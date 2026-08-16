import { useEffect, useRef, useState } from "react";
import { CarbonButton, CarbonField, CarbonInput, CarbonSelect } from "./carbon-primitives";
import { CarbonDisclosure } from "./carbon-disclosures";
import { ScientificSlider } from "./scientific-slider-control";
import { BoundaryConditionSwitcher } from "./visual-controls";
import { runtimeState, useFdtdRuntimeSelector } from "./runtime-state";

type SourceEditorSnapshot = {
  source: {
    type: string;
    shape: string;
    xLambda: number;
    yLambda: number;
    multipoleOrder: number;
    multipolePhase: string;
  };
  mode: string;
  title: string;
  hint: string;
  widthEnabled: boolean;
  angleEnabled: boolean;
  multipoleEnabled: boolean;
  minX: string;
  maxX: string;
  minY: string;
  maxY: string;
};

type MonitorEditorSnapshot = {
  monitor: { quantity: string; xLambda: number; yLambda: number };
  mode: string;
  title: string;
  hint: string;
  minX: string;
  maxX: string;
  minY: string;
  maxY: string;
};

function useEditorSnapshot<T>(eventName: string, initial: T) {
  const [snapshot, setSnapshot] = useState(initial);
  const signature = useRef(JSON.stringify(initial));
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<T>).detail;
      const nextSignature = JSON.stringify(detail);
      if (nextSignature === signature.current) return;
      signature.current = nextSignature;
      setSnapshot(detail);
    };
    window.addEventListener(eventName, update);
    return () => window.removeEventListener(eventName, update);
  }, [eventName]);
  return [snapshot, setSnapshot] as const;
}

function MaterialWarning() {
  const [warning, setWarning] = useState("");
  useEffect(() => {
    const sync = (event: Event) => setWarning(String((event as CustomEvent<{ warning?: unknown }>).detail?.warning ?? ""));
    window.addEventListener("fdtd:material-warning", sync);
    return () => window.removeEventListener("fdtd:material-warning", sync);
  }, []);
  return <output id="materialWarning" className="material-warning brush-material-warning" aria-live="polite" hidden={!warning}>{warning}</output>;
}



export function CanvasContextMenu() {
  return (
            <div
              id="canvasContextMenu"
              className="source-menu context-choice-menu"
              role="region"
              aria-labelledby="canvasContextMenuTitle"
              aria-describedby="canvasContextMenuHint"
              hidden
            >
              <div className="source-menu-header">
                <div>
                  <p id="canvasContextMenuHint" className="source-menu-hint">x / λ<sub>0</sub> 1.20, y / λ<sub>0</sub> 3.00</p>
                  <h2 id="canvasContextMenuTitle">Add element</h2>
                </div>
                <CarbonButton id="canvasContextCloseBtn" className="icon-button compact-button" data-carbon-icon-only="true" type="button" title="Close" aria-label="Close canvas menu">×</CarbonButton>
              </div>
              <div className="context-choice-grid" role="group" aria-label="Canvas element type">
                <CarbonButton className="text-button" type="button" data-canvas-add="source">Source</CarbonButton>
                <CarbonButton className="text-button" type="button" data-canvas-add="monitor">Monitor</CarbonButton>
                <CarbonButton className="text-button" type="button" data-canvas-add="material">Material</CarbonButton>
              </div>
            </div>
  );
}



