import { useEffect, useState } from "react";
import { ApplicationHeader, StatusFooter, WorkflowNavigation } from "./carbon-shell";
import { CarbonButton } from "./carbon-primitives";
import { CanvasStage } from "./canvas-stage";
import { ControlPanel } from "./control-panel";
import { requestRuntimeAction } from "./runtime-state";

export function FdtdWorkspace() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contextInspectorOpen, setContextInspectorOpen] = useState(false);
  useEffect(() => {
    const syncDrawer = (event: Event) => setDrawerOpen(Boolean((event as CustomEvent<{ open?: unknown }>).detail?.open));
    window.addEventListener("fdtd:control-drawer-state", syncDrawer);
    document.body.classList.toggle("controls-drawer-open", drawerOpen);
    return () => {
      window.removeEventListener("fdtd:control-drawer-state", syncDrawer);
      document.body.classList.remove("controls-drawer-open");
    };
  }, [drawerOpen]);
  useEffect(() => {
    const syncContextInspector = (event: Event) => {
      setContextInspectorOpen(Boolean((event as CustomEvent<{ open?: unknown }>).detail?.open));
    };
    window.addEventListener("fdtd:context-inspector-state", syncContextInspector);
    return () => window.removeEventListener("fdtd:context-inspector-state", syncContextInspector);
  }, []);
  return (
    <>
      <a className="skip-link" href="#simulatorWorkspace">Skip to simulator workspace</a>
      <div className={`app-shell cds--grid${drawerOpen ? " controls-open" : ""}${contextInspectorOpen ? " contextual-inspector-open" : ""}`}>
        <ApplicationHeader />
        <main
          id="simulatorWorkspace"
          className="workspace cds--css-grid cds--css-grid--condensed cds--css-grid--full-width"
          aria-labelledby="simulator-title"
          tabIndex={-1}
        >
          <h1 id="simulator-title" className="scientific-visually-hidden">
            EM Wave Simulator — 2D FDTD laboratory
          </h1>
          <WorkflowNavigation />
          <CanvasStage />
          <aside
            id="contextInspectorHost"
            className="context-inspector-host"
            aria-label="Canvas properties"
            aria-hidden={contextInspectorOpen ? "false" : "true"}
            inert={!contextInspectorOpen}
            hidden={!contextInspectorOpen}
          />
          <ControlPanel />
          <StatusFooter />
          <CarbonButton
            id="controlDrawerBackdrop"
            className="control-drawer-backdrop"
            type="button"
            aria-label="Close controls"
            hidden
            onClick={() => requestRuntimeAction("close-controls")}
          />
        </main>
      </div>
    </>
  );
}
