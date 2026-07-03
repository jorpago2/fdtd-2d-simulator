"use strict";

(function initFdtdCanvasSurfaceThreeRenderer(global) {
  const scriptUrl = global.document?.currentScript?.src || global.location?.href || "./";
  const THREE_MODULE_URL = new URL("../../../assets/vendor/three/three.module.min.js?v=0.185.1", scriptUrl).href;
  const RUNNING_TARGET = Object.freeze({ colDivisor: 14, rowDivisor: 14, minCols: 42, minRows: 30, maxCols: 88, maxRows: 64 });
  const STILL_TARGET = Object.freeze({ colDivisor: 8, rowDivisor: 8, minCols: 64, minRows: 46, maxCols: 176, maxRows: 128 });
  const SURFACE_X_SCALE = 1.34;
  const SURFACE_Y_SCALE = 0.82;
  const SURFACE_SKEW_SCALE = 0.34;
  const SURFACE_Z_SCALE = 0.52;
  const SURFACE_HEIGHT_SCALE = 0.34;
  const RUNNING_FRAME_REUSE_INTERVAL = 2;

  let threeModulePromise = null;
  const rendererStats = {
    loadState: "idle",
    frames: 0,
    reusedFrames: 0,
    lastGrid: "",
    lastError: "",
  };

  function loadThreeModule() {
    if (!threeModulePromise) {
      rendererStats.loadState = "loading";
      threeModulePromise = import(THREE_MODULE_URL).catch((error) => {
        console.warn("Three.js surface renderer could not be loaded.", error);
        rendererStats.loadState = "failed";
        rendererStats.lastError = error?.message || String(error);
        return null;
      });
    }
    return threeModulePromise;
  }

  function finitePositive(value, fallback) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function sampledAxis(start, end, step, upperBound) {
    const axis = [];
    for (let value = start; value < end; value += step) axis.push(Math.min(value, upperBound));
    if (axis.length === 0 || axis[axis.length - 1] < end) axis.push(Math.min(end, upperBound));
    return axis;
  }

  function makeSurfaceGrid(sim, width, height, dpr) {
    const viewW = finitePositive(sim.visibleGridWidth(), sim.nx);
    const viewH = finitePositive(sim.visibleGridHeight(), sim.ny);
    const target = state.running ? RUNNING_TARGET : STILL_TARGET;
    const targetCols = clampInt(width / (target.colDivisor * dpr), target.minCols, target.maxCols);
    const targetRows = clampInt(height / (target.rowDivisor * dpr), target.minRows, target.maxRows);
    const stepX = Math.max(1, Math.ceil(viewW / targetCols));
    const stepY = Math.max(1, Math.ceil(viewH / targetRows));
    const x0 = sim.viewX;
    const y0 = sim.viewY;
    const x1 = sim.viewX + viewW;
    const y1 = sim.viewY + viewH;
    const aspect = width / Math.max(1, height);
    const narrowViewport = aspect < 0.7;
    return {
      xs: sampledAxis(x0, x1, stepX, sim.nx),
      ys: sampledAxis(y0, y1, stepY, sim.ny),
      invViewW: 1 / Math.max(1e-9, viewW),
      invViewH: 1 / Math.max(1e-9, viewH),
      surfaceScaleX: narrowViewport ? 0.72 : 1,
      surfaceScaleY: narrowViewport ? 0.86 : 1,
    };
  }

  function surfacePoint(sim, grid, x, y, mapped, out, offset) {
    const u = (x - sim.viewX) * grid.invViewW - 0.5;
    const v = (y - sim.viewY) * grid.invViewH - 0.5;
    out[offset] = (u * SURFACE_X_SCALE + v * SURFACE_SKEW_SCALE) * grid.surfaceScaleX;
    out[offset + 1] = (-v * SURFACE_Y_SCALE + mapped * SURFACE_HEIGHT_SCALE) * grid.surfaceScaleY;
    out[offset + 2] = v * SURFACE_Z_SCALE;
  }

  function colorContextFor(sim, surfaceContext) {
    if (surfaceContext.kind === "material") {
      const material = surfaceContext.material;
      const signed = state.materialPart === "imag" || (material.min < material.center && material.max > material.center);
      const mapName = currentMaterialColormapName(material);
      return {
        kind: "material",
        signed,
        lut: cmasherColorLut(mapName, signed),
      };
    }

    const magnitude = sim.fieldDisplayIsMagnitude();
    const mapName = currentFieldColormapName(magnitude);
    return {
      kind: "field",
      signed: !magnitude,
      lut: cmasherColorLut(mapName, !magnitude),
    };
  }

  function writeColor(sample, mapped, shade, colorContext, colors, offset) {
    if (sample.material === 2) {
      colors[offset] = 7 / 255;
      colors[offset + 1] = 8 / 255;
      colors[offset + 2] = 11 / 255;
      return;
    }
    const t = colorContext.signed ? 0.5 + 0.5 * clamp(mapped, -1, 1) : clamp(mapped, 0, 1);
    const colorIndex = clamp(Math.round(t * CMASHER_LUT_LAST), 0, CMASHER_LUT_LAST) * 3;
    colors[offset] = clamp(colorContext.lut[colorIndex] * shade, 0, 255) / 255;
    colors[offset + 1] = clamp(colorContext.lut[colorIndex + 1] * shade, 0, 255) / 255;
    colors[offset + 2] = clamp(colorContext.lut[colorIndex + 2] * shade, 0, 255) / 255;
  }

  function fillIndices(indices, cols, rows) {
    let indexOffset = 0;
    for (let row = 0; row < rows - 1; row += 1) {
      for (let col = 0; col < cols - 1; col += 1) {
        const a = row * cols + col;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        indices[indexOffset] = a;
        indices[indexOffset + 1] = c;
        indices[indexOffset + 2] = b;
        indices[indexOffset + 3] = b;
        indices[indexOffset + 4] = c;
        indices[indexOffset + 5] = d;
        indexOffset += 6;
      }
    }
  }

  class FdtdCanvasSurfaceThreeRenderer {
    constructor() {
      this.THREE = null;
      this.loadStarted = false;
      this.unavailable = false;
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.geometry = null;
      this.material = null;
      this.mesh = null;
      this.canvas = null;
      this.positions = null;
      this.colors = null;
      this.shapeKey = "";
      this.lastFrameKey = "";
      this.runningReuseCounter = 0;
    }

    startLoading(sim) {
      if (this.loadStarted || this.unavailable) return;
      this.loadStarted = true;
      loadThreeModule().then((module) => {
        if (!module?.WebGLRenderer || !module?.BufferGeometry) {
          this.unavailable = true;
          rendererStats.loadState = "unavailable";
          rendererStats.lastError = "Three.js module did not expose the expected WebGL renderer API.";
          return;
        }
        this.THREE = module;
        rendererStats.loadState = "ready";
        if (state.viewProjection === "3d" && !state.running && typeof sim?.render === "function") {
          sim.render();
        }
      });
    }

    ensureCanvas(sim) {
      const nextCanvas = sim.surfaceCanvas || this.canvas || global.document?.createElement?.("canvas") || null;
      if (!nextCanvas) return null;
      if (this.renderer && this.canvas !== nextCanvas) {
        this.renderer.dispose();
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.geometry = null;
        this.material = null;
        this.mesh = null;
        this.positions = null;
        this.colors = null;
        this.shapeKey = "";
      }
      this.canvas = nextCanvas;
      return this.canvas;
    }

    frameKey(sim) {
      return [
        sim.canvas.width,
        sim.canvas.height,
        sim.viewX,
        sim.viewY,
        sim.viewZoom,
        state.viewMode,
        state.fieldDisplay,
        state.fieldComponent,
        state.materialPart,
      ].join("|");
    }

    reuseFrame(sim) {
      if (!state.running || !this.THREE || this.unavailable || !this.renderer || !this.lastFrameKey) return false;
      if (this.frameKey(sim) !== this.lastFrameKey) {
        this.runningReuseCounter = 0;
        return false;
      }
      this.runningReuseCounter = (this.runningReuseCounter + 1) % RUNNING_FRAME_REUSE_INTERVAL;
      if (this.runningReuseCounter === 0) return false;
      rendererStats.reusedFrames += 1;
      return true;
    }

    ensureRenderer(width, height, canvas) {
      if (!this.THREE || !this.canvas || this.unavailable) return false;
      const THREE = this.THREE;

      if (!this.renderer) {
        try {
          this.renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: false,
            depth: true,
            powerPreference: "high-performance",
          });
        } catch (error) {
          console.warn("Three.js surface renderer is not available in this browser.", error);
          this.unavailable = true;
          rendererStats.loadState = "unavailable";
          rendererStats.lastError = error?.message || String(error);
          return false;
        }
        this.renderer.setPixelRatio(1);
        this.renderer.setClearColor(0x000000, 0);
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        this.camera.position.set(0, 0, 3);
        this.camera.lookAt(0, 0, 0);
        this.geometry = new THREE.BufferGeometry();
        this.material = new THREE.MeshBasicMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          depthTest: true,
          depthWrite: true,
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        this.scene.add(this.mesh);
      }

      const renderWidth = Math.max(1, Math.floor(width));
      const renderHeight = Math.max(1, Math.floor(height));
      if (this.canvas.width !== renderWidth || this.canvas.height !== renderHeight) {
        this.renderer.setSize(renderWidth, renderHeight, false);
      }

      const aspect = renderWidth / Math.max(1, renderHeight);
      const xExtent = aspect >= 1 ? 1.2 * aspect : 1.2;
      const yExtent = aspect >= 1 ? 1.02 : 1.02 / Math.max(0.45, aspect);
      this.camera.left = -xExtent;
      this.camera.right = xExtent;
      this.camera.top = yExtent;
      this.camera.bottom = -yExtent;
      this.camera.updateProjectionMatrix();
      return true;
    }

    ensureGeometry(cols, rows) {
      const THREE = this.THREE;
      const vertexCount = cols * rows;
      const indexCount = Math.max(0, (cols - 1) * (rows - 1) * 6);
      const nextShapeKey = `${cols}x${rows}`;

      if (!this.positions || this.positions.length !== vertexCount * 3) {
        this.positions = new Float32Array(vertexCount * 3);
        this.colors = new Float32Array(vertexCount * 3);
        this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
      }

      if (this.shapeKey !== nextShapeKey) {
        const indices = vertexCount <= 65535 ? new Uint16Array(indexCount) : new Uint32Array(indexCount);
        fillIndices(indices, cols, rows);
        this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        this.shapeKey = nextShapeKey;
      }
    }

    drawBackground(sim) {
      const ctx = sim.ctx;
      const width = sim.canvas.width;
      const height = sim.canvas.height;
      const background = ctx.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, "rgb(3, 5, 9)");
      background.addColorStop(0.58, "rgb(7, 8, 13)");
      background.addColorStop(1, "rgb(0, 0, 0)");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }

    render(sim) {
      if (this.unavailable) return false;
      if (!this.THREE) {
        this.startLoading(sim);
        return false;
      }

      const width = sim.canvas.width;
      const height = sim.canvas.height;
      const dpr = Math.max(1, global.devicePixelRatio || 1);
      const canvas = this.ensureCanvas(sim);
      const renderingToDisplayCanvas = canvas === sim.surfaceCanvas;
      if (!this.ensureRenderer(width, height, canvas)) return false;
      if (renderingToDisplayCanvas) {
        canvas.hidden = false;
      }

      const surfaceContext = sim.surfaceRenderContext();
      const colorContext = colorContextFor(sim, surfaceContext);
      const grid = makeSurfaceGrid(sim, width, height, dpr);
      const cols = grid.xs.length;
      const rows = grid.ys.length;
      if (cols < 2 || rows < 2) return false;

      this.ensureGeometry(cols, rows);

      let vertexOffset = 0;
      for (let row = 0; row < rows; row += 1) {
        const y = grid.ys[row];
        const rowLight = 0.86 + (row / Math.max(1, rows - 1)) * 0.12;
        for (let col = 0; col < cols; col += 1) {
          const x = grid.xs[col];
          const sample = sim.surfaceSample(x, y, surfaceContext);
          const mapped = Number.isFinite(sample.mapped) ? sample.mapped : 0;
          const shade = clamp(rowLight + Math.max(0, mapped) * 0.08, 0.62, 1.08);
          surfacePoint(sim, grid, x, y, mapped, this.positions, vertexOffset);
          writeColor(sample, mapped, shade, colorContext, this.colors, vertexOffset);
          vertexOffset += 3;
        }
      }

      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
      if (!renderingToDisplayCanvas) {
        this.drawBackground(sim);
      }
      this.renderer.render(this.scene, this.camera);
      if (!renderingToDisplayCanvas) {
        sim.ctx.drawImage(this.canvas, 0, 0, width, height);
      }
      rendererStats.frames += 1;
      rendererStats.lastGrid = `${cols}x${rows}`;
      this.lastFrameKey = this.frameKey(sim);
      this.runningReuseCounter = 0;
      return true;
    }
  }

  global.FdtdCanvasSurfaceThreeRenderer = Object.freeze({
    createRenderer: () => new FdtdCanvasSurfaceThreeRenderer(),
    loadThreeModule,
    status: () => ({ ...rendererStats }),
  });
})(window);
