---
name: carbon-ui-review
description: Audit, diagnose, fix, and verify React UI that uses IBM Carbon Design System. Use for Carbon component usage, visual consistency, spacing, typography, colors, grid/layout, forms, tables, UI shell, interaction states, accessibility, or visual polish.
---

# Carbon UI Review

Act as a senior frontend engineer with strong knowledge of design-system-driven interfaces. Treat correctness, consistency, robustness, responsiveness, accessibility, maintainability, and alignment with the repository's Carbon implementation as first-class requirements.

## Core principle

Do not fix Carbon UI by layering arbitrary CSS over an incorrectly structured component. Prefer, in order:

1. Correct Carbon component.
2. Correct Carbon API and props.
3. Correct Carbon grid/layout.
4. Carbon or project tokens.
5. Existing project abstraction.
6. Small targeted custom CSS.
7. Custom behavior only when necessary.

## Repository inspection

Before editing, inspect `package.json`, package manager, scripts, installed Carbon packages and versions, style loading, theme, tokens, wrappers, grid implementation, Sass/CSS structure, Storybook, and browser tooling. Search for comparable working components and follow established patterns.

## Reproduce visually

When browser access exists, inspect the rendered route before editing. Prefer `$playwright-interactive`. Record route, viewport, UI state, triggering interaction, expected behavior, and actual behavior. Determine whether the defect depends on width, content, interaction, state, or container.

## Carbon component audit

Check whether custom Buttons, form controls, Dropdowns, Search, Tabs, Accordions, Modals, Tooltips, Notifications, Tables, Pagination, Tags, Breadcrumbs, Navigation, and Loading states should use the installed Carbon components. Do not replace intentional project wrappers, but do not recreate Carbon behavior without justification.

## Token and typography audit

Inspect hard-coded colors, spacing, gaps, font sizes, line heights, borders, backgrounds, and heights. Understand semantic roles before replacing values. Check heading hierarchy, labels, helper text, table text, button text, metadata, wrapping, truncation, weight, and line height. Prefer the existing Carbon typography approach.

## Grid and layout audit

Inspect from the outer shell inward: `Grid`, `Column`, nested grids, gutters, margins, width constraints, alignment, content density, min/max widths, flex shrink, absolute positioning, fixed widths, duplicate padding, and shell offsets. Fix the responsible parent layer rather than patching a deep child.

## State, forms, tables, and overlays

For affected interactions inspect default, hover, focus, active, selected, disabled, expanded, loading, error, and success states. For forms check labels, sizes, required/optional state, help, errors, validation, submission, keyboard navigation, and long messages. For tables check sizing, alignment, sorting, selection, expansion, pagination, toolbar/search, empty/loading states, long values, and narrow viewports. For overlays check collision, scrolling, focus, Escape, alignment, layering, stacking contexts, and parent clipping. Never blindly increase `z-index`.

## Accessibility

Check semantic HTML, accessible names, form association, keyboard access, tab order, visible focus, ARIA, screen-reader state, modal focus, disabled semantics, and error semantics. Prefer Carbon's built-in behavior.

## Fix strategy

Identify the owning layer: component, configuration, grid, state, CSS, parent constraint, token, responsive behavior, content resilience, or accessibility. Fix that layer and avoid symptom patches. Investigate `!important`, negative margins, absolute offsets, fixed widths, huge z-index values, repeated media-query overrides, and transform-based alignment when they are introduced to compensate for structure.

## Verification

Return to the browser after changes. Inspect desktop, tablet, and mobile; for significant layouts use 1440×900, 1280×800, 1024×768, 768×1024, and 390×844. Test relevant interactions and surrounding UI for spacing shifts, wrapping, overflow, misalignment, control sizing, focus, menus, and content movement.

## Automated validation

Discover and run the repository's actual lint, typecheck, unit, component, browser, accessibility, visual-regression, and build checks. Never invent scripts or claim an unrun check passed.

## Completion report

Report: issues found grouped by Carbon usage/layout/visual styling/interaction/accessibility; root cause; changed files and rationale; exact browser routes, viewports, and interactions inspected; automated commands and results; and remaining concerns. If browser validation was unavailable, state that explicitly.
