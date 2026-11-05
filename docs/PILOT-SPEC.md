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

## Required event fields

| Field | Meaning |
|---|---|
| order_id | Unique process case |
| activity | Activity that occurred |
| timestamp | Event completion time |
| department | Responsible operational group |
| resource | Person or role involved |
| event_cost | Estimated labor or handling cost |

## Initial questions

- Where does fulfillment spend the most time waiting?
- Which activity creates the largest delay?
- How much rework occurs?
- Which orders are late or at risk of being late?
- Which department shows the strongest improvement opportunity?

## Initial metrics

- Average fulfillment cycle time
- Average waiting time
- On-time shipment rate
- Rework rate
- Orders analyzed
- Estimated event cost

## Acceptance criteria

- The app launches from a clean project folder without a server or account.
- Synthetic orders are loaded automatically.
- The app displays at least five fulfillment KPIs.
- The app identifies at least one evidence-backed bottleneck.
- The app identifies rework and late shipments.
- Selecting an order shows its event timeline.
- The app labels the dataset as synthetic.
- No AI or external integration is required.
