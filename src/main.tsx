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
import {
  CarbonButtonBridge,
  CarbonFormBridge,
  prepareCarbonButtonBridge,
  prepareCarbonFormBridge,
} from "./ui/carbon-button-bridge";
import {
  ApplicationHeader,
  SceneSearch,
  StatusFooter,
  WorkflowNavigation,
} from "./ui/carbon-shell";
import { VisualFieldControls, VisualOverlayControls } from "./ui/visual-controls";
import { installCarbonSceneBrowser } from "./ui/scene-browser";
import {
  installCarbonDisclosureUpgrade,
  upgradeCarbonDisclosures,
} from "./ui/carbon-disclosure-upgrade";
import {
  installScientificSliderControls,
  ScientificSliderRoot,
  scientificSliderDefinitions,
} from "./ui/scientific-sliders";

declare const __FDTD_BUILD_VERSION__: string;

(globalThis as typeof globalThis & { Plotly: typeof Plotly }).Plotly = Plotly;
installCarbonSceneBrowser();
installCarbonDisclosureUpgrade();
installScientificSliderControls();
upgradeCarbonDisclosures();

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing React mount point: #${id}`);
  return element;
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
  createRoot(requiredElement("reactHeaderRoot")).render(<ApplicationHeader />);
  createRoot(requiredElement("reactWorkflowRoot")).render(<WorkflowNavigation />);
  createRoot(requiredElement("reactSceneSearchRoot")).render(<SceneSearch />);
  createRoot(requiredElement("reactFooterRoot")).render(<StatusFooter />);
  createRoot(requiredElement("reactVisualFieldRoot")).render(<VisualFieldControls />);
  createRoot(requiredElement("reactVisualOverlaysRoot")).render(<VisualOverlayControls />);
  scientificSliderDefinitions().forEach((definition) => {
    createRoot(requiredElement(definition.mountId)).render(<ScientificSliderRoot definition={definition} />);
  });
});

const bridgedButtons = prepareCarbonButtonBridge();
const bridgedFormControls = prepareCarbonFormBridge();
const bridgeHost = document.createElement("div");
bridgeHost.className = "carbon-portal-host";
bridgeHost.setAttribute("aria-hidden", "true");
document.body.append(bridgeHost);
flushSync(() => {
  createRoot(bridgeHost).render(
    <>
      <CarbonButtonBridge buttons={bridgedButtons} />
      <CarbonFormBridge controls={bridgedFormControls} />
    </>,
  );
});

void startLegacyRuntime().catch((error: unknown) => {
  console.error("FDTD runtime startup failed", error);
});
