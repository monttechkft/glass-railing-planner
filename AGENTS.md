# Codex Project Context

## Project purpose

This repository contains a browser-based glass railing planner built with
plain HTML, CSS, JavaScript, and Vite. It replaces the behavior that originally
came from multiple Python calculators. The application must remain easy for
the owner to read, so preserve useful comments around non-obvious calculations
and UI-generation code.

All user-facing and internal physical measurements are in integer millimetres.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

Run `npm run build` after UI or calculation changes. The `package.json` also
contains an `npm test` command, but there is currently no test directory in the
workspace. At minimum, use `node --check src/main.js`,
`node --check src/calculator.js`, and `npm run build` for verification.

## Important files

- `index.html` contains the permanent page structure and empty containers for
  JavaScript-generated controls and results.
- `src/main.js` creates system-specific form fields, reads inputs, renders
  layouts, and aggregates the bills of materials.
- `src/calculator.js` contains the calculation engine and validation rules.
- `src/style.css` contains all application styling.
- `glass_inventory.json` is the embedded inventory consumed at build/runtime.
- `README.md` contains installation, build, and end-user instructions.
- `vite.config.js` reads `VITE_BASE_PATH` for GitHub Project Pages builds while
  keeping local development at `/`.
- `.github/workflows/deploy-pages.yml` builds and deploys `dist` on pushes to
  `main` and supports manual runs.

The original Python and Excel files are not currently present in the workspace.

GitHub Pages must use **Settings → Pages → Source: GitHub Actions**. The workflow
sets `VITE_BASE_PATH` to `/${{ github.event.repository.name }}/`, matching this
repository's Project Pages URL structure.

## Railing systems

The UI names and internal system IDs are:

- `958`: **Full-Height Post System**, using 850 mm-high glass.
- `general`: **Half-Height Post System**, using 900 mm-high glass.
- `vonalmenti`: **Continuous Base-Rail System**, using 1000 mm-high colored
  glass.

### Rail variants

Full-Height variants:

- `958-top`: 958 mm Top-Mounted; enabled.
- `1000-top`: 1000 mm Top-Mounted; visible but disabled.
- `1266-side`: 1266 mm Side-Mounted; visible but disabled.

Half-Height variants:

- `448-top`: 448 mm Top-Mounted.
- `628-side`: 628 mm Side-Mounted.

Continuous Base-Rail variants:

- `102-top`: 102 mm Top-Mounted.
- `117-side`: 117 mm Side-Mounted.

Variant definitions live in `RAIL_VARIANTS` in `src/calculator.js`. Disabled UI
variants are listed in `DISABLED_RAIL_VARIANTS` in `src/main.js`.

## Input behavior

- Railing system and Rail variant are global project settings.
- Only Section 1 is visible initially.
- **Add section** adds sections sequentially, up to Section 4.
- **Remove section** removes the last visible section. Section 1 cannot be
  removed.
- Only visible sections are submitted. A section is calculated only when its
  length is greater than zero.
- Section 1 starts with a 4000 mm default length. Added sections start empty.
- Number of panels is optional; an empty value invokes automatic panel-count
  selection.
- There are two **Calculate plan** buttons, one beneath the Input data heading
  and one at the bottom of the form. Both submit the same form.

Full-Height per-section fields:

- **Left end**: End Post or Corner Post.
- **Right end**: End Post or Corner Post.
- Section length.
- Number of panels.

Half-Height global field:

- Gap between panels, applied to all sections.

Continuous Base-Rail global fields:

- Gap between panels, applied to all sections.
- Glass color, applied to all sections.

## Calculation behavior

- Each active section is optimized independently and receives one recommended
  plan.
- The application uses fixed search settings from `DEFAULTS`:
  - preferred maximum glass width: 1100 mm;
  - initial allowed undercut: 50 mm;
  - tolerance increment: 10 mm;
  - maximum undercut: 200 mm.
- Only the best plan from the first successful tolerance/width tier is kept.
- Full-Height post physical widths are `I = 85`, `K = 30`, and `S = 115` mm.
- Continuous Base-Rail standard profiles are 2500 mm long. Additional custom
  cuts use the existing weighted cost rule in `optimizeProfiles()`.
- Do not reintroduce profile offcut/reuse allocation or numbered source-bar
  logic unless explicitly requested. The current profile model is standard
  bars plus independently supplied custom cuts.

### Corner-post rule

In the Full-Height system, a physical Corner Post is selected by both adjoining
sections. The total number of Corner Post endpoint selections across active
sections must therefore be even. `calculateProject()` reports an error if it is
odd. The aggregated `958S` BoM quantity is the endpoint total divided by two.

## Result behavior

- The results heading is **Recommended plan**.
- There is no project summary table and no `Plan 01` title.
- Every active section is rendered under its **Section N** heading.
- Do not add a redundant `Layout` subtitle below each Section heading.
- The undercut badge remains visible for each section.
- Glass and post boxes are interleaved for post systems, beginning with a post.
- Continuous Base-Rail layouts contain glass boxes only.
- Do not render the old per-section **Profile layout** text below base-rail
  glass boxes.
- Long layouts scroll horizontally.

Glass box widths use a fixed shared visual scale of 1 screen pixel per 5 mm of
physical width. The boxes must not flex, grow, or shrink, so equal glass widths
look identical across sections and different physical widths remain
proportional.

## Bills of materials

BoM tables are project-level totals aggregated across every active section.

### Glass BoM

- Shows glass as `height x width mm`, for example `850 x 900 mm`.
- Contains Glass dimensions, Quantity, and Line total columns.
- Base-rail glass colors remain distinct items when grouping inventory.

### Post BoM

- Shown only for Full-Height and Half-Height systems.
- Contains only Post type and Quantity columns; do not restore Line total.
- Appears separately from the Glass BoM.
- Full-Height Corner Post quantity applies the divide-by-two rule described
  above.

### Base-Rail BoM

- Shown only for the Continuous Base-Rail system.
- Contains only Rail type and Quantity columns; do not restore Line total.
- Appears separately from the Glass BoM.
- The standard bar item is named `<rail variant> (2.5m Bar)`.
- Custom-cut items are named `<rail variant> (<length> mm Custom Cut)` and are
  grouped by cut length across sections.
- The footer label is **Base-Rail total**.

## UI wording and appearance

- Main title: **Glass railing planner**.
- Left panel title: **Input data**.
- Right panel title: **Recommended plan**.
- Do not restore the removed eyebrow, descriptive subtitle, numbered step
  labels, or recommendation helper text.
- Keep the interface measurement values in millimetres.
- Preserve horizontal scrolling for long layouts.

## Continuation guidance

Before changing behavior, inspect the current implementation because the UI
has been refined through many small decisions. Prefer preserving current
calculation behavior unless the user explicitly requests a rule change. Update
this file and `README.md` when a change materially alters setup, terminology,
inputs, calculations, or output structure.
