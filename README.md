# Glass Railing Planner

A browser-based tool for creating glass-panel and railing-component plans for
up to four balcony sections. It supports three railing systems and produces a
layout for every active section together with aggregated bills of materials.

All measurements shown in the interface are in millimetres.

## Requirements

- Node.js `20.19` or newer, or Node.js `22.12` or newer
- npm

## Install the dependencies

From the project directory, run:

```bash
npm install
```

This installs React, TypeScript, Vite, and the test tooling used by the
application.

## Run the application locally

Start the Vite development server:

```bash
npm run dev
```

Vite prints a local address, usually `http://localhost:5173`. Open that address
in a web browser. The page updates automatically when source files change.

## Build the application

Create an optimized production build with:

```bash
npm run build
```

The compiled application is written to the `dist` directory. This directory
contains the static HTML, CSS, and JavaScript files that can be deployed to a
web server.

To inspect the production build locally, run:

```bash
npm run preview
```

Open the local address printed by Vite.

## Check and test the application

Check the React and TypeScript source without producing build files:

```bash
npm run typecheck
```

Run both the calculation/data tests and the React interface tests:

```bash
npm test
```

## GitHub Pages deployment

The workflow in `.github/workflows/deploy-pages.yml` automatically installs
dependencies, builds the application, and publishes the `dist` directory to
GitHub Pages whenever a commit is pushed to the `main` branch. It can also be
started manually from the repository's **Actions** tab.

Before the first deployment, open the GitHub repository and select **Settings
→ Pages → Build and deployment → Source → GitHub Actions**. Subsequent pushes
to `main` will update the published site automatically.

The workflow supplies the repository name as Vite's base path. Local
development continues to run from `/`, while the deployed assets load from the
GitHub Project Pages subdirectory.

## How to use the planner

1. Select a **Railing system**.
2. Select an available **Rail variant**.
3. Enter the data for **Section 1**.
4. Use **Add section** to add more sections, up to Section 4. Use **Remove
   section** to remove the last visible section.
5. Leave **Number of panels** empty to let the planner determine it
   automatically, or enter a specific number.
6. Select **Calculate plan**. The button above or below the form performs the
   same calculation.

Only sections with a length greater than zero are included in the result.

### Full-Height Post System

For every section, select the post type at the **Left end** and **Right end**:

- **End Post**
- **Corner Post**

A physical Corner Post joins two sections, so the total number of Corner Post
selections across the active sections must be even. The aggregated Post Bill
of Materials divides this endpoint count by two.

The 1000 mm Top-Mounted and 1266 mm Side-Mounted rail variants are currently
visible but disabled.

### Half-Height Post System

The **Gap between panels** is a global value and applies to every active
section. Each section has its own length and optional panel count.

### Continuous Base-Rail System

The **Gap between panels** and **Glass color** are global values and apply to
every active section. Each section has its own length and optional panel count.
The physical base rail is a continuous U-channel fixed to the balcony surface;
the glass panels are installed directly in this channel without posts.

The aggregated Base-Rail Bill of Materials lists the required 2.5 m U-channel
profiles and groups custom cuts by length.

## Understanding the results

- Each active section has a separate graphical layout.
- A text representation beneath each layout lists the same component sequence
  as `| productCode | productCode | ... |`.
- Each glass box is labelled with the exact `productCode` selected from the
  inventory CSV. Hovering over a glass box shows its dimensions.
- Post boxes and the Post Bill of Materials use their selected inventory
  `productCode`. Half-Height systems currently use the `F1` product.
- Glass box widths use the same fixed scale in every section, so their displayed
  widths are proportional to the physical panel widths.
- Long layouts can be scrolled horizontally.
- The Glass Bill of Materials combines matching glass panels from every active
  section and identifies each item by its inventory `productCode`.
- The Post or Base-Rail Bill of Materials contains totals for the entire
  project, not separate totals for each section.
- Every BoM row shows both the product code and its descriptive `productName`.
  Wide tables can be scrolled horizontally on smaller screens.
- BoM prices are shown in HUF and come from `data/product_prices.csv`. Its
  `priceUnit` column distinguishes products sold by `piece` from base-rail
  custom cuts sold by `metre`. Custom-cut BoM quantities are aggregated in
  metres.
- The planner returns one recommended plan for each active section.

## Product data

Product data is separated by ownership and update frequency. Stable definitions
come from the Excel-editable `data/products.csv` file. Its required columns are:

- `productCode`
- `productName`
- `categoryCode`
- `categoryName`
- `groupCode`
- `groupName`
- `componentType`
- `compatibleRailingSystems`
- `finishCode`
- `finishName`
- `widthMm`
- `heightMm`
- `layoutWidthMm`
- `enabled`

