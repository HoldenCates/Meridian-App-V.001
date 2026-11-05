# Meridian App V.002

Portable process-intelligence workspace for order-fulfillment efficiency analysis.

## Run it

Open `index.html` in a modern browser. No installation, account, server, or network connection is required.

## What it demonstrates

Synthetic order events are transformed into:

- Fulfillment KPIs
- Bottleneck findings
- Rework and late-shipment detection
- Filters by department, status, and order start date
- Process-variant comparison
- Ranked improvement opportunities with adjustable assumptions
- Order-level evidence timelines
- Accessible Overview, Process, Opportunities, Cases, and Data views
- Interactive process map with frequency, waiting-time, and cost overlays
- Activity and transition evidence with direct order drill-down
- Backbone-first process map with Core, Exceptions, and Full Network detail modes
- Bottleneck halos tied to the active wait target, map coverage telemetry, activity search, and fit-to-screen
- Opportunity-to-process and opportunity-to-case evidence links
- Searchable, sortable case review with cycle-time and status context
- Guided file-import status from upload through validated analysis

The dataset is intentionally fictional and must not be treated as a finding about Meridian’s real operations.

Financial figures are scenario estimates. Delay value is calculated from recoverable fulfillment hours and a user-selected hourly value; rework value uses duplicate event cost. Neither represents booked savings.

## Project layout

- `index.html` — portable app shell
- `src/styles.css` — Meridian visual system and responsive layouts
- `src/ui.js` — accessible tab navigation and view state
- `src/process-view.js` — interactive process-map rendering and selection
- `src/analysis.js` — reusable, tested analysis logic
- `src/sample-data.js` — deterministic 24-order fictional pilot dataset
- `src/app.js` — synthetic data and browser interactions
- `data/sample-orders.csv` — sample event log for the CSV importer
- `tests/analysis.test.js` — automated calculation checks
- `docs/PILOT-SPEC.md` — approved pilot scope
- `AGENTS.md` — durable Codex project guidance
- `GOALS.md` and `PLANS.md` — goals and build phases

## Import a CSV

Select a CSV or Excel workbook using your existing business column names. For workbooks, choose the worksheet to analyze. Meridian suggests mappings for the required order identifier, activity, and timestamp fields, plus optional department, resource, and event cost fields. Review a source preview and confirm the mapping before analysis. CSV import supports quoted commas and escaped quotes.

Excel import is powered by the locally vendored SheetJS Community Edition 0.20.3. The app does not contact a CDN at runtime. See `THIRD_PARTY_NOTICES.md` and `vendor/LICENSE-SheetJS.txt` for attribution and license terms.

Process visualization is powered by the locally vendored Apache ECharts 6.1.0 Canvas build. See `THIRD_PARTY_NOTICES.md` and `vendor/LICENSE-ECharts.txt` for attribution and license terms.

The personal interface uses a black-and-gold tactical palette with IBM Plex Mono throughout the complete application. Font files are stored locally under `vendor/fonts` so the app remains portable and offline-ready.

This repository currently uses the personal `holden-console` theme in `src/theme-holden.css`. Shared layout and analysis behavior remain separate so customer distributions can receive their own colors, typography, identity, and visual treatment. See `docs/THEMING.md` for the customization contract.

## Verify the calculations

With Node.js installed, run `node tests/run-all.js`. The tests cover CSV and Excel import, mapping, validation, cycle-time status, rework, filtering, totals, process variants, and opportunity calculations.
