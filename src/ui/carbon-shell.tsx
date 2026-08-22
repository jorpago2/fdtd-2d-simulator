import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  ContentSwitcher,
  IconSwitch,
  OverflowMenu,
  OverflowMenuItem,
  Search,
  SkipToContent,
} from "@carbon/react";
import {
  Chemistry,
  Cursor_1,
  Download,
  Draw,
  Grid as GridIcon,
  Inspection,
  Pause,
  Play,
  Reset,
  SettingsAdjust,
  SkipForward,
} from "@carbon/react/icons";
import {
  ScientificAutosaveStatus,
  ScientificHeader,
  ScientificOutcomeSummary,
  ScientificPreflightSummary,
  ScientificRecoveryNotice,
  ScientificStatusBar,
  ScientificToolRail,
  useScientificAutosave,
  useScientificResultTransition,
  useScientificTheme,
  type ScientificStatusDescriptor,
} from "@jorpago2/scientific-ui";
import { requestRuntimeAction, runtimeState, runtimeStep, useFdtdRuntimeReady, useFdtdRuntimeSelector, useFdtdRuntimeState } from "./runtime-state";

type SimulationStatus = {
  state: "ready" | "running" | "modified" | "failed";
  label: string;
};

function isSceneSnapshot(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && (value as { kind?: unknown }).kind === "fdtd-2d-scene";
}

export function useFdtdAutosave() {
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const requestSessionSnapshot = useCallback(() => {
    window.dispatchEvent(new Event("fdtd:request-session-snapshot"));
  }, []);
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isSceneSnapshot(detail)) setSnapshot(detail);
    };
    window.addEventListener("fdtd:session-snapshot", update);
    window.addEventListener("fdtd:runtime-ready", requestSessionSnapshot);
    document.addEventListener("change", requestSessionSnapshot);
    document.addEventListener("pointerup", requestSessionSnapshot);
    return () => {
      window.removeEventListener("fdtd:session-snapshot", update);
      window.removeEventListener("fdtd:runtime-ready", requestSessionSnapshot);
      document.removeEventListener("change", requestSessionSnapshot);
      document.removeEventListener("pointerup", requestSessionSnapshot);
    };
  }, [requestSessionSnapshot]);
  const autosave = useScientificAutosave({
    storageKey: "fdtd-2d-simulator:session",
    value: snapshot,
    onRestore: (saved) => {
      window.dispatchEvent(new CustomEvent("fdtd:restore-session", { detail: saved }));
      requestSessionSnapshot();
    },
    validate: isSceneSnapshot,
    shouldSave: isSceneSnapshot,
    schemaVersion: 1,
    maxBytes: 3_000_000,
  });
  return autosave;
}

function useSimulationStatus() {
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>({ state: "ready", label: "Ready" });
  useEffect(() => {
    const syncSimulationStatus = (event: Event) => {
      const detail = (event as CustomEvent<Partial<SimulationStatus>>).detail;
      if (!detail || !["ready", "running", "modified", "failed"].includes(detail.state ?? "")) return;
      if (typeof detail.label !== "string" || !detail.label.trim()) return;
      setSimulationStatus((current) => current.state === detail.state && current.label === detail.label
        ? current
        : { state: detail.state!, label: detail.label! });
    };
    window.addEventListener("fdtd:simulation-status", syncSimulationStatus);
    return () => window.removeEventListener("fdtd:simulation-status", syncSimulationStatus);
  }, []);
  return simulationStatus;
}

function useSceneTitle() {
  const [title, setTitle] = useState("Plane wave in air");
  useEffect(() => {
    const sync = (event: Event) => {
      const nextTitle = (event as CustomEvent<{ title?: unknown }>).detail?.title;
      if (typeof nextTitle === "string" && nextTitle.trim()) setTitle((current) => current === nextTitle ? current : nextTitle);
    };
    window.addEventListener("fdtd:scene-title", sync);
    return () => window.removeEventListener("fdtd:scene-title", sync);
  }, []);
  return title;
}

