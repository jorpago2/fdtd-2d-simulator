# Design — EM Wave Simulator

A locked visual contract for the FDTD application. The interface should read as
a contemporary scientific instrument: exact, calm and canvas-first. Carbon is
the implementation vocabulary, not the aesthetic objective.

## Genre and structure

- Genre: modern-minimal, technical and austere.
- App macrostructure: Workbench.
- Primary surface: electromagnetic canvas.
- Secondary surfaces: workflow rail, task panel and contextual inspector.
- Enrichment: none. Scientific fields and geometry carry the visual content.

## Theme

FDTD consumes Carbon `g10` and `g100` through `@jorpago2/scientific-ui`.
Product tokens in `tokens.css` alias those theme tokens; application CSS must
not introduce a parallel palette.

- Blue is reserved for the primary action, active selection and focus.
- Layer changes communicate hierarchy; shadows are limited to true overlays.
- Field colormaps, material fills and source/monitor geometry retain their
  domain-specific colours.
- Light and dark modes preserve the same hierarchy rather than merely swapping
  foreground and background.

## Typography

- Display and UI: IBM Plex Sans through the shared scientific-ui font token.
- Numerical data: IBM Plex Mono where aligned comparison materially helps.
- Panel headings use compact Carbon headings; body copy is never smaller than
  Carbon body-compact text and explanatory prose uses a comfortable line height.
- Data uses tabular numerals. Symbols and units remain attached to their value.
- Sentence case is the default. Uppercase is reserved for short contextual
  kickers such as the active workflow step.

## Spacing and control rhythm

- Use the 4-point product scale in `tokens.css`.
- Labels sit above controls. Help and errors sit below them.
- Input, select and adjacent button heights align to a 48 px control rhythm;
  touch-reachable targets never fall below 44 px.
- Task sections use whitespace before borders. Avoid bordered cards inside
  already bordered panels.
- Narrow inspectors prefer stacked label/value rows over compressed columns.

## Component voice

- Primary action: one filled action per local task.
- Secondary action: ghost or tertiary; destructive actions never compete in
  width or colour with the commit action.
- Sliders expose a directly editable numerical value. The visible value and the
  value used by the runtime share the same units and scale.
- Segmented choices use a restrained selected surface plus an underline; all
  alternatives retain equal target sizes.
- Evidence and outcomes separate title, state, measurement and interpretation.
  States always pair text with an icon or shape, never colour alone.

## Responsive behaviour

- At Carbon `lg` and above, the canvas and task panel coexist.
- Below `lg`, an open task panel owns the work area and the bottom workflow rail
  remains visible.
- Compact summaries use two evidence columns and collapse to one only when the
  content requires it. Long scientific expressions stack rather than fragment.
- Recovery, help and contextual surfaces never cover their own Close or primary
  actions.

## Motion

- Motion is functional and minimal. No page reveals or decorative movement.
- Focus is instant. Drawer/overlay transitions may use the timing tokens in
  `tokens.css` and must reduce to at most a 150 ms opacity change when reduced
  motion is requested.

## Shared contract (normative)

This application consumes `@jorpago2/scientific-ui` and follows the [shared interface contract](https://github.com/jorpago2/jorpago2.github.io/blob/main/docs/interface-contract.md).

## Compatibility boundaries

- Existing `fdtd:*` events, React mount points and DOM IDs are compatibility contracts.
- The canvas may use a fixed-height workbench without document scrolling when every reachable control remains unobscured.
- Runtime controls may update React-rendered status text through the documented DOM bridge.
- Visual changes must not alter the solver, scene definitions or numerical results.
