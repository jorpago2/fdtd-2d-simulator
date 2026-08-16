import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CarbonButton } from "./carbon-primitives";
import { BoundaryEditor, BrushEditor, CanvasContextMenu, MonitorEditor, SourceEditor } from "./context-editors";
import { CanvasVisualControls } from "./visual-controls";
import { useFdtdRuntimeState } from "./runtime-state";

export function CanvasStage() {
  const canvasMode = useFdtdRuntimeState()?.canvasMode ?? "select";
  return <CanvasStageContents canvasMode={canvasMode} />;
}

const CanvasStageContents = memo(function CanvasStageContents({ canvasMode }: { canvasMode: string }) {
  const drawing = canvasMode === "brush";
  const [help, setHelp] = useState<{ open: boolean; topic: string | null }>({ open: false, topic: null });
  const [walkthrough, setWalkthrough] = useState({ open: false, progress: "Step 1 of 7", title: "Open the controls", text: "Use the menu button to open the simulation controls.", previousDisabled: true, nextLabel: "Next" });
  useEffect(() => {
    const sync = (event: Event) => setHelp((event as CustomEvent<{ open: boolean; topic: string | null }>).detail);
    window.addEventListener("fdtd:help-guide-state", sync);
    return () => window.removeEventListener("fdtd:help-guide-state", sync);
  }, []);
  useEffect(() => {
    const sync = (event: Event) => setWalkthrough((current) => ({ ...current, ...(event as CustomEvent<Partial<typeof current>>).detail }));
    window.addEventListener("fdtd:walkthrough-state", sync);
    return () => window.removeEventListener("fdtd:walkthrough-state", sync);
  }, []);
  const helpTitle = help.topic ? ({ scene: "Model", simulate: "Run", measure: "Measure", edit: "Canvas editing", numerics: "Validate" }[help.topic] ?? "How to use the simulator") : "How to use the simulator";
  return (
        <div className={`stage scientific-stage${drawing ? " is-draw-mode" : ""}`}>
          <div className="canvas-toolbar">
            <CarbonButton
              id="canvasOptionsToggle"
              className="icon-button canvas-options-toggle"
              data-carbon-icon-only="true"
              type="button"
              aria-controls="canvasViewControls"
              aria-expanded="false"
              aria-label="Canvas display options"
              title="Canvas display options"
              hidden={!help.open}
            >
              ⋯
            </CarbonButton>
            <div id="canvasViewControls" className="canvas-view-controls" aria-label="Canvas display" hidden>
              <CanvasVisualControls />
            </div>
          </div>

          <div className={`canvas-frame${drawing ? " is-draw-mode" : ""}`}>
            <canvas
              id="fieldCanvas"
              className="field-canvas"
              width="900"
              height="600"
              aria-hidden="true"
              hidden
            ></canvas>
            <canvas
              id="surfaceCanvas"
              className="surface-canvas"
              width="900"
              height="600"
              aria-hidden="true"
              hidden
            ></canvas>
            <canvas
              id="simCanvas"
              width="900"
              height="600"
              tabIndex={0}
              aria-keyshortcuts="Delete Backspace"
              aria-label="Normalized electromagnetic field map"
              aria-describedby="canvasFallbackDescription"
              data-canvas-mode={canvasMode}
            >
              Interactive 2D FDTD field map. Use the control panel to choose a scene, source, boundary condition, material model, and visualized field component.
            </canvas>
            <p id="canvasFallbackDescription" className="sr-only">
              Interactive 2D FDTD field map with selectable electromagnetic field, material, Poynting-vector, and overlay views.
            </p>
            <div className="colorbar" aria-label="Normalized E z over E 0 color scale">
              <span id="colorbarTitle" className="colorbar-title"><i>E</i><sub>z</sub> / <i>E</i><sub>0</sub></span>
              <div className="colorbar-body">
                <div id="colorbarGradient" className="colorbar-gradient" aria-hidden="true"></div>
                <div className="colorbar-labels" aria-hidden="true">
                  <span id="colorbarMax">+1.000</span>
                  <span id="colorbarMid">0</span>
                  <span id="colorbarMin">-1.000</span>
                </div>
              </div>
            </div>
            <div id="surfaceOrbitControls" className="surface-orbit-controls" role="group" aria-label="3D surface orbit controls" hidden>
              <CarbonButton
                id="surfaceOrbitGizmo"
                className="surface-orbit-gizmo"
                type="button"
                title="Rotate 3D surface with drag or arrow keys"
                aria-label="Rotate 3D surface; use arrow keys, Home to reset"
                aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home"
                data-surface-orbit-drag
              >
                <span className="surface-orbit-ring" aria-hidden="true"></span>
                <span className="surface-orbit-axis surface-orbit-axis-x" aria-hidden="true">X</span>
                <span className="surface-orbit-axis surface-orbit-axis-y" aria-hidden="true">Y</span>
                <span className="surface-orbit-axis surface-orbit-axis-z" aria-hidden="true">Z</span>
              </CarbonButton>
              <div className="surface-orbit-pad" aria-label="3D surface rotation steps">
                <CarbonButton type="button" title="Pitch up" aria-label="Pitch 3D surface up" data-surface-orbit-action="pitch-up">↑</CarbonButton>
                <CarbonButton type="button" title="Rotate left" aria-label="Rotate 3D surface left" data-surface-orbit-action="yaw-left">←</CarbonButton>
                <CarbonButton type="button" title="Reset 3D view" aria-label="Reset 3D surface view" data-surface-orbit-action="reset">⌂</CarbonButton>
                <CarbonButton type="button" title="Rotate right" aria-label="Rotate 3D surface right" data-surface-orbit-action="yaw-right">→</CarbonButton>
                <CarbonButton type="button" title="Pitch down" aria-label="Pitch 3D surface down" data-surface-orbit-action="pitch-down">↓</CarbonButton>
              </div>
              <output id="surfaceOrbitReadout" className="sr-only" aria-live="polite">3D orbit yaw 0°, pitch 0°</output>
            </div>
            {createPortal(<section
              id="helpGuidePanel"
              className="help-guide-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="helpGuideTitle"
              aria-describedby="helpGuideIntro"
              tabIndex={-1}
              hidden={!help.open}
            >
              <div className="help-guide-header">
                <CarbonButton
                  id="helpGuideBackBtn"
                  className="icon-button compact-button help-guide-back"
                  data-carbon-icon-only="true"
                  type="button"
                  title="Back to guide"
                  aria-label="Back to guide overview"
                  hidden={!help.topic}
                >
                  &larr;
                </CarbonButton>
                <div>
                  <p id="helpGuideKicker" className="panel-kicker">{help.topic ? "Guide detail" : "Quick guide"}</p>
                  <h2 id="helpGuideTitle">{helpTitle}</h2>
                </div>
                <CarbonButton id="helpGuideCloseBtn" className="icon-button compact-button" data-carbon-icon-only="true" type="button" title="Close guide" aria-label="Close guide">&times;</CarbonButton>
              </div>
              <div id="helpGuideHome" className="help-guide-body help-guide-view" hidden={Boolean(help.topic)}>
                <p id="helpGuideIntro" className="help-guide-intro">
                  Define the model, run the FDTD update, measure observables, then validate the numerical evidence.
                </p>
                <CarbonButton id="walkthroughStartBtn" className="text-button primary-button help-guide-walkthrough-button" data-carbon-kind="primary" type="button">
                  Start walkthrough
                </CarbonButton>
                <div className="help-guide-grid">
                  <CarbonButton className="help-guide-card" type="button" data-help-guide-topic="scene">
                    <span aria-hidden="true">1</span>
                    <strong>Model</strong>
                    <small>Examples, source, geometry, and boundaries.</small>
                    <b aria-hidden="true">&rsaquo;</b>
                  </CarbonButton>
                  <CarbonButton className="help-guide-card" type="button" data-help-guide-topic="simulate">
                    <span aria-hidden="true">2</span>
                    <strong>Run</strong>
                    <small>Run, reset, step, and display the fields.</small>
                    <b aria-hidden="true">&rsaquo;</b>
                  </CarbonButton>
                  <CarbonButton className="help-guide-card" type="button" data-help-guide-topic="measure">
                    <span aria-hidden="true">3</span>
                    <strong>Measure</strong>
                    <small>Outcomes, flux, monitors, and spectra.</small>
                    <b aria-hidden="true">&rsaquo;</b>
                  </CarbonButton>
                  <CarbonButton className="help-guide-card" type="button" data-help-guide-topic="edit">
                    <span aria-hidden="true">4</span>
                    <strong>Edit</strong>
                    <small>Sources, monitors, materials, and canvas actions.</small>
                    <b aria-hidden="true">&rsaquo;</b>
                  </CarbonButton>
                  <CarbonButton className="help-guide-card" type="button" data-help-guide-topic="numerics">
                    <span aria-hidden="true">5</span>
                    <strong>Validate</strong>
                    <small>Resolution, CFL, boundaries, and cost.</small>
                    <b aria-hidden="true">&rsaquo;</b>
                  </CarbonButton>
                </div>
                <div className="help-guide-note">
                  <strong>Physics note:</strong> field snapshots are qualitative. For quantitative work, check resolution, boundary distance, source type, monitors, and convergence.
                </div>
              </div>
              <div id="helpGuideDetail" className="help-guide-body help-guide-view help-guide-detail-view" aria-live="polite" hidden={!help.topic}>
                <section className="help-guide-topic" data-help-guide-topic-panel="scene" hidden={help.topic !== "scene"}>
                  <p>The Scene menu is the fastest way to start from a physically coherent setup.</p>
                  <ul>
                    <li><strong>Current</strong> shows the loaded example and what it is intended to demonstrate.</li>
                    <li><strong>Browse</strong> searches examples by family, such as sources, waveguides, resonators, or advanced materials.</li>
                    <li>Loading a scene updates the grid, sources, monitors, material map, and boundary conditions together.</li>
                  </ul>
                </section>
                <section className="help-guide-topic" data-help-guide-topic-panel="simulate" hidden={help.topic !== "simulate"}>
                  <p>Simulate controls the time evolution and how the field data is rendered. It does not change the geometry or material map by itself.</p>
                  <h3>Time controls</h3>
                  <ul>
                    <li><strong>Play</strong> advances the Yee-grid update continuously. The animation rate is a display choice; the solver still advances by discrete FDTD time steps.</li>
                    <li><strong>Step</strong> advances one controlled batch, useful when checking a source turn-on, a reflection, or whether a field has reached a monitor.</li>
                    <li><strong>Reset</strong> clears fields, dispersive memory, source history, and monitor traces while keeping the selected scene and edited objects.</li>
                  </ul>
                  <h3>What the display means</h3>
                  <ul>
                    <li><strong>Field maps</strong> show instantaneous field components. They are excellent for intuition, but not enough for quantitative reflection or transmission.</li>
                    <li><strong>Poynting flux</strong> is the local power-flow proxy. For quantitative work, integrate it on monitors and compare with a reference simulation.</li>
                    <li><strong>Material + field:</strong> in a 2D &epsilon; or &mu; view, enable the E/H overlay and choose a field component to compare the excitation with a time-varying or field-driven material response. The material colorbar remains the quantitative scale; the field overlay is independently auto-scaled.</li>
                    <li><strong>2D and 3D views</strong> render the same simulation data. Changing the view should not be interpreted as changing the electromagnetic model.</li>
                  </ul>
                  <h3>Implemented formulas</h3>
                  <ul>
                    <li><strong>Yee update:</strong> the default Ez mode advances Ez, Hx, and Hy on a split-field grid for loss and CPML.
                      <span className="help-guide-formula">H<sub>x</sub> &larr; H<sub>x</sub> - (S / &mu;<sub>x</sub>) &part;<sub>y</sub>E<sub>z</sub>, &nbsp; H<sub>y</sub> &larr; H<sub>y</sub> + (S / &mu;<sub>y</sub>) &part;<sub>x</sub>E<sub>z</sub></span>
                      <span className="help-guide-formula">E<sub>z</sub> = E<sub>zx</sub> + E<sub>zy</sub>, with E<sub>zx</sub> driven by &part;<sub>x</sub>H<sub>y</sub> and E<sub>zy</sub> driven by -&part;<sub>y</sub>H<sub>x</sub>.</span>
                    </li>
                    <li><strong>Source timing:</strong> source wavelength is converted to normalized frequency before the update.
                      <span className="help-guide-formula">f = S / (N<sub>&lambda;</sub> &middot; &lambda;<sub>s</sub>/&lambda;<sub>0</sub>)</span>
                      Default source: sine Jz filament, &lambda;<sub>s</sub>/&lambda;<sub>0</sub> = 1.00, amplitude = 0.55, x = 1.20 &lambda;<sub>0</sub>, y = 3.00 &lambda;<sub>0</sub>, FWHM/window = 0.35 &lambda;<sub>0</sub>, angle = 0&deg;, phase = 0&deg;.
                    </li>
                    <li><strong>Time profiles:</strong> sine sources use a smooth ramp, while pulse sources use fixed compact envelopes.
                      <span className="help-guide-formula">sine: A sin(2&pi;ft), ramped over max(24, 1.5/f) steps</span>
                      <span className="help-guide-formula">Gaussian: A exp[-(t - 48)<sup>2</sup> / (2 &middot; 14<sup>2</sup>)], &nbsp; Ricker: A(1 - 2a<sup>2</sup>)exp(-a<sup>2</sup>)</span>
                    </li>
                    <li><strong>Guided mode source:</strong> mode launch solves a 1D finite-difference eigenproblem and injects a selected profile, not a hand-drawn line.
                      <span className="help-guide-formula">[&Delta;<sub>y</sub> + k<sub>0</sub><sup>2</sup>&epsilon;(y)&mu;(y)]&psi; = &beta;<sup>2</sup>&psi;, &nbsp; n<sub>eff</sub> = &beta;/k<sub>0</sub></span>
                      Mode order is limited to 0-3 and the mode window is clamped to 0.25-3.00 &lambda;<sub>0</sub>.
                    </li>
                    <li><strong>Poynting map:</strong> the rendered power-flow components are derived from the simulated field components.
                      <span className="help-guide-formula">Ez mode: S<sub>x</sub> = -E<sub>z</sub>H<sub>y</sub>, &nbsp; S<sub>y</sub> = E<sub>z</sub>H<sub>x</sub></span>
                      <span className="help-guide-formula">Hz mode: S<sub>x</sub> = E<sub>y</sub>H<sub>z</sub>, &nbsp; S<sub>y</sub> = -E<sub>x</sub>H<sub>z</sub></span>
                    </li>
                    <li><strong>Maxwell checker:</strong> Results &gt; Maxwell equations compares two consecutive Yee states with the update equations actually used by the simulator.
                      <span className="help-guide-formula">residual = RMS(LHS - RHS) / RMS(LHS, RHS)</span>
                      It samples only regular interior cells; CPML, injected-source neighborhoods, material interfaces, PEC, lossy, dispersive, tensor, gain, nonlinear, and time-varying material cells are excluded from the simple curl check.
                    </li>
                  </ul>
                  <p className="help-guide-topic-note">A stable-looking animation can still be under-resolved. For resonators, waveguides, plasmonics, or lossy media, inspect monitors after transients decay.</p>
                </section>
                <section className="help-guide-topic" data-help-guide-topic-panel="measure" hidden={help.topic !== "measure"}>
                  <p>Measure turns the simulated fields into evidence that answers the physical question posed by the scene.</p>
                  <ul>
                    <li><strong>Outcome</strong> summarizes whether the selected monitor has enough data to report a result.</li>
                    <li><strong>Line monitors</strong> estimate local fields, flux, reflectance, and transmittance after the transient has reached them.</li>
                    <li><strong>Spectra and ports</strong> require a sufficient sampling window; a single field snapshot is not a quantitative result.</li>
                    <li><strong>Export</strong> preserves the current result and its numerical context for later comparison.</li>
                  </ul>
                  <p className="help-guide-topic-note">Place monitors away from sources, discontinuities, and CPML unless the experiment intentionally probes a near-field quantity.</p>
                </section>
                <section className="help-guide-topic" data-help-guide-topic-panel="edit" hidden={help.topic !== "edit"}>
                  <p>Edit changes the simulation setup, so results should be interpreted again after modifying it. A geometry edit is a new numerical experiment.</p>
                  <h3>Select</h3>
                  <ul>
                    <li><strong>Sources</strong> define how energy enters the domain: plane wave, mode, dipole, current source, or other excitation depending on the scene.</li>
                    <li><strong>Monitors</strong> are measurement objects. Place them away from sources, discontinuities, and CPML unless measuring a local near-field quantity intentionally.</li>
                    <li><strong>Delete</strong> removes the selected object from the setup. If a source or monitor disappears, the simulation may still run but the physical question changes.</li>
                  </ul>
                  <h3>Contextual menus</h3>
                  <ul>
                    <li><strong>Canvas menu:</strong> right-click or long-press an empty point of the canvas to add a source or a contextual monitor. The pointer position is converted to simulation coordinates, expressed as x/&lambda;<sub>0</sub> and y/&lambda;<sub>0</sub>, then clamped to the active interior so the object is not created inside the CPML band.</li>
                    <li><strong>Source menu:</strong> edits the temporal profile, spatial profile, source wavelength &lambda;<sub>s</sub>/&lambda;<sub>0</sub>, amplitude A, position, FWHM/window, propagation angle &theta;, phase &phi;, and multipole order n when the selected source type uses it.</li>
                    <li><strong>Monitor menu:</strong> edits the measured quantity, center position, length L, and angle &theta;. The angle defines the monitor tangent direction.
                      <span className="help-guide-formula">u = (cos&theta;, sin&theta;), &nbsp; n = (-sin&theta;, cos&theta;)</span>
                    </li>
                    <li><strong>Boundary menu:</strong> switches the selected boundary between CPML absorbing and reflective. This changes the numerical boundary condition, so reflected/transmitted measurements should be recollected after the fields have been reset or have decayed.</li>
                  </ul>
                  <h3>Contextual monitor results</h3>
                  <ul>
                    <li><strong>Sampling:</strong> a contextual monitor is a discrete line segment, not a continuous analytical port. Its center is converted to a cell, its length is converted to cells, and the segment is sampled by rounding points back to Yee cells. Duplicate cells and PEC cells are skipped.
                      <span className="help-guide-formula">N<sub>s</sub> = number of accepted cells after rounding, clamping, duplicate removal, and PEC rejection</span>
                    </li>
                    <li><strong>Scalar readouts:</strong> each accepted cell contributes the scaled out-of-plane simulated field F<sub>z</sub>.
                      <span className="help-guide-formula">f<sub>i</sub> = F<sub>z,i</sub> &middot; fieldScale, &nbsp; F<sub>z</sub> = E<sub>z</sub> (TMz) or H<sub>z</sub> (TEz)</span>
                      <span className="help-guide-formula">Mean = (1/N<sub>s</sub>)&Sigma;f<sub>i</sub>, &nbsp; RMS = sqrt[(1/N<sub>s</sub>)&Sigma;f<sub>i</sub><sup>2</sup>], &nbsp; Mean |F<sub>z</sub>| = (1/N<sub>s</sub>)&Sigma;|f<sub>i</sub>|</span>
                      Mean |F<sub>z</sub>| is the magnitude of the scalar simulated component, not a full vector norm of E and H.
                    </li>
                    <li><strong>Flux readouts:</strong> the simulator first computes the local Poynting proxy from the simulated fields, then projects it onto the monitor normal and tangent.
                      <span className="help-guide-formula">Ez mode: S = (-E<sub>z</sub>H<sub>y</sub>, E<sub>z</sub>H<sub>x</sub>)</span>
                      <span className="help-guide-formula">Hz mode: S = (E<sub>y</sub>H<sub>z</sub>, -E<sub>x</sub>H<sub>z</sub>)</span>
                      <span className="help-guide-formula">Flux n = (1/N<sub>s</sub>)&Sigma;(S<sub>i</sub>&middot;n)&middot;fieldScale<sup>2</sup>, &nbsp; Flux t = (1/N<sub>s</sub>)&Sigma;(S<sub>i</sub>&middot;u)&middot;fieldScale<sup>2</sup></span>
                    </li>
                    <li><strong>Selected value:</strong> the highlighted Value follows the monitor quantity: Scalar returns Mean, scalar-field magnitude returns Mean |F<sub>z</sub>|, and the flux options return the mean normal or tangential Poynting component. Values are instantaneous at the reported FDTD time unless a scene-specific Results observable states otherwise.</li>
                    <li><strong>Interpretation:</strong> these are line averages in simulator units. They are useful for local probes, qualitative flux direction, and relative comparisons. For quantitative R/T and signed power-balance residual, use the diagnostic line-monitor results or compare contextual monitor readings against a reference scene with the same grid, source, scale, and monitor placement. Interpret absorption only for passive, stationary scenes.</li>
                  </ul>
                  <h3>Draw</h3>
                  <ul>
                    <li><strong>Brush mode:</strong> paints material cells along the pointer path. Brush size is given in &lambda;<sub>0</sub> and converted to an integer cell radius before painting. It is fast for sketches, but curved or thin features can still be staircased on a coarse grid.</li>
                    <li><strong>Geometry mode:</strong> inserts a parametric object centered on the click or touch point. Rectangle and ellipse use width w and height h; circle uses radius r; ring uses outer radius r and inner radius r<sub>in</sub>. All dimensions are normalized to &lambda;<sub>0</sub>.</li>
                    <li><strong>Geometry limits:</strong> w and h are clamped to 0.05-50 &lambda;<sub>0</sub>, r to 0.05-25 &lambda;<sub>0</sub>, and r<sub>in</sub> to 0.01-25 &lambda;<sub>0</sub>. If r<sub>in</sub> is not smaller than r, it is reduced automatically.</li>
                    <li><strong>Selected regions:</strong> when an already drawn material region is selected, the same Draw menu edits that region instead of preparing a new brush stroke. Changing custom parameters rewrites all custom cells with the current material model and recollects the numerical state.</li>
                  </ul>
                  <h3>Material presets</h3>
                  <ul>
                    <li><strong>Custom &epsilon;, &mu;:</strong> writes the user-defined relative permittivity and permeability into the selected cells. This is the only preset that can carry anisotropy, conductivity, gain, modulation, nonlinearity, phase-change, gyrotropy, bianisotropy, or ADE dispersion.</li>
                    <li><strong>PEC:</strong> creates a perfect electric conductor mask. The cell material code is PEC, electric fields in that cell are zeroed, and advanced material states are cleared for those cells.</li>
                    <li><strong>Loss preset:</strong> writes a simple dielectric with &epsilon;<sub>r</sub> = 2.6, &ell;<sub>&epsilon;</sub> = 0.028, &mu;<sub>r</sub> = 1, and &ell;<sub>&mu;</sub> = 0. It is a convenient normalized absorber/scatterer, not a measured complex permittivity or a CPML replacement.</li>
                    <li><strong>Erase:</strong> returns cells to air, with &epsilon;<sub>r</sub> = 1, &ell;<sub>&epsilon;</sub> = 0, &mu;<sub>r</sub> = 1, &ell;<sub>&mu;</sub> = 0, and no dynamic material state.</li>
                    <li><strong>Clear medium / Clear field:</strong> Clear medium removes drawn material from the scene. Clear field resets the electromagnetic field arrays while keeping the geometry and material parameters.</li>
                  </ul>
                  <h3 id="materialParameterReference">Material parameter units</h3>
                  <ul>
                    <li><strong>Normalized grid:</strong> &Delta;x = &lambda;<sub>0</sub>/N<sub>&lambda;</sub> and &Delta;t = S&Delta;x/c<sub>0</sub>, where S = 0.10 and N<sub>&lambda;</sub> is Cells / &lambda;<sub>0</sub>. Lengths are ratios to &lambda;<sub>0</sub>; field amplitude and intensity remain simulator units unless externally calibrated.</li>
                    <li><strong>Conversion to SI:</strong> use the configured &lambda;<sub>0</sub> in metres. Then &omega;<sub>SI</sub> = &omega;<sub>step</sub>/&Delta;t, &gamma;<sub>SI</sub> = &gamma;<sub>step</sub>/&Delta;t, f<sub>SI</sub> = f<sub>step</sub>/&Delta;t, &tau;<sub>SI</sub> = &tau;<sub>steps</sub>&Delta;t, and &sigma;<sub>SI</sub> = &sigma;<sub>n</sub>&epsilon;<sub>0</sub>c<sub>0</sub>/&Delta;x.</li>
                    <li><strong>&epsilon;<sub>r,x/y</sub>:</strong> dimensionless relative permittivity in the electric update; isotropic default 4.00. <strong>&mu;<sub>r,x/y</sub>:</strong> dimensionless relative permeability in the magnetic update; isotropic default 1.00.</li>
                    <li><strong>&ell;<sub>&epsilon;,x/y</sub>:</strong> dimensionless electric loss per time step. <strong>&ell;<sub>&mu;,x/y</sub>:</strong> equivalent magnetic loss. The update multiplies the field by 1/(1 + &ell;); positive values damp and negative values add normalized gain.</li>
                    <li><strong>Do not enter tabulated &epsilon;'' or &mu;'':</strong> the &ell; fields are discrete damping coefficients, not frequency-independent imaginary constitutive parameters. Use normalized conductivity or a causal ADE fit for measured loss.</li>
                    <li><strong>Anisotropic &epsilon;, &mu;:</strong> exposes grid-aligned y entries; it does not rotate the principal axes. Real values and loss coefficients are clamped to -30...30. Near-zero or negative nondispersive values need particular care.</li>
                  </ul>
                  <h3>Advanced material options: tensor, coupling, and conductivity</h3>
                  <ul>
                    <li><strong>g<sub>&epsilon;</sub>:</strong> dimensionless antisymmetric electric-tensor coupling, active only in Hz mode; default 0.25, range -5...5.
                      <span className="help-guide-formula">&epsilon;<sub>xy</sub> = +g<sub>&epsilon;</sub>, &nbsp; &epsilon;<sub>yx</sub> = -g<sub>&epsilon;</sub></span>
                      It is an instantaneous real teaching proxy, not the causal complex &plusmn;ig tensor required for calibrated Faraday rotation.
                    </li>
                    <li><strong>&kappa;<sub>n</sub>:</strong> dimensionless normalized magnetoelectric coupling &kappa;/&radic;(|&epsilon;&mu;|). Its sign controls coupling handedness; range -0.85...0.85, default 0.20. The editor uses a reduced local constitutive proxy; curated bianisotropic scenes can enable the six-field route.</li>
                    <li><strong>&sigma;<sub>n,x</sub>, &sigma;<sub>n,y</sub>:</strong> non-negative normalized electric conductivity, range 0...5. The y value appears with anisotropy; otherwise x is used for both axes.
                      <span className="help-guide-formula">q = &sigma;<sub>n</sub>S/(2|&epsilon;<sub>r</sub>|), &nbsp; C<sub>a</sub> = (1 - q)/(1 + q), &nbsp; C<sub>b</sub> = 1/(1 + q)</span>
                      This is the J = &sigma;E damping route for a nondispersive conductor; use ADE for metallic dispersion.
                    </li>
                    <li><strong>I<sub>sat,g</sub>:</strong> simulator intensity at which negative &ell;<sub>&epsilon;</sub> is reduced by one half. Units are normalized field amplitude squared; range 0.05...100, default 4.00. It has no effect for non-negative loss.
                      <span className="help-guide-formula">&ell;<sub>gain,eff</sub> = &ell;<sub>gain</sub>/(1 + I/I<sub>sat,g</sub>)</span>
                    </li>
                  </ul>
                  <h3>Space-time and nonlinear response</h3>
                  <ul>
                    <li><strong>m:</strong> dimensionless fractional modulation depth of the base real permittivity, range 0...0.95, default 0.20.</li>
                    <li><strong>f<sub>m</sub>:</strong> signed modulation frequency in cycles per FDTD time step, range -0.2...0.2, default 0.010. Its sign reverses temporal phase progression.</li>
                    <li><strong>&Lambda;<sub>m</sub>/&lambda;<sub>0</sub>:</strong> modulation period normalized to the configured free-space wavelength, range 0.1...20, default 2.0.</li>
                    <li><strong>&theta;<sub>m</sub>:</strong> modulation-wavevector direction from +x in degrees, 0...360&deg;, default 0&deg;. <strong>&phi;<sub>m</sub>:</strong> initial phase in degrees, -180...180&deg;, default 0&deg;.</li>
                    <li><strong>Kerr &chi;<sup>(3)</sup>:</strong> normalized coefficient in inverse simulator intensity, range -20...20, default 0.50. Positive values increase &epsilon; in this scalar model. <strong>I<sub>sat</sub>:</strong> saturation intensity in simulator field-squared units, range 0.05...50, default 5.00.
                      <span className="help-guide-formula">&Delta;&epsilon;<sub>Kerr</sub> = &chi;<sup>(3)</sup>I/(1 + I/I<sub>sat</sub>)</span>
                    </li>
                    <li><strong>Harmonic &chi;<sup>(2)</sup>, &chi;<sup>(3)</sup><sub>H</sub>:</strong> normalized polarization coefficients, each in -2...2; defaults 0.08 and 0.00. They are not SI susceptibilities. <strong>I<sub>sat,H</sub>:</strong> saturation intensity in simulator field-squared units, range 0.05...50, default 6.00.
                      <span className="help-guide-formula">P<sub>NL</sub> = [&chi;<sup>(2)</sup>E<sup>2</sup> + &chi;<sup>(3)</sup><sub>H</sub>E<sup>3</sup>]/(1 + E<sup>2</sup>/I<sub>sat,H</sub>)</span>
                    </li>
                    <li><strong>Phase-change &epsilon;<sub>on</sub>:</strong> relative permittivity at state s = 1; default 9.00. <strong>&ell;<sub>&epsilon;,on</sub>:</strong> per-step electric loss at s = 1; default 0.08. The s = 0 values are the base &epsilon;<sub>r</sub> and &ell;<sub>&epsilon;</sub>.</li>
                    <li><strong>I<sub>on</sub>, I<sub>off</sub>:</strong> switching and recovery thresholds in simulator field-squared units; defaults 0.80 and 0.20, with I<sub>off</sub> &le; I<sub>on</sub>. <strong>&tau;<sub>on</sub>, &tau;<sub>off</sub>:</strong> exponential time constants in FDTD steps; defaults 18 and 180.
                      <span className="help-guide-formula">I &ge; I<sub>on</sub>: s &larr; s + (1 - s)(1 - e<sup>-1/&tau;<sub>on</sub></sup>); &nbsp; I &le; I<sub>off</sub>: s &larr; s - s(1 - e<sup>-1/&tau;<sub>off</sub></sup>)</span>
                    </li>
                  </ul>
                  <h3>Dispersive ADE parameters</h3>
                  <ul>
                    <li><strong>Model:</strong> None disables material memory. Drude and plasma expose the same free-carrier ADE parameters but use different teaching labels. Lorentz uses a bound resonance; Debye uses first-order relaxation. Base &epsilon;<sub>r</sub> is the high-frequency/background permittivity.</li>
                    <li><strong>&omega;<sub>p</sub>:</strong> plasma angular frequency in radians per FDTD step; used by Drude/Plasma, range 0...1.2, default 0.28. <strong>&gamma;:</strong> damping rate per step, range 0...0.5, default 0.018; used by Drude/Plasma and Lorentz.</li>
                    <li><strong>&omega;<sub>0</sub>:</strong> Lorentz resonance angular frequency in radians per step, range 0...1.2, default 0.15. <strong>&Delta;&epsilon;:</strong> dimensionless Lorentz oscillator strength or Debye static-to-high-frequency increment, range -20...20, default 2.00.</li>
                    <li><strong>&tau;:</strong> Debye relaxation time in FDTD steps, range 1...200, default 18.</li>
                  </ul>
                  <h3>Model scope</h3>
                  <ul>
                    <li>PEC is ideal and lossless. Tensor coupling, Kerr, harmonic, phase-change, gain, and time modulation are reduced normalized models; fit and validate them independently before mapping to measured materials.</li>
                    <li>Subpixel smoothing is restricted to passive dielectric interfaces. PEC, dispersive, tensorial, nonlinear, gain, modulation, and phase-change cells retain explicit masks.</li>
                    <li>Near-zero values, gain, large ADE poles, strong modulation, and high coupling can destabilize the solver. Finite fields and UI warnings are not a convergence proof.</li>
                  </ul>
                  <h3>Implementation formulas</h3>
                  <ul>
                    <li><strong>Base and loss:</strong> constitutive values scale the Yee curl terms; the separate &ell; coefficients apply per-step decay.
                      <span className="help-guide-formula">E<sup>n+1</sup> = E<sub>curl</sub><sup>n+1</sup>/(1 + &ell;<sub>&epsilon;</sub>), &nbsp; H<sup>n+1</sup> = H<sub>curl</sub><sup>n+1</sup>/(1 + &ell;<sub>&mu;</sub>)</span>
                    </li>
                    <li><strong>Conductivity:</strong> normalized conductivity modifies both the stored field and the curl drive.
                      <span className="help-guide-formula">q = &sigma;<sub>n</sub>S/(2|&epsilon;<sub>r</sub>|), &nbsp; C<sub>a</sub> = (1 - q)/(1 + q), &nbsp; C<sub>b</sub> = 1/(1 + q)</span>
                    </li>
                    <li><strong>Kerr and modulation:</strong> enabled cells update their effective permittivity before each field step.
                      <span className="help-guide-formula">&epsilon;<sub>eff</sub> = &epsilon;<sub>base</sub>&#123;1 + m cos[2&pi;((x cos&theta;<sub>m</sub> + y sin&theta;<sub>m</sub>)/&Lambda;<sub>m</sub> - f<sub>m</sub>t) + &phi;<sub>m</sub>]&#125; + &chi;<sup>(3)</sup>I/(1 + I/I<sub>sat</sub>)</span>
                    </li>
                    <li><strong>Harmonic response:</strong> nonlinear polarization is converted to a current-like correction from its discrete change.
                      <span className="help-guide-formula">P<sub>NL</sub> = [&chi;<sup>(2)</sup>E<sup>2</sup> + &chi;<sup>(3)</sup><sub>H</sub>E<sup>3</sup>]/(1 + E<sup>2</sup>/I<sub>sat,H</sub>), &nbsp; J<sub>NL</sub> = P<sub>NL</sub><sup>n</sup> - P<sub>NL</sub><sup>n-1</sup></span>
                    </li>
                    <li><strong>Phase-change material:</strong> the internal state s moves between off and on states according to field intensity.
                      <span className="help-guide-formula">if I &ge; I<sub>on</sub>: s &larr; s + (1 - s)(1 - e<sup>-1/&tau;<sub>on</sub></sup>); if I &le; I<sub>off</sub>: s &larr; s - s(1 - e<sup>-1/&tau;<sub>off</sub></sup>)</span>
                      &epsilon;<sub>r</sub> and &ell;<sub>&epsilon;</sub> are linearly interpolated between their off/on values using s.
                    </li>
                    <li><strong>Dispersion:</strong> Drude and Lorentz cells use second-order ADE polarization memory; Debye uses exponential relaxation.
                      <span className="help-guide-formula">Drude/Lorentz ADE: P<sup>n+1</sup> = [(2 - &omega;<sub>0</sub><sup>2</sup>)P<sup>n</sup> - (1 - &gamma;/2)P<sup>n-1</sup> + drive&middot;E<sup>n</sup>] / (1 + &gamma;/2)</span>
                      Drude sets &omega;<sub>0</sub> = 0 and drive = &omega;<sub>p</sub><sup>2</sup>; Lorentz uses drive = &Delta;&epsilon;&omega;<sub>0</sub><sup>2</sup>; Debye uses exp(-1/&tau;).
                    </li>
                  </ul>
                  <p className="help-guide-topic-note">After drawing, check whether the smallest feature is actually resolved by enough cells. Visual smoothness is not the same as numerical convergence.</p>
                </section>
                <section className="help-guide-topic" data-help-guide-topic-panel="numerics" hidden={help.topic !== "numerics"}>
                  <p>Numerics controls accuracy, stability, and performance. These settings decide whether a pretty field pattern is also a trustworthy simulation.</p>
                  <h3>Resolution</h3>
                  <ul>
                    <li><strong>Cells / &lambda;<sub>0</sub></strong> sets how finely the free-space wavelength is sampled. Inside a material, the wavelength is shorter by the refractive index.</li>
                    <li>Basic propagation may look acceptable with moderate resolution, but high-Q resonators, thin gaps, plasmonics, and phase-sensitive devices need many more cells.</li>
                    <li><strong>Subpixel smoothing</strong> reduces staircasing at material interfaces. It helps geometry errors, but it is not a substitute for convergence checks.</li>
                  </ul>
                  <h3>Implemented numerical values</h3>
                  <ul>
                    <li><strong>Grid and timestep:</strong> square cells are normalized by the free-space wavelength.
                      <span className="help-guide-formula">&Delta;x = &lambda;<sub>0</sub> / N<sub>&lambda;</sub>, &nbsp; &Delta;t = S&Delta;x/c<sub>0</sub></span>
                      Defaults: N<sub>&lambda;</sub> = 20, &lambda;<sub>0</sub> = 1.00 &micro;m, S = 0.10, grid = 360 x 240 cells. The hard grid limit is 1200 x 800 cells.
                    </li>
                    <li><strong>CPML absorbing boundary:</strong> the simulator uses graded convolutional PML coefficients.
                      <span className="help-guide-formula">&sigma;<sub>max</sub> = -ln(R)(m + 1)/(2L), &nbsp; &kappa; = 1 + (&kappa;<sub>max</sub> - 1)u<sup>m</sup>, &nbsp; b = exp[-(&sigma;&Delta;t/&kappa; + &alpha;&Delta;t)]</span>
                      <span className="help-guide-formula">&psi; &larr; b&psi; + a&part;F, &nbsp; &part;F<sub>CPML</sub> = &part;F/&kappa; + &psi;</span>
                      Defaults: order m = 4, &kappa;<sub>max</sub> = 6, &alpha;<sub>max</sub> = 0.08S = 0.008, target reflection R = 1e-10.
                    </li>
                    <li><strong>Boundary thickness:</strong> CPML thickness is chosen from wavelength and domain size, while reflective walls use a short zeroed-field band.
                      <span className="help-guide-formula">L<sub>CPML</sub> = min(max(18, round(0.9N<sub>&lambda;</sub>), round(0.16 min(N<sub>x</sub>, N<sub>y</sub>))), round(0.24 min(N<sub>x</sub>, N<sub>y</sub>)))</span>
                      Reflective wall thickness is round(0.14N<sub>&lambda;</sub>) clamped to 3-10 cells.
                    </li>
                  </ul>
                  <h3>Time step and boundaries</h3>
                  <ul>
                    <li><strong>CFL</strong> controls the time step. A smaller value is more conservative for difficult media, but it requires more steps for the same physical time.</li>
                    <li><strong>CPML</strong> absorbs outgoing waves at open boundaries. It works best when sources, resonators, and strong near fields are not too close to the absorbing layer.</li>
                    <li><strong>Reflective boundaries</strong> are physical walls, not numerical absorbers. Use them only when a mirror-like boundary is part of the intended problem.</li>
                  </ul>
                  <h3>What to trust</h3>
                  <ul>
                    <li>For quantitative reflection, transmission, absorption, or Q factor, use monitors and compare against a reference or a refined grid.</li>
                    <li>If changing grid size, CFL, or CPML thickness changes the conclusion, the setup is not converged yet.</li>
                    <li>Performance cost grows with the number of cells, fields, material states, monitors, and rendered pixels.</li>
                  </ul>
                </section>
              </div>
            </section>, document.body)}
            {createPortal(<>
              <div id="walkthroughOverlay" className="walkthrough-overlay" hidden={!walkthrough.open}></div>
              <div id="walkthroughHighlight" className="walkthrough-highlight" aria-hidden="true" hidden={!walkthrough.open}></div>
              <section
                id="walkthroughPanel"
                className="walkthrough-panel"
                role="dialog"
                aria-labelledby="walkthroughTitle"
                aria-describedby="walkthroughText"
                tabIndex={-1}
                hidden={!walkthrough.open}
              >
                <div className="walkthrough-header">
                  <output id="walkthroughProgress" className="panel-kicker">{walkthrough.progress}</output>
                  <CarbonButton id="walkthroughSkipBtn" className="icon-button compact-button" data-carbon-icon-only="true" type="button" title="Close walkthrough" aria-label="Close walkthrough">&times;</CarbonButton>
                </div>
                <h2 id="walkthroughTitle">{walkthrough.title}</h2>
                <p id="walkthroughText">{walkthrough.text}</p>
                <div className="walkthrough-actions">
                  <CarbonButton id="walkthroughPrevBtn" className="text-button" type="button" disabled={walkthrough.previousDisabled}>Back</CarbonButton>
                  <CarbonButton id="walkthroughNextBtn" className="text-button primary-button" data-carbon-kind="primary" type="button">{walkthrough.nextLabel}</CarbonButton>
                </div>
              </section>
            </>, document.body)}
            <CanvasContextMenu />
            <SourceEditor />
            <MonitorEditor />
            <BrushEditor />
            <BoundaryEditor />
          </div>
        </div>
  );
});