export function ApplicationHeader() {
  const simulationStatus = useSimulationStatus();
  const sceneTitle = useSceneTitle();
  const runtimeReady = useFdtdRuntimeReady();

  const openFullGuide = () => {
    const runtimeWindow = window as Window & {
      FdtdOpenHelpGuide?: () => void;
      FdtdReady?: Promise<void>;
    };
    const runtimeGuide = runtimeWindow.FdtdOpenHelpGuide;
    if (runtimeGuide) {
      runtimeGuide();
      return;
    }
    void runtimeWindow.FdtdReady?.then(() => runtimeWindow.FdtdOpenHelpGuide?.());
  };

  const status: ScientificStatusDescriptor = {
    state: runtimeReady ? simulationStatus.state : "needs-input",
    label: runtimeReady ? simulationStatus.label : "Loading",
  };

  return (
    <ScientificHeader
      product="EM Wave Simulator"
      compactProduct="FDTD"
      productMark={<GridIcon size={20} />}
      descriptor="2D FDTD laboratory"
      contextLabel="Simulation"
      context={<span className="fdtd-scene-title">{sceneTitle}</span>}
      status={status}
      primaryAction={<CanvasPrimaryControls running={runtimeReady && simulationStatus.state === "running"} runtimeReady={runtimeReady} />}
      skipLink={<SkipToContent href="#simulatorWorkspace">Skip to simulator workspace</SkipToContent>}
      help={{
        id: "fdtd-help",
        summary: "Choose a scene, run the FDTD update, then inspect fields, materials, flux and numerical validation before interpreting the result.",
        shortcuts: [{ keys: ["Esc"], description: "Close the active guide or panel" }],
        action: { label: "Open full guide", onClick: openFullGuide },
      }}
      aria-label="EM Wave Simulator application header"
    />
  );
}

const workflowLayers = [
  ["scenes", "Model", GridIcon],
  ["simulation", "Run", Chemistry],
  ["results", "Measure", Inspection],
  ["config", "Validate", SettingsAdjust],
] as const;

export function WorkflowNavigation() {
  const [activeLayer, setActiveLayer] = useState<string | null>("scenes");
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    const syncActiveLayer = (event: Event) => {
      const layer = (event as CustomEvent<{ layer?: string }>).detail?.layer;
      if (layer && workflowLayers.some(([candidate]) => candidate === layer)) {
        setActiveLayer(layer);
      }
    };
    window.addEventListener("fdtd:workflow-change", syncActiveLayer);
    return () => window.removeEventListener("fdtd:workflow-change", syncActiveLayer);
  }, []);
  useEffect(() => {
    const syncDrawerState = (event: Event) => {
      setDrawerOpen(Boolean((event as CustomEvent<{ open?: unknown }>).detail?.open));
    };
    window.addEventListener("fdtd:control-drawer-state", syncDrawerState);
    return () => window.removeEventListener("fdtd:control-drawer-state", syncDrawerState);
  }, []);

  const chooseLayer = (layer: string | null) => {
    if (!layer) {
      requestRuntimeAction("close-controls");
      return;
    }
    setActiveLayer(layer);
    window.dispatchEvent(new CustomEvent("fdtd:workflow-change", { detail: { layer } }));
  };

  return (
    <ScientificToolRail
      label="Simulation workflow"
      items={workflowLayers.map(([id, label, Icon]) => ({
        id,
        label,
        icon: <Icon size={16} />,
        triggerId: `workflow-${id}`,
        controlsId: "controlPanel",
        className: "mobile-layer-button",
        dataAttributes: { "data-mobile-layer": id },
      }))}
      activeId={activeLayer}
      expandedId={drawerOpen ? activeLayer : null}
      onChange={chooseLayer}
    />
  );
}

interface CanvasPrimaryControlsProps {
  running: boolean;
  runtimeReady: boolean;
}

