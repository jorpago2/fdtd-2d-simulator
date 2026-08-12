import { createRoot } from "react-dom/client";
import { useLayoutEffect, type ReactNode } from "react";
import Plotly from "plotly.js-basic-dist-min";
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

(globalThis as typeof globalThis & { Plotly: typeof Plotly }).Plotly = Plotly;
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
  return new Promise((resolve) => {
    createRoot(mount).render(
      <>
        <RootCommit onCommit={resolve} />
        {content}
      </>,
    );
  });
}

async function startApplication() {
  await upgradeCarbonDisclosures();
  await Promise.all([
    renderReactRoot(requiredElement("reactHeaderRoot"), <ApplicationHeader />),
    renderReactRoot(requiredElement("reactWorkflowRoot"), <WorkflowNavigation />),
    renderReactRoot(requiredElement("reactSceneSearchRoot"), <SceneSearch />),
    renderReactRoot(requiredElement("reactFooterRoot"), <StatusFooter />),
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
