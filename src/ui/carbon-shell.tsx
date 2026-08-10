import { useEffect, useState } from "react";
import {
  Button,
  ContentSwitcher,
  Link,
  OverflowMenu,
  OverflowMenuItem,
  Search,
  Switch,
  Theme,
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
import { ScientificHeader, ScientificToolRail } from "@jorpago2/scientific-ui";

export function ApplicationHeader() {
  const [themeIndex, setThemeIndex] = useState(document.documentElement.dataset.theme === "dark" ? 1 : 0);
  const [compactHeader, setCompactHeader] = useState(() =>
    window.matchMedia("(max-width: 65.99rem), (max-height: 39.99rem)").matches
  );
  const [simulationStatus, setSimulationStatus] = useState<{
    state: "ready" | "running" | "modified" | "failed";
    label: string;
  }>({ state: "ready", label: "Ready" });

  useEffect(() => {
    const compactQuery = window.matchMedia("(max-width: 65.99rem), (max-height: 39.99rem)");
    const syncCompactHeader = () => setCompactHeader(compactQuery.matches);
    const syncAppliedTheme = (event: Event) => {
      const theme = (event as CustomEvent<{ theme?: unknown }>).detail?.theme;
      setThemeIndex(theme === "dark" ? 1 : 0);
    };
    const syncSimulationStatus = (event: Event) => {
      const detail = (event as CustomEvent<{
        state?: "ready" | "running" | "modified" | "failed";
        label?: unknown;
      }>).detail;
      if (!detail || !["ready", "running", "modified", "failed"].includes(detail.state ?? "")) return;
      if (typeof detail.label !== "string" || !detail.label.trim()) return;
      setSimulationStatus({ state: detail.state!, label: detail.label });
    };
    compactQuery.addEventListener("change", syncCompactHeader);
    window.addEventListener("fdtd:theme-applied", syncAppliedTheme);
    window.addEventListener("fdtd:simulation-status", syncSimulationStatus);
    return () => {
      compactQuery.removeEventListener("change", syncCompactHeader);
      window.removeEventListener("fdtd:theme-applied", syncAppliedTheme);
      window.removeEventListener("fdtd:simulation-status", syncSimulationStatus);
    };
  }, []);

  const chooseTheme = (index: number) => {
    const nextIndex = index === 1 ? 1 : 0;
    const theme = nextIndex === 1 ? "dark" : "light";
    setThemeIndex(nextIndex);
    window.dispatchEvent(new CustomEvent("fdtd:theme-change", { detail: { theme } }));
  };

  return (
    <Theme theme={themeIndex === 1 ? "g100" : "g10"}>
      <ScientificHeader
        aria-label="EM Wave Simulator application header"
        product="EM Wave Simulator"
        productMark="F"
        descriptor="2D FDTD laboratory"
        href="./"
        contextLabel="Simulation"
        context={<span id="headerSceneTitle">Plane wave in air</span>}
        status={simulationStatus}
        secondaryActions={<CanvasPrimaryControls
          compactHeader={compactHeader}
          running={simulationStatus.state === "running"}
          themeIndex={themeIndex}
          onThemeChange={chooseTheme}
        />}
        primaryAction={<Button
          id="controlDrawerToggle"
          className="control-drawer-toggle"
          type="button"
          kind="ghost"
          size="sm"
          hasIconOnly
          iconDescription="Open current workflow panel"
          aria-controls="controlPanel"
          aria-expanded="false"
          data-carbon-react="true"
        >
          <SettingsAdjust size={16} aria-hidden={true} />
        </Button>}
      />
    </Theme>
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
  return <ScientificToolRail
    label="Simulation workflow"
    activeId={activeLayer}
    expandedId={activeLayer}
    onChange={setActiveLayer}
    collapsible={false}
    items={workflowLayers.map(([layer, label, Icon]) => ({
      id: layer,
      label,
      icon: <Icon size={16} aria-hidden={true} />,
      controlsId: "controlPanel",
      className: "mobile-layer-button",
      dataAttributes: { "data-mobile-layer": layer },
    }))}
  />;
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
          className="icon-button primary simulation-run-button"
          type="button"
          kind="primary"
          size="sm"
          hasIconOnly
          iconDescription={running ? "Pause simulation" : "Start simulation"}
          aria-pressed={running}
          data-carbon-react="true"
        >
          <span aria-hidden="true">{running ? <Pause size={16} /> : <Play size={16} />}</span>
          <span className="simulation-run-label" aria-hidden="true" />
        </Button>
        <Button
          id="resetBtn"
          className="icon-button canvas-reset-button"
          type="button"
          kind="ghost"
          size="sm"
          hasIconOnly
          iconDescription="Reset field"
          data-carbon-react="true"
        >
          <Reset size={16} aria-hidden={true} />
        </Button>
        <OverflowMenu
          id="canvasActionToggle"
          className="icon-button canvas-action-toggle"
          size="sm"
          iconDescription="More simulation actions"
          menuOptionsClass="canvas-action-menu"
          flipped
          data-carbon-react="true"
        >
          {compactHeader && (
            <OverflowMenuItem
              id="compactResetBtn"
              itemText="Reset field"
              onClick={() => document.getElementById("resetBtn")?.click()}
            />
          )}
          <OverflowMenuItem
            id="stepBtn"
            itemText="Advance one step"
            onClick={() => window.dispatchEvent(new Event("fdtd:simulation-step"))}
          />
          {compactHeader && (
            <>
              <OverflowMenuItem
                id="compactSelectModeBtn"
                itemText="Select canvas objects"
                onClick={() => document.getElementById("selectModeBtn")?.click()}
              />
              <OverflowMenuItem
                id="compactDrawModeBtn"
                itemText="Draw materials"
                onClick={() => document.getElementById("brushModeBtn")?.click()}
              />
            </>
          )}
          <OverflowMenuItem
            id="saveBtn"
            itemText="Save canvas as PNG"
            onClick={() => window.dispatchEvent(new Event("fdtd:save-png"))}
          />
          <OverflowMenuItem
            hasDivider
            itemText={themeIndex === 1 ? "Use light theme" : "Use dark theme"}
            onClick={() => onThemeChange(themeIndex === 1 ? 0 : 1)}
          />
        </OverflowMenu>
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
  return (
    <>
      <span><b>Grid</b> <output id="statusGridOutput">360 × 240</output></span>
      <span><b>Step</b> <output id="statusStepOutput">0</output></span>
      <span><b>CFL</b> <output id="statusCourantOutput">0.10</output></span>
      <span><b>Boundary</b> <output id="statusBoundaryOutput">CPML</output></span>
      <span className="status-strip-author" data-react-ui="footer">
        <Link inline href="https://www.uv.es/jorpago2" target="_blank" rel="noopener noreferrer">Jorge Parra</Link>
        <span aria-hidden="true">·</span>
        <Link inline href="https://jorpago2.github.io/" target="_blank" rel="noopener noreferrer">Online Simulators &amp; Tools</Link>
      </span>
    </>
  );
}