export function SourceEditor() {
  const [editor, setEditor] = useEditorSnapshot<SourceEditorSnapshot>("fdtd:source-editor", {
    source: { type: "sine", shape: "point", xLambda: 1.2, yLambda: 3, multipoleOrder: 3, multipolePhase: "cos" },
    mode: "add",
    title: "Add source",
    hint: "x / λ₀ 1.20, y / λ₀ 3.00",
    widthEnabled: false,
    angleEnabled: false,
    multipoleEnabled: false,
    minX: "0.2",
    maxX: "8.8",
    minY: "0.2",
    maxY: "5.8",
  });
  const updateSource = (patch: Partial<SourceEditorSnapshot["source"]>) => {
    setEditor((current) => ({ ...current, source: { ...current.source, ...patch } }));
  };
  return (
            <div
              id="sourceMenu"
              className="source-menu"
              role="region"
              aria-labelledby="sourceMenuTitle"
              aria-describedby="sourceMenuHint"
              hidden
            >
              <div className="source-menu-header">
                <div>
                  <p id="sourceMenuHint" className="source-menu-hint">{editor.hint}</p>
                  <h2 id="sourceMenuTitle">{editor.title}</h2>
                </div>
                <CarbonButton id="sourceCloseBtn" className="icon-button compact-button" data-carbon-icon-only="true" type="button" title="Close" aria-label="Close source editor">×</CarbonButton>
              </div>
              <div className="context-kind-switcher" role="group" aria-label="Add element">
                <CarbonButton className="is-active" type="button" aria-pressed="true" data-canvas-add="source">Source</CarbonButton>
                <CarbonButton type="button" aria-pressed="false" data-canvas-add="monitor">Monitor</CarbonButton>
                <CarbonButton type="button" aria-pressed="false" data-canvas-add="material">Material</CarbonButton>
              </div>
              <div className="source-menu-body">
                <CarbonField>
                  <span>Time profile</span>
                  <CarbonSelect controlled id="sourceTypeInput" value={editor.source.type} onChange={(event) => updateSource({ type: event.currentTarget.value })}>
                    <option value="sine">Sine</option>
                    <option value="gaussian">Gaussian pulse</option>
                    <option value="ricker">Ricker</option>
                  </CarbonSelect>
                </CarbonField>
                <CarbonField>
                  <span>Spatial profile</span>
                  <CarbonSelect controlled id="sourceShapeInput" value={editor.source.shape} onChange={(event) => updateSource({ shape: event.currentTarget.value })}>
                    <optgroup label="Out-of-plane electric current, Jz">
                      <option value="point">Jz filament</option>
                      <option value="gaussianSpot">Gaussian Jz patch</option>
                      <option value="pointDipole">Point electric dipole</option>
                      <option value="dipole">Jz dipole pair</option>
                      <option value="circularDipoleCw">Circular dipole +90 deg</option>
                      <option value="circularDipoleCcw">Circular dipole -90 deg</option>
                      <option value="janusDipole">Janus dipole</option>
                      <option value="huygens">Huygens source</option>
                      <option value="quadrupole">Jz quadrupole pattern</option>
                      <option value="multipole">2D Jz multipole pattern</option>
                    </optgroup>
                    <optgroup label="In-plane electric current, Jx/Jy">
                      <option value="inPlaneElectricDipole">In-plane electric dipole</option>
                    </optgroup>
                    <optgroup label="Incident fields">
                      <option value="line">Plane wave</option>
                      <option value="gaussianProfile">Gaussian line</option>
                      <option value="evanescentLine">Evanescent line</option>
                      <option value="modeProfile">Guided mode profile</option>
                    </optgroup>
                  </CarbonSelect>
                </CarbonField>
                <div className="scientific-slider-group">
                  <ScientificSlider controlId="frequencyInput" />
                </div>
                <div className="scientific-slider-group">
                  <ScientificSlider controlId="amplitudeInput" />
                </div>
                <fieldset className="two-col">
                  <legend className="sr-only">Source position</legend>
                  <CarbonField>
                    <span><i>x</i> / λ<sub>0</sub></span>
                    <CarbonInput controlled id="sourceXInput" type="number" inputMode="decimal" autoComplete="off" min={editor.minX} max={editor.maxX} step="0.05" value={editor.source.xLambda} onChange={(event) => updateSource({ xLambda: Number(event.currentTarget.value) })} />
                  </CarbonField>
                  <CarbonField>
                    <span><i>y</i> / λ<sub>0</sub></span>
                    <CarbonInput controlled id="sourceYInput" type="number" inputMode="decimal" autoComplete="off" min={editor.minY} max={editor.maxY} step="0.05" value={editor.source.yLambda} onChange={(event) => updateSource({ yLambda: Number(event.currentTarget.value) })} />
                  </CarbonField>
                </fieldset>
                <div id="sourceWidthControl" className={`scientific-slider-group${editor.widthEnabled ? "" : " is-disabled"}`} hidden={!editor.widthEnabled}>
                  <ScientificSlider controlId="sourceWidthInput" />
                </div>
                <div id="sourceAngleControl" className={`scientific-slider-group${editor.angleEnabled ? "" : " is-disabled"}`} hidden={!editor.angleEnabled}>
                  <ScientificSlider controlId="sourceAngleInput" />
                </div>
                <CarbonDisclosure className="source-detail-panel context-detail-panel" title="Source details">
                  <div className="source-detail-body">
                    <div id="sourceTimePhaseControl" className="scientific-slider-group">
                      <ScientificSlider controlId="sourceTimePhaseInput" />
                    </div>
                    <fieldset className="two-col source-order-controls" hidden={!editor.multipoleEnabled}>
                      <legend className="sr-only">Multipole angular profile</legend>
                      <CarbonField id="sourceOrderControl" className={editor.multipoleEnabled ? "" : "is-disabled"} hidden={!editor.multipoleEnabled}>
                        <span><i>n</i></span>
                        <CarbonInput controlled id="sourceOrderInput" type="number" inputMode="decimal" autoComplete="off" min="1" max="8" step="1" value={editor.source.multipoleOrder} disabled={!editor.multipoleEnabled} onChange={(event) => updateSource({ multipoleOrder: Number(event.currentTarget.value) })} />
                      </CarbonField>
                      <CarbonField id="sourcePhaseControl" className={editor.multipoleEnabled ? "" : "is-disabled"} hidden={!editor.multipoleEnabled}>
                        <span>angular part</span>
                        <CarbonSelect controlled id="sourcePhaseInput" value={editor.source.multipolePhase} disabled={!editor.multipoleEnabled} onChange={(event) => updateSource({ multipolePhase: event.currentTarget.value })}>
                          <option value="cos">cos(nφ)</option>
                          <option value="sin">sin(nφ)</option>
                        </CarbonSelect>
                      </CarbonField>
                    </fieldset>
                  </div>
                </CarbonDisclosure>
              </div>
              <div className="source-menu-actions">
                <CarbonButton id="sourceDeleteBtn" className="text-button danger-button" data-carbon-kind="danger--tertiary" type="button" hidden={editor.mode !== "edit"}>Delete</CarbonButton>
                <CarbonButton id="sourceApplyBtn" className="text-button primary-button" data-carbon-kind="primary" type="button">{editor.mode === "edit" ? "Update source" : "Add source"}</CarbonButton>
              </div>
            </div>
  );
}



