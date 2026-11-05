# Meridian V.002 — Order-Fulfillment Simulation Report

Run date: 2026-11-05

## Decision

The current analysis engine is ready for broader pilot simulation. It correctly identified the injected bottleneck in each operational scenario, preserved evidence at the order level, rejected corrupted required data, and remained responsive at 5,000 orders.

It is not yet ready to claim that a dataset is complete. Meridian can detect blank or invalid required values, but it cannot know that an entire expected process activity is absent unless the business supplies an expected-process template.

## Scenarios executed

| Scenario | Orders | Events | Result |
|---|---:|---:|---|
| Stable baseline | 250 | 1,760 | Shipping handoff correctly ranked first; 0% late and 4% rework |
| Warehouse surge | 500 | 3,563 | Inventory check to picking correctly ranked first; 12.6% rework |
| Carrier cutoff | 420 | 2,940 | Shipment creation to carrier handoff correctly ranked first; 33.3% late |
| Incomplete operational history | 300 | 2,010 | Analysis completed with skipped activities and missing optional values |
| Scale test | 5,000 | 35,250 | Full analysis completed in approximately 100 ms on the development computer |

The warehouse scenario was also exported with realistic business headers, parsed through the CSV importer, automatically mapped, validated, analyzed, and compared with the direct simulation result. The same bottleneck was retained after import.

## What passed

- Correct order, event, late-shipment, and rework counts
- Correct bottleneck ranking for warehouse and shipping disruptions
- Process graph creation across normal, rework, and skipped-step variants
- Opportunity evidence linked to affected order IDs
- CSV alias recognition and controlled field mapping
- Missing optional department, resource, and cost values without a crash
- Rejection of blank core values, invalid timestamps, and duplicate events
- 5,000-order analysis below the 10-second safety threshold

## Missing-data finding

There are two different missing-data conditions:

1. **Broken records** — an event exists but its order ID, activity, or timestamp is blank or invalid. Meridian detects and blocks these records.
2. **Silent absence** — no event was exported for an activity that may have occurred. Meridian can still analyze the observed path, but it cannot prove that the path is complete.

For a customer pilot, Meridian should add an optional expected-process template. That template can define expected activities and produce a coverage/confidence warning without treating legitimate alternate paths as automatically incorrect.

## Recommended next simulation gate

Run a shipment-style acceptance package containing three portable CSV files:

- clean standard operating data;
- high-delay and rework data;
- incomplete and corrupted data.

Then test import and analysis on a second computer with no development tools or network connection. This verifies portability, user guidance, and missing-data messaging before a real customer dataset is introduced.

