import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ActionableNotification,
  Button,
  Column,
  ContentSwitcher,
  Grid,
  Header,
  HeaderGlobalBar,
  HeaderName,
  IconButton,
  IconSwitch,
  OverflowMenu,
  OverflowMenuItem,
  Search,
  SideNav,
  SideNavItems,
  SideNavLink,
  Tag,
  Toggletip,
  ToggletipActions,
  ToggletipButton,
  ToggletipContent,
} from "@carbon/react";
import {
  Contrast,
  Chemistry,
  Cursor_1,
  Download,
  Draw,
  Grid as GridIcon,
  Help,
  Inspection,
  Pause,
  Play,
  Reset,
  SettingsAdjust,
  SkipForward,
} from "@carbon/react/icons";
import { ScientificOutcomeSummary, ScientificPreflightSummary, useScientificAutosave, useScientificResultTransition } from "@jorpago2/scientific-ui";
import { useFdtdTheme } from "./fdtd-theme";
import { requestRuntimeAction, runtimeState, runtimeStep, useFdtdRuntimeReady, useFdtdRuntimeSelector, useFdtdRuntimeState } from "./runtime-state";

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

function FdtdHeaderHelp({ compact, onOpenGuide }: { compact: boolean; onOpenGuide: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const toggleHelp = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === "Escape" && buttonRef.current?.getAttribute("aria-expanded") === "true") {
        event.preventDefault();
        buttonRef.current.click();
        buttonRef.current.focus();
        return;
      }
      if (
        event.defaultPrevented
        || event.key !== "?"
        || (event.target instanceof HTMLElement
          && (event.target.matches("input, select, textarea") || event.target.isContentEditable))
      ) return;
      event.preventDefault();
      buttonRef.current?.click();
    };
    document.addEventListener("keydown", toggleHelp, true);
    return () => document.removeEventListener("keydown", toggleHelp, true);
  }, []);

  if (compact) {
    return (
      <IconButton
        ref={buttonRef}
        id="fdtd-help"
        type="button"
        kind="ghost"
        size="lg"
        className="scientific-header-help__button"
        label="Help"
        aria-keyshortcuts="?"
        onClick={onOpenGuide}
      >
        <Help size={20} aria-hidden={true} />
      </IconButton>
    );
  }

  return (
    <Toggletip className="scientific-header-help" align="bottom-end" autoAlign>
      <ToggletipButton
        ref={buttonRef}
        id="fdtd-help"
        className="scientific-header-help__button"
        label="Help"
        aria-keyshortcuts="?"
      >
        <Help size={20} aria-hidden={true} />
      </ToggletipButton>
      <ToggletipContent className="scientific-header-help__popover">
        <div className="scientific-header-help__content">
          <strong className="scientific-header-help__title">Quick workflow</strong>
          <p className="scientific-header-help__summary">Choose a scene, run the FDTD update, then inspect fields, materials, flux and numerical validation before interpreting the result.</p>
          <dl className="scientific-header-help__shortcuts">
            <div><dt><kbd>Esc</kbd></dt><dd>Close the active guide or panel</dd></div>
            <div><dt><kbd>?</kbd></dt><dd>Toggle this help</dd></div>
          </dl>
          <ToggletipActions>
            <Button size="sm" kind="primary" onClick={() => {
              buttonRef.current?.focus();
              buttonRef.current?.click();
              window.requestAnimationFrame(onOpenGuide);
            }}>Open full guide</Button>
          </ToggletipActions>
        </div>
      </ToggletipContent>
    </Toggletip>
  );
}

