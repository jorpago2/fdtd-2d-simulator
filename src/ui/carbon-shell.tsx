import { useEffect, useRef, useState } from "react";
import {
  Button,
  ContentSwitcher,
  Link,
  OverflowMenu,
  OverflowMenuItem,
  Search,
  Switch,
} from "@carbon/react";
import {
  Chemistry,
  Grid as GridIcon,
  Inspection,
  Pause,
  Play,
  Reset,
  SettingsAdjust,
} from "@carbon/react/icons";
import { ScientificAutosaveStatus, ScientificHeader, ScientificOutcomeSummary, ScientificPreflightSummary, ScientificRecoveryNotice, ScientificStatusBar, ScientificToolRail, useScientificAutosave, useScientificResultTransition } from "@jorpago2/scientific-ui";

type SimulationStatus = {
  state: "ready" | "running" | "modified" | "failed";
  label: string;
};

function isSceneSnapshot(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && (value as { kind?: unknown }).kind === "fdtd-2d-scene";
}

function useFdtdAutosave() {
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isSceneSnapshot(detail)) setSnapshot(detail);
    };
    const request = () => window.dispatchEvent(new Event("fdtd:request-session-snapshot"));
    window.addEventListener("fdtd:session-snapshot", update);
    window.addEventListener("fdtd:runtime-ready", request);
    document.addEventListener("change", request);
    document.addEventListener("pointerup", request);
    return () => {
      window.removeEventListener("fdtd:session-snapshot", update);
      window.removeEventListener("fdtd:runtime-ready", request);
      document.removeEventListener("change", request);
      document.removeEventListener("pointerup", request);
    };
  }, []);
  const autosave = useScientificAutosave({
    storageKey: "fdtd-2d-simulator:session",
    value: snapshot,
    onRestore: (saved) => window.dispatchEvent(new CustomEvent("fdtd:restore-session", { detail: saved })),
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
      setSimulationStatus({ state: detail.state!, label: detail.label });
    };
    window.addEventListener("fdtd:simulation-status", syncSimulationStatus);
    return () => window.removeEventListener("fdtd:simulation-status", syncSimulationStatus);
  }, []);
  return simulationStatus;
}

