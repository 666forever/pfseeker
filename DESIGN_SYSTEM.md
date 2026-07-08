# pfseeker Design System

## Purpose

The pfseeker design system defines the visual and interaction foundation for a curated profile-media discovery platform. It is intentionally dark, precise, image-first, restrained, editorial, premium, and original to `.pfseeker®`.

This system does not copy the assessed reference site's branding, layout, assets, copy, or legacy implementation.

## Brand Usage

- Use `.pfseeker®` as the expressive primary mark in hero compositions and brand-forward moments.
- Use `pfseeker` as the standard written product name in metadata, navigation, legal copy, and ordinary prose.
- Use `profile seeker` only as explanatory context.
- The registered symbol must render as valid UTF-8. Do not use mojibake or replacement-character sequences.

## Typography

pfseeker uses production-safe system typography:

- Interface: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`
- Editorial accent: `Georgia, "Times New Roman", serif`
- Code/data: `"SFMono-Regular", Consolas, "Liberation Mono", "Cascadia Mono", monospace`

This avoids external font licensing risk, unnecessary preloading, and slow font discovery. It also renders well on Windows while preserving crisp UI hierarchy. Only normal, bold, and heavier brand-like weights are used through system font synthesis; no broad font-weight palette is required.

## Tokens

Tokens are centralized in [src/styles/global.css](C:/Users/hk/Documents/pfseeker-codex-project/src/styles/global.css).

Color tokens:

- `--color-bg`
- `--color-bg-subtle`
- `--color-surface`
- `--color-surface-raised`
- `--color-surface-recessed`
- `--color-surface-overlay`
- `--color-text`
- `--color-text-strong`
- `--color-text-muted`
- `--color-text-subtle`
- `--color-border`
- `--color-border-strong`
- `--color-accent`
- `--color-accent-muted`
- `--color-accent-ink`
- `--color-success`
- `--color-warning`
- `--color-danger`
- `--color-info`

Layout and motion tokens:

- font family, size, and line-height tokens
- `--space-*` spacing scale
- `--container-*` content widths
- `--radius-*` radii
- `--shadow-*` elevation
- `--focus-ring`
- `--duration-*`
- `--ease-standard`
- `--breakpoint-*`

Tailwind is compiled, but the system must remain understandable through semantic custom properties independent of utility classes.

## Component Conventions

Components live in [src/components](C:/Users/hk/Documents/pfseeker-codex-project/src/components).

Completed Phase 2 primitives:

- Button
- IconButton
- TextInput
- SearchInput
- Textarea
- Select
- Checkbox
- Radio
- Switch
- Badge
- Card
- Skeleton
- EmptyState
- Alert
- Toast/live-region foundation
- Tooltip
- Dropdown
- Dialog
- Drawer
- VisuallyHidden
- Spinner

Use semantic elements first:

- Buttons are real `button` elements unless they navigate.
- Links are real anchors only when they have a destination.
- Form controls expose labels and error/help text.
- Feedback uses visible text and live regions where state changes matter.

## Interaction States

Primitives support relevant states through shared CSS:

- default
- hover
- focus-visible
- active
- disabled
- loading
- invalid
- selected/pressed where applicable

Disabled controls are visually muted and non-interactive. Invalid fields expose `aria-invalid` and visible error text. Loading buttons include a status spinner.

## Overlay Rules

Dialogs and drawers use native `dialog` elements with shared behavior from [src/scripts/primitives.ts](C:/Users/hk/Documents/pfseeker-codex-project/src/scripts/primitives.ts).

Required behavior:

- labelled title
- optional description
- modal background interaction prevention
- focus entry
- focus trap
- Escape close
- close control
- focus restoration to opener
- reduced-motion-safe transitions

Dropdowns use `aria-expanded`, `aria-controls`, and close on outside click or Escape.

Tooltips are supplementary only. Essential information must also be visible in labels, help text, or body copy.

## Accessibility Rules

- Every interactive control must be keyboard reachable.
- Focus indicators must remain visible against dark backgrounds.
- Touch targets should be at least 44px tall for primary controls.
- Dynamic success, error, or progress messages should use live regions.
- Dialogs and drawers must trap focus and restore focus.
- Controls must not rely on hover-only disclosure.
- Reduced-motion preferences must be respected.
- High zoom and mobile layouts must remain usable.

## Motion Rules

Motion is short, purposeful, and non-decorative:

- Fast interaction feedback uses `--duration-fast`.
- Standard state transitions use `--duration-normal`.
- Larger overlay movement may use `--duration-slow`.
- `prefers-reduced-motion: reduce` forces near-zero animation duration.

## Responsive Behavior

The first responsive target is small touch screens. Layouts use:

- constrained content widths
- one-column mobile fallbacks
- flexible component rows
- stable dimensions for controls and loading placeholders
- no viewport-width font scaling beyond bounded `clamp()` display sizes

## Correct Usage

- Use `Button` for actions such as saving, confirming, or opening overlays.
- Use `Button href` only for navigation.
- Use `SearchInput` for search entry with a real submit action.
- Use `Alert` for persistent feedback and `ToastRegion` for transient status.
- Use `Dialog` for focused decisions and `Drawer` for temporary side-panel workflows.
- Use `Card` for individual repeated items or framed tools, not nested page sections.

## Incorrect Usage

- Do not place `href="#"` on placeholder links.
- Do not use a link as a button when no navigation occurs.
- Do not put essential information only in a tooltip.
- Do not copy the reference site's indigo-heavy styling, logos, or content.
- Do not add decorative gradient blobs, excessive glass effects, or generic dashboard panels.
- Do not build hidden admin/account controls before server-side authorization exists.

## Internal Showcase

The route `/dev/design-system` demonstrates all Phase 2 primitives and their meaningful states. It is marked `noindex, nofollow` and is not linked from public navigation.