Prices come from `data/product_prices.csv`, whose required columns are
`productCode`, `productName`, `priceHuf`, and `priceUnit`. Every defined product
has one price row. Use `piece` for products sold individually and `metre` for
base-rail custom cuts.

Tracked stock comes from `data/product_stock.csv`, whose required columns are
`productCode`, `productName`, and `stockQuantity`. Every product has one stock
row because the sheets deliberately use the same row order. Glass quantities
are required because they affect plan ranking; an untracked railing-component
quantity remains an empty cell.

All three files must contain exactly the same products in the same order. Both
`productCode` and `productName` are repeated so rows remain recognizable in
Excel. The application verifies the row count, order, codes, and names before
joining data. Columns may be reordered because each parser uses header names,
but rows may not be reordered independently. Extra columns are allowed and
ignored. Keep the required names unchanged, and export edited Excel sheets as
UTF-8 CSV with comma separators.

The `categoryCode` column uses compact codes: `G` for glass and `R` for a
railing component. The adjacent `categoryName` column contains a required,
freely editable descriptive label; it is not used by calculations.

Glass `productName` values use
`<width> x <height> mm <finish name> Glass Panel`, for example
`900 x 850 mm Clear Glass Panel`.

Product groups use a structured code:

- Glass: `G-H<height>`, such as `G-H850` or `G-H1000`. Different glass
  finishes can belong to the same height group.
- Railing components use `R-<railing system ID>`, such as `R-FP-958-TM`,
  `R-HP-628-SM`, or `R-UC-102-TM`.

Glass product codes use `G-H<height>-W<width>-<finish>`, such as
`G-H850-W900-U1`.

Railing-component product codes start with their complete product-group code,
such as `R-FP-958-TM-MID-F1` or `R-HP-628-SM-F1`.

`compatibleRailingSystems` contains comma-separated railing-system IDs. Excel
quotes cells containing more than one ID automatically. Glass may be compatible
with multiple systems. Every railing component currently belongs to exactly
one system, and its `groupCode` must equal `R-<compatible system ID>`.
The rail-variant form values use these same canonical IDs, and calculations
select both glass and railing components by membership in this column.

`componentType` is the stable behavior used by the calculator. Current values
are `glassPanel`, `endPost`, `intermediatePost`, `cornerPost`,
`multiPositionPost`, `baseRailBar`, and `baseRailCustomCut`. This lets product
codes and names change without requiring the calculator to decode their text.

`widthMm` and `heightMm` describe the product. `layoutWidthMm` records the
physical width consumed in a railing layout when applicable. For glass it is
the same as `widthMm`. Set `enabled` to `true` or `false`; disabled records
remain in the product catalogue but are not selected by calculations.

The CSV files are included in the Vite bundle, so the deployed application does
not need Excel, a database, or separate runtime data requests. After editing a
CSV, rebuild the application or restart the development server.

## Railing-system catalogue

Railing-system families and selectable variants come from the Excel-editable
`data/railing_systems.csv` file. Its required columns are:

- `systemId` — canonical ID referenced by product compatibility values
- `systemName` — variant name shown in the Rail variant list
- `systemFamilyId` — calculation family: `FP`, `HP`, or `UC`
- `systemFamilyName` — family name shown in the Railing system list
- `enabled` — `true` makes the variant selectable; `false` keeps it visible but
  disabled

Rows determine the display order. Each family must have one consistent
`systemFamilyName`, and all three supported family IDs must be present. Every ID
listed in a product's `compatibleRailingSystems` cell must exist in this
catalogue; the application reports a data error if an ID is misspelled or
missing.

Like the product data files, this CSV is bundled into the application at build
time.

## Main project files

- `index.html` — minimal HTML document containing the React root element
- `src/main.tsx` — React entry point
- `src/App.tsx` — planner state, calculation submission, and component wiring
- `src/components/PlannerForm.tsx` — system-specific form and section controls
- `src/components/ResultsPanel.tsx` — layouts and aggregated BoM tables
- `src/data.ts` — one-time CSV loading and validated data joining
- `src/types.ts` — shared product, form, and calculation result contracts
- `src/formatters.ts` — measurement and price display helpers
- `src/calculator.js` — railing calculations and plan selection
- `src/inventory.js` — product, price, and stock CSV parsing and validated joins
- `src/railingSystems.js` — railing-system catalogue parsing and validation
- `src/style.css` — interface and layout styling
- `vite.config.js` — local and GitHub Pages base-path configuration
- `.github/workflows/deploy-pages.yml` — automatic GitHub Pages deployment
- `test/ui.test.tsx` — React interaction and rendering tests
- `data/products.csv` — stable Excel-editable product definitions
- `data/product_prices.csv` — prices and sales units keyed by product code
- `data/product_stock.csv` — tracked stock quantities keyed by product code
- `data/railing_systems.csv` — Excel-editable railing-system catalogue