export function MonitorEditor() {
  const [editor, setEditor] = useEditorSnapshot<MonitorEditorSnapshot>("fdtd:monitor-editor", {
    monitor: { quantity: "scalar", xLambda: 4.5, yLambda: 3 },
    mode: "add",
    title: "Add monitor",
    hint: "Line monitor",
    minX: "0.2",
    maxX: "8.8",
    minY: "0.2",
    maxY: "5.8",
  });
  const updateMonitor = (patch: Partial<MonitorEditorSnapshot["monitor"]>) => {
    setEditor((current) => ({ ...current, monitor: { ...current.monitor, ...patch } }));
  };
  return (
            <div
              id="monitorMenu"
              className="source-menu monitor-menu"
              role="region"
              aria-labelledby="monitorMenuTitle"
              aria-describedby="monitorMenuHint"
              hidden
            >
              <div className="source-menu-header">
                <div>
                  <p id="monitorMenuHint" className="source-menu-hint">{editor.hint}</p>
                  <h2 id="monitorMenuTitle">{editor.title}</h2>
                </div>
                <CarbonButton id="monitorCloseBtn" className="icon-button compact-button" data-carbon-icon-only="true" type="button" title="Close" aria-label="Close monitor editor">×</CarbonButton>
              </div>
              <div className="context-kind-switcher" role="group" aria-label="Add element">
                <CarbonButton type="button" aria-pressed="false" data-canvas-add="source">Source</CarbonButton>
                <CarbonButton className="is-active" type="button" aria-pressed="true" data-canvas-add="monitor">Monitor</CarbonButton>
                <CarbonButton type="button" aria-pressed="false" data-canvas-add="material">Material</CarbonButton>
              </div>
              <div className="source-menu-body">
                <CarbonField>
                  <span>Quantity</span>
                  <CarbonSelect controlled id="monitorQuantityInput" value={editor.monitor.quantity} onChange={(event) => updateMonitor({ quantity: event.currentTarget.value })}>
                    <option value="scalar">Scalar field</option>
                    <option value="magnitude">Scalar-field magnitude |Fz|</option>
                    <option value="normalFlux">Mean normal Poynting flux</option>
                    <option value="tangentFlux">Mean tangential Poynting flux</option>
                  </CarbonSelect>
                </CarbonField>
                <fieldset className="two-col">
                  <legend className="sr-only">Monitor position</legend>
                  <CarbonField>
                    <span><i>x</i> / λ<sub>0</sub></span>
                    <CarbonInput controlled id="monitorXInput" type="number" inputMode="decimal" autoComplete="off" min={editor.minX} max={editor.maxX} step="0.05" value={editor.monitor.xLambda} onChange={(event) => updateMonitor({ xLambda: Number(event.currentTarget.value) })} />
                  </CarbonField>
                  <CarbonField>
                    <span><i>y</i> / λ<sub>0</sub></span>
                    <CarbonInput controlled id="monitorYInput" type="number" inputMode="decimal" autoComplete="off" min={editor.minY} max={editor.maxY} step="0.05" value={editor.monitor.yLambda} onChange={(event) => updateMonitor({ yLambda: Number(event.currentTarget.value) })} />
                  </CarbonField>
                </fieldset>
                <div className="scientific-slider-group">
                  <ScientificSlider controlId="monitorLengthInput" />
                </div>
                <div className="scientific-slider-group">
                  <ScientificSlider controlId="monitorAngleInput" />
                </div>
              </div>
              <div className="source-menu-actions">
                <CarbonButton id="monitorDeleteBtn" className="text-button danger-button" data-carbon-kind="danger--tertiary" type="button" hidden={editor.mode !== "edit"}>Delete</CarbonButton>
                <CarbonButton id="monitorApplyBtn" className="text-button primary-button" data-carbon-kind="primary" type="button">{editor.mode === "edit" ? "Update monitor" : "Add monitor"}</CarbonButton>
              </div>
            </div>
  );
}



