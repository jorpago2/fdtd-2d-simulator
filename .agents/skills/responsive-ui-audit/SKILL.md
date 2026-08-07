---
name: responsive-ui-audit
description: Reproduce, diagnose, fix, and verify responsive frontend defects including overflow, clipping, overlaps, wrapping, breakpoints, fixed-width failures, grid issues, navigation, tables, dialogs, and viewport-specific interaction bugs.
---

# Responsive UI Audit

Act as a senior frontend engineer performing a systematic responsive-design investigation. The goal is a layout that behaves correctly throughout the width range, not several independently acceptable screenshots.

## Core rule

Do not begin by adding a media query. First determine which element fails, the first failing width, the cause, the owning layout constraint, and whether a fluid solution is possible. Use breakpoints only when behavior genuinely changes.

## Understand the page

Before editing identify the route, component tree, outer layout, Carbon grid, shell/navigation, parent constraints, relevant CSS/Sass files, responsive utilities, and existing conventions. Inspect comparable working pages.

## Browser reproduction

Browser validation is required when available; prefer `$playwright-interactive`. Test 1440×900, 1280×800, 1024×768, 768×1024, and 390×844, then resize continuously between them. Find the first failing width by shrinking from a known-good width and record the range.

## Overflow diagnosis

Find the actual overflowing element. Do not immediately add `overflow-x: hidden` to `body`, `html`, or a wrapper. Investigate fixed widths, min-width, `100vw`, grid gaps, box sizing, long text, images, tables, flex children, transforms, negative margins, and overlays. Decide whether scrolling is intentional.

## Flex, grid, and width rules

Inspect flex grow/shrink/basis, intrinsic minimum sizes, wrapping, gap, parent width, Carbon `Grid`/`Column`, nested grids, tracks, gutters, spans, and width constraints. Prefer correcting Carbon grid configuration over replacing it. Treat `width`, `min-width`, `max-width`, `inline-size`, and their logical equivalents as intentional constraints to understand rather than blindly remove.

## Content resilience

Test long titles, button labels, breadcrumbs, tabs, labels, validation messages, tags, names, table cells, navigation items, missing values, and localization-length content. Look for overflow, clipping, wrapping, ellipsis hiding important information, layout shifts, and unusable controls.

## Navigation, forms, tables, overlays

For headers, sidebars, drawers, and shells test open/closed states, fixed/sticky positioning, overlays, scroll locking, main-content offsets, focus, stacking, and resizing after interaction. For forms test labels, usable controls, stacking, help/error text, and mobile layout. For tables choose deliberately between internal scrolling, reduced columns, compact presentation, and responsive sizing; never make the whole page scroll accidentally. For modals, menus, dropdowns, popovers, and tooltips test collision, body scrolling, reachable actions, clipping, close controls, and reduced viewport height.

## Vertical responsiveness

Test low viewport heights for modals, sticky headers, fixed footers, side panels, long forms, and full-height dashboards. Check unreachable actions, nested scroll traps, content behind fixed elements, and excessive header height.

## Interaction across breakpoints

Test before and after resizing: open navigation, resize to mobile, close it, resize back; repeat for modals, dropdowns, tabs, and expanded table rows. State must remain coherent across layout modes.

## Avoid breakpoint explosion

Inspect existing breakpoints before adding one. Nearby one-off breakpoints usually indicate a structural problem. Prefer fluid sizing, correct grid spans, wrapping, minimum-size fixes, max-widths, and existing project/Carbon breakpoints.

## Root-cause categories

Classify the defect as intrinsic sizing, parent constraint, grid configuration, breakpoint configuration, content resilience, positioning, overflow, or component behavior. Fix the owning layer rather than patching downstream symptoms.

## Regression sweep

After fixing, revisit the failing width, slightly smaller and larger widths, mobile, tablet, laptop, and desktop. Inspect nearby components because responsive fixes often move the defect.

## Visual and console checks

At each relevant width inspect edge and grid alignment, gutters, vertical rhythm, overflow, wrapping, buttons, navigation, forms, tables, dialogs, cards, and sticky elements. Watch for resize errors, rendering loops, hydration warnings, state updates, hidden-component errors, and failed layout assumptions.

## Automated tests

Use existing Playwright or equivalent tests when available. Prefer behavior checks such as no unexpected page overflow, working mobile navigation, usable modals, visible critical content, coherent breakpoint state, and stable screenshot regression. Avoid brittle pixel assertions without a clear reason.

## Completion report

Report the user-visible problem, failing viewport and interaction/content conditions, root cause, fix, actual verification matrix, interactions tested, automated commands and outcomes, and remaining risks. Only mark a viewport PASS if it was actually tested. Never claim responsive verification from code inspection alone when browser tooling was available.
