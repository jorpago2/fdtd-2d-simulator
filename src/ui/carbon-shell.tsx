import { useState } from "react";
import {
  Button,
  ContentSwitcher,
  Header,
  HeaderGlobalBar,
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
  Reset,
  SettingsAdjust,
} from "@carbon/react/icons";

export function ApplicationHeader() {
  const [themeIndex, setThemeIndex] = useState(document.documentElement.dataset.theme === "dark" ? 1 : 0);

  return (
    <Theme as={Header} theme="g10" className="topbar" aria-label="EM Wave Simulator application header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">EM</span>
        <div className="brand-heading" data-react-ui="brand">
          <h1 className="brand-title">EM Wave Simulator</h1>
          <p className="brand-descriptor">2D FDTD laboratory</p>
        </div>
      </div>
      <div className="header-context" aria-label="Current simulation">
        <span className="header-context-label">Simulation</span>
        <strong id="headerSceneTitle" className="header-scene-title">Plane wave in air</strong>
        <span id="headerSimulationStatus" className="header-status" role="status" aria-live="polite" data-state="ready">
          <span className="header-status-indicator" aria-hidden="true" />
          <span className="header-status-label">Ready</span>
        </span>
      </div>
      <HeaderGlobalBar className="header-actions" aria-label="Global actions">
        <CanvasPrimaryControls />
        <ContentSwitcher
          className="header-theme-toggle"
          selectedIndex={themeIndex}
          size="sm"
          onChange={({ index }) => setThemeIndex(index ?? 0)}
        >
          <Switch name="light" text="Light" data-theme-choice="light" data-carbon-react="true">Light</Switch>
          <Switch name="dark" text="Dark" data-theme-choice="dark" data-carbon-react="true">Dark</Switch>
        </ContentSwitcher>
        <Button
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
        </Button>
      </HeaderGlobalBar>
    </Theme>
  );
}

const workflowLayers = [
  ["scenes", "1", "Scene", GridIcon],
  ["simulation", "2", "Simulate", Chemistry],
  ["results", "3", "Results", Inspection],
  ["config", "4", "Numerics", SettingsAdjust],
] as const;

export function WorkflowNavigation() {
  return workflowLayers.map(([layer, step, label, Icon], index) => (
    <Button
      className={`mobile-layer-button${index === 0 ? " is-active" : ""}`}
      type="button"
      kind="ghost"
      size="sm"
      data-mobile-layer={layer}
      data-carbon-react="true"
      aria-current={index === 0 ? "page" : undefined}
      aria-controls="controlPanel"
      aria-expanded="false"
      key={layer}
    >
      <span className="nav-step" aria-hidden="true">{step}</span>
      <Icon className="nav-icon" size={16} aria-hidden={true} />
      <span className="nav-label">{label}</span>
    </Button>
  ));
}

export function CanvasPrimaryControls() {
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
          iconDescription="Start simulation"
          aria-pressed="false"
          data-carbon-react="true"
        >
          <span id="playPauseIcon" aria-hidden="true">▶</span>
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
          <OverflowMenuItem
            id="stepBtn"
            itemText="Advance one step"
            onClick={() => window.dispatchEvent(new Event("fdtd:simulation-step"))}
          />
          <OverflowMenuItem
            id="saveBtn"
            itemText="Save canvas as PNG"
            onClick={() => window.dispatchEvent(new Event("fdtd:save-png"))}
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