export function BrushEditor() {
  useFdtdRuntimeSelector((current) => current ? [
    current.brush, current.brushTool, current.brushGeometry,
    current.geometryWidthLambda, current.geometryHeightLambda, current.geometryRadiusLambda, current.geometryInnerRadiusLambda,
    current.customAnisotropic, current.customEpsReal, current.customEpsImag, current.customEpsYReal, current.customEpsYImag,
    current.customMuReal, current.customMuImag, current.customMuYReal, current.customMuYImag,
    current.materialGyrotropyEnabled, current.gyrotropyG, current.materialBianisotropyEnabled, current.bianisotropyKappa,
    current.materialConductivityEnabled, current.conductivitySigma, current.conductivitySigmaY,
    current.materialSaturableGainEnabled, current.gainSaturation,
    current.materialModulationEnabled, current.modulationDepth, current.modulationFrequency, current.modulationPeriodLambda, current.modulationAngleDeg, current.modulationPhaseDeg,
    current.materialNonlinearEnabled, current.kerrChi3, current.kerrSaturation,
    current.materialHarmonicEnabled, current.harmonicChi2, current.harmonicChi3, current.harmonicSaturation,
    current.materialPhaseChangeEnabled, current.phaseEpsOn, current.phaseLossOn, current.phaseThresholdOn, current.phaseThresholdOff, current.phaseTauOn, current.phaseTauOff,
    current.dispersionModel, current.dispersionOmegaP, current.dispersionGamma, current.dispersionOmega0, current.dispersionDeltaEps, current.dispersionTau,
  ].join("|") : "");
  const state = runtimeState();
  const [editor, setEditor] = useState({ editsRegion: false, hint: "Draw medium" });
  useEffect(() => {
    const sync = (event: Event) => {
      const next = (event as CustomEvent<{ editsRegion: boolean; hint: string }>).detail;
      setEditor((current) => current.editsRegion === next.editsRegion && current.hint === next.hint ? current : next);
    };
    window.addEventListener("fdtd:brush-editor", sync);
    return () => window.removeEventListener("fdtd:brush-editor", sync);
  }, []);
  const brushTool = state?.brushTool ?? "paint";
  const geometry = state?.brushGeometry ?? "rectangle";
  const usesWidth = geometry === "rectangle" || geometry === "ellipse";
  const usesHeight = geometry === "rectangle" || geometry === "ellipse";
  const usesRadius = geometry === "disk" || geometry === "ring";
  const usesInnerRadius = geometry === "ring";
  const customBrush = (state?.brush ?? "custom") === "custom";
  const anisotropic = customBrush && Boolean(state?.customAnisotropic);
  const dispersionModel = state?.dispersionModel ?? "none";
  return (
            <div
              id="brushMenu"
              className="source-menu brush-menu"
              role="region"
              aria-labelledby="brushMenuTitle"
              aria-describedby="brushMenuHint"
              hidden
            >
              <div className="source-menu-header">
                <div>
                  <p id="brushMenuHint" className="source-menu-hint">{editor.hint}</p>
                  <h2 id="brushMenuTitle">Draw</h2>
                </div>
                <CarbonButton id="brushMenuCloseBtn" className="icon-button compact-button" data-carbon-icon-only="true" type="button" title="Close" aria-label="Close draw editor">×</CarbonButton>
              </div>
              <div className="context-kind-switcher" role="group" aria-label="Add element">
                <CarbonButton type="button" aria-pressed="false" data-canvas-add="source">Source</CarbonButton>
                <CarbonButton type="button" aria-pressed="false" data-canvas-add="monitor">Monitor</CarbonButton>
                <CarbonButton className="is-active" type="button" aria-pressed="true" data-canvas-add="material">Material</CarbonButton>
              </div>
              <div className="source-menu-body">
              <fieldset id="brushToolControl" className="canvas-mode-toggle brush-tool-toggle" role="radiogroup" aria-label="Draw tool" hidden={editor.editsRegion}>
                <legend className="sr-only">Draw tool</legend>
                <CarbonButton className={`mode-toggle-button${brushTool === "paint" ? " is-active" : ""}`} type="button" role="radio" data-brush-tool="paint" aria-checked={brushTool === "paint"}>Brush</CarbonButton>
                <CarbonButton className={`mode-toggle-button${brushTool === "geometry" ? " is-active" : ""}`} type="button" role="radio" data-brush-tool="geometry" aria-checked={brushTool === "geometry"}>Geometry</CarbonButton>
              </fieldset>
              <div id="brushGeometryPanel" className="modulation-panel brush-geometry-panel" hidden={editor.editsRegion || brushTool !== "geometry"}>
                <CarbonField>
                  <span>Geometry</span>
                  <CarbonSelect controlled id="brushGeometryInput" value={geometry}>
                    <option value="rectangle">Rectangle</option>
                    <option value="disk">Circle</option>
                    <option value="ellipse">Ellipse</option>
                    <option value="ring">Donut / ring</option>
                  </CarbonSelect>
                </CarbonField>
                <fieldset className="two-col material-params geometry-params">
                  <legend className="sr-only">Geometry dimensions</legend>
                  <CarbonField id="geometryWidthControl" hidden={!usesWidth || editor.editsRegion}>
                    <span><i>w</i> / &lambda;<sub>0</sub></span>
                    <CarbonInput controlled id="geometryWidthInput" type="number" inputMode="decimal" autoComplete="off" min="0.05" max="50" step="0.05" value={state?.geometryWidthLambda ?? 1} />
                  </CarbonField>
                  <CarbonField id="geometryHeightControl" hidden={!usesHeight || editor.editsRegion}>
                    <span><i>h</i> / &lambda;<sub>0</sub></span>
                    <CarbonInput controlled id="geometryHeightInput" type="number" inputMode="decimal" autoComplete="off" min="0.05" max="50" step="0.05" value={state?.geometryHeightLambda ?? 0.5} />
                  </CarbonField>
                </fieldset>
                <fieldset className="two-col material-params geometry-params">
                  <legend className="sr-only">Geometry radii</legend>
                  <CarbonField id="geometryRadiusControl" hidden={!usesRadius || editor.editsRegion}>
                    <span><i>r</i> / &lambda;<sub>0</sub></span>
                    <CarbonInput controlled id="geometryRadiusInput" type="number" inputMode="decimal" autoComplete="off" min="0.05" max="25" step="0.05" value={state?.geometryRadiusLambda ?? 0.45} />
                  </CarbonField>
                  <CarbonField id="geometryInnerRadiusControl" hidden={!usesInnerRadius || editor.editsRegion}>
                    <span><i>r</i><sub>in</sub> / &lambda;<sub>0</sub></span>
                    <CarbonInput controlled id="geometryInnerRadiusInput" type="number" inputMode="decimal" autoComplete="off" min="0.01" max="25" step="0.05" value={state?.geometryInnerRadiusLambda ?? 0.25} />
                  </CarbonField>
                </fieldset>
              </div>
              <div id="brushSizeControl" className="scientific-slider-group" hidden={editor.editsRegion || brushTool === "geometry"}>
                <ScientificSlider controlId="brushMenuSizeInput" />
              </div>
              <fieldset className="segmented" role="radiogroup" aria-label="Material">
                <legend className="sr-only">Material</legend>
                {([['custom', 'Custom ε, μ'], ['pec', 'PEC'], ['lossy', 'Loss'], ['erase', 'Erase']] as const).map(([value, label]) => <CarbonButton className={`segment${state?.brush === value ? " is-active" : ""}`} type="button" role="radio" data-brush={value} aria-checked={state?.brush === value} key={value}>{label}</CarbonButton>)}
              </fieldset>
              <MaterialWarning />
              <fieldset id="brushMaterialGrid" className={`material-tensor-editor brush-material-params${anisotropic ? " is-anisotropic" : ""}`} aria-label="Custom epsilon and mu" disabled={!customBrush}>
                <legend className="sr-only">Custom epsilon and mu</legend>
                <div className="material-tensor-part material-tensor-real" aria-label="Real material components">
                  <span className="material-tensor-title">Real</span>
                  <span className="material-tensor-axis" aria-hidden="true"></span>
                  <span className="material-tensor-axis">x</span>
                  <span className="material-tensor-axis brush-anisotropic-params" hidden={!anisotropic}>y</span>
                  <span className="material-tensor-row">&epsilon;</span>
                  <CarbonField className="material-tensor-cell material-cell-eps-real">
                    <span id="customEpsRealLabel">&epsilon;{anisotropic ? <sub>x</sub> : null}&prime;</span>
                    <CarbonInput controlled id="customEpsRealInput" type="number" inputMode="decimal" autoComplete="off" min="-30" max="30" step="0.05" value={state?.customEpsReal ?? 4} />
                  </CarbonField>
                  <CarbonField className="material-tensor-cell material-cell-eps-y-real brush-anisotropic-params" hidden={!anisotropic}>
                    <span>&epsilon;<sub>y</sub>&prime;</span>
                    <CarbonInput controlled id="customEpsYRealInput" type="number" inputMode="decimal" autoComplete="off" min="-30" max="30" step="0.05" value={state?.customEpsYReal ?? 4} />
                  </CarbonField>
                  <span className="material-tensor-row">&mu;</span>
                  <CarbonField className="material-tensor-cell material-cell-mu-real">
                    <span id="customMuRealLabel">&mu;{anisotropic ? <sub>x</sub> : null}&prime;</span>
                    <CarbonInput controlled id="customMuRealInput" type="number" inputMode="decimal" autoComplete="off" min="-30" max="30" step="0.05" value={state?.customMuReal ?? 1} />
                  </CarbonField>
                  <CarbonField className="material-tensor-cell material-cell-mu-y-real brush-anisotropic-params" hidden={!anisotropic}>
                    <span>&mu;<sub>y</sub>&prime;</span>
                    <CarbonInput controlled id="customMuYRealInput" type="number" inputMode="decimal" autoComplete="off" min="-30" max="30" step="0.05" value={state?.customMuYReal ?? 1} />
                  </CarbonField>
                </div>
                <div className="material-tensor-part material-tensor-imag" aria-label="Normalized per-step material loss coefficients">
                  <span className="material-tensor-title">Loss / step</span>
                  <span className="material-tensor-axis" aria-hidden="true"></span>
                  <span className="material-tensor-axis">x</span>
                  <span className="material-tensor-axis brush-anisotropic-params" hidden={!anisotropic}>y</span>
                  <span className="material-tensor-row">&epsilon;</span>
                  <CarbonField className="material-tensor-cell material-cell-eps-imag">
                    <span id="customEpsImagLabel">&ell;&epsilon;{anisotropic ? ",x" : ""}</span>
                    <CarbonInput controlled id="customEpsImagInput" type="number" inputMode="decimal" autoComplete="off" min="-30" max="30" step="0.0005" value={state?.customEpsImag ?? 0} />
                  </CarbonField>
                  <CarbonField className="material-tensor-cell material-cell-eps-y-imag brush-anisotropic-params" hidden={!anisotropic}>
                    <span>&ell;&epsilon;,y</span>
                    <CarbonInput controlled id="customEpsYImagInput" type="number" inputMode="decimal" autoComplete="off" min="-30" max="30" step="0.0005" value={state?.customEpsYImag ?? 0} />
                  </CarbonField>
                  <span className="material-tensor-row">&mu;</span>
                  <CarbonField className="material-tensor-cell material-cell-mu-imag">
                    <span id="customMuImagLabel">&ell;&mu;{anisotropic ? ",x" : ""}</span>
                    <CarbonInput controlled id="customMuImagInput" type="number" inputMode="decimal" autoComplete="off" min="-30" max="30" step="0.0005" value={state?.customMuImag ?? 0} />
                  </CarbonField>
                  <CarbonField className="material-tensor-cell material-cell-mu-y-imag brush-anisotropic-params" hidden={!anisotropic}>
                    <span>&ell;&mu;,y</span>
                    <CarbonInput controlled id="customMuYImagInput" type="number" inputMode="decimal" autoComplete="off" min="-30" max="30" step="0.0005" value={state?.customMuYImag ?? 0} />
                  </CarbonField>
                </div>
              </fieldset>
              <CarbonDisclosure className="material-detail-panel context-detail-panel" title="Advanced material model">
                <div className="source-detail-body">
                  <CarbonField className="toggle-row brush-anisotropy-toggle">
                    <CarbonInput controlled id="customAnisotropyInput" type="checkbox" checked={Boolean(state?.customAnisotropic)} disabled={!customBrush} />
                    <span>Anisotropic ε, μ</span>
                  </CarbonField>
              <div className="modulation-panel gyrotropy-panel">
                <CarbonField className="toggle-row modulation-toggle">
                  <CarbonInput controlled id="gyrotropyEnabledInput" type="checkbox" checked={Boolean(state?.materialGyrotropyEnabled)} disabled={!customBrush} />
                  <span>Antisymmetric &epsilon; coupling (Hz proxy)</span>
                </CarbonField>
                <CarbonField className="gyrotropy-params" hidden={!customBrush || !state?.materialGyrotropyEnabled}>
                  <span><i>g</i><sub>&epsilon;</sub></span>
                  <CarbonInput controlled id="gyrotropyGInput" type="number" inputMode="decimal" autoComplete="off" min="-5" max="5" step="0.01" value={state?.gyrotropyG ?? 0.25} />
                </CarbonField>
              </div>
              <div className="modulation-panel bianisotropy-panel">
                <CarbonField className="toggle-row modulation-toggle">
                  <CarbonInput controlled id="bianisotropyEnabledInput" type="checkbox" checked={Boolean(state?.materialBianisotropyEnabled)} disabled={!customBrush} />
                  <span>Magnetoelectric coupling &kappa; / &radic;&epsilon;&mu;</span>
                </CarbonField>
                <CarbonField className="bianisotropy-params" hidden={!customBrush || !state?.materialBianisotropyEnabled}>
                  <span>&kappa;<sub>n</sub></span>
                  <CarbonInput controlled id="bianisotropyKappaInput" type="number" inputMode="decimal" autoComplete="off" min="-0.85" max="0.85" step="0.01" value={state?.bianisotropyKappa ?? 0.2} />
                </CarbonField>
              </div>
              <div className="modulation-panel conductivity-panel">
                <CarbonField className="toggle-row modulation-toggle">
                  <CarbonInput controlled id="conductivityEnabledInput" type="checkbox" checked={Boolean(state?.materialConductivityEnabled)} disabled={!customBrush} />
                  <span>Finite conductivity <i>J</i> = &sigma;<i>E</i> (normalized)</span>
                </CarbonField>
                <div className="two-col material-params conductivity-params" hidden={!customBrush || !state?.materialConductivityEnabled}>
                  <CarbonField>
                    <span>&sigma;<sub>x</sub> norm.</span>
                    <CarbonInput controlled id="conductivitySigmaInput" type="number" inputMode="decimal" autoComplete="off" min="0" max="5" step="0.01" value={state?.conductivitySigma ?? 0} />
                  </CarbonField>
                  <CarbonField id="conductivitySigmaYControl" className="brush-anisotropic-params" hidden={!anisotropic || !state?.materialConductivityEnabled}>
                    <span>&sigma;<sub>y</sub> norm.</span>
                    <CarbonInput controlled id="conductivitySigmaYInput" type="number" inputMode="decimal" autoComplete="off" min="0" max="5" step="0.01" value={state?.conductivitySigmaY ?? 0} />
                  </CarbonField>
                </div>
              </div>
              <div className="modulation-panel saturable-gain-panel">
                <CarbonField className="toggle-row modulation-toggle">
                  <CarbonInput controlled id="saturableGainEnabledInput" type="checkbox" checked={Boolean(state?.materialSaturableGainEnabled)} disabled={!customBrush} />
                  <span>Saturable gain for negative &ell;<sub>&epsilon;</sub></span>
                </CarbonField>
                <CarbonField className="saturable-gain-params" hidden={!customBrush || !state?.materialSaturableGainEnabled}>
                  <span><i>I</i><sub>sat,g</sub></span>
                  <CarbonInput controlled id="gainSaturationInput" type="number" inputMode="decimal" autoComplete="off" min="0.05" max="100" step="0.05" value={state?.gainSaturation ?? 4} />
                </CarbonField>
              </div>
              <div className="modulation-panel">
                <CarbonField className="toggle-row modulation-toggle">
                  <CarbonInput controlled id="modulationEnabledInput" type="checkbox" checked={Boolean(state?.materialModulationEnabled)} disabled={!customBrush} />
                  <span>Space-time &epsilon;&prime; modulation</span>
                </CarbonField>
                <div className="two-col material-params modulation-params" hidden={!customBrush || !state?.materialModulationEnabled}>
                  <CarbonField>
                    <span><i>m</i></span>
                    <CarbonInput controlled id="modulationDepthInput" type="number" inputMode="decimal" autoComplete="off" min="0" max="0.95" step="0.05" value={state?.modulationDepth ?? 0.2} />
                  </CarbonField>
                  <CarbonField>
                    <span><i>f</i><sub>m</sub></span>
                    <CarbonInput controlled id="modulationFrequencyInput" type="number" inputMode="decimal" autoComplete="off" min="-0.2" max="0.2" step="0.001" value={state?.modulationFrequency ?? 0.01} />
                  </CarbonField>
                </div>
                <div className="two-col material-params modulation-params" hidden={!customBrush || !state?.materialModulationEnabled}>
                  <CarbonField>
                    <span>&Lambda;<sub>m</sub> / &lambda;<sub>0</sub></span>
                    <CarbonInput controlled id="modulationPeriodInput" type="number" inputMode="decimal" autoComplete="off" min="0.1" max="20" step="0.1" value={state?.modulationPeriodLambda ?? 2} />
                  </CarbonField>
                  <CarbonField>
                    <span>&theta;<sub>m</sub></span>
                    <CarbonInput controlled id="modulationAngleInput" type="number" inputMode="decimal" autoComplete="off" min="0" max="360" step="5" value={state?.modulationAngleDeg ?? 0} />
                  </CarbonField>
                </div>
                <CarbonField hidden={!customBrush || !state?.materialModulationEnabled}>
                  <span>&phi;<sub>m</sub></span>
                  <CarbonInput controlled id="modulationPhaseInput" type="number" inputMode="decimal" autoComplete="off" min="-180" max="180" step="5" value={state?.modulationPhaseDeg ?? 0} />
                </CarbonField>
              </div>
              <div className="modulation-panel nonlinear-panel">
                <CarbonField className="toggle-row modulation-toggle">
                  <CarbonInput controlled id="nonlinearEnabledInput" type="checkbox" checked={Boolean(state?.materialNonlinearEnabled)} disabled={!customBrush} />
                  <span>Kerr &chi;<sup>(3)</sup> nonlinearity</span>
                </CarbonField>
                <div className="two-col material-params nonlinear-params" hidden={!customBrush || !state?.materialNonlinearEnabled}>
                  <CarbonField>
                    <span>&chi;<sup>(3)</sup></span>
                    <CarbonInput controlled id="kerrChi3Input" type="number" inputMode="decimal" autoComplete="off" min="-20" max="20" step="0.05" value={state?.kerrChi3 ?? 0.5} />
                  </CarbonField>
                  <CarbonField>
                    <span><i>I</i><sub>sat</sub></span>
                    <CarbonInput controlled id="kerrSaturationInput" type="number" inputMode="decimal" autoComplete="off" min="0.05" max="50" step="0.05" value={state?.kerrSaturation ?? 5} />
                  </CarbonField>
                </div>
              </div>
              <div className="modulation-panel harmonic-panel">
                <CarbonField className="toggle-row modulation-toggle">
                  <CarbonInput controlled id="harmonicEnabledInput" type="checkbox" checked={Boolean(state?.materialHarmonicEnabled)} disabled={!customBrush} />
                  <span>Harmonic polarization <i>P</i><sub>NL</sub></span>
                </CarbonField>
                <div className="two-col material-params harmonic-params" hidden={!customBrush || !state?.materialHarmonicEnabled}>
                  <CarbonField>
                    <span>&chi;<sup>(2)</sup></span>
                    <CarbonInput controlled id="harmonicChi2Input" type="number" inputMode="decimal" autoComplete="off" min="-2" max="2" step="0.01" value={state?.harmonicChi2 ?? 0.08} />
                  </CarbonField>
                  <CarbonField>
                    <span>&chi;<sup>(3)</sup><sub>H</sub></span>
                    <CarbonInput controlled id="harmonicChi3Input" type="number" inputMode="decimal" autoComplete="off" min="-2" max="2" step="0.01" value={state?.harmonicChi3 ?? 0} />
                  </CarbonField>
                </div>
                <CarbonField className="harmonic-params" hidden={!customBrush || !state?.materialHarmonicEnabled}>
                  <span><i>I</i><sub>sat,H</sub></span>
                  <CarbonInput controlled id="harmonicSaturationInput" type="number" inputMode="decimal" autoComplete="off" min="0.05" max="50" step="0.05" value={state?.harmonicSaturation ?? 6} />
                </CarbonField>
              </div>
              <div className="modulation-panel phase-change-panel">
                <CarbonField className="toggle-row modulation-toggle">
                  <CarbonInput controlled id="phaseChangeEnabledInput" type="checkbox" checked={Boolean(state?.materialPhaseChangeEnabled)} disabled={!customBrush} />
                  <span>Phase-change memory <i>s</i></span>
                </CarbonField>
                <div className="two-col material-params phase-change-params" hidden={!customBrush || !state?.materialPhaseChangeEnabled}>
                  <CarbonField>
                    <span>&epsilon;<sub>on</sub>&prime;</span>
                    <CarbonInput controlled id="phaseEpsOnInput" type="number" inputMode="decimal" autoComplete="off" min="-30" max="30" step="0.05" value={state?.phaseEpsOn ?? 9} />
                  </CarbonField>
                  <CarbonField>
                    <span>&ell;<sub>&epsilon;,on</sub></span>
                    <CarbonInput controlled id="phaseLossOnInput" type="number" inputMode="decimal" autoComplete="off" min="-30" max="30" step="0.0005" value={state?.phaseLossOn ?? 0.08} />
                  </CarbonField>
                </div>
                <div className="two-col material-params phase-change-params" hidden={!customBrush || !state?.materialPhaseChangeEnabled}>
                  <CarbonField>
                    <span><i>I</i><sub>on</sub></span>
                    <CarbonInput controlled id="phaseThresholdOnInput" type="number" inputMode="decimal" autoComplete="off" min="0" max="100" step="0.05" value={state?.phaseThresholdOn ?? 0.8} />
                  </CarbonField>
                  <CarbonField>
                    <span><i>I</i><sub>off</sub></span>
                    <CarbonInput controlled id="phaseThresholdOffInput" type="number" inputMode="decimal" autoComplete="off" min="0" max="100" step="0.05" value={state?.phaseThresholdOff ?? 0.2} />
                  </CarbonField>
                </div>
                <div className="two-col material-params phase-change-params" hidden={!customBrush || !state?.materialPhaseChangeEnabled}>
                  <CarbonField>
                    <span>&tau;<sub>on</sub></span>
                    <CarbonInput controlled id="phaseTauOnInput" type="number" inputMode="decimal" autoComplete="off" min="1" max="1000" step="1" value={state?.phaseTauOn ?? 18} />
                  </CarbonField>
                  <CarbonField>
                    <span>&tau;<sub>off</sub></span>
                    <CarbonInput controlled id="phaseTauOffInput" type="number" inputMode="decimal" autoComplete="off" min="1" max="2000" step="1" value={state?.phaseTauOff ?? 180} />
                  </CarbonField>
                </div>
              </div>
              <div className="modulation-panel dispersion-panel">
                <CarbonField>
                  <span>Dispersive model</span>
                  <CarbonSelect controlled id="dispersionModelInput" value={dispersionModel} disabled={!customBrush}>
                    <option value="none">None</option>
                    <option value="drude">Drude metal</option>
                    <option value="plasma">Plasma</option>
                    <option value="lorentz">Lorentz oscillator</option>
                    <option value="debye">Debye relaxation</option>
                  </CarbonSelect>
                </CarbonField>
                <div className="two-col material-params dispersion-params" hidden={!customBrush || dispersionModel === "none"}>
                  <CarbonField id="dispersionOmegaPControl" hidden={!customBrush || !["drude", "plasma"].includes(dispersionModel)}>
                    <span>&omega;<sub>p</sub></span>
                    <CarbonInput controlled id="dispersionOmegaPInput" type="number" inputMode="decimal" autoComplete="off" min="0" max="1.2" step="0.005" value={state?.dispersionOmegaP ?? 0.28} />
                  </CarbonField>
                  <CarbonField id="dispersionGammaControl" hidden={!customBrush || !["drude", "plasma", "lorentz"].includes(dispersionModel)}>
                    <span>&gamma;</span>
                    <CarbonInput controlled id="dispersionGammaInput" type="number" inputMode="decimal" autoComplete="off" min="0" max="0.5" step="0.001" value={state?.dispersionGamma ?? 0.018} />
                  </CarbonField>
                </div>
                <div className="two-col material-params dispersion-params" hidden={!customBrush || !["lorentz", "debye"].includes(dispersionModel)}>
                  <CarbonField id="dispersionOmega0Control" hidden={!customBrush || dispersionModel !== "lorentz"}>
                    <span>&omega;<sub>0</sub></span>
                    <CarbonInput controlled id="dispersionOmega0Input" type="number" inputMode="decimal" autoComplete="off" min="0" max="1.2" step="0.005" value={state?.dispersionOmega0 ?? 0.15} />
                  </CarbonField>
                  <CarbonField id="dispersionDeltaEpsControl" hidden={!customBrush || !["lorentz", "debye"].includes(dispersionModel)}>
                    <span>&Delta;&epsilon;</span>
                    <CarbonInput controlled id="dispersionDeltaEpsInput" type="number" inputMode="decimal" autoComplete="off" min="-20" max="20" step="0.05" value={state?.dispersionDeltaEps ?? 2} />
                  </CarbonField>
                </div>
                <CarbonField id="dispersionTauControl" className="dispersion-params" hidden={!customBrush || dispersionModel !== "debye"}>
                  <span>&tau;</span>
                  <CarbonInput controlled id="dispersionTauInput" type="number" inputMode="decimal" autoComplete="off" min="1" max="200" step="1" value={state?.dispersionTau ?? 18} />
                </CarbonField>
              </div>
                </div>
              </CarbonDisclosure>
              </div>
              <div className="button-row source-menu-actions">
                <CarbonButton id="brushMenuClearMaterialsBtn" className="text-button" type="button" hidden={editor.editsRegion}>Clear medium</CarbonButton>
                <CarbonButton id="brushMenuClearFieldsBtn" className="text-button" type="button" hidden={editor.editsRegion}>Clear field</CarbonButton>
              </div>
            </div>
  );
}



