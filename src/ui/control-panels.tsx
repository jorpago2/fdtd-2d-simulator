import { FdtdRunOutcome, NumericalPreflight, SceneSearch } from "./carbon-shell";
import { useEffect, useState } from "react";
import { CarbonDisclosure } from "./carbon-disclosures";
import { CarbonButton, CarbonField, CarbonFileInput, CarbonInput, CarbonSelect, CarbonTextArea } from "./carbon-primitives";
import { SceneCardBrowser, SceneFilterBar } from "./scene-browser";
import { ScientificSlider } from "./scientific-slider-control";
import { FieldComponentControls, VisualFieldControls, VisualOverlayControls } from "./visual-controls";
import { Checkbox, ContentSwitcher, Select, Switch } from "@carbon/react";
import { requestRuntimeAction, runtimeState, useFdtdRuntimeSelector } from "./runtime-state";
import { CustomMonitorResults, LineMonitorResults, MaxwellCheckResults, PerformanceResults, RuntimeEngine, SceneObservableResults } from "./results-views";

type SceneRecordSnapshot = {
  badges?: string[];
  description?: string;
  group?: string;
  groupLabel?: string;
  index?: number | null;
  thumbnail?: string;
  thumbnailSrc?: string;
  title?: string;
};

type SceneGuideSnapshot = {
  phenomenon: string;
  expected: string;
  fdtd: string;
  description: string;
  geometry: string;
  source: string;
  materials: string;
  explanation: string;
  errors: string[];
  enabled: string;
  experiments: string;
  references: Record<string, string[]>;
};

