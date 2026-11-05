# Meridian App V.001 — Pilot Specification

## Purpose

V.001 is a portable internal prototype for finding efficiency opportunities in order fulfillment. It uses made-up data so the analysis workflow can be verified before real business data is available.

## Process scope

Each order follows some or all of these activities:

1. Order received
2. Payment verified
3. Inventory checked
4. Order picked
5. Order packed
6. Shipment created
7. Order shipped

Some orders intentionally contain delays, rework, or missing activity records.

The built-in fictional dataset contains 24 orders across multiple process variants so stakeholder review can test filters, evidence, and opportunity ranking.

## Required event fields

| Field | Meaning |
|---|---|
| order_id | Unique process case |
| activity | Activity that occurred |
| timestamp | Event completion time |
| department | Responsible operational group |
| resource | Person or role involved |
| event_cost | Estimated labor or handling cost |

Imported CSV files may use different column names. The mapping step suggests common aliases, requires the three core fields, prevents one source column from being used twice, and previews the source before analysis.

Excel workbooks use the same controlled mapping process. The user selects one worksheet at a time, reviews the source preview, and confirms the mapping before the app replaces the active analysis.

## Initial questions

- Where does fulfillment spend the most time waiting?
- Which activity creates the largest delay?
- How much rework occurs?
- Which orders are late or at risk of being late?
- Which department shows the strongest improvement opportunity?
- How much fulfillment time appears recoverable under an agreed handoff target?
- What modeled capacity value could that recovered time represent?

## Initial metrics

- Average fulfillment cycle time
- Average waiting time
- On-time shipment rate
- Rework rate
- Orders analyzed
- Estimated event cost
- Recoverable hours above an adjustable handoff target
- Modeled capacity value using an adjustable value-per-hour assumption

## Opportunity-model guardrails

- Financial figures are planning estimates, not accounting results or promised savings.
- Delay value equals hours above the selected handoff target multiplied by the selected value per recovered fulfillment hour.
- Rework value uses only the event_cost of repeated activities.
- Delay and rework findings retain their supporting order evidence and confidence level.
- Opportunity values can overlap and must not be summed into a total benefit.

## Acceptance criteria

- The app launches from a clean project folder without a server or account.
- Synthetic orders are loaded automatically.
- The app displays at least five fulfillment KPIs.
- The app identifies at least one evidence-backed bottleneck.
- The app identifies rework and late shipments.
- Selecting an order shows its event timeline.
- The app labels the dataset as synthetic.
- No AI or external integration is required.