export function ApplicationHeader() {
  const helpGuideReturnFocusRef = useRef<HTMLElement | null>(null);
  const [compactHeader, setCompactHeader] = useState(() =>
    window.matchMedia("(max-width: 65.99rem), (max-height: 39.99rem)").matches
  );
  const simulationStatus = useSimulationStatus();

  useEffect(() => {
    const compactQuery = window.matchMedia("(max-width: 65.99rem), (max-height: 39.99rem)");
    const syncCompactHeader = () => setCompactHeader(compactQuery.matches);
    compactQuery.addEventListener("change", syncCompactHeader);
    return () => {
      compactQuery.removeEventListener("change", syncCompactHeader);
    };
  }, []);

  const openFullGuide = () => {
    const runtimeGuide = (window as Window & { FdtdOpenHelpGuide?: () => void }).FdtdOpenHelpGuide;
    if (runtimeGuide) {
      runtimeGuide();
      return;
    }
    const panel = document.getElementById("helpGuidePanel");
    if (!panel) return;
    const legacyToggle = document.getElementById("helpGuideToggle");
    const closeButton = document.getElementById("helpGuideCloseBtn");
    helpGuideReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.hidden = false;
    legacyToggle?.setAttribute("aria-expanded", "true");
    panel.focus({ preventScroll: true });

    const closeGuide = () => {
      panel.hidden = true;
      legacyToggle?.setAttribute("aria-expanded", "false");
      closeButton?.removeEventListener("click", closeGuide);
      document.removeEventListener("keydown", handleEscape, true);
      helpGuideReturnFocusRef.current?.focus({ preventScroll: true });
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeGuide();
    };
    closeButton?.addEventListener("click", closeGuide);
    document.addEventListener("keydown", handleEscape, true);
  };

  return (
    <ScientificHeader
      aria-label="EM Wave Simulator application header"
      product="EM Wave Simulator"
      productIcon="fdtd"
      descriptor="2D FDTD laboratory"
      href="./"
      contextLabel="Simulation"
      context={<span id="headerSceneTitle">Plane wave in air</span>}
      status={simulationStatus}
      help={{
        id: "fdtd-help",
        summary: "Choose a scene, run the FDTD update, then inspect fields, materials, flux and numerical validation before interpreting the result.",
        shortcuts: [{ keys: ["Esc"], description: "Close the active guide or panel" }],
        action: {
          label: "Open full guide",
          onClick: openFullGuide,
        },
      }}
      primaryAction={<CanvasPrimaryControls
        compactHeader={compactHeader}
        running={simulationStatus.state === "running"}
      />}
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
  const chooseLayer = (layer: string | null) => {
    if (!layer) return;
    setActiveLayer(layer);
    window.dispatchEvent(new CustomEvent("fdtd:workflow-change", { detail: { layer } }));
  };
  return (
    <ScientificToolRail
      label="Simulation workflow"
      activeId={activeLayer}
      expandedId={activeLayer}
      onChange={chooseLayer}
      collapsible={false}
      items={workflowLayers.map(([layer, label, Icon]) => ({
        id: layer,
        label,
        icon: <Icon size={16} aria-hidden={true} />,
        controlsId: "controlPanel",
        className: "mobile-layer-button",
        dataAttributes: { "data-mobile-layer": layer },
      }))}
    />
  );
}

interface CanvasPrimaryControlsProps {
  compactHeader: boolean;
  running: boolean;
}

export function CanvasPrimaryControls({ compactHeader, running }: CanvasPrimaryControlsProps) {
  const [modeIndex, setModeIndex] = useState(0);

  return (
    <div className="header-simulation-controls" role="group" aria-label="Simulation and canvas controls">
      <div className="tool-group compact">
        <Button
          id="playPauseBtn"
          className="simulation-run-button"
          type="button"
          kind="primary"
          size="lg"
          hasIconOnly={compactHeader}
          iconDescription={running ? "Pause simulation" : "Start simulation"}
          tooltipPosition="bottom"
          renderIcon={running ? Pause : Play}
          aria-label={running ? "Pause simulation" : "Start simulation"}
          aria-pressed={running}
          data-carbon-react="true"
        >
          {compactHeader ? null : <span className="simulation-run-label">{running ? "Pause" : "Start"}</span>}
        </Button>
        <Button
          id="stepBtn"
          className="header-step-button"
          type="button"
          kind="ghost"
          size="sm"
        >
          Step
        </Button>
        <Button
          id="resetBtn"
          className="icon-button canvas-reset-button"
          type="button"
          kind="ghost"
          size="sm"
          hasIconOnly
          iconDescription="Reset field"
          tooltipPosition="bottom"
          title="Reset field"
          data-carbon-react="true"
        >
          <Reset size={16} aria-hidden={true} />
        </Button>
        <Button
          id="saveBtn"
          className="header-save-button"
          type="button"
          kind="ghost"
          size="sm"
        >
          Save PNG
        </Button>
        {compactHeader && (
          <OverflowMenu
            className="header-overflow-menu"
            iconDescription="More simulation actions"
            align="bottom-end"
            size="sm"
            flipped
          >
            <OverflowMenuItem itemText="Step simulation" onClick={() => document.getElementById("stepBtn")?.click()} />
            <OverflowMenuItem itemText="Reset field" onClick={() => document.getElementById("resetBtn")?.click()} />
            <OverflowMenuItem itemText="Save PNG" onClick={() => document.getElementById("saveBtn")?.click()} />
          </OverflowMenu>
        )}
      </div>
      <ContentSwitcher
        className="interaction-toggle"
        selectedIndex={modeIndex}
        size="sm"
        onChange={({ index }) => setModeIndex(index ?? 0)}
      >
        <Switch id="selectModeBtn" name="select" text="Select" title="Select and move canvas objects" data-carbon-react="true">Select</Switch>
        <Switch id="brushModeBtn" name="draw" text="Draw" title="Draw materials and geometries" data-carbon-react="true">Draw</Switch>
      </ContentSwitcher>
    </div>
  );
}

export function SceneSearch() {
  return (
    <Search
      id="sceneSearchInput"
      labelText="Search scenes"
      closeButtonLabelText="Clear scene search"
      placeholder="Bragg, Kerr, TEz..."
      size="lg"
      autoComplete="off"
    />
  );
}

export function StatusFooter() {
  const simulationStatus = useSimulationStatus();
  const autosave = useFdtdAutosave();
  return (
    <><>{autosave.recovery && <ScientificRecoveryNotice savedAt={autosave.recovery.savedAt} onRestore={autosave.restore} onDiscard={autosave.discard} />}</>
    <ScientificStatusBar className="fdtd-status-strip" embedded aria-label="Simulation status" status={simulationStatus} metadata={<>
      <ScientificAutosaveStatus status={autosave.status} savedAt={autosave.lastSavedAt} />
      <span><b>Grid</b> <output id="statusGridOutput">360 × 240</output></span>
      <span><b>Step</b> <output id="statusStepOutput">0</output></span>
      <span><b>CFL</b> <output id="statusCourantOutput">0.10</output></span>
      <span><b>Boundary</b> <output id="statusBoundaryOutput">CPML</output></span>
      <span className="status-strip-author" data-react-ui="footer">
        <Link inline href="https://www.uv.es/jorpago2" target="_blank" rel="noopener noreferrer">Jorge Parra</Link>
        <span aria-hidden="true">·</span>
        <Link inline href="https://jorpago2.github.io/" target="_blank" rel="noopener noreferrer">Online Simulators &amp; Tools</Link>
      </span>
    </>} /></>
  );
}

export function FdtdRunOutcome() {
  const simulationStatus = useSimulationStatus();
  const outcomeHeading = useRef<HTMLHeadingElement>(null);
  const [resultSnapshot, setResultSnapshot] = useState({
    reflectance: "—",
    transmittance: "—",
    balance: "—",
    angle: "0°",
    insight: "Run the simulation to collect monitor samples.",
  });

  useEffect(() => {
    const readResults = () => setResultSnapshot({
      reflectance: document.getElementById("summaryReflectanceOutput")?.textContent?.trim() || "—",
      transmittance: document.getElementById("summaryTransmittanceOutput")?.textContent?.trim() || "—",
      balance: document.getElementById("summaryBalanceOutput")?.textContent?.trim() || "—",
      angle: document.getElementById("summaryAngleOutput")?.textContent?.trim() || "0°",
      insight: document.getElementById("resultsInsightNote")?.textContent?.trim() || "Run the simulation to collect monitor samples.",
    });
    const observedElements = [
      "summaryReflectanceOutput",
      "summaryTransmittanceOutput",
      "summaryBalanceOutput",
      "summaryAngleOutput",
      "resultsInsightNote",
    ].map((id) => document.getElementById(id)).filter((element): element is HTMLElement => Boolean(element));
    const observer = new MutationObserver(readResults);
    observedElements.forEach((element) => observer.observe(element, { childList: true, characterData: true, subtree: true }));
    readResults();
    return () => observer.disconnect();
  }, []);

  const hasMonitorResult = resultSnapshot.reflectance !== "—" || resultSnapshot.transmittance !== "—";
  const outcomeState = simulationStatus.state === "running"
    ? "running"
    : simulationStatus.state === "failed"
      ? "failed"
      : simulationStatus.state === "modified" && hasMonitorResult
        ? "modified"
        : hasMonitorResult
          ? "up-to-date"
          : "needs-input";

  useScientificResultTransition({
    state: outcomeState,
    resultRef: outcomeHeading,
    completionKey: hasMonitorResult ? `${resultSnapshot.reflectance}|${resultSnapshot.transmittance}|${resultSnapshot.balance}` : null,
    onReveal: () => window.dispatchEvent(new CustomEvent("fdtd:workflow-change", { detail: { layer: "results" } })),
  });

  return <ScientificOutcomeSummary
    className="fdtd-run-outcome"
    title="Monitor outcome"
    headingRef={outcomeHeading}
    status={{
      state: outcomeState,
      label: simulationStatus.state === "running"
        ? "Collecting field samples"
        : simulationStatus.state === "failed"
          ? simulationStatus.label
          : simulationStatus.state === "modified" && hasMonitorResult
            ? "Result uses an earlier scene"
            : hasMonitorResult
              ? "Monitor result current"
              : "No monitor result",
    }}
    summary={resultSnapshot.insight}
    metrics={hasMonitorResult ? [
      { id: "reflectance", label: "Estimated reflectance", value: resultSnapshot.reflectance },
      { id: "transmittance", label: "Estimated transmittance", value: resultSnapshot.transmittance },
      { id: "balance", label: "Power-balance residual", value: resultSnapshot.balance },
      { id: "angle", label: "Propagation angle", value: resultSnapshot.angle },
    ] : []}
    actions={hasMonitorResult ? [
      { id: "save-field", label: "Save field PNG", emphasis: "primary", onClick: () => document.getElementById("saveBtn")?.click() },
      { id: "review-validation", label: "Review validation", emphasis: "secondary", collapseAt: "sm", onClick: () => document.getElementById("sceneObservableResults")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
      { id: "reset-field", label: "Reset field", emphasis: "tertiary", overflowOnly: true, onClick: () => document.getElementById("resetBtn")?.click() },
    ] : [
      { id: "start-simulation", label: "Start simulation", emphasis: "primary", disabled: simulationStatus.state === "running", onClick: () => document.getElementById("playPauseBtn")?.click() },
      { id: "review-numerics", label: "Review numerics", emphasis: "secondary", collapseAt: "sm", onClick: () => window.dispatchEvent(new CustomEvent("fdtd:workflow-change", { detail: { layer: "config" } })) },
    ]}
  />;
}

export function NumericalPreflight() {
  const simulationStatus = useSimulationStatus();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const ids = ["gridNxInput", "gridNyInput", "cellsPerWavelengthInput"];
    const refresh = () => setRevision((value) => value + 1);
    const controls = ids.map((id) => document.getElementById(id)).filter((element): element is HTMLElement => Boolean(element));
    controls.forEach((element) => element.addEventListener("change", refresh));
    window.addEventListener("fdtd:simulation-status", refresh);
    return () => {
      controls.forEach((element) => element.removeEventListener("change", refresh));
      window.removeEventListener("fdtd:simulation-status", refresh);
    };
  }, []);
  const numericValue = (id: string, fallback: number) => {
    const value = Number((document.getElementById(id) as HTMLInputElement | null)?.value);
    return Number.isFinite(value) ? value : fallback;
  };
  const nx = numericValue("gridNxInput", 360);
  const ny = numericValue("gridNyInput", 240);
  const cellsPerWavelength = numericValue("cellsPerWavelengthInput", 20);
  const underResolved = cellsPerWavelength < 20;
  void revision;
  return <ScientificPreflightSummary
    className="fdtd-preflight"
    description="These checks assess whether the current discretization is safe to run. They do not replace mesh, domain and boundary convergence studies."
    status={{
      state: simulationStatus.state === "failed" ? "failed" : underResolved ? "warning" : "ready",
      label: simulationStatus.state === "failed" ? "Solver failed" : underResolved ? "Review resolution" : "Ready to run",
    }}
    checks={[
      { id: "grid", label: "Grid capacity", state: nx * ny <= 960_000 ? "passed" : "failed", value: `${nx} × ${ny}`, detail: `${(nx * ny).toLocaleString("en-US")} Yee cells` },
      { id: "resolution", label: "Free-space resolution", state: underResolved ? "warning" : "passed", value: `${cellsPerWavelength} cells / λ₀`, detail: underResolved ? "Material wavelengths and small features may be under-resolved." : "Still verify convergence for quantitative claims." },
      { id: "stability", label: "CFL stability", state: "passed", value: "S = 0.10" },
      { id: "run", label: "Current execution", state: simulationStatus.state === "running" ? "running" : simulationStatus.state === "failed" ? "failed" : simulationStatus.state === "modified" ? "warning" : "not-run", detail: simulationStatus.label },
    ]}
  />;
}
