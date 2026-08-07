
# AGENTS.md

## Project Context

This repository contains a React frontend using IBM Carbon Design System. The UI must remain visually consistent with Carbon, responsive, accessible, and behaviorally correct. Treat visual correctness and interaction behavior as first-class requirements.

## Working Rules

Before modifying code, inspect the relevant implementation, nearby components, project conventions, `package.json`, package manager, scripts, Carbon versions, and reproduce the problem whenever possible. For UI bugs, inspect the application in a real browser when available. Do not invent scripts, dependencies, component APIs, or Carbon APIs. Prefer the smallest root-cause fix without regressions.

## React Architecture

Prefer small focused components, predictable composition, shared components, existing hooks/utilities, semantic HTML, and stable layouts. Avoid unrelated rewrites during visual fixes.

## IBM Carbon

Use the installed Carbon implementation first. Before creating custom controls, check whether Carbon already provides the required Button, Input, Select, Dropdown, ComboBox, Checkbox, Tabs, Accordion, Modal, Notification, Tooltip, Menu, Table, Loading, Tag, Breadcrumb, Search, or shell component. Preserve Carbon accessibility, sizing, interaction, and visual conventions.

Use Carbon or project tokens for spacing, typography, color, backgrounds, borders, layers, focus, and sizing. Avoid arbitrary magic values unless product-specific and intentional. Respect `Grid`, `Column`, gutters, margins, maximum widths, shell offsets, and breakpoints; do not replace a functioning Carbon grid with local hacks.

## Responsive UI

Verify significant UI changes at 1440×900, 1280×800, 1024×768, 768×1024, and 390×844, including intermediate widths around breakpoints. Check horizontal overflow, clipping, overlaps, navigation coverage, fixed widths, min/max widths, wrapping, controls, modals, popovers, stacking, empty space, and layout jumps.

## Browser Validation

For UI work, use `$playwright-interactive` when available. Reproduce the issue, inspect the affected viewport, interact with controls, apply the fix, reload, verify the original scenario, check other supported viewports, and check nearby regressions. Do not claim a visual issue is fixed based only on compilation, static CSS, or unit tests.

## Interaction and Accessibility

Test default, hover, focus, active, selected, expanded, collapsed, disabled, loading, empty, error, and success states when relevant. Check semantic HTML, accessible names, keyboard operation, tab order, visible focus, Escape behavior, ARIA usage, error association, and disabled semantics. Prefer Carbon's built-in accessible behavior.

## CSS and Overlays

Prefer local, predictable, token-based, responsive, content-resilient styles. Avoid `!important`, arbitrary z-index escalation, negative margins, magic offsets, absolute structural positioning, JavaScript layout calculations, duplicate media queries, excessive specificity, and DOM-order hacks. For overlays inspect stacking contexts, `position`, `transform`, `opacity`, `overflow`, portals, and Carbon layers. Fix the source rather than increasing z-index repeatedly.

## Forms, Dense Interfaces, and Content

Check labels, help text, validation, required/disabled states, field sizing, spacing, keyboard navigation, mobile layout, long messages, empty/loading states, narrow tables, truncation, sorting, selection, and large datasets. Test long titles, labels, values, missing optional values, and localization-length content.

## Runtime and Testing

During browser validation inspect React warnings, exceptions, failed relevant requests, hydration errors, missing keys, invalid DOM nesting, accessibility warnings, and Carbon warnings. Discover and run the repository's actual scripts: typecheck, lint, tests, component/integration/accessibility tests, visual regression, and production build as applicable. Do not invent command names.

## Definition of Done

A UI change is complete only when the problem is reproduced or understood, the root cause is identified, the architecture and Carbon conventions are respected, browser behavior is verified, relevant responsive viewports and interaction states are checked, accessibility and runtime behavior have not regressed, automated checks pass, and nearby UI has been inspected.

## Required UI Bug Workflow

1. Reproduce: locate the route/component, run the app, identify viewport and interaction state.
2. Diagnose: determine whether the cause is Carbon usage, grid, CSS, parent layout, state, rendering, DOM, overflow, stacking, breakpoint, content, or browser behavior.
3. Fix: apply the smallest robust root-cause correction.
4. Verify: return to the browser and test the original scenario, other viewports, states, and adjacent UI.
5. Validate: run the appropriate automated checks.
6. Report: summarize root cause, changes, browser verification, automated verification, and remaining risks. Never claim unperformed verification.

## Repository Skills

Use `$carbon-ui-review` for Carbon-specific visual, component, consistency, or accessibility work. Use `$responsive-ui-audit` for responsive layout, breakpoint, overflow, wrapping, or viewport-specific problems. Use both when applicable. Prefer `$playwright-interactive` as the browser inspection layer.

## Review Priorities

Prioritize user-facing regressions: incorrect Carbon usage, reimplemented Carbon controls, hard-coded design values, overflow, fragile CSS hacks, missing interaction states, keyboard/accessibility regressions, long-content failures, modal/popover viewport problems, runtime errors, and missing verification. Distinguish defects, maintainability risks, and optional polish.
