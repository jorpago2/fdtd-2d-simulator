import { Checkbox, ContentSwitcher, RadioButton, RadioButtonGroup, Switch } from "@carbon/react";
import type { ReactNode } from "react";
import { requestRuntimeAction, runtimeState, useFdtdRuntimeSelector } from "./runtime-state";

const projectionOptions = [
  ["2d", "2D", "Show flat 2D map", "2D"],
  ["3d", "3D", "Show 3D surface", "3D"],
] as const;

const viewOptions = [
  ["field", <><i aria-hidden="true">E</i>/<i aria-hidden="true">H</i></>, "Show electromagnetic fields", "E/H"],
  ["poynting", <i aria-hidden="true">S</i>, "Show Poynting vector flux", "S"],
  ["epsilon", "ε", "Show permittivity map", "ε"],
  ["mu", "μ", "Show permeability map", "μ"],
] as const;

const displayOptions = [
  ["scalar", <><i aria-hidden="true">E</i><sub aria-hidden="true">z</sub></>, "Show out-of-plane field", "Ez"],
  ["transverseX", <><i aria-hidden="true">H</i><sub aria-hidden="true">x</sub></>, "Show transverse x component", "Hx"],
  ["transverseY", <><i aria-hidden="true">H</i><sub aria-hidden="true">y</sub></>, "Show transverse y component", "Hy"],
  ["electricMag", <>|<i aria-hidden="true">E</i>|</>, "Show electric-field magnitude", "|E|"],
  ["magneticMag", <>|<i aria-hidden="true">H</i>|</>, "Show magnetic-field magnitude", "|H|"],
] as const;

const materialPartOptions = [
  ["real", "Re", "Show the real material component", "Re"],
  ["imag", "Im", "Show the imaginary material component", "Im"],
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
  options: ReadonlyArray<readonly [string, ReactNode, string, string]>;
  selected: string;
}) {
  const legacyAttribute = {
    viewProjection: "data-view-projection",
    viewMode: "data-view-mode",
    fieldDisplay: "data-field-display",
    materialPart: "data-material-part",
  }[attribute as "viewProjection" | "viewMode" | "fieldDisplay" | "materialPart"];
  const selectedIndex = Math.max(0, options.findIndex(([value]) => value === selected));
  return (
    <ContentSwitcher
      aria-label={ariaLabel}
      className="visual-choice-switcher scientific-content-switcher scientific-content-switcher--sm"
      selectedIndex={selectedIndex}
      size="sm"
      onChange={({ index }) => {
        const option = typeof index === "number" ? options[index] : undefined;
        if (option) requestRuntimeAction("visual-choice", { property: attribute, value: option[0] });
      }}
    >
      {options.map(([value, label, title, accessibleLabel]) => (
        <Switch
          name={`${attribute}-${value}`}
          aria-label={accessibleLabel}
          title={title}
          data-visual-choice={attribute}
          data-visual-value={value}
          {...(legacyAttribute ? { [legacyAttribute]: value } : {})}
          key={value}
        >
          {label}
        </Switch>
      ))}
    </ContentSwitcher>
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
  const poyntingMode = viewMode === "poynting";
  const materialMode = viewMode === "epsilon" || viewMode === "mu";
  return (
    <>
      <ChoiceButtons ariaLabel="Projection" attribute="viewProjection" options={projectionOptions} selected={state?.viewProjection ?? "2d"} />
      <ChoiceButtons ariaLabel="View" attribute="viewMode" options={viewOptions} selected={viewMode} />
      {!poyntingMode ? (
        <ChoiceButtons ariaLabel="Field component" attribute="fieldDisplay" options={displayOptions} selected={state?.fieldDisplay ?? "scalar"} />
      ) : null}
      {!materialMode ? (
        <Checkbox
          id="fieldQuiverInput"
          className="toolbar-switch quiver-switch"
          labelText={<span id="fieldQuiverLabel" data-field-quiver-label><i>{poyntingMode ? "S" : "H"}</i> quiver</span>}
          title="Overlay vector arrows"
          checked={state?.fieldQuiver ?? false}
          onChange={(_, data) => requestRuntimeAction("visual-choice", { property: "fieldQuiver", value: data.checked })}
        />
      ) : null}
      {materialMode ? (
        <ChoiceButtons
          ariaLabel="Material component"
          attribute="materialPart"
          options={materialPartOptions}
          selected={state?.materialPart ?? "real"}
        />
      ) : null}
      {materialMode ? (
        <Checkbox
          id="materialFieldOverlayToolbarInput"
          className="toolbar-switch"
          labelText={<><i>E</i>/<i>H</i> overlay</>}
          title="Overlay a selectable electric or magnetic field on the material map"
          checked={state?.materialFieldOverlay ?? false}
          onChange={(_, data) => requestRuntimeAction("visual-choice", { property: "materialFieldOverlay", value: data.checked })}
        />
      ) : null}
      <span className="visual-options-divider" aria-hidden="true" />
      <OverlayControls toolbar />
    </>
  );
}

export function VisualFieldControls() {
  useFdtdRuntimeSelector((current) => current ? `${current.viewMode}|${current.viewProjection}|${current.fieldDisplay}|${current.fieldQuiver}|${current.materialFieldOverlay}` : "");
  const state = runtimeState();
  const viewMode = state?.viewMode ?? "field";
  const poyntingMode = viewMode === "poynting";
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
      {materialMode ? (
        <Checkbox
          id="materialFieldOverlayInput"
          className="toggle-row"
          labelText="Overlay field on ε/μ"
          checked={state?.materialFieldOverlay ?? false}
          onChange={(_, data) => requestRuntimeAction("visual-choice", { property: "materialFieldOverlay", value: data.checked })}
        />
      ) : null}
      {!poyntingMode ? (
        <div className="visual-control-row visual-component-row">
          <span>Component</span>
          <ChoiceButtons ariaLabel="Visual panel field component" attribute="fieldDisplay" options={displayOptions} selected={state?.fieldDisplay ?? "scalar"} />
        </div>
      ) : null}
      {!materialMode ? (
        <Checkbox
          id="fieldQuiverPanelInput"
          className="toggle-row visual-quiver-row"
          labelText={<span data-field-quiver-label><i>{poyntingMode ? "S" : "H"}</i> quiver</span>}
          title="Overlay vector arrows"
          checked={state?.fieldQuiver ?? false}
          onChange={(_, data) => requestRuntimeAction("visual-choice", { property: "fieldQuiver", value: data.checked })}
        />
      ) : null}
    </div>
  );
}

export function VisualOverlayControls() {
  return <OverlayControls />;
}

export function FieldComponentControls() {
  const selected = useFdtdRuntimeSelector((state) => state?.fieldComponent ?? "ez");
  return (
    <RadioButtonGroup
      className="solver-radio-group"
      legendText="Solver polarization"
      name="field-component"
      orientation="horizontal"
      valueSelected={selected}
      onChange={(value) => requestRuntimeAction("visual-choice", { property: "fieldComponent", value })}
    >
      <RadioButton id="field-component-ez" labelText={<><i>E</i><sub>z</sub> · TMz</>} value="ez" />
      <RadioButton id="field-component-hz" labelText={<><i>H</i><sub>z</sub> · TEz</>} value="hz" />
    </RadioButtonGroup>
  );
}
