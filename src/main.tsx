import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import Plotly from "plotly.js-basic-dist-min";
import {
  SCIENTIFIC_PLOT_LINE_WIDTHS,
  createScientificPlotlyConfig,
  createScientificPlotlyLayout,
  prepareScientificPlotlyToolbar,
  ScientificUiProvider,
} from "@jorpago2/scientific-ui";
import "@jorpago2/scientific-ui/styles.css";
import "./core/app-state";
import "./core/boundary-state";
import "./core/state-normalizer";
import "./data/scene-catalog-loader";
import "./ui/entity-selection-controller";
import "./ui/material-selection-controller";
import "./ui/visual-layer-model";
import "./ui/runtime-state";
import { FdtdWorkspace } from "./ui/fdtd-workspace";
import { installCarbonSceneBrowser } from "./ui/scene-browser";
import { installCarbonDisclosures } from "./ui/carbon-disclosures";
import { installScientificSliderControls } from "./ui/scientific-sliders";
import { FdtdThemeBridge } from "./ui/fdtd-theme";

(globalThis as typeof globalThis & { Plotly: typeof Plotly }).Plotly = Plotly;
(globalThis as typeof globalThis & {
  ScientificPlotUI: {
    createConfig: typeof createScientificPlotlyConfig;
    createLayout: typeof createScientificPlotlyLayout;
    lineWidths: typeof SCIENTIFIC_PLOT_LINE_WIDTHS;
    prepareToolbar: typeof prepareScientificPlotlyToolbar;
  };
}).ScientificPlotUI = {
  createConfig: createScientificPlotlyConfig,
  createLayout: createScientificPlotlyLayout,
  lineWidths: SCIENTIFIC_PLOT_LINE_WIDTHS,
  prepareToolbar: prepareScientificPlotlyToolbar,
};
installScientificSliderControls();

async function startApplication() {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing React application root");
  flushSync(() => createRoot(root).render(
    <ScientificUiProvider themeStorageKey="fdtdTheme">
      <FdtdThemeBridge />
      <FdtdWorkspace />
    </ScientificUiProvider>,
  ));

  installCarbonSceneBrowser();
  installCarbonDisclosures();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await import("./runtime-entry");
}

const applicationReady = startApplication();
(window as typeof window & { FdtdReady: Promise<void> }).FdtdReady = applicationReady;
void applicationReady.catch((error: unknown) => {
  console.error("FDTD runtime startup failed", error);
});