function SceneSpotlight() {
  const [record, setRecord] = useState<SceneRecordSnapshot>({
    badges: ["FDTD"],
    description: "Homogeneous air with a continuous line source: a basic scene for observing propagation, wavelength, and absorbing boundaries.",
    group: "Maxwell and propagation",
    index: 1,
    thumbnail: "wave",
    title: "Plane wave in air",
  });
  useEffect(() => {
    const sync = (event: Event) => {
      const next = (event as CustomEvent<{ record: SceneRecordSnapshot }>).detail.record;
      setRecord((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    window.addEventListener("fdtd:scene-selection", sync);
    return () => window.removeEventListener("fdtd:scene-selection", sync);
  }, []);
  return <section
    id="sceneSpotlight"
    className="scene-spotlight"
    aria-labelledby="sceneSpotlightTitle"
    aria-describedby="sceneSpotlightDescription"
    data-scene-thumb={record.thumbnail ?? "wave"}
  >
    <span className="scene-card-thumb scene-spotlight-thumb" aria-hidden="true">
      {record.thumbnailSrc ? <img className="scene-thumb-image" src={record.thumbnailSrc} alt="" width={96} height={96} /> : <><span /><span /><span /></>}
    </span>
    <div className="scene-spotlight-body">
      <span className="scene-spotlight-kicker">
        <span id="sceneSpotlightNumber" className="scene-card-number">{record.index == null ? "Custom" : `Example ${record.index}`}</span>
        <span aria-hidden="true">·</span>
        <span id="sceneSpotlightGroup" className="scene-spotlight-group">{record.group || record.groupLabel || "General"}</span>
      </span>
      <h3 id="sceneSpotlightTitle" className="scene-spotlight-title">{record.title || "Custom scene"}</h3>
      <span id="sceneSpotlightDescription" className="scene-spotlight-description">{record.description || "Custom FDTD scene."}</span>
      <span id="sceneSpotlightBadges" className="scene-card-badges scene-spotlight-badges">
        {(record.badges ?? []).map((badge) => <span className="scene-card-badge" key={badge}>{badge}</span>)}
      </span>
    </div>
  </section>;
}

function SceneGuideField({ label, value }: { label: string; value: string }) {
  return <div className="scene-guide-item"><h3>{label}</h3><p>{value}</p></div>;
}

function SceneGuideList({ label, items }: { label: string; items: string[] }) {
  return <div className="scene-guide-item"><h3>{label}</h3><ul>{items.map((item) => {
    const doi = (window as typeof window & { FdtdUiSceneGuide?: { sceneGuideReferenceDoiUrl?: (text: string) => string } }).FdtdUiSceneGuide?.sceneGuideReferenceDoiUrl?.(item);
    return <li key={item}>{item}{doi ? <> <a href={doi} target="_blank" rel="noopener noreferrer" aria-label={`Open DOI for ${item}`}>DOI</a></> : null}</li>;
  })}</ul></div>;
}

function SceneGuide() {
  const [guide, setGuide] = useState<SceneGuideSnapshot | null>(null);
  const [details, setDetails] = useState(false);
  useEffect(() => {
    const sync = (event: Event) => {
      const next = (event as CustomEvent<{ guide: SceneGuideSnapshot }>).detail.guide;
      setGuide((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    window.addEventListener("fdtd:scene-guide", sync);
    return () => window.removeEventListener("fdtd:scene-guide", sync);
  }, []);
  if (!guide) return <section id="sceneGuidePanel" className="scene-guide-panel" aria-live="polite" />;
  return <>
    <section id="sceneGuidePanel" className={`scene-guide-panel${details ? " show-details" : ""}`} aria-live="polite">
      <div className="scene-guide-grid">
        <SceneGuideField label="Phenomenon" value={guide.phenomenon} />
        <SceneGuideField label="Expected results" value={guide.expected} />
      </div>
      <section className="scene-guide-details scene-guide-section">
        <h3>Model details</h3>
        <div className="scene-guide-grid">
          <SceneGuideField label="FDTD simulation" value={guide.fdtd} />
          <SceneGuideField label="Description" value={guide.description} />
          <SceneGuideField label="Geometry" value={guide.geometry} />
          <SceneGuideField label="Source" value={guide.source} />
          <SceneGuideField label="Materials" value={guide.materials} />
          <SceneGuideField label="Explanation" value={guide.explanation} />
        </div>
      </section>
      <section className="scene-guide-details scene-guide-section">
        <h3>More context</h3>
        <div className="scene-guide-grid">
          <SceneGuideList label="Common mistakes" items={guide.errors} />
          <SceneGuideField label="What it enables" value={guide.enabled} />
          <SceneGuideField label="Related experiments" value={guide.experiments} />
        </div>
      </section>
      <section className="scene-guide-details scene-guide-section">
        <h3>References</h3>
        <div className="scene-guide-reference-grid">
          {Object.entries(guide.references).map(([category, items]) => <SceneGuideList label={category} items={items} key={category} />)}
        </div>
      </section>
    </section>
    <CarbonButton id="sceneGuideDetailsToggle" className="text-button" type="button" aria-expanded={details} onClick={() => setDetails((value) => !value)}>
      {details ? "Hide model details" : "Show model details"}
    </CarbonButton>
  </>;
}

function SceneBrowserMeta() {
  const [meta, setMeta] = useState({ hidden: true, text: "0 scenes across all families" });
  useEffect(() => {
    const sync = (event: Event) => {
      const next = (event as CustomEvent<typeof meta>).detail;
      setMeta((current) => current.hidden === next.hidden && current.text === next.text ? current : next);
    };
    window.addEventListener("fdtd:scene-browser-meta", sync);
    return () => window.removeEventListener("fdtd:scene-browser-meta", sync);
  }, []);
  return <div className="scene-browser-meta" aria-live="polite"><output id="sceneBrowserCount" hidden={meta.hidden}>{meta.text}</output></div>;
}

function ReproStatus() {
  const [status, setStatus] = useState({ text: "Scene state can be exported with sources, grid, boundaries, material parameters, and drawn cells.", warning: false });
  useEffect(() => {
    const sync = (event: Event) => {
      const next = (event as CustomEvent<typeof status>).detail;
      setStatus((current) => current.text === next.text && current.warning === next.warning ? current : next);
    };
    window.addEventListener("fdtd:repro-status", sync);
    return () => window.removeEventListener("fdtd:repro-status", sync);
  }, []);
  return <p id="reproStatus" className={`simulation-guide-note${status.warning ? " is-warning" : ""}`}>{status.text}</p>;
}

function RunSettings() {
  useFdtdRuntimeSelector((current) => current ? `${current.renderFps}|${current.autoScale}` : "");
  const state = runtimeState();
  return (
    <>
      <div className="control-row">
        <Select
          id="renderFpsInput"
          labelText="Display FPS"
          size="sm"
          value={String(state?.renderFps ?? 0)}
          onChange={(event) => requestRuntimeAction("runtime-setting", { property: "renderFps", value: Number(event.currentTarget.value) })}
        >
          <option value="0">Auto</option>
          <option value="60">60</option>
          <option value="30">30</option>
          <option value="15">15</option>
        </Select>
      </div>
      <Checkbox
        id="autoScaleInput"
        className="toggle-row"
        labelText="Automatic display scale"
        checked={state?.autoScale ?? false}
        onChange={(_, data) => requestRuntimeAction("runtime-setting", { property: "autoScale", value: data.checked })}
      />
    </>
  );
}

export function ScenePanel({ active }: { active: boolean }) {
  const [sceneView, setSceneView] = useState<"current" | "browse">("current");
  useEffect(() => {
    const sync = (event: Event) => {
      setSceneView((event as CustomEvent<{ view?: unknown }>).detail?.view === "browse" ? "browse" : "current");
    };
    window.addEventListener("fdtd:scene-view-sync", sync);
    return () => window.removeEventListener("fdtd:scene-view-sync", sync);
  }, []);
  return (
            <div id="tab-scenes" className={`control-tab-panel${active ? " is-active" : ""}`} role="tabpanel" aria-labelledby="tab-scenes-button" data-control-panel="scenes" hidden={!active}>
<section className="panel-section scene-section">
              <h2>Model and example</h2>
              <ContentSwitcher
                className="scene-view-toggle scientific-content-switcher scientific-content-switcher--sm"
                selectedIndex={sceneView === "browse" ? 1 : 0}
                size="sm"
                onChange={({ index }) => {
                  const view = index === 1 ? "browse" : "current";
                  setSceneView(view);
                  requestRuntimeAction("scene-view-request", { view });
                }}
              >
                <Switch
                  name="current"
                  text="Current"
                  className={sceneView === "current" ? "is-active" : ""}
                  aria-selected={sceneView === "current"}
                  data-scene-view="current"
                />
                <Switch
                  name="browse"
                  text="Browse"
                  className={sceneView === "browse" ? "is-active" : ""}
                  aria-selected={sceneView === "browse"}
                  data-scene-view="browse"
                />
              </ContentSwitcher>
              <div className="scene-browser" aria-label="Scene library">
                <div id="sceneCurrentPanel" className="scene-view-panel scene-current-panel" data-scene-view-panel="current" hidden={sceneView !== "current"}>
                  <SceneSpotlight />
                  <SceneGuide />
                </div>
                <div id="sceneBrowsePanel" className="scene-view-panel scene-browse-panel" data-scene-view-panel="browse" hidden={sceneView !== "browse"}>
                  <SceneSearch />
                  <SceneFilterBar />
                  <SceneBrowserMeta />
                  <SceneCardBrowser />
                </div>
              </div>
            </section>
            </div>
  );
}



export function RunPanel({ active }: { active: boolean }) {
  return (
            <div id="tab-simulation" className={`control-tab-panel${active ? " is-active" : ""}`} role="tabpanel" aria-labelledby="tab-simulation-button" data-control-panel="simulation" hidden={!active}>
<section className="panel-section run-section">
              <h2>Execution and field</h2>
              <div className="solver-row">
                <span>Field component</span>
                <FieldComponentControls />
              </div>
              <p className="results-insight-note">Solver convention: <i>E</i><sub>z</sub> is TMz and <i>H</i><sub>z</sub> is TEz. At interfaces, p/TM uses the <i>H</i><sub>z</sub> solver; s/TE uses <i>E</i><sub>z</sub>.</p>
              <div className="control-row">
                <span title="Implementation route; it does not change the physical model.">Compute engine</span>
                <RuntimeEngine />
              </div>
              <div className="scientific-slider-group" title="Changes animation pacing, not the CFL time step.">
                <ScientificSlider controlId="speedInput" />
              </div>
              <RunSettings />
              <div className="scientific-slider-group" title="Visual scaling only; it does not change the electromagnetic fields.">
                <ScientificSlider controlId="gainInput" />
              </div>
            </section>
<section className="panel-section visual-field-section">
              <h2>Field map</h2>
              <VisualFieldControls />
            </section>
            <section className="panel-section visual-overlays-section">
              <h2>Overlays</h2>
              <VisualOverlayControls />
            </section>
            </div>
  );
}



export function ResultsPanel({ active }: { active: boolean }) {
  return (
            <div id="tab-results" className={`control-tab-panel${active ? " is-active" : ""}`} role="tabpanel" aria-labelledby="tab-results-button" data-control-panel="results" hidden={!active}>
<section className="panel-section diagnostics-section">
              <FdtdRunOutcome />
              <section className="scene-observables-panel results-detail-panel panel-section">
                <h2>Scene checks</h2>
                <div className="results-detail-body">
                  <SceneObservableResults />
                </div>
              </section>
              <CarbonDisclosure className="maxwell-check-panel results-detail-panel panel-section" title="Maxwell checker">
                <div className="results-detail-body">
                  <div className="button-row maxwell-check-controls">
                    <CarbonField className="toggle-row">
                      <CarbonInput id="maxwellCheckInput" type="checkbox" />
                      <span>Discrete Maxwell checker</span>
                    </CarbonField>
                    <CarbonButton id="maxwellCheckResetBtn" className="text-button" type="button">Reset check</CarbonButton>
                  </div>
                  <p className="results-insight-note">Checks the last Yee update against the discrete curl equations, away from CPML, sources, material interfaces, PEC, loss, dispersion, tensors, gain, and nonlinear cells.</p>
                  <MaxwellCheckResults />
                </div>
              </CarbonDisclosure>
              <CarbonDisclosure className="monitor-panel results-detail-panel panel-section" title="Line monitors">
                <LineMonitorResults />
              </CarbonDisclosure>
              <CarbonDisclosure className="custom-monitor-panel results-detail-panel panel-section" title="Custom monitors">
                <div className="results-detail-body">
                  <CustomMonitorResults />
                </div>
              </CarbonDisclosure>
              <CarbonDisclosure className="sweep-panel results-detail-panel panel-section" title="Parameter sweep">
                <div className="results-detail-body">
                  <div className="two-col">
                    <CarbonField>
                      <span>Sweep</span>
                      <CarbonSelect id="sweepModeInput">
                        <option value="angle">Angle θ</option>
                        <option value="frequency">Frequency f</option>
                        <option value="amplitude">Source amplitude</option>
                        <option value="gainLoss">Gain/loss γ</option>
                        <option value="symmetry">Symmetry break δ</option>
                        <option value="blochK">Bloch k/πa</option>
                        <option value="direction">Direction F/R</option>
                      </CarbonSelect>
                    </CarbonField>
                    <CarbonField>
                      <span>points</span>
                      <CarbonInput id="sweepSamplesInput" type="number" inputMode="decimal" autoComplete="off" min="3" max="41" step="1" value="9" />
                    </CarbonField>
                  </div>
                  <div className="two-col">
                    <CarbonField>
                      <span>start</span>
                      <CarbonInput id="sweepStartInput" type="number" inputMode="decimal" autoComplete="off" min="-80" max="80" step="1" value="0" />
                    </CarbonField>
                    <CarbonField>
                      <span>end</span>
                      <CarbonInput id="sweepEndInput" type="number" inputMode="decimal" autoComplete="off" min="-80" max="80" step="1" value="70" />
                    </CarbonField>
                  </div>
                  <CarbonField>
                    <span>steps / point</span>
                    <CarbonInput id="sweepStepsInput" type="number" inputMode="decimal" autoComplete="off" min="120" max="8000" step="60" value="720" />
                  </CarbonField>
                  <CarbonField className="toggle-row sweep-memory-row">
                    <CarbonInput id="sweepBidirectionalInput" type="checkbox" />
                    <span>Bidirectional</span>
                  </CarbonField>
                  <div className="sweep-actions">
                    <CarbonButton id="sweepRunBtn" className="text-button primary-button" data-carbon-kind="primary" type="button">Run sweep</CarbonButton>
                    <CarbonButton id="sweepExportBtn" className="text-button" type="button" disabled>Export CSV</CarbonButton>
                  </div>
                  <p id="sweepStatus" className="sweep-status" role="status" aria-live="polite">No sweep yet.</p>
                  <canvas id="sweepChart" className="sweep-chart" width="420" height="180" aria-label="R and T sweep chart"></canvas>
                  <div className="chart-footer">
                    <div className="chart-legend" aria-hidden="true">
                      <span><i className="legend-swatch reflectance"></i>R</span>
                      <span><i className="legend-swatch transmittance"></i>T</span>
                      <span><i className="legend-swatch auxiliary"></i>Aux</span>
                    </div>
                    <output id="sweepChartReadout" className="chart-readout">No sweep point</output>
                  </div>
                </div>
              </CarbonDisclosure>
              <CarbonDisclosure className="analysis-panel results-detail-panel panel-section" title="Spectral / NTFF">
                <div className="results-detail-body">
                  <div className="analysis-panel-header">
                    <CarbonField className="toggle-row">
                      <CarbonInput id="analysisInput" type="checkbox" checked />
                      <span>Spectral + NTFF</span>
                    </CarbonField>
                    <CarbonButton id="analysisResetBtn" className="text-button" type="button">Reset analysis</CarbonButton>
                  </div>
                  <div className="sweep-actions">
                    <CarbonButton id="lineReferenceCaptureBtn" className="text-button" type="button">Capture reference</CarbonButton>
                    <CarbonButton id="lineReferenceClearBtn" className="text-button" type="button">Clear reference</CarbonButton>
                  </div>
                  <p id="lineReferenceStatus" className="sweep-status">No line-monitor reference captured.</p>
                  <p id="analysisStatus" className="sweep-status">Waiting for samples.</p>
                  <div className="analysis-chart-grid">
                    <div id="spectrumChart" className="analysis-chart scientific-plot-surface" role="img" tabIndex={0} aria-describedby="analysisChartReadout" aria-label="Probe spectrum. Collecting samples."></div>
                    <canvas id="farFieldChart" className="analysis-chart" width="420" height="160" role="img" tabIndex={0} aria-describedby="analysisChartReadout" aria-label="Near-to-far angular pattern. Collecting phasors."></canvas>
                  </div>
                  <div className="chart-footer">
                    <div className="chart-legend" aria-hidden="true">
                      <span><i className="legend-swatch spectrum"></i>Spectrum</span>
                      <span><i className="legend-swatch farfield"></i>Far field</span>
                    </div>
                    <output id="analysisChartReadout" className="chart-readout">Focus or move over a chart</output>
                  </div>
                </div>
              </CarbonDisclosure>
            </section>
            </div>
  );
}



export function ValidationPanel({ active }: { active: boolean }) {
  useFdtdRuntimeSelector((current) => current ? `${current.gridNx}|${current.gridNy}|${current.cellsPerWavelength}|${current.subpixelSmoothingEnabled}` : "");
  const state = runtimeState();
  return (
            <div id="tab-config" className={`control-tab-panel${active ? " is-active" : ""}`} role="tabpanel" aria-labelledby="tab-config-button" data-control-panel="config" hidden={!active}>
            <NumericalPreflight />
            <section className="panel-section grid-section config-detail-panel">
              <h2>Grid</h2>
              <div className="config-detail-body">
                <div className="two-col">
                  <CarbonField>
                    <span><i>N</i><sub>x</sub> cells</span>
                    <CarbonInput controlled id="gridNxInput" type="number" inputMode="decimal" autoComplete="off" min="80" max="1200" step="10" value={state?.gridNx ?? 360} />
                  </CarbonField>
                  <CarbonField>
                    <span><i>N</i><sub>y</sub> cells</span>
                    <CarbonInput controlled id="gridNyInput" type="number" inputMode="decimal" autoComplete="off" min="60" max="800" step="10" value={state?.gridNy ?? 240} />
                  </CarbonField>
                </div>
                <div className="two-col">
                  <CarbonField>
                    <span>Cells / &lambda;<sub>0</sub></span>
                    <CarbonInput controlled id="cellsPerWavelengthInput" type="number" inputMode="decimal" autoComplete="off" min="8" max="80" step="1" value={state?.cellsPerWavelength ?? 20} />
                  </CarbonField>
                  <CarbonField className="toggle-row grid-option-toggle">
                    <CarbonInput controlled id="subpixelSmoothingInput" type="checkbox" checked={state?.subpixelSmoothingEnabled ?? false} />
                    <span>Subpixel smoothing</span>
                  </CarbonField>
                </div>
                <div className="diagnostic-metric">
                  <span>Subpixel smoothing status</span>
                  <output>{state?.subpixelSmoothingEnabled ? "On · passive corners" : "Off · passive interfaces only"}</output>
                </div>
                <p className="simulation-guide-note">Cells / &lambda;<sub>0</sub> sets the normalized grid resolution. Subpixel smoothing only changes passive dielectric interface coefficients; PEC, dispersive, tensorial, nonlinear, gain, and phase-change cells are left unchanged.</p>
              </div>
            </section>
            <CarbonDisclosure className="panel-section reproducibility-section config-detail-panel" title="Reproducibility">
              <div className="config-detail-body">
                <div className="button-row">
                  <CarbonButton id="exportSceneBtn" className="text-button" data-carbon-kind="primary" type="button" onClick={() => requestRuntimeAction("export-scene")}>Export JSON</CarbonButton>
                  <CarbonFileInput id="importSceneFileInput" className="text-button" accept="application/json,.json" labelText="Import JSON" onChange={(event) => {
                    const input = event.currentTarget;
                    requestRuntimeAction("import-scene", { file: input.files?.[0] ?? null });
                    input.value = "";
                  }} />
                  <CarbonButton id="copySceneUrlBtn" className="text-button" type="button" onClick={() => requestRuntimeAction("copy-scene-url")}>Copy URL</CarbonButton>
                </div>
                <CarbonTextArea id="shareSceneUrlOutput" className="share-url-output" readOnly hidden></CarbonTextArea>
                <ReproStatus />
              </div>
            </CarbonDisclosure>
            <CarbonDisclosure className="panel-section performance-panel config-detail-panel" title="Performance">
              <PerformanceResults />
            </CarbonDisclosure>
            </div>
  );
}