export function CanvasPrimaryControls({ running, runtimeReady }: CanvasPrimaryControlsProps) {
  const canvasMode = useFdtdRuntimeSelector((state) => state?.canvasMode ?? "select");
  const { isDark, toggleTheme } = useScientificTheme();
  const modeIndex = canvasMode === "brush" ? 1 : 0;

  useEffect(() => {
    let overflowHadFocus = false;
    const rememberResponsiveFocus = () => {
      const overflow = document.querySelector<HTMLElement>(".header-overflow-menu");
      overflowHadFocus = Boolean(overflow?.contains(document.activeElement));
    };
    const preserveResponsiveFocus = () => {
      const overflow = document.querySelector<HTMLElement>(".header-overflow-menu");
      const shouldRestore = overflowHadFocus || Boolean(overflow?.contains(document.activeElement));
      if (!shouldRestore) return;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!overflow || getComputedStyle(overflow).display !== "none") return;
          document.querySelector<HTMLElement>(".scientific-theme-toggle")?.focus();
          overflowHadFocus = false;
        });
      });
    };
    document.addEventListener("focusin", rememberResponsiveFocus);
    window.addEventListener("resize", preserveResponsiveFocus);
    return () => {
      document.removeEventListener("focusin", rememberResponsiveFocus);
      window.removeEventListener("resize", preserveResponsiveFocus);
    };
  }, []);

  return (
    <div className="header-simulation-controls" role="group" aria-label="Simulation and canvas controls">
      <div className="tool-group compact">
        <Button
          id="playPauseBtn"
          className="simulation-run-button"
          type="button"
          kind="primary"
          size="lg"
          hasIconOnly
          disabled={!runtimeReady}
          iconDescription={running ? "Pause simulation" : "Start simulation"}
          tooltipPosition="bottom"
          renderIcon={running ? Pause : Play}
          aria-label={running ? "Pause simulation" : "Start simulation"}
          aria-pressed={running}
          data-carbon-react="true"
          onClick={() => window.dispatchEvent(new Event("fdtd:toggle-running"))}
        />
        <Button
          id="stepBtn"
          className="header-step-button"
          type="button"
          kind="ghost"
          size="lg"
          hasIconOnly
          disabled={!runtimeReady}
          iconDescription="Step simulation"
          tooltipPosition="bottom"
          renderIcon={SkipForward}
          aria-label="Step simulation"
          onClick={() => requestRuntimeAction("simulation-step")}
        />
        <Button
          id="resetBtn"
          className="icon-button canvas-reset-button"
          type="button"
          kind="ghost"
          size="lg"
          hasIconOnly
          disabled={!runtimeReady}
          renderIcon={Reset}
          iconDescription="Reset field"
          tooltipPosition="bottom"
          title="Reset field"
          aria-label="Reset field"
          data-carbon-react="true"
          onClick={() => requestRuntimeAction("reset-simulation")}
        />
        <Button
          id="saveBtn"
          className="header-save-button"
          type="button"
          kind="ghost"
          size="lg"
          hasIconOnly
          disabled={!runtimeReady}
          iconDescription="Save PNG"
          tooltipPosition="bottom"
          renderIcon={Download}
          aria-label="Save PNG"
          onClick={() => requestRuntimeAction("save-png")}
        />
        <OverflowMenu
            className="header-overflow-menu"
            menuOptionsClass="scientific-header-overflow-options"
            iconDescription="More simulation actions"
            align="bottom-end"
            size="sm"
            flipped
          >
            <OverflowMenuItem className="fdtd-header-overflow-item" disabled={!runtimeReady} itemText="Step simulation" onClick={() => requestRuntimeAction("simulation-step")} />
            <OverflowMenuItem className="fdtd-header-overflow-item" disabled={!runtimeReady} itemText="Select and move objects" onClick={() => requestRuntimeAction("canvas-mode", { mode: "select" })} />
            <OverflowMenuItem className="fdtd-header-overflow-item" disabled={!runtimeReady} itemText="Draw materials" onClick={() => requestRuntimeAction("canvas-mode", { mode: "brush" })} />
            <OverflowMenuItem className="fdtd-header-overflow-item" disabled={!runtimeReady} itemText="Reset field" onClick={() => requestRuntimeAction("reset-simulation")} />
            <OverflowMenuItem className="fdtd-header-overflow-item" disabled={!runtimeReady} itemText="Save PNG" onClick={() => requestRuntimeAction("save-png")} />
            <OverflowMenuItem className="fdtd-header-overflow-item" itemText={isDark ? "Use light theme" : "Use dark theme"} onClick={toggleTheme} />
        </OverflowMenu>
      </div>
      <ContentSwitcher
        className="interaction-toggle scientific-content-switcher scientific-content-switcher--lg"
        selectedIndex={modeIndex}
        size="lg"
        onChange={({ index }) => requestRuntimeAction("canvas-mode", { mode: index === 1 ? "brush" : "select" })}
      >
        <IconSwitch id="selectModeBtn" name="select" text="Select and move canvas objects" align="bottom" data-carbon-react="true">
          <Cursor_1 size={20} aria-hidden={true} />
        </IconSwitch>
        <IconSwitch id="brushModeBtn" name="draw" text="Draw materials and geometries" align="bottom" data-carbon-react="true">
          <Draw size={20} aria-hidden={true} />
        </IconSwitch>
      </ContentSwitcher>
    </div>
  );
}

