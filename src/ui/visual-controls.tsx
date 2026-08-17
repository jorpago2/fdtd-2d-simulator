import { Button, Checkbox, ContentSwitcher, Switch } from "@carbon/react";
import { requestRuntimeAction, runtimeState, useFdtdRuntimeSelector } from "./runtime-state";

const projectionOptions = [
  ["2d", "2D", "Show flat 2D map"],
  ["3d", "3D", "Show 3D surface"],
] as const;

const viewOptions = [
  ["field", <><i>E</i>/<i>H</i></>, "Show electromagnetic fields"],
  ["poynting", <i>S</i>, "Show Poynting vector flux"],
  ["epsilon", "ε", "Show permittivity map"],
  ["mu", "μ", "Show permeability map"],
] as const;

const displayOptions = [
  ["scalar", <><i>E</i><sub>z</sub></>, "Show out-of-plane field"],
  ["transverseX", <><i>H</i><sub>x</sub></>, "Show transverse x component"],
  ["transverseY", <><i>H</i><sub>y</sub></>, "Show transverse y component"],
  ["electricMag", <>|<i>E</i>|</>, "Show electric-field magnitude"],
  ["magneticMag", <>|<i>H</i>|</>, "Show magnetic-field magnitude"],
] as const;

const overlayLayers = [
  ["boundaries", "CPML/bounds", "Show CPML and reflective boundary overlays", "visualLayerBoundaries"],
  ["monitors", "monitor markers", "Show diagnostic and custom monitor markers", "visualLayerMonitors"],
  ["axes", "axes", "Show x and y axis glyph", "visualLayerAxes"],
  ["scale", "scale", "Show wavelength scale bar", "visualLayerScale"],
  ["sources", "sources", "Show source markers", "visualLayerSources"],
  ["colorbar", "colorbar", "Show color scale", "visualLayerColorbar"],
] as const;

function ChoiceButtons({
  ariaLabel,
  attribute,
  options,
  selected,
}: {
  ariaLabel: string;
  attribute: string;
  options: ReadonlyArray<readonly [string, React.ReactNode, string]>;
  selected: string;
}) {
  return (
    <fieldset className="canvas-mode-toggle" role="radiogroup" aria-label={ariaLabel}>
      <legend className="sr-only">{ariaLabel}</legend>
      {options.map(([value, label, title]) => {
        const active = value === selected;
        return (
          <Button
            className={`mode-toggle-button${active ? " is-active" : ""}`}
            type="button"
            kind="ghost"
            size="sm"
            role="radio"
            aria-checked={active}
            title={title}
            data-visual-choice={attribute}
            data-visual-value={value}
            onClick={() => requestRuntimeAction("visual-choice", { property: attribute, value })}
            key={value}
          >
            {label}
          </Button>
        );
      })}
    </fieldset>
  );
}

function OverlayControls({ toolbar = false }: { toolbar?: boolean }) {
  useFdtdRuntimeSelector((state) => state ? overlayLayers.map(([, , , property]) => String(state[property])).join("|") : "");
  const state = runtimeState();
  return (
    <div className={toolbar ? "visual-layer-grid canvas-overlay-grid" : "visual-layer-grid"} aria-label="Canvas overlay layers" data-react-ui="visual-overlay-controls">
      {overlayLayers.map(([layer, label, title, property]) => (
        <Checkbox
          className="toolbar-switch visual-layer-switch visual-panel-layer"
          id={toolbar ? `canvasVisualLayer-${layer}` : `visualLayer-${layer}`}
          title={title}
          labelText={label}
          data-visual-layer={layer}
          checked={state?.[property] ?? ["boundaries", "axes", "scale", "sources", "colorbar"].includes(layer)}
          onChange={(_, data) => requestRuntimeAction("visual-layer", { layer, enabled: data.checked })}
          key={layer}
        />
      ))}
    </div>
  );
}

export function BoundaryConditionSwitcher() {
  const boundary = useFdtdRuntimeSelector((state) => state?.boundary ?? "absorbing");
  const selectedIndex = boundary === "reflective" ? 1 : 0;
  return (
    <ContentSwitcher
      className="boundary-condition-switcher scientific-content-switcher scientific-content-switcher--md"
      selectedIndex={selectedIndex}
      size="md"
      onChange={({ index }) => {
        const mode = index === 1 ? "reflective" : "absorbing";
        requestRuntimeAction("boundary-mode-request", { mode });
      }}
    >
      <Switch name="absorbing" text="CPML absorbing" data-boundary-mode="absorbing" />
      <Switch name="reflective" text="Reflective" data-boundary-mode="reflective" />
    </ContentSwitcher>
  );
}

