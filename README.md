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

This installs Vite, which is used to serve and compile the application.

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

The aggregated Base-Rail Bill of Materials lists the required 2.5 m bars and
groups custom cuts by length.

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
- BoM prices are shown in HUF and come from the CSV `price` column. For
  base-rail custom-cut (`-V`) products, `price` is interpreted as a per-metre
  rate. Their BoM quantity is the aggregated required length in metres.
- The planner returns one recommended plan for each active section.

## Inventory data

The application imports its inventory from the Excel-editable
`glass_inventory.csv` file. The required columns are:

- `productCode`
- `productName`
- `productCategory`
- `productCategoryName`
- `productGroup`
- `productGroupName`
- `height`
- `width`
- `color`
- `colorName`
- `price`
- `quantity`

The columns may be reordered because the parser uses their header names. Extra
columns are also allowed and ignored by the application. Keep the required
names unchanged, and export the edited Excel sheet as UTF-8 CSV with comma
separators.

The `productCategory` column uses compact codes: `G` for glass and `R` for a
railing component. The adjacent `productCategoryName` column contains a
required, freely editable descriptive label; it is not used by calculations.

Glass `productName` values use `<width>x<height>mm Glass Panel - <color name>`,
for example `900x850mm Glass Panel - Clear`.

Product groups use a structured code:

- Glass: `G-<color>-<height>`, such as `G-U1-850` or `G-U3-1000`.
- Railing components: `R-<mounting>-<height>`, where `TM` means Top-Mounted
  and `SM` means Side-Mounted, such as `R-TM-958` or `R-SM-628`.

Glass product codes use `G-<color>-<width>x<height>`, such as
`G-U1-900x850`.

Railing-component product codes start with their complete product-group code,
such as `R-TM-958I-F1` or `R-SM-628-F1`.

The CSV is included in the Vite bundle, so the deployed application does not
need Excel, a database, or a separate runtime data request.

## Main project files

- `index.html` — page structure and form containers
- `src/main.js` — form creation, user interaction, result rendering, and BoM
  aggregation
- `src/calculator.js` — railing calculations and plan selection
- `src/inventory.js` — CSV parsing, column validation, and product normalization
- `src/style.css` — interface and layout styling
- `vite.config.js` — local and GitHub Pages base-path configuration
- `.github/workflows/deploy-pages.yml` — automatic GitHub Pages deployment
- `glass_inventory.csv` — active Excel-editable product inventory