export function SceneSearch() {
  const [value, setValue] = useState("");
  useEffect(() => {
    const clear = () => setValue("");
    window.addEventListener("fdtd:scene-search-clear", clear);
    return () => window.removeEventListener("fdtd:scene-search-clear", clear);
  }, []);
  return (
    <Search
      id="sceneSearchInput"
      labelText="Search scenes"
      closeButtonLabelText="Clear scene search"
      placeholder="Bragg, Kerr, TEz..."
      size="lg"
      autoComplete="off"
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
    />
  );
}

type FdtdAutosave = ReturnType<typeof useFdtdAutosave>;

export function SessionRecovery({ autosave }: { autosave: FdtdAutosave }) {
  if (!autosave.recovery) return null;
  return <ScientificRecoveryNotice
    savedAt={autosave.recovery.savedAt}
    onRestore={autosave.restore}
    onDiscard={autosave.discard}
  />;
}

export function StatusFooter({ autosave }: { autosave: FdtdAutosave }) {
  const state = useFdtdRuntimeState();
  const simulationStatus = useSimulationStatus();
  const status: ScientificStatusDescriptor = {
    state: simulationStatus.state,
    label: simulationStatus.label,
  };
  return (
    <ScientificStatusBar
      className="fdtd-status-strip"
      aria-label="Simulation status"
      data-react-ui="footer"
      status={status}
      metadata={<div className="fdtd-status-metadata">
        <ScientificAutosaveStatus status={autosave.status} savedAt={autosave.lastSavedAt} />
        <span><b>Grid</b> <output>{state?.gridNx ?? 360} × {state?.gridNy ?? 240}</output></span>
        <span><b>Step</b> <output>{runtimeStep()}</output></span>
        <span><b>CFL</b> <output>0.10</output></span>
        <span><b>Boundary</b> <output>{state?.boundary === "reflective" ? "Reflective" : "CPML absorbing"}</output></span>
      </div>}
    />
  );
}

