import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { CarbonButton } from "./carbon-primitives";
import { ResultsPanel, RunPanel, ScenePanel, ValidationPanel } from "./control-panels";
import { requestRuntimeAction } from "./runtime-state";

const tabs = [
  ["scenes", "1", "Model", "Step 1 · Model", "Model setup"],
  ["simulation", "2", "Run", "Step 2 · Run", "Run and display"],
  ["results", "3", "Measure", "Step 3 · Measure", "Measurements"],
  ["config", "4", "Validate", "Step 4 · Validate", "Numerical checks"],
] as const;

type TabName = typeof tabs[number][0];

function isTabName(value: unknown): value is TabName {
  return tabs.some(([name]) => name === value);
}

export function ControlPanel() {
  const [active, setActive] = useState<TabName>("scenes");
  const [open, setOpen] = useState(false);
  const panelScrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncWorkflow = (event: Event) => {
      const layer = (event as CustomEvent<{ layer?: unknown }>).detail?.layer;
      if (isTabName(layer)) setActive(layer);
    };
    const syncDrawer = (event: Event) => {
      setOpen(Boolean((event as CustomEvent<{ open?: unknown }>).detail?.open));
    };
    window.addEventListener("fdtd:workflow-change", syncWorkflow);
    window.addEventListener("fdtd:control-drawer-state", syncDrawer);
    return () => {
      window.removeEventListener("fdtd:workflow-change", syncWorkflow);
      window.removeEventListener("fdtd:control-drawer-state", syncDrawer);
    };
  }, []);

  useLayoutEffect(() => {
    panelScrollerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [active]);

  const choose = (tab: TabName) => {
    setActive(tab);
    requestRuntimeAction("control-tab-request", { tab });
  };

  const moveTabFocus = (event: KeyboardEvent<HTMLButtonElement>, direction: number | "first" | "last") => {
    const current = tabs.findIndex(([name]) => name === active);
    const next = direction === "first"
      ? 0
      : direction === "last"
        ? tabs.length - 1
        : (current + direction + tabs.length) % tabs.length;
    event.preventDefault();
    choose(tabs[next][0]);
    document.getElementById(`tab-${tabs[next][0]}-button`)?.focus();
  };

  const context = tabs.find(([name]) => name === active) ?? tabs[0];
  return (
    <aside
      id="controlPanel"
      className="control-panel scientific-task-panel"
      aria-label={`${context[4]} controls`}
      aria-hidden={!open}
      inert={!open}
      tabIndex={-1}
      data-mobile-layer={active}
    >
      <div className="control-panel-header scientific-task-panel__header">
        <div className="control-panel-title-block scientific-task-panel__heading">
          <p className="panel-kicker">{context[3]}</p>
          <h2>{context[4]}</h2>
        </div>
        <div className="control-panel-actions scientific-task-panel__actions">
          <CarbonButton
            id="controlDrawerCloseBtn"
            className="icon-button compact-button control-drawer-close"
            data-carbon-icon-only="true"
            type="button"
            aria-label="Close controls"
            title="Close controls"
            onClick={() => requestRuntimeAction("close-controls")}
          >
            &times;
          </CarbonButton>
        </div>
      </div>
      <div className="control-tabs" role="tablist" aria-label="Control sections">
        {tabs.map(([name, step, label]) => {
          const selected = name === active;
          return (
            <CarbonButton
              className={`control-tab-button${selected ? " is-active" : ""}`}
              type="button"
              role="tab"
              id={`tab-${name}-button`}
              aria-controls={`tab-${name}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              data-control-tab={name}
              onClick={() => choose(name)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") moveTabFocus(event, 1);
                else if (event.key === "ArrowLeft" || event.key === "ArrowUp") moveTabFocus(event, -1);
                else if (event.key === "Home") moveTabFocus(event, "first");
                else if (event.key === "End") moveTabFocus(event, "last");
              }}
              key={name}
            >
              <span className="nav-step" aria-hidden="true">{step}</span>
              <span className="nav-label">{label}</span>
            </CarbonButton>
          );
        })}
      </div>
      <div ref={panelScrollerRef} className="control-tab-panels scientific-task-panel__body">
        <ScenePanel active={active === "scenes"} />
        <RunPanel active={active === "simulation"} />
        <ResultsPanel active={active === "results"} />
        <ValidationPanel active={active === "config"} />
      </div>
    </aside>
  );
}