export function CanvasVisualControls() {
  useFdtdRuntimeSelector((current) => current ? `${current.viewMode}|${current.viewProjection}|${current.fieldDisplay}|${current.fieldQuiver}|${current.materialPart}|${current.materialFieldOverlay}` : "");
  const state = runtimeState();
  const viewMode = state?.viewMode ?? "field";
  const materialMode = viewMode === "epsilon" || viewMode === "mu";
  return (
    <>
      <ChoiceButtons ariaLabel="Projection" attribute="viewProjection" options={projectionOptions} selected={state?.viewProjection ?? "2d"} />
      <ChoiceButtons ariaLabel="View" attribute="viewMode" options={viewOptions} selected={viewMode} />
      <ChoiceButtons ariaLabel="Field component" attribute="fieldDisplay" options={displayOptions} selected={state?.fieldDisplay ?? "scalar"} />
      <Checkbox
        id="fieldQuiverInput"
        className="toolbar-switch quiver-switch"
        labelText={<span id="fieldQuiverLabel"><i>H</i> quiver</span>}
        title="Overlay vector arrows"
        checked={state?.fieldQuiver ?? false}
        onChange={(_, data) => requestRuntimeAction("visual-choice", { property: "fieldQuiver", value: data.checked })}
      />
      <fieldset className="canvas-mode-toggle material-part-toggle" role="radiogroup" aria-label="Material component" hidden={!materialMode}>
        <legend className="sr-only">Material component</legend>
        {(["real", "imag"] as const).map((value) => {
          const active = (state?.materialPart ?? "real") === value;
          return (
            <Button
              className={`mode-toggle-button${active ? " is-active" : ""}`}
              type="button"
              kind="ghost"
              size="sm"
              role="radio"
              aria-checked={active}
              onClick={() => requestRuntimeAction("visual-choice", { property: "materialPart", value })}
              key={value}
            >
              {value === "real" ? "Re" : "Im"}
            </Button>
          );
        })}
      </fieldset>
      <Checkbox
        id="materialFieldOverlayToolbarInput"
        className="toolbar-switch"
        labelText={<><i>E</i>/<i>H</i> overlay</>}
        title="Overlay a selectable electric or magnetic field on the material map"
        hidden={!materialMode}
        checked={state?.materialFieldOverlay ?? false}
        onChange={(_, data) => requestRuntimeAction("visual-choice", { property: "materialFieldOverlay", value: data.checked })}
      />
      <span className="visual-options-divider" aria-hidden="true" />
      <OverlayControls toolbar />
    </>
  );
}

export function VisualFieldControls() {
  useFdtdRuntimeSelector((current) => current ? `${current.viewMode}|${current.viewProjection}|${current.fieldDisplay}|${current.fieldQuiver}|${current.materialFieldOverlay}` : "");
  const state = runtimeState();
  const viewMode = state?.viewMode ?? "field";
  const materialMode = viewMode === "epsilon" || viewMode === "mu";
  return (
    <div className="visual-control-stack" data-react-ui="visual-field-controls">
      <div className="visual-control-row">
        <span>Projection</span>
        <ChoiceButtons ariaLabel="Visual panel projection" attribute="viewProjection" options={projectionOptions} selected={state?.viewProjection ?? "2d"} />
      </div>
      <div className="visual-control-row">
        <span>Quantity</span>
        <ChoiceButtons ariaLabel="Visual panel quantity" attribute="viewMode" options={viewOptions} selected={viewMode} />
      </div>
      <Checkbox
        id="materialFieldOverlayInput"
        className="toggle-row"
        labelText="Overlay field on ε/μ"
        hidden={!materialMode}
        checked={state?.materialFieldOverlay ?? false}
        onChange={(_, data) => requestRuntimeAction("visual-choice", { property: "materialFieldOverlay", value: data.checked })}
      />
      <div className="visual-control-row visual-component-row">
        <span>Component</span>
        <ChoiceButtons ariaLabel="Visual panel field component" attribute="fieldDisplay" options={displayOptions} selected={state?.fieldDisplay ?? "scalar"} />
      </div>
      <Checkbox
        id="fieldQuiverPanelInput"
        className="toggle-row visual-quiver-row"
        labelText={<span><i>H</i> quiver</span>}
        title="Overlay vector arrows"
        checked={state?.fieldQuiver ?? false}
        onChange={(_, data) => requestRuntimeAction("visual-choice", { property: "fieldQuiver", value: data.checked })}
      />
    </div>
  );
}

export function VisualOverlayControls() {
  return <OverlayControls />;
}

export function FieldComponentControls() {
  const selected = useFdtdRuntimeSelector((state) => state?.fieldComponent ?? "ez");
  return (
    <fieldset className="canvas-mode-toggle solver-toggle" role="radiogroup" aria-label="Simulated field component">
      <legend className="sr-only">Simulated field component</legend>
      {([
        ["ez", <><i>E</i><sub>z</sub></>, "TMz: solve Ez, Hx, Hy"],
        ["hz", <><i>H</i><sub>z</sub></>, "TEz: solve Hz, Ex, Ey"],
      ] as const).map(([value, label, title]) => {
        const active = value === selected;
        return (
          <Button
            className={`mode-toggle-button${active ? " is-active" : ""}`}
            type="button"
            kind="ghost"
            size="sm"
            role="radio"
            aria-checked={active}
            title={title}
            onClick={() => requestRuntimeAction("visual-choice", { property: "fieldComponent", value })}
            key={value}
          >
            {label}
          </Button>
        );
      })}
    </fieldset>
  );
}