export function ApplicationHeader() {
  const breakpointFocusRef = useRef<"run" | "theme" | null>(null);
  const lastHeaderFocusRef = useRef<"run" | "theme" | null>(null);
  const [compactHeader, setCompactHeader] = useState(() =>
    window.matchMedia("(max-width: 65.99rem), (max-height: 39.99rem)").matches
  );
  const simulationStatus = useSimulationStatus();
  const sceneTitle = useSceneTitle();
  const runtimeReady = useFdtdRuntimeReady();

  useEffect(() => {
    const compactQuery = window.matchMedia("(max-width: 65.99rem), (max-height: 39.99rem)");
    const semanticHeaderFocus = (element: Element | null): "run" | "theme" | null => {
      if (!(element instanceof HTMLElement)) return null;
      if (element.id === "playPauseBtn") return "run";
      if (
        element.closest(".scientific-theme-toggle, .header-overflow-menu")
        || element.getAttribute("aria-label") === "More simulation actions"
        || /(?:light|dark) theme/i.test(element.textContent ?? "")
      ) {
        return "theme";
      }
      return null;
    };
    const trackHeaderFocus = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target === document.body || target === document.documentElement) return;
      lastHeaderFocusRef.current = semanticHeaderFocus(target);
    };
    const syncCompactHeader = () => {
      breakpointFocusRef.current = semanticHeaderFocus(document.activeElement) ?? lastHeaderFocusRef.current;
      setCompactHeader(compactQuery.matches);
    };
    document.addEventListener("focusin", trackHeaderFocus, true);
    compactQuery.addEventListener("change", syncCompactHeader);
    return () => {
      document.removeEventListener("focusin", trackHeaderFocus, true);
      compactQuery.removeEventListener("change", syncCompactHeader);
    };
  }, []);

  useEffect(() => {
    const focusTarget = breakpointFocusRef.current;
    if (!focusTarget) return;
    breakpointFocusRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      const selector = focusTarget === "run"
        ? "#playPauseBtn"
        : compactHeader
          ? ".header-overflow-menu"
          : ".scientific-theme-toggle";
      const target = document.querySelector<HTMLElement>(selector);
      if (target?.isConnected && target.getClientRects().length > 0) {
        target.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [compactHeader]);

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

  const { isDark, toggleTheme } = useFdtdTheme();
  const statusType = simulationStatus.state === "failed"
    ? "red"
    : simulationStatus.state === "running"
      ? "blue"
      : simulationStatus.state === "modified"
        ? "warm-gray"
        : "green";

  return (
    <Header className="scientific-header scientific-app-header" aria-label="EM Wave Simulator application header">
      <HeaderName className="scientific-header__brand scientific-app-header__brand" href="./" prefix="" aria-label="EM Wave Simulator">
        <span className="scientific-header__brand-mark scientific-app-header__brand-mark" aria-hidden="true"><GridIcon size={20} /></span>
        <span className="scientific-header__brand-copy"><strong>EM Wave Simulator</strong><small>2D FDTD laboratory</small></span>
      </HeaderName>
      <div className="scientific-header__context scientific-app-header__context">
        <span className="scientific-header__context-label">Simulation</span>
        <div className="scientific-header__context-value"><span>{sceneTitle}</span></div>
         <Tag className="scientific-header__status" size="sm" type={runtimeReady ? statusType : "warm-gray"} data-state={runtimeReady ? simulationStatus.state : "loading"}>{runtimeReady ? simulationStatus.label : "Loading"}</Tag>
      </div>
      <HeaderGlobalBar className="scientific-header__actions scientific-app-header__actions" role="group" aria-label="Application actions">
        <div className="scientific-header__primary-action">
           <CanvasPrimaryControls compactHeader={compactHeader} running={runtimeReady && simulationStatus.state === "running"} runtimeReady={runtimeReady} />
        </div>
        {!compactHeader && <div className="scientific-header__theme">
          <IconButton
            type="button"
            kind="ghost"
            size="lg"
            align="bottom-end"
            label={isDark ? "Use light theme" : "Use dark theme"}
            className="scientific-theme-toggle"
            aria-pressed={isDark}
            onClick={toggleTheme}
          >
            <Contrast size={20} aria-hidden={true} />
          </IconButton>
        </div>}
        <div className="scientific-header__help" data-scientific-header-terminal-action><FdtdHeaderHelp compact={compactHeader} onOpenGuide={openFullGuide} /></div>
      </HeaderGlobalBar>
    </Header>
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
  const navigationRef = useRef<HTMLElement>(null);
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
    if (!layer) return;
    setActiveLayer(layer);
    window.dispatchEvent(new CustomEvent("fdtd:workflow-change", { detail: { layer } }));
  };

  const moveFocus = (event: ReactKeyboardEvent<HTMLButtonElement>, direction: number | "first" | "last") => {
    const buttons = Array.from(navigationRef.current?.querySelectorAll<HTMLButtonElement>(".scientific-tool-rail__item:not(:disabled)") ?? []);
    if (buttons.length === 0) return;
    const currentIndex = buttons.indexOf(event.currentTarget);
    const nextIndex = direction === "first"
      ? 0
      : direction === "last"
        ? buttons.length - 1
        : (Math.max(0, currentIndex) + direction + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[nextIndex]?.focus();
  };

  return (
    <SideNav
      ref={navigationRef}
      className="scientific-tool-rail"
      aria-label="Simulation workflow"
      expanded
      isFixedNav
      isPersistent
      addFocusListeners={false}
      addMouseListeners={false}
    >
      <SideNavItems className="scientific-tool-rail__items">
        {workflowLayers.map(([layer, label, Icon]) => {
          const active = layer === activeLayer;
          return <SideNavLink
            key={layer}
            as="button"
            type="button"
            id={`workflow-${layer}`}
            isActive={active}
            aria-controls="controlPanel"
            aria-current={active ? "page" : undefined}
            aria-expanded={drawerOpen && active}
            title={label}
            className="scientific-tool-rail__item mobile-layer-button"
            data-mobile-layer={layer}
            onClick={() => chooseLayer(layer)}
            onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
              if (event.key === "ArrowDown" || event.key === "ArrowRight") moveFocus(event, 1);
              else if (event.key === "ArrowUp" || event.key === "ArrowLeft") moveFocus(event, -1);
              else if (event.key === "Home") moveFocus(event, "first");
              else if (event.key === "End") moveFocus(event, "last");
            }}
          >
            <span className="scientific-tool-rail__content">
              <span aria-hidden="true" className="scientific-tool-rail__icon"><Icon size={16} /></span>
              <span className="scientific-tool-rail__label">{label}</span>
            </span>
          </SideNavLink>;
        })}
      </SideNavItems>
    </SideNav>
  );
}

