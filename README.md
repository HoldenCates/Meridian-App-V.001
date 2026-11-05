# Meridian App V.001

Portable first vertical slice for order-fulfillment efficiency analysis.

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

The dataset is intentionally fictional and must not be treated as a finding about Meridian’s real operations.

Financial figures are scenario estimates. Delay value is calculated from recoverable fulfillment hours and a user-selected hourly value; rework value uses duplicate event cost. Neither represents booked savings.

## Project layout

- `index.html` — portable app shell
- `src/analysis.js` — reusable, tested analysis logic
- `src/sample-data.js` — deterministic 24-order fictional pilot dataset
- `src/app.js` — synthetic data and browser interactions
- `data/sample-orders.csv` — sample event log for the CSV importer
- `tests/analysis.test.js` — automated calculation checks
- `docs/PILOT-SPEC.md` — approved pilot scope
- `AGENTS.md` — durable Codex project guidance
- `GOALS.md` and `PLANS.md` — goals and build phases

## Import a CSV

Select a CSV using your existing business column names. Meridian suggests mappings for the required order identifier, activity, and timestamp fields, plus optional department, resource, and event cost fields. Review a source preview and confirm the mapping before analysis. The importer supports quoted commas and escaped quotes.

## Verify the calculations

With Node.js installed, run `node tests/analysis.test.js`. The tests cover CSV parsing, validation, cycle-time status, rework, filtering, totals, process variants, and opportunity calculations.