export function FdtdRunOutcome() {
  const simulationStatus = useSimulationStatus();
  const runtimeReady = useFdtdRuntimeReady();
  const outcomeHeading = useRef<HTMLHeadingElement>(null);
  const [resultSnapshot, setResultSnapshot] = useState({
    reflectance: "—",
    transmittance: "—",
    balance: "—",
    balanceMethod: "line monitors",
    balanceReady: false,
    angle: "0°",
    samples: 0,
    step: 0,
    insight: "Run the simulation to collect monitor samples.",
  });

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<Partial<typeof resultSnapshot>>).detail;
      if (detail) setResultSnapshot((current) => {
        const next = { ...current, ...detail };
        return Object.keys(next).every((key) => next[key as keyof typeof next] === current[key as keyof typeof current])
          ? current
          : next;
      });
    };
    window.addEventListener("fdtd:results-snapshot", sync);
    return () => window.removeEventListener("fdtd:results-snapshot", sync);
  }, []);

  const hasMonitorResult = resultSnapshot.reflectance !== "—" || resultSnapshot.transmittance !== "—";
  const outcomeState = simulationStatus.state === "running"
    ? "running"
    : simulationStatus.state === "failed"
      ? "failed"
      : hasMonitorResult
        ? "up-to-date"
        : "needs-input";

  useScientificResultTransition({
    state: outcomeState,
    resultRef: outcomeHeading,
    completionKey: hasMonitorResult ? `${resultSnapshot.reflectance}|${resultSnapshot.transmittance}|${resultSnapshot.balance}` : null,
    onReveal: () => window.dispatchEvent(new CustomEvent("fdtd:workflow-change", { detail: { layer: "results" } })),
  });

  return <div className="fdtd-outcome-group">
    <ScientificOutcomeSummary
      className="fdtd-run-outcome"
      title="Monitor outcome"
      headingRef={outcomeHeading}
      status={{
        state: outcomeState,
        label: simulationStatus.state === "running"
          ? "Collecting field samples"
          : simulationStatus.state === "failed"
            ? simulationStatus.label
            : hasMonitorResult
              ? `Monitor result current · ${resultSnapshot.samples} samples`
              : "No monitor result",
      }}
      summary={resultSnapshot.insight}
      metrics={hasMonitorResult ? [
        { id: "reflectance", label: "Estimated reflectance (fraction)", value: resultSnapshot.reflectance },
        { id: "transmittance", label: "Estimated transmittance (fraction)", value: resultSnapshot.transmittance },
        { id: "balance", label: "Power-balance residual (fraction)", value: resultSnapshot.balance },
        { id: "angle", label: "Propagation angle", value: resultSnapshot.angle },
      ] : []}
      actions={hasMonitorResult ? [
        { id: "save-field", label: "Save field PNG", emphasis: "primary", disabled: !runtimeReady, onClick: () => requestRuntimeAction("save-png") },
        { id: "review-validation", label: "Review validation", emphasis: "secondary", collapseAt: "sm", onClick: () => document.getElementById("sceneObservableResults")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
        { id: "reset-field", label: "Reset field", emphasis: "tertiary", disabled: !runtimeReady, overflowOnly: true, onClick: () => requestRuntimeAction("reset-simulation") },
      ] : [
        { id: "start-simulation", label: "Start simulation", emphasis: "primary", disabled: !runtimeReady || simulationStatus.state === "running", onClick: () => requestRuntimeAction("toggle-running") },
        { id: "review-numerics", label: "Review numerics", emphasis: "secondary", collapseAt: "sm", onClick: () => window.dispatchEvent(new CustomEvent("fdtd:workflow-change", { detail: { layer: "config" } })) },
      ]}
    />
    {hasMonitorResult && <p className="fdtd-result-context">Step {resultSnapshot.step.toLocaleString()} · {resultSnapshot.samples} samples · estimator: {resultSnapshot.balanceMethod}. R/T are dimensionless; power readouts use the simulator's normalized monitor units.</p>}
  </div>;
}

export function NumericalPreflight() {
  const simulationStatus = useSimulationStatus();
  useFdtdRuntimeSelector((current) => current ? `${current.gridNx}|${current.gridNy}|${current.cellsPerWavelength}` : "");
  const state = runtimeState();
  const [health, setHealth] = useState({ level: "stable", limit: 1 / Math.sqrt(2), reason: "CFL estimate is ready.", flags: [] as string[] });
  useEffect(() => {
    const sync = (event: Event) => {
      const next = (event as CustomEvent<typeof health>).detail;
      setHealth((current) => current.level === next.level
        && current.limit === next.limit
        && current.reason === next.reason
        && current.flags.join("\u0000") === next.flags.join("\u0000")
        ? current
        : next);
    };
    window.addEventListener("fdtd:numerical-health", sync);
    return () => window.removeEventListener("fdtd:numerical-health", sync);
  }, []);
  const nx = state?.gridNx ?? 360;
  const ny = state?.gridNy ?? 240;
  const cellsPerWavelength = state?.cellsPerWavelength ?? 20;
  const underResolved = cellsPerWavelength < 20;
  return <ScientificPreflightSummary
    className="fdtd-preflight"
    compact
    description="These checks assess whether the current discretization is safe to run. They do not replace mesh, domain and boundary convergence studies."
    status={{
      state: simulationStatus.state === "failed" ? "failed" : underResolved ? "warning" : "ready",
      label: simulationStatus.state === "failed" ? "Solver failed" : underResolved ? "Review resolution" : "Ready to run",
    }}
    checks={[
      { id: "grid", label: "Grid capacity", state: nx * ny <= 960_000 ? "passed" : "failed", value: `${nx} × ${ny}`, detail: `${(nx * ny).toLocaleString("en-US")} Yee cells` },
      { id: "resolution", label: "Free-space resolution", state: underResolved ? "warning" : "passed", value: `${cellsPerWavelength} cells / λ₀`, detail: underResolved ? "Material wavelengths and small features may be under-resolved." : "Still verify convergence for quantitative claims." },
      { id: "stability", label: "CFL stability", state: health.level === "unstable" ? "failed" : health.level === "caution" ? "warning" : "passed", value: `S = 0.10 / ${health.limit.toFixed(2)}`, detail: health.reason },
      { id: "run", label: "Current execution", state: simulationStatus.state === "running" ? "running" : simulationStatus.state === "failed" ? "failed" : simulationStatus.state === "modified" ? "ready" : "not-run", value: simulationStatus.state === "ready" ? "Not run" : simulationStatus.label, detail: simulationStatus.label },
    ]}
  />;
}
