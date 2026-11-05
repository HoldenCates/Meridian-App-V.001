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
- Order-level evidence timelines

The dataset is intentionally fictional and must not be treated as a finding about Meridian’s real operations.

## Project layout

- `index.html` — portable app shell
- `src/analysis.js` — reusable, tested analysis logic
- `src/app.js` — synthetic data and browser interactions
- `data/sample-orders.csv` — sample event log for the CSV importer
- `tests/analysis.test.js` — automated calculation checks
- `docs/PILOT-SPEC.md` — approved pilot scope
- `AGENTS.md` — durable Codex project guidance
- `GOALS.md` and `PLANS.md` — goals and build phases

## Import a CSV

Select a CSV with `order_id`, `activity`, and `timestamp` columns. Department, resource, and event_cost are optional enrichment fields. Meridian shows a data-quality report before replacing the synthetic analysis with the imported event log.

## Verify the calculations

With Node.js installed, run `node tests/analysis.test.js`. The tests cover CSV parsing, validation, cycle-time status, rework, filtering, totals, and process variants.
