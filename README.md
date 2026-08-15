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
- Glass box widths use the same fixed scale in every section, so their displayed
  widths are proportional to the physical panel widths.
- Long layouts can be scrolled horizontally.
- The Glass Bill of Materials combines matching glass panels from every active
  section.
- The Post or Base-Rail Bill of Materials contains totals for the entire
  project, not separate totals for each section.
- The planner returns one recommended plan for each active section.

## Inventory data

The application imports its inventory from `glass_inventory.json`. Inventory
records are grouped by glass height and, for base-rail glass, by color. Values
such as `width` are stored in millimetres.

Because the JSON file is included in the Vite build, the application does not
need an Excel file or a database at runtime.

## Main project files

- `index.html` — page structure and form containers
- `src/main.js` — form creation, user interaction, result rendering, and BoM
  aggregation
- `src/calculator.js` — railing calculations and plan selection
- `src/style.css` — interface and layout styling
- `glass_inventory.json` — embedded glass inventory
