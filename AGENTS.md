# Codex Project Context

## Project purpose

This repository contains a browser-based glass railing planner built with
React, TypeScript, CSS, and Vite. Its framework-independent calculation and CSV
modules remain in JavaScript. It replaces behavior that originally came from
multiple Python calculators. The application must remain easy for the owner to
read, so preserve useful comments around non-obvious calculations, state, and
rendering code.

All user-facing and internal physical measurements are in integer millimetres.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
npm test
npm run typecheck
```

Run `npm run typecheck`, `npm test`, and `npm run build` after inventory, UI, or
calculation changes. Also use `node --check src/inventory.js`, `node --check
src/railingSystems.js`, and `node --check src/calculator.js` for direct syntax
verification of the framework-independent JavaScript modules.

## Important files

- `index.html` contains the minimal document and React root element.
- `src/main.tsx` mounts the React application.
- `src/App.tsx` owns planner state and invokes the calculation engine.
- `src/components/PlannerForm.tsx` renders global and per-section inputs.
- `src/components/ResultsPanel.tsx` renders layouts and aggregates the bills of
  materials.
- `src/data.ts` loads and joins the embedded CSV files once at startup.
- `src/types.ts` defines the shared CSV, form, and calculation-result contracts.
- `src/formatters.ts` contains measurement and price display helpers.
- `src/calculator.js` contains the calculation engine and validation rules.
- `src/inventory.js` parses product, price, and stock CSV files and joins them
  into calculation-ready product objects using `productCode`.
- `src/railingSystems.js` parses the railing-system catalogue, exposes the
  supported calculation-family IDs, and validates product compatibility IDs.
- `src/style.css` contains all application styling.
- `data/products.csv` stores stable glass and railing-component definitions.
- `data/product_prices.csv` repeats `productCode` and `productName` and stores
  `priceHuf` and `priceUnit` for every product.
- `data/product_stock.csv` repeats `productCode` and `productName` and stores
  `stockQuantity`. Every product has a row; untracked railing stock is empty.
- `data/railing_systems.csv` is the active embedded catalogue for railing-system
  families and variants. Its row order controls the form order, and `enabled`
  controls whether a variant can be selected.
- Its `groupCode` values use `G-H<height>` for glass. Railing-component groups
  use `R-<railing system ID>`, such as `R-FP-958-TM`, `R-HP-628-SM`, and
  `R-UC-102-TM`.
- `compatibleRailingSystems` is parsed as a list of railing-system IDs. Glass
  may list multiple systems. Each railing component must list exactly one, and
  its `groupCode` must equal that system ID prefixed with `R-`.
- `categoryCode` uses the compact codes `G` for glass and `R` for railing
  components; `categoryName` stores their readable names.
- Glass `productCode` values use `G-H<height>-W<width>-<finish>`, and glass
  `productName` values use `<width> x <height> mm <finish name> Glass Panel`.
- `componentType` supplies the calculation role (`glassPanel`, the individual
  full-height post roles, `multiPositionPost`, `baseRailBar`, or
  `baseRailCustomCut`) so the application does not parse behavior from codes.
- The three product-data files must contain exactly the same product rows in
  the same order. Their `productCode` and `productName` cells are validated
  against `data/products.csv`; duplicate and required missing data is rejected.
- Only product definitions with `enabled=true` may be selected by calculations.
- `test/inventory.test.js` covers the three CSV parsers, their validated join,
  reordered columns, and calculations using the joined product rows.
- `test/ui.test.tsx` covers key React rendering and interaction paths.
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

The UI names and internal calculation-family IDs are:

- `FP`: **Full-Height Post System**, using 850 mm-high glass.
- `HP`: **Half-Height Post System**, using 900 mm-high glass.
- `UC`: **Continuous Base-Rail System**, using 1000 mm-high colored
  glass.

### Rail variants

Full-Height variants:

- `FP-958-TM`: 958 mm Top-Mounted; enabled.
- `FP-1000-TM`: 1000 mm Top-Mounted; visible but disabled.
- `FP-1266-SM`: 1266 mm Side-Mounted; visible but disabled.

Half-Height variants:

- `HP-448-TM`: 448 mm Top-Mounted.
- `HP-628-SM`: 628 mm Side-Mounted.

Continuous Base-Rail variants:

- `UC-102-TM`: 102 mm Top-Mounted.
- `UC-117-SM`: 117 mm Side-Mounted.

Family and variant names, canonical system IDs, row order, and selectable state
come from `data/railing_systems.csv`. The `compatibleRailingSystems` values in the
product inventory reference those canonical IDs. Both glass and railing
components are selected through that compatibility list.

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
- Full-Height post physical widths are read from the selected products'
  `layoutWidthMm` values (`I = 85`, `K = 30`, and `S = 115` mm currently).
- Continuous Base-Rail standard U-channel length is read from the selected
  product's `layoutWidthMm` value (2500 mm currently). Additional custom
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
- Glass boxes display the selected inventory `productCode`; their dimensions
  remain available in the browser tooltip.
- Post boxes display inventory `productCode` values. Half-Height post layouts
  currently use only the matching `F1` product.
- Beneath the boxes, every section shows the same ordered component sequence as
  plain text in the form `| productCode | productCode | ... |`.
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
Product names come from `data/products.csv`; prices are displayed in HUF and
come from `data/product_prices.csv`. A `baseRailCustomCut` product's price is
its HUF-per-metre rate and is scaled to the required cut length. Its BoM
quantity is the aggregated length in metres, not a count of custom-cut pieces.
All BoM tables scroll horizontally when their columns exceed the panel width.

### Glass BoM

- Identifies glass items by the selected inventory `productCode`.
- Contains Product code, Product name, Quantity, Line total, Unit price, and
  Total price columns.
- Base-rail glass colors remain distinct items when grouping inventory.

### Post BoM

- Shown only for Full-Height and Half-Height systems.
- Identifies posts by inventory `productCode` and contains Product code,
  Product name, Quantity, Unit price, and Total price columns.
- Appears separately from the Glass BoM.
- Full-Height Corner Post quantity applies the divide-by-two rule described
  above.

### Base-Rail BoM

- Shown only for the Continuous Base-Rail system.
- Contains Product code, Product name, Quantity, Unit price, and Total price
  columns.
- Appears separately from the Glass BoM.
- The standard bar item uses the selected `baseRailBar` product code.
- Custom cuts use one row with the selected `baseRailCustomCut` product code
  and the aggregated required length in metres as Quantity.
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
