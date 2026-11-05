const assert = require("node:assert/strict");
const { parseCsv, validateEvents, analyzeEvents, filterOrders, summarizeOrders, buildVariants, rankOpportunities } = require("../src/analysis.js");
const { syntheticEvents } = require("../src/sample-data.js");

const csv = `order_id,activity,timestamp,department,event_cost
A,Received,2026-01-01T08:00:00,Desk,1
A,Packed,2026-01-01T10:00:00,Warehouse,2
A,Packed,2026-01-01T11:00:00,Warehouse,2
A,Shipped,2026-01-02T10:00:00,Shipping,3
B,Received,2026-01-02T08:00:00,Desk,1
B,Packed,2026-01-02T09:00:00,Warehouse,2
B,Shipped,2026-01-02T10:00:00,Shipping,3`;

const parsed = parseCsv(csv);
assert.equal(parsed.events.length, 7);
assert.equal(validateEvents(parsed.events, parsed.headers).valid, true);

const orders = analyzeEvents(parsed.events);
assert.equal(orders.length, 2);
assert.equal(orders.find(order => order.order_id === "A").rework, true);
assert.equal(orders.find(order => order.order_id === "A").late, true);
assert.equal(orders.find(order => order.order_id === "B").late, false);
assert.deepEqual(filterOrders(orders, { status: "late" }).map(order => order.order_id), ["A"]);
assert.deepEqual(filterOrders(orders, { status: "on-track" }).map(order => order.order_id), ["B"]);
assert.equal(filterOrders(orders, { department: "Shipping", from: "2026-01-02" }).length, 1);

const summary = summarizeOrders(orders);
assert.equal(summary.totalCost, 14);
assert.equal(summary.lateRate, 0.5);
assert.equal(summary.reworkRate, 0.5);
assert.equal(buildVariants(orders).length, 2);
assert.equal(orders.find(order => order.order_id === "A").reworkCost, 2);

const opportunities = rankOpportunities(orders, { waitTargetHours: 2, valuePerHour: 10 });
assert.equal(opportunities[0].type, "Flow delay");
assert.equal(opportunities[0].recoverableHours, 21);
assert.equal(opportunities[0].estimatedValue, 210);
assert.equal(opportunities.find(opportunity => opportunity.type === "Rework").estimatedValue, 2);

const pilotOrders = analyzeEvents(syntheticEvents);
assert.equal(pilotOrders.length, 24);
assert.ok(pilotOrders.filter(order => order.late).length >= 5);
assert.ok(pilotOrders.filter(order => order.rework).length >= 5);
assert.ok(buildVariants(pilotOrders).length >= 3);
assert.ok(rankOpportunities(pilotOrders, { waitTargetHours: 2, valuePerHour: 35 }).length >= 2);

const invalid = validateEvents([{ order_id: "A", activity: "Received", timestamp: "not-a-date" }], ["order_id", "activity", "timestamp"]);
assert.equal(invalid.invalidTimestamps, 1);
console.log("Analysis checks passed.");