export function BoundaryEditor() {
  const [hint, setHint] = useState("CPML region");
  useEffect(() => {
    const sync = (event: Event) => {
      const next = (event as CustomEvent<{ hint?: unknown }>).detail?.hint;
      if (typeof next === "string") setHint((current) => current === next ? current : next);
    };
    window.addEventListener("fdtd:boundary-editor", sync);
    return () => window.removeEventListener("fdtd:boundary-editor", sync);
  }, []);
  return (
            <div
              id="boundaryMenu"
              className="source-menu boundary-menu"
              role="region"
              aria-labelledby="boundaryMenuTitle"
              aria-describedby="boundaryMenuHint"
              hidden
            >
              <div className="source-menu-header">
                <div>
                  <p id="boundaryMenuHint" className="source-menu-hint">{hint}</p>
                  <h2 id="boundaryMenuTitle">Boundary</h2>
                </div>
                <CarbonButton id="boundaryMenuCloseBtn" className="icon-button compact-button" data-carbon-icon-only="true" type="button" title="Close" aria-label="Close boundary editor">&times;</CarbonButton>
              </div>
              <div className="source-menu-body">
                <div className="boundary-condition-control">
                  <span>Boundary condition</span>
                  <BoundaryConditionSwitcher />
                </div>
              </div>
            </div>
  );
}
