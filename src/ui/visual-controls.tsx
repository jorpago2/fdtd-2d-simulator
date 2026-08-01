export function VisualFieldControls() {
  return (
    <div className="visual-control-stack" data-react-ui="visual-field-controls">
      <div className="visual-control-row">
        <span>Projection</span>
        <fieldset className="canvas-mode-toggle projection-toggle" role="radiogroup" aria-label="Visual panel projection">
          <legend className="sr-only">Visual panel projection</legend>
          <button className="mode-toggle-button is-active" type="button" role="radio" data-view-projection="2d" aria-checked="true" title="Show flat 2D map">2D</button>
          <button className="mode-toggle-button" type="button" role="radio" data-view-projection="3d" aria-checked="false" title="Show 3D surface">3D</button>
        </fieldset>
      </div>
      <div className="visual-control-row">
        <span>Quantity</span>
        <fieldset className="canvas-mode-toggle view-toggle" role="radiogroup" aria-label="Visual panel quantity">
          <legend className="sr-only">Visual panel quantity</legend>
          <button className="mode-toggle-button is-active" type="button" role="radio" data-view-mode="field" aria-checked="true" title="Show electromagnetic fields"><i>E</i>/<i>H</i></button>
          <button className="mode-toggle-button" type="button" role="radio" data-view-mode="poynting" aria-checked="false" title="Show Poynting vector flux"><i>S</i></button>
          <button className="mode-toggle-button" type="button" role="radio" data-view-mode="epsilon" aria-checked="false" title="Show permittivity map">ε</button>
          <button className="mode-toggle-button" type="button" role="radio" data-view-mode="mu" aria-checked="false" title="Show permeability map">μ</button>
        </fieldset>
      </div>
      <label className="toggle-row" title="Overlay a selectable electric or magnetic field on the material map" data-material-field-overlay-control hidden>
        <input type="checkbox" data-material-field-overlay-input />
        <span>Overlay field on ε/μ</span>
      </label>
      <div className="visual-control-row visual-component-row">
        <span>Component</span>
        <fieldset className="canvas-mode-toggle field-display-toggle" role="radiogroup" aria-label="Visual panel field component">
          <legend className="sr-only">Visual panel field component</legend>
          <button className="mode-toggle-button is-active" type="button" role="radio" data-field-display="scalar" aria-checked="true" title="Show out-of-plane field"><i>E</i><sub>z</sub></button>
          <button className="mode-toggle-button" type="button" role="radio" data-field-display="transverseX" aria-checked="false" title="Show transverse x component"><i>H</i><sub>x</sub></button>
          <button className="mode-toggle-button" type="button" role="radio" data-field-display="transverseY" aria-checked="false" title="Show transverse y component"><i>H</i><sub>y</sub></button>
          <button className="mode-toggle-button" type="button" role="radio" data-field-display="electricMag" aria-checked="false" title="Show electric-field magnitude">|<i>E</i>|</button>
          <button className="mode-toggle-button" type="button" role="radio" data-field-display="magneticMag" aria-checked="false" title="Show magnetic-field magnitude">|<i>H</i>|</button>
        </fieldset>
      </div>
      <label className="toggle-row visual-quiver-row" title="Overlay vector arrows" data-field-quiver-control>
        <input type="checkbox" data-field-quiver-input />
        <span data-field-quiver-label><i>H</i> quiver</span>
      </label>
    </div>
  );
}

const overlayLayers = [
  ["boundaries", "CPML/bounds", "Show CPML and reflective boundary overlays", true],
  ["monitors", "line monitors", "Show fixed L/R line-monitor markers", false],
  ["axes", "axes", "Show x and y axis glyph", true],
  ["scale", "scale", "Show wavelength scale bar", true],
  ["sources", "sources", "Show source markers", true],
  ["colorbar", "colorbar", "Show color scale", true],
] as const;

export function VisualOverlayControls() {
  return (
    <div className="visual-layer-grid" aria-label="Canvas overlay layers" data-react-ui="visual-overlay-controls">
      {overlayLayers.map(([layer, label, title, enabled]) => (
        <label className="toolbar-switch visual-layer-switch visual-panel-layer" title={title} key={layer}>
          <input type="checkbox" data-visual-layer={layer} defaultChecked={enabled} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}
