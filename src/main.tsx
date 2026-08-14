import { createRoot } from "react-dom/client";
import { useLayoutEffect, type ReactNode } from "react";
import Plotly from "plotly.js-basic-dist-min";
import {
  SCIENTIFIC_PLOT_LINE_WIDTHS,
  ScientificUiProvider,
  createScientificPlotlyConfig,
  createScientificPlotlyLayout,
  prepareScientificPlotlyToolbar,
} from "@jorpago2/scientific-ui";
import "@jorpago2/scientific-ui/styles.css";
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
  FdtdRunOutcome,
  NumericalPreflight,
  SceneSearch,
  StatusFooter,
  WorkflowNavigation,
} from "./ui/carbon-shell";
import { VisualFieldControls, VisualOverlayControls } from "./ui/visual-controls";
import { installCarbonSceneBrowser } from "./ui/scene-browser";
import {
  installCarbonDisclosures,
  upgradeCarbonDisclosures,
} from "./ui/carbon-disclosures";
import {
  installScientificSliderControls,
  ScientificSliderRoot,
  scientificSliderDefinitions,
} from "./ui/scientific-sliders";

const FDTD_THEME_STORAGE_KEY = "fdtdTheme";

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
installCarbonSceneBrowser();
installCarbonDisclosures();
installScientificSliderControls();

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing React mount point: #${id}`);
  return element;
}

function RootCommit({ onCommit }: { onCommit: () => void }) {
  useLayoutEffect(onCommit, [onCommit]);
  return null;
}

function renderReactRoot(mount: HTMLElement, content: ReactNode): Promise<void> {
  mount.dataset.carbonReactRoot = "";
  return new Promise((resolve) => {
    createRoot(mount).render(
      <ScientificUiProvider themeStorageKey={FDTD_THEME_STORAGE_KEY}>
        <RootCommit onCommit={resolve} />
        {content}
      </ScientificUiProvider>,
    );
  });
}

window.addEventListener("scientific-ui:theme-applied", (event) => {
  const isDark = Boolean((event as CustomEvent<{ isDark?: unknown }>).detail?.isDark);
  const theme = isDark ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new CustomEvent("fdtd:theme-change", { detail: { theme } }));
});

async function startApplication() {
  await upgradeCarbonDisclosures();
  await Promise.all([
    renderReactRoot(requiredElement("reactHeaderRoot"), <ApplicationHeader />),
    renderReactRoot(requiredElement("reactWorkflowRoot"), <WorkflowNavigation />),
    renderReactRoot(requiredElement("reactSceneSearchRoot"), <SceneSearch />),
    renderReactRoot(requiredElement("reactFooterRoot"), <StatusFooter />),
    renderReactRoot(requiredElement("reactRunOutcomeRoot"), <FdtdRunOutcome />),
    renderReactRoot(requiredElement("reactNumericalPreflightRoot"), <NumericalPreflight />),
    renderReactRoot(requiredElement("reactVisualFieldRoot"), <VisualFieldControls />),
    renderReactRoot(requiredElement("reactVisualOverlaysRoot"), <VisualOverlayControls />),
    ...scientificSliderDefinitions().map((definition) => renderReactRoot(
      requiredElement(definition.mountId),
      <ScientificSliderRoot definition={definition} />,
    )),
  ]);

  const bridgedButtons = prepareCarbonButtonBridge();
  const bridgedFormControls = prepareCarbonFormBridge();
  const bridgeHost = document.createElement("div");
  bridgeHost.className = "carbon-portal-host";
  bridgeHost.setAttribute("aria-hidden", "true");
  document.body.append(bridgeHost);
  await renderReactRoot(bridgeHost,
    <>
      <CarbonButtonBridge buttons={bridgedButtons} />
      <CarbonFormBridge controls={bridgedFormControls} />
    </>,
  );

  await import("./runtime-entry");
}

const applicationReady = startApplication();
(window as typeof window & { FdtdReady: Promise<void> }).FdtdReady = applicationReady;
void applicationReady.catch((error: unknown) => {
  console.error("FDTD runtime startup failed", error);
});
