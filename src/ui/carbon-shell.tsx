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
import { ScientificHeader, ScientificStatusBar, ScientificToolRail } from "@jorpago2/scientific-ui";

type SimulationStatus = {
  state: "ready" | "running" | "modified" | "failed";
  label: string;
};

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
  const [themeIndex, setThemeIndex] = useState(document.documentElement.dataset.theme === "dark" ? 1 : 0);
  const [compactHeader, setCompactHeader] = useState(() =>
    window.matchMedia("(max-width: 65.99rem), (max-height: 39.99rem)").matches
  );
  const simulationStatus = useSimulationStatus();

  useEffect(() => {
    const compactQuery = window.matchMedia("(max-width: 65.99rem), (max-height: 39.99rem)");
    const syncCompactHeader = () => setCompactHeader(compactQuery.matches);
    const syncAppliedTheme = (event: Event) => {
      const theme = (event as CustomEvent<{ theme?: unknown }>).detail?.theme;
      setThemeIndex(theme === "dark" ? 1 : 0);
    };
    compactQuery.addEventListener("change", syncCompactHeader);
    window.addEventListener("fdtd:theme-applied", syncAppliedTheme);
    return () => {
      compactQuery.removeEventListener("change", syncCompactHeader);
      window.removeEventListener("fdtd:theme-applied", syncAppliedTheme);
    };
  }, []);

  const chooseTheme = (index: number) => {
    const nextIndex = index === 1 ? 1 : 0;
    const theme = nextIndex === 1 ? "dark" : "light";
    setThemeIndex(nextIndex);
    window.dispatchEvent(new CustomEvent("fdtd:theme-change", { detail: { theme } }));
  };

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
      productMark="F"
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
        themeIndex={themeIndex}
        onThemeChange={chooseTheme}
      />}
    />
  );
}

const workflowLayers = [
  ["scenes", "Scene", GridIcon],
  ["simulation", "Simulate", Chemistry],
  ["results", "Results", Inspection],
  ["config", "Numerics", SettingsAdjust],
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
  onThemeChange: (index: number) => void;
  running: boolean;
  themeIndex: number;
}

export function CanvasPrimaryControls({ compactHeader, onThemeChange, running, themeIndex }: CanvasPrimaryControlsProps) {
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
        <Button
          id="themeToggleBtn"
          className="theme-toggle-button"
          type="button"
          kind="ghost"
          size="sm"
          onClick={() => onThemeChange(themeIndex === 1 ? 0 : 1)}
        >
          {themeIndex === 1 ? "Light" : "Dark"}
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
            <OverflowMenuItem
              itemText={themeIndex === 1 ? "Use light theme" : "Use dark theme"}
              onClick={() => onThemeChange(themeIndex === 1 ? 0 : 1)}
            />
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
  return (
    <ScientificStatusBar embedded aria-label="Simulation status" status={simulationStatus} metadata={<>
      <span><b>Grid</b> <output id="statusGridOutput">360 × 240</output></span>
      <span><b>Step</b> <output id="statusStepOutput">0</output></span>
      <span><b>CFL</b> <output id="statusCourantOutput">0.10</output></span>
      <span><b>Boundary</b> <output id="statusBoundaryOutput">CPML</output></span>
      <span className="status-strip-author" data-react-ui="footer">
        <Link inline href="https://www.uv.es/jorpago2" target="_blank" rel="noopener noreferrer">Jorge Parra</Link>
        <span aria-hidden="true">·</span>
        <Link inline href="https://jorpago2.github.io/" target="_blank" rel="noopener noreferrer">Online Simulators &amp; Tools</Link>
      </span>
    </>} />
  );
}
