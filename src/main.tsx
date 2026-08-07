import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import Plotly from "plotly.js-basic-dist-min";
import legacyRuntimeScripts from "./legacy-runtime.json";
import "./core/app-state";
import "./core/boundary-state";
import "./core/state-normalizer";
import "./data/scene-catalog-loader";
import "./ui/entity-selection-controller";
import "./ui/material-selection-controller";
import "./ui/visual-layer-model";
import { VisualFieldControls, VisualOverlayControls } from "./ui/visual-controls";

declare const __FDTD_BUILD_VERSION__: string;

(globalThis as typeof globalThis & { Plotly: typeof Plotly }).Plotly = Plotly;

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing React mount point: #${id}`);
  return element;
}

function Brand() {
  return (
    <div className="brand-heading" data-react-ui="brand">
      <h1 className="brand-title">EM Wave Simulator</h1>
      <p className="brand-descriptor">2D FDTD laboratory</p>
    </div>
  );
}

function FooterLinks() {
  return (
    <>
      <span><b>Grid</b> <output id="statusGridOutput">360 × 240</output></span>
      <span><b>Step</b> <output id="statusStepOutput">0</output></span>
      <span><b>CFL</b> <output id="statusCourantOutput">0.10</output></span>
      <span><b>Boundary</b> <output id="statusBoundaryOutput">CPML</output></span>
      <span className="status-strip-author" data-react-ui="footer">
        <a href="https://www.uv.es/jorpago2" target="_blank" rel="noopener noreferrer">Jorge Parra</a>
        <span aria-hidden="true">{"\u00b7"}</span>
        <a href="https://jorpago2.github.io/" target="_blank" rel="noopener noreferrer">Online Simulators &amp; Tools</a>
      </span>
    </>
  );
}

function loadClassicScript(source: string): Promise<void> {
  const scriptUrl = new URL(source, document.baseURI);
  scriptUrl.searchParams.set("v", __FDTD_BUILD_VERSION__);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl.href;
    script.async = false;
    script.dataset.runtimeScript = "";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load runtime script: ${scriptUrl.pathname}`));
    document.body.append(script);
  });
}

async function startLegacyRuntime(): Promise<void> {
  await Promise.all(legacyRuntimeScripts.map(loadClassicScript));
}

flushSync(() => {
  createRoot(requiredElement("reactBrandRoot")).render(<Brand />);
  createRoot(requiredElement("reactFooterRoot")).render(<FooterLinks />);
  createRoot(requiredElement("reactVisualFieldRoot")).render(<VisualFieldControls />);
  createRoot(requiredElement("reactVisualOverlaysRoot")).render(<VisualOverlayControls />);
});
void startLegacyRuntime().catch((error: unknown) => {
  console.error("FDTD runtime startup failed", error);
});
