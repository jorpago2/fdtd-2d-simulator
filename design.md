# Design — EM Wave Simulator

## Shared contract (normative)

This application consumes `@jorpago2/scientific-ui` and follows the [shared interface contract](https://github.com/jorpago2/jorpago2.github.io/blob/main/docs/interface-contract.md).

## Scientific exceptions

- Field colormaps, material fills and source/monitor geometry retain domain-specific colours.
- Existing `fdtd:*` events, React mount points and DOM IDs are compatibility contracts.
- The canvas may use a fixed-height workbench without document scrolling when every reachable control remains unobscured.
- Runtime controls may update React-rendered status text through the documented DOM bridge.
