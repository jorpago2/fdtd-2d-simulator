(function initFdtdCanvasFieldWebglRenderer(global) {
  "use strict";

  const RENDER_MODE_FIELD = 0;
  const RENDER_MODE_MATERIAL = 1;
  const REQUIRED_TEXTURE_UNITS = 8;
  const FIELD_TEXTURE_UNITS = Object.freeze({
    ez: 0,
    hx: 1,
    hy: 2,
    dualEz: 3,
    dualHx: 4,
    dualHy: 5,
  });
  const MATERIAL_TEXTURE_UNIT = 6;
  const LUT_TEXTURE_UNIT = 7;
  const FIELD_QUANTITY_MODE = Object.freeze({
    scalar: 0,
    transverseX: 1,
    transverseY: 2,
    electricMag: 3,
    magneticMag: 4,
    poyntingMag: 5,
    poyntingX: 6,
    poyntingY: 7,
  });
  const FIELD_TEXTURE_KEYS = Object.freeze(["ez", "hx", "hy", "dualEz", "dualHx", "dualHy"]);

  const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
uniform vec2 u_texOrigin;
uniform vec2 u_texSpan;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = u_texOrigin + a_texCoord * u_texSpan;
}`;

  const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_ezTex;
uniform sampler2D u_hxTex;
uniform sampler2D u_hyTex;
uniform sampler2D u_dualEzTex;
uniform sampler2D u_dualHxTex;
uniform sampler2D u_dualHyTex;
uniform sampler2D u_materialTex;
uniform sampler2D u_lutTex;
uniform int u_renderMode;
uniform int u_quantityMode;
uniform float u_scale;
uniform bool u_fieldMagnitude;
uniform bool u_fieldComponentHz;
uniform bool u_fullVectorBianisotropy;
uniform bool u_materialSigned;
uniform float u_materialCenter;
uniform float u_materialMin;
uniform float u_materialMax;
uniform float u_materialSpan;
uniform float u_lutSize;
out vec4 outColor;

float safeValue(float value) {
  return value == value && abs(value) < 1.0e30 ? value : 0.0;
}

float ezValue() {
  return safeValue(texture(u_ezTex, v_texCoord).r);
}

float hxValue() {
  return safeValue(texture(u_hxTex, v_texCoord).r);
}

float hyValue() {
  return safeValue(texture(u_hyTex, v_texCoord).r);
}

float dualEzValue() {
  return safeValue(texture(u_dualEzTex, v_texCoord).r);
}

float dualHxValue() {
  return safeValue(texture(u_dualHxTex, v_texCoord).r);
}

float dualHyValue() {
  return safeValue(texture(u_dualHyTex, v_texCoord).r);
}

float lutCoordinate(float colorT) {
  float index = floor(clamp(colorT, 0.0, 1.0) * (u_lutSize - 1.0) + 0.5);
  return (index + 0.5) / u_lutSize;
}

vec3 lutColor(float colorT) {
  return texture(u_lutTex, vec2(lutCoordinate(colorT), 0.5)).rgb;
}

vec3 fieldMaterialTint(vec3 color, int materialId) {
  if (materialId == 1) return color * 0.78 + vec3(36.0, 62.0, 42.0) / 255.0;
  if (materialId == 2) return vec3(8.0, 11.0, 13.0) / 255.0;
  if (materialId == 3) return color * 0.72 + vec3(92.0, 48.0, 12.0) / 255.0;
  if (materialId == 4) return color * 0.52 + vec3(18.0, 24.0, 74.0) / 255.0;
  if (materialId == 5) return color * 0.84 + vec3(26.0, 42.0, 52.0) / 255.0;
  return color;
}

float materialMappedValue(float value) {
  if (value >= u_materialCenter) {
    float denom = max(abs(u_materialMax - u_materialCenter), 1.0e-9);
    return (value - u_materialCenter) / denom;
  }
  float denom = max(abs(u_materialCenter - u_materialMin), 1.0e-9);
  return (value - u_materialCenter) / denom;
}

vec2 poyntingValue() {
  float ez = ezValue();
  float hx = hxValue();
  float hy = hyValue();
  if (u_fieldComponentHz) {
    if (u_fullVectorBianisotropy) {
      float dualEz = dualEzValue();
      return vec2(hy * ez - dualEz * dualHyValue(), dualEz * dualHxValue() - hx * ez);
    }
    return vec2(hy * ez, -hx * ez);
  }
  return vec2(-ez * hy, ez * hx);
}

float fieldQuantityValue() {
  if (u_quantityMode == 0) return ezValue();
  if (u_quantityMode == 1) return hxValue();
  if (u_quantityMode == 2) return hyValue();
  if (u_quantityMode == 3) {
    if (u_fieldComponentHz) {
      if (u_fullVectorBianisotropy) return length(vec3(hxValue(), hyValue(), dualEzValue()));
      return length(vec2(hxValue(), hyValue()));
    }
    return abs(ezValue());
  }
  if (u_quantityMode == 4) {
    if (u_fieldComponentHz) {
      if (u_fullVectorBianisotropy) return length(vec3(ezValue(), dualHxValue(), dualHyValue()));
      return abs(ezValue());
    }
    return length(vec2(hxValue(), hyValue()));
  }

  vec2 s = poyntingValue();
  if (u_quantityMode == 6) return s.x;
  if (u_quantityMode == 7) return s.y;
  return length(s);
}

void main() {
  int materialId = int(floor(texture(u_materialTex, v_texCoord).r * 255.0 + 0.5));

  if (u_renderMode == 1) {
    float value = ezValue();
    if (materialId == 2) {
      outColor = vec4(vec3(8.0, 11.0, 13.0) / 255.0, 1.0);
      return;
    }
    float mapped = clamp(materialMappedValue(value), -1.0, 1.0);
    float colorT = u_materialSigned
      ? 0.5 + 0.5 * mapped
      : clamp((value - u_materialMin) / max(u_materialSpan, 1.0e-9), 0.0, 1.0);
    outColor = vec4(lutColor(colorT), 1.0);
    return;
  }

  float value = fieldQuantityValue();
  float rawMapped = value * u_scale;
  float mapped = u_fieldMagnitude ? clamp(rawMapped, 0.0, 1.0) : clamp(rawMapped, -1.0, 1.0);
  float colorT = u_fieldMagnitude ? mapped : 0.5 + 0.5 * mapped;
  outColor = vec4(fieldMaterialTint(lutColor(colorT), materialId), 1.0);
}`;

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) || "Unknown shader compile error";
      gl.deleteShader(shader);
      throw new Error(info);
    }
    return shader;
  }

  function createProgram(gl) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) || "Unknown shader link error";
      gl.deleteProgram(program);
      throw new Error(info);
    }
    return program;
  }

  function createTexture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  function rgbaLutFromRgb(rgbLut) {
    const rgba = new Uint8Array(CMASHER_LUT_SIZE * 4);
    for (let i = 0; i < CMASHER_LUT_SIZE; i += 1) {
      const rgbIndex = i * 3;
      const rgbaIndex = i * 4;
      rgba[rgbaIndex] = rgbLut[rgbIndex];
      rgba[rgbaIndex + 1] = rgbLut[rgbIndex + 1];
      rgba[rgbaIndex + 2] = rgbLut[rgbIndex + 2];
      rgba[rgbaIndex + 3] = 255;
    }
    return rgba;
  }

  function fieldArray(sim, key) {
    return sim[key] || sim.ez;
  }

  function hasFullVectorBianisotropy(sim) {
    return Boolean(sim.fullVectorBianisotropyActive?.());
  }

  function materialValuesChangeWithTime() {
    return Boolean(state.materialModulationEnabled || state.materialNonlinearEnabled || state.materialPhaseChangeEnabled);
  }

  function materialContextArrayKey(sim, materialContext) {
    const values = materialContext?.values;
    if (values === sim.eps) return "eps";
    if (values === sim.loss) return "loss";
    if (values === sim.mu) return "mu";
    if (values === sim.muLoss) return "muLoss";
    return "unknown";
  }

  function materialTextureCacheKey(sim) {
    return `material|${sim.nx}x${sim.ny}|${Number(sim.materialTextureRevision) || 0}`;
  }

  function materialValueTextureCacheKey(sim, materialContext) {
    if (materialValuesChangeWithTime()) return null;
    return `materialValue|${materialContextArrayKey(sim, materialContext)}|${sim.nx}x${sim.ny}|${Number(sim.materialValueRevision) || 0}`;
  }

  function fieldQuantityDescriptor(sim) {
    const fieldComponentHz = state.fieldComponent === "hz";
    const fullVector = hasFullVectorBianisotropy(sim);
    if (state.viewMode === "poynting") {
      const mode =
        state.fieldDisplay === "transverseX"
          ? FIELD_QUANTITY_MODE.poyntingX
          : state.fieldDisplay === "transverseY"
            ? FIELD_QUANTITY_MODE.poyntingY
            : FIELD_QUANTITY_MODE.poyntingMag;
      const requiredTextures = fieldComponentHz && fullVector
        ? ["ez", "hx", "hy", "dualEz", "dualHx", "dualHy"]
        : ["ez", "hx", "hy"];
      return {
        mode,
        magnitude: mode === FIELD_QUANTITY_MODE.poyntingMag,
        requiredTextures,
        renderLabel: "WebGL2 Poynting map",
      };
    }

    if (state.viewMode !== "field") return null;
    if (state.fieldDisplay === "transverseX") {
      return {
        mode: FIELD_QUANTITY_MODE.transverseX,
        magnitude: false,
        requiredTextures: ["hx"],
        renderLabel: "WebGL2 field map",
      };
    }
    if (state.fieldDisplay === "transverseY") {
      return {
        mode: FIELD_QUANTITY_MODE.transverseY,
        magnitude: false,
        requiredTextures: ["hy"],
        renderLabel: "WebGL2 field map",
      };
    }
    if (state.fieldDisplay === "electricMag") {
      return {
        mode: FIELD_QUANTITY_MODE.electricMag,
        magnitude: true,
        requiredTextures: fieldComponentHz
          ? fullVector
            ? ["hx", "hy", "dualEz"]
            : ["hx", "hy"]
          : ["ez"],
        renderLabel: "WebGL2 field magnitude",
      };
    }
    if (state.fieldDisplay === "magneticMag") {
      return {
        mode: FIELD_QUANTITY_MODE.magneticMag,
        magnitude: true,
        requiredTextures: fieldComponentHz
          ? fullVector
            ? ["ez", "dualHx", "dualHy"]
            : ["ez"]
          : ["hx", "hy"],
        renderLabel: "WebGL2 field magnitude",
      };
    }
    return {
      mode: FIELD_QUANTITY_MODE.scalar,
      magnitude: false,
      requiredTextures: ["ez"],
      renderLabel: "WebGL2 field map",
    };
  }

  function materialValueArray(sim) {
    if (state.viewMode !== "epsilon" && state.viewMode !== "mu") return null;
    return sim.materialViewContext();
  }

  function backgroundColor() {
    return state.theme === "dark" ? [3 / 255, 8 / 255, 12 / 255, 1] : [235 / 255, 244 / 255, 248 / 255, 1];
  }

  class FieldWebglRenderer {
    constructor(documentRef = global.document, options = {}) {
      this.canvas = options.canvas || documentRef.createElement("canvas");
      this.gl = this.canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: true,
      });
      if (!this.gl) throw new Error("WebGL2 is not available.");

      const gl = this.gl;
      const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
      if (maxTextureUnits < REQUIRED_TEXTURE_UNITS) {
        throw new Error(`WebGL2 exposes ${maxTextureUnits} texture units; ${REQUIRED_TEXTURE_UNITS} are required.`);
      }

      this.program = createProgram(gl);
      this.textures = {
        ez: createTexture(gl),
        hx: createTexture(gl),
        hy: createTexture(gl),
        dualEz: createTexture(gl),
        dualHx: createTexture(gl),
        dualHy: createTexture(gl),
        material: createTexture(gl),
        lut: createTexture(gl),
      };
      this.textureSizes = new Map();
      this.textureUploadKeys = new Map();
      this.lutKey = "";
      this.lastRenderMode = "none";
      this.installGeometry();
      this.readUniformLocations();
    }

    installGeometry() {
      const gl = this.gl;
      const vertices = new Float32Array([
        -1, -1, 0, 1,
         1, -1, 1, 1,
        -1,  1, 0, 0,
        -1,  1, 0, 0,
         1, -1, 1, 1,
         1,  1, 1, 0,
      ]);
      const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      gl.useProgram(this.program);
      const positionLocation = gl.getAttribLocation(this.program, "a_position");
      const texCoordLocation = gl.getAttribLocation(this.program, "a_texCoord");
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(texCoordLocation);
      gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    }

    readUniformLocations() {
      const gl = this.gl;
      const uniform = (name) => gl.getUniformLocation(this.program, name);
      this.uniforms = {
        ezTex: uniform("u_ezTex"),
        hxTex: uniform("u_hxTex"),
        hyTex: uniform("u_hyTex"),
        dualEzTex: uniform("u_dualEzTex"),
        dualHxTex: uniform("u_dualHxTex"),
        dualHyTex: uniform("u_dualHyTex"),
        materialTex: uniform("u_materialTex"),
        lutTex: uniform("u_lutTex"),
        renderMode: uniform("u_renderMode"),
        quantityMode: uniform("u_quantityMode"),
        scale: uniform("u_scale"),
        fieldMagnitude: uniform("u_fieldMagnitude"),
        fieldComponentHz: uniform("u_fieldComponentHz"),
        fullVectorBianisotropy: uniform("u_fullVectorBianisotropy"),
        materialSigned: uniform("u_materialSigned"),
        materialCenter: uniform("u_materialCenter"),
        materialMin: uniform("u_materialMin"),
        materialMax: uniform("u_materialMax"),
        materialSpan: uniform("u_materialSpan"),
        lutSize: uniform("u_lutSize"),
        texOrigin: uniform("u_texOrigin"),
        texSpan: uniform("u_texSpan"),
      };
    }

    ensureSize(width, height) {
      width = Math.max(1, Math.floor(width));
      height = Math.max(1, Math.floor(height));
      if (this.canvas.width !== width) this.canvas.width = width;
      if (this.canvas.height !== height) this.canvas.height = height;
    }

    prepareRenderTarget(sim, options = {}) {
      const targetWidth = options.targetWidth || this.canvas.width || sim.nx;
      const targetHeight = options.targetHeight || this.canvas.height || sim.ny;
      this.ensureSize(targetWidth, targetHeight);

      const gl = this.gl;
      const [r, g, b, a] = backgroundColor();
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(r, g, b, a);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const viewport = options.viewport || {
        left: 0,
        top: 0,
        width: this.canvas.width,
        height: this.canvas.height,
      };
      const viewportX = Math.max(0, Math.round(viewport.left));
      const viewportY = Math.max(0, Math.round(this.canvas.height - viewport.top - viewport.height));
      const viewportWidth = Math.max(1, Math.round(viewport.width));
      const viewportHeight = Math.max(1, Math.round(viewport.height));
      gl.viewport(viewportX, viewportY, viewportWidth, viewportHeight);

      if (options.viewport) {
        return {
          texOriginX: this.safeTextureCoordinate(sim.viewX, sim.nx),
          texOriginY: this.safeTextureCoordinate(sim.viewY, sim.ny),
          texSpanX: this.safeTextureCoordinate(sim.visibleGridWidth(), sim.nx),
          texSpanY: this.safeTextureCoordinate(sim.visibleGridHeight(), sim.ny),
        };
      }
      return {
        texOriginX: 0,
        texOriginY: 0,
        texSpanX: 1,
        texSpanY: 1,
      };
    }

    safeTextureCoordinate(value, size) {
      return Math.max(0, Math.min(1, value / Math.max(1, size || 1)));
    }

    bindTexture(texture, textureUnit) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0 + textureUnit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    textureHasSize(texture, width, height) {
      const size = this.textureSizes.get(texture);
      return size?.width === width && size?.height === height;
    }

    rememberTextureSize(texture, width, height) {
      this.textureSizes.set(texture, { width, height });
    }

    textureCacheKeyMatches(texture, cacheKey) {
      return cacheKey != null && this.textureUploadKeys.get(texture) === cacheKey;
    }

    rememberTextureUpload(texture, cacheKey) {
      if (cacheKey == null) this.textureUploadKeys.delete(texture);
      else this.textureUploadKeys.set(texture, cacheKey);
    }

    uploadFloatTexture(texture, textureUnit, width, height, values, cacheKey = null) {
      const gl = this.gl;
      this.bindTexture(texture, textureUnit);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      if (!this.textureHasSize(texture, width, height)) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, values);
        this.rememberTextureSize(texture, width, height);
        this.rememberTextureUpload(texture, cacheKey);
      } else if (!this.textureCacheKeyMatches(texture, cacheKey)) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RED, gl.FLOAT, values);
        this.rememberTextureUpload(texture, cacheKey);
      }
    }

    uploadMaterialTexture(sim) {
      const gl = this.gl;
      const cacheKey = materialTextureCacheKey(sim);
      this.bindTexture(this.textures.material, MATERIAL_TEXTURE_UNIT);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      if (!this.textureHasSize(this.textures.material, sim.nx, sim.ny)) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, sim.nx, sim.ny, 0, gl.RED, gl.UNSIGNED_BYTE, sim.material);
        this.rememberTextureSize(this.textures.material, sim.nx, sim.ny);
        this.rememberTextureUpload(this.textures.material, cacheKey);
      } else if (!this.textureCacheKeyMatches(this.textures.material, cacheKey)) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, sim.nx, sim.ny, gl.RED, gl.UNSIGNED_BYTE, sim.material);
        this.rememberTextureUpload(this.textures.material, cacheKey);
      }
    }

    uploadLut(name, signed) {
      const key = `${name}|${signed ? 1 : 0}`;
      if (key === this.lutKey) return;
      const gl = this.gl;
      const rgba = rgbaLutFromRgb(cmasherColorLut(name, signed));
      this.bindTexture(this.textures.lut, LUT_TEXTURE_UNIT);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CMASHER_LUT_SIZE, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      this.lutKey = key;
    }

    uploadFieldTextures(sim, requiredTextureKeys) {
      const required = new Set(requiredTextureKeys);
      const primaryKey = requiredTextureKeys[0] || "ez";
      for (const key of required) {
        this.uploadFloatTexture(this.textures[key], FIELD_TEXTURE_UNITS[key], sim.nx, sim.ny, fieldArray(sim, key));
      }
      const primaryTexture = this.textures[primaryKey] || this.textures.ez;
      for (const key of FIELD_TEXTURE_KEYS) {
        if (!required.has(key)) this.bindTexture(primaryTexture, FIELD_TEXTURE_UNITS[key]);
      }
    }

    setCommonUniforms(renderMode, target) {
      const gl = this.gl;
      gl.useProgram(this.program);
      gl.uniform1i(this.uniforms.ezTex, FIELD_TEXTURE_UNITS.ez);
      gl.uniform1i(this.uniforms.hxTex, FIELD_TEXTURE_UNITS.hx);
      gl.uniform1i(this.uniforms.hyTex, FIELD_TEXTURE_UNITS.hy);
      gl.uniform1i(this.uniforms.dualEzTex, FIELD_TEXTURE_UNITS.dualEz);
      gl.uniform1i(this.uniforms.dualHxTex, FIELD_TEXTURE_UNITS.dualHx);
      gl.uniform1i(this.uniforms.dualHyTex, FIELD_TEXTURE_UNITS.dualHy);
      gl.uniform1i(this.uniforms.materialTex, MATERIAL_TEXTURE_UNIT);
      gl.uniform1i(this.uniforms.lutTex, LUT_TEXTURE_UNIT);
      gl.uniform1i(this.uniforms.renderMode, renderMode);
      gl.uniform1f(this.uniforms.lutSize, CMASHER_LUT_SIZE);
      gl.uniform2f(this.uniforms.texOrigin, target.texOriginX, target.texOriginY);
      gl.uniform2f(this.uniforms.texSpan, target.texSpanX, target.texSpanY);
    }

    setNeutralMaterialUniforms() {
      const gl = this.gl;
      gl.uniform1i(this.uniforms.materialSigned, 0);
      gl.uniform1f(this.uniforms.materialCenter, 1);
      gl.uniform1f(this.uniforms.materialMin, 0);
      gl.uniform1f(this.uniforms.materialMax, 1);
      gl.uniform1f(this.uniforms.materialSpan, 1);
    }

    draw() {
      const gl = this.gl;
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      const error = gl.getError();
      if (error !== gl.NO_ERROR) {
        throw new Error(`WebGL field renderer failed with error ${error}.`);
      }
    }

    renderField(sim, descriptor, target) {
      const scale = sim.fieldRenderScale();
      const fieldMapName = currentFieldColormapName(descriptor.magnitude);
      this.uploadLut(fieldMapName, !descriptor.magnitude);
      this.uploadFieldTextures(sim, descriptor.requiredTextures);
      this.uploadMaterialTexture(sim);
      this.setCommonUniforms(RENDER_MODE_FIELD, target);
      const gl = this.gl;
      gl.uniform1i(this.uniforms.quantityMode, descriptor.mode);
      gl.uniform1f(this.uniforms.scale, scale);
      gl.uniform1i(this.uniforms.fieldMagnitude, descriptor.magnitude ? 1 : 0);
      gl.uniform1i(this.uniforms.fieldComponentHz, state.fieldComponent === "hz" ? 1 : 0);
      gl.uniform1i(this.uniforms.fullVectorBianisotropy, hasFullVectorBianisotropy(sim) ? 1 : 0);
      this.setNeutralMaterialUniforms();
      this.draw();
      this.lastRenderMode = descriptor.renderLabel;
    }

    renderMaterial(sim, materialContext, target) {
      const materialMapName = currentMaterialColormapName(materialContext);
      const materialMapSigned =
        state.materialPart === "imag" || (materialContext.min < materialContext.center && materialContext.max > materialContext.center);
      this.uploadLut(materialMapName, materialMapSigned);
      this.uploadFloatTexture(
        this.textures.ez,
        FIELD_TEXTURE_UNITS.ez,
        sim.nx,
        sim.ny,
        materialContext.values,
        materialValueTextureCacheKey(sim, materialContext)
      );
      for (const key of FIELD_TEXTURE_KEYS) {
        if (key !== "ez") this.bindTexture(this.textures.ez, FIELD_TEXTURE_UNITS[key]);
      }
      this.uploadMaterialTexture(sim);
      this.setCommonUniforms(RENDER_MODE_MATERIAL, target);
      const gl = this.gl;
      gl.uniform1i(this.uniforms.quantityMode, FIELD_QUANTITY_MODE.scalar);
      gl.uniform1f(this.uniforms.scale, 1);
      gl.uniform1i(this.uniforms.fieldMagnitude, 0);
      gl.uniform1i(this.uniforms.fieldComponentHz, state.fieldComponent === "hz" ? 1 : 0);
      gl.uniform1i(this.uniforms.fullVectorBianisotropy, 0);
      gl.uniform1i(this.uniforms.materialSigned, materialMapSigned ? 1 : 0);
      gl.uniform1f(this.uniforms.materialCenter, materialContext.center);
      gl.uniform1f(this.uniforms.materialMin, materialContext.min);
      gl.uniform1f(this.uniforms.materialMax, materialContext.max);
      gl.uniform1f(this.uniforms.materialSpan, Math.max(1e-9, materialContext.max - materialContext.min));
      this.draw();
      this.lastRenderMode = "WebGL2 material map";
    }

    render(sim, options = {}) {
      if (state.viewProjection !== "2d") return false;
      const fieldDescriptor = fieldQuantityDescriptor(sim);
      const materialContext = fieldDescriptor ? null : materialValueArray(sim);
      if (!fieldDescriptor && !materialContext) return false;

      const target = this.prepareRenderTarget(sim, options);
      if (fieldDescriptor) this.renderField(sim, fieldDescriptor, target);
      else this.renderMaterial(sim, materialContext, target);
      return true;
    }
  }

  function createRenderer(options = {}) {
    return new FieldWebglRenderer(options.documentRef || global.document, options);
  }

  global.FdtdCanvasFieldWebglRenderer = Object.freeze({
    createRenderer,
  });
})(window);