interface CanvasPrimaryControlsProps {
  compactHeader: boolean;
  running: boolean;
  runtimeReady: boolean;
}

export function CanvasPrimaryControls({ compactHeader, running, runtimeReady }: CanvasPrimaryControlsProps) {
  const canvasMode = useFdtdRuntimeSelector((state) => state?.canvasMode ?? "select");
  const modeIndex = canvasMode === "brush" ? 1 : 0;
  const { isDark, toggleTheme } = useFdtdTheme();

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
        {compactHeader && (
          <OverflowMenu
            className="header-overflow-menu"
            menuOptionsClass="scientific-header-overflow-options"
            iconDescription="More simulation actions"
            align="bottom-end"
            size="sm"
            flipped
          >
            <OverflowMenuItem className="scientific-header-overflow-item" disabled={!runtimeReady} itemText="Step simulation" onClick={() => requestRuntimeAction("simulation-step")} />
            <OverflowMenuItem className="scientific-header-overflow-item" disabled={!runtimeReady} itemText="Select and move objects" onClick={() => requestRuntimeAction("canvas-mode", { mode: "select" })} />
            <OverflowMenuItem className="scientific-header-overflow-item" disabled={!runtimeReady} itemText="Draw materials" onClick={() => requestRuntimeAction("canvas-mode", { mode: "brush" })} />
            <OverflowMenuItem className="scientific-header-overflow-item" disabled={!runtimeReady} itemText="Reset field" onClick={() => requestRuntimeAction("reset-simulation")} />
            <OverflowMenuItem className="scientific-header-overflow-item" disabled={!runtimeReady} itemText="Save PNG" onClick={() => requestRuntimeAction("save-png")} />
            <OverflowMenuItem className="scientific-header-overflow-item" itemText={isDark ? "Use light theme" : "Use dark theme"} onClick={toggleTheme} />
          </OverflowMenu>
        )}
      </div>
      <ContentSwitcher
        className="interaction-toggle"
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

function formatSavedAt(savedAt: string | null | undefined) {
  if (!savedAt) return "";
  const date = new Date(savedAt);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "";
}

function autosaveLabel(status: "idle" | "saving" | "saved" | "unavailable" | "error", savedAt?: string | null) {
  if (status === "saving") return "Saving locally…";
  if (status === "saved") return `Saved locally${formatSavedAt(savedAt) ? ` ${formatSavedAt(savedAt)}` : ""}`;
  if (status === "unavailable") return "Local saving unavailable";
  if (status === "error") return "Local saving failed";
  return "Local saving ready";
}

export function StatusFooter() {
  const autosave = useFdtdAutosave();
  const state = useFdtdRuntimeState();
  return (
    <>
      {autosave.recovery && <aside className="scientific-recovery-notice" aria-label="Session recovery">
        <ActionableNotification
          kind="info"
          title="Previous session available"
          subtitle={`Saved locally ${formatSavedAt(autosave.recovery.savedAt) || "during an earlier visit"}. Restore the saved inputs and configuration, or discard this draft.`}
          actionButtonLabel="Restore session"
          onActionButtonClick={autosave.restore}
          onCloseButtonClick={autosave.discard}
          closeOnEscape
          aria-label="Discard saved session"
          lowContrast
        />
      </aside>}
      <footer className="scientific-status-bar scientific-status-bar--embedded fdtd-status-strip" aria-label="Simulation status" data-react-ui="footer">
        <Grid fullWidth condensed>
          <Column sm={4} md={8} lg={16} className="scientific-status-bar__metadata">
            <span className="scientific-autosave-status" role="status" aria-live="polite" aria-atomic="true">{autosaveLabel(autosave.status, autosave.lastSavedAt)}</span>
            <span><b>Grid</b> <output>{state?.gridNx ?? 360} × {state?.gridNy ?? 240}</output></span>
            <span><b>Step</b> <output>{runtimeStep()}</output></span>
            <span><b>CFL</b> <output>0.10</output></span>
            <span><b>Boundary</b> <output>{state?.boundary === "reflective" ? "Reflective" : "CPML absorbing"}</output></span>
          </Column>
        </Grid>
      </footer>
    </>
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
    angle: "0°",
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
      { id: "save-field", label: "Save field PNG", emphasis: "primary", disabled: !runtimeReady, onClick: () => requestRuntimeAction("save-png") },
      { id: "review-validation", label: "Review validation", emphasis: "secondary", collapseAt: "sm", onClick: () => document.getElementById("sceneObservableResults")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
      { id: "reset-field", label: "Reset field", emphasis: "tertiary", disabled: !runtimeReady, overflowOnly: true, onClick: () => requestRuntimeAction("reset-simulation") },
    ] : [
      { id: "start-simulation", label: "Start simulation", emphasis: "primary", disabled: !runtimeReady || simulationStatus.state === "running", onClick: () => requestRuntimeAction("toggle-running") },
      { id: "review-numerics", label: "Review numerics", emphasis: "secondary", collapseAt: "sm", onClick: () => window.dispatchEvent(new CustomEvent("fdtd:workflow-change", { detail: { layer: "config" } })) },
    ]}
  />;
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
