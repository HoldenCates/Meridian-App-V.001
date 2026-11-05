const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const { parseCsv, suggestMappings, validateMapping, mapEvents, validateEvents, analyzeEvents, summarizeOrders, buildProcessGraph, rankOpportunities } = require("../src/analysis.js");

const activities = ["Order received", "Payment verified", "Inventory checked", "Order picked", "Order packed", "Shipment created", "Order shipped"];
const details = {
  "Order received": ["Order Desk", "Intake", 1.5],
  "Payment verified": ["Order Desk", "Payments", 1.5],
  "Inventory checked": ["Inventory", "Inventory control", 2],
  "Order picked": ["Warehouse", "Picker", 4.5],
  "Order packed": ["Warehouse", "Packer", 4.5],
  "Shipment created": ["Shipping", "Shipping desk", 2.5],
  "Order shipped": ["Carrier", "Carrier handoff", 2.5]
};

function makeScenario({ orderCount, waitFor, repeatFor = () => false, skipFor = () => false, omitOptionalFor = () => false }) {
  const events = [];
  for (let orderIndex = 0; orderIndex < orderCount; orderIndex += 1) {
    const orderId = `SIM-${String(orderIndex + 1).padStart(5, "0")}`;
    const start = new Date(Date.UTC(2026, 0, 5, 8) + orderIndex * 20 * 60 * 1000);
    let elapsedHours = 0;
    activities.forEach((activity, activityIndex) => {
      if (activityIndex > 0) elapsedHours += waitFor(orderIndex, activityIndex - 1);
      if (skipFor(orderIndex, activity)) return;
      const [department, resource, eventCost] = details[activity];
      const omitOptional = omitOptionalFor(orderIndex, activity);
      events.push({
        order_id: orderId,
        activity,
        timestamp: new Date(start.getTime() + elapsedHours * 36e5).toISOString(),
        department: omitOptional ? "" : department,
        resource: omitOptional ? "" : resource,
        event_cost: omitOptional ? "" : eventCost
      });
      if (repeatFor(orderIndex, activity)) {
        elapsedHours += 0.35;
        events.push({
          order_id: orderId,
          activity,
          timestamp: new Date(start.getTime() + elapsedHours * 36e5).toISOString(),
          department: omitOptional ? "" : department,
          resource: omitOptional ? "" : resource,
          event_cost: omitOptional ? "" : eventCost
        });
      }
    });
  }
  return events;
}

function runScenario(name, events) {
  const started = performance.now();
  const quality = validateEvents(events, ["order_id", "activity", "timestamp", "department", "resource", "event_cost"]);
  const orders = analyzeEvents(events);
  const summary = summarizeOrders(orders);
  const graph = buildProcessGraph(orders);
  const opportunities = rankOpportunities(orders, { waitTargetHours: 2, valuePerHour: 35 });
  return {
    name,
    quality,
    orders,
    summary,
    graph,
    opportunities,
    elapsedMs: performance.now() - started
  };
}

const standardWaits = [0.2, 0.4, 0.9, 0.5, 0.25, 3];

const baseline = runScenario("Stable baseline", makeScenario({
  orderCount: 250,
  waitFor: (_orderIndex, transitionIndex) => standardWaits[transitionIndex],
  repeatFor: (orderIndex, activity) => activity === "Order picked" && orderIndex % 25 === 0
}));
assert.equal(baseline.quality.valid, true);
assert.equal(baseline.orders.length, 250);
assert.equal(baseline.graph.nodes.length, 7);
assert.equal(baseline.summary.lateRate, 0);
assert.equal(baseline.summary.reworkRate, 0.04);

const warehouse = runScenario("Warehouse surge", makeScenario({
  orderCount: 500,
  waitFor: (orderIndex, transitionIndex) => transitionIndex === 2 ? (orderIndex % 3 ? 9 + orderIndex % 5 : 1.1) : standardWaits[transitionIndex],
  repeatFor: (orderIndex, activity) => activity === "Inventory checked" && orderIndex % 8 === 0
}));
assert.equal(warehouse.orders.length, 500);
assert.equal(warehouse.opportunities[0].processElementId, "Inventory checked|||Order picked");
assert.equal(warehouse.summary.reworkRate, 0.126);

const csvCell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
const warehouseCsv = [
  ["Order Number", "Process Step", "Completed At", "Team", "Operator", "Handling Cost"],
  ...warehouse.orders.flatMap(order => order.events.map(event => [event.order_id, event.activity, event.timestamp, event.department, event.resource, event.event_cost]))
].map(row => row.map(csvCell).join(",")).join("\n");
const importedWarehouse = parseCsv(warehouseCsv);
const warehouseMapping = suggestMappings(importedWarehouse.columns);
assert.equal(validateMapping(warehouseMapping).valid, true);
const mappedWarehouseEvents = mapEvents(importedWarehouse.events, warehouseMapping);
assert.equal(validateEvents(mappedWarehouseEvents, ["order_id", "activity", "timestamp", "department", "resource", "event_cost"]).valid, true);
const importedWarehouseOrders = analyzeEvents(mappedWarehouseEvents);
assert.equal(importedWarehouseOrders.length, 500);
assert.equal(rankOpportunities(importedWarehouseOrders, { waitTargetHours: 2, valuePerHour: 35 })[0].processElementId, "Inventory checked|||Order picked");

const carrier = runScenario("Carrier cutoff", makeScenario({
  orderCount: 420,
  waitFor: (orderIndex, transitionIndex) => transitionIndex === 5 ? (orderIndex % 3 === 0 ? 30 : 4) : standardWaits[transitionIndex]
}));
assert.equal(carrier.orders.length, 420);
assert.equal(carrier.opportunities[0].processElementId, "Shipment created|||Order shipped");
assert.equal(carrier.summary.lateRate, 1 / 3);

const incomplete = runScenario("Incomplete operational history", makeScenario({
  orderCount: 300,
  waitFor: (_orderIndex, transitionIndex) => standardWaits[transitionIndex],
  skipFor: (orderIndex, activity) => (activity === "Payment verified" && orderIndex % 5 === 0) || (activity === "Shipment created" && orderIndex % 10 === 0),
  omitOptionalFor: (orderIndex, activity) => (orderIndex + activities.indexOf(activity)) % 3 === 0
}));
assert.equal(incomplete.quality.valid, true);
assert.equal(incomplete.orders.length, 300);
assert.ok(incomplete.graph.edges.some(edge => edge.id === "Order received|||Inventory checked"));
assert.ok(incomplete.graph.edges.some(edge => edge.id === "Order packed|||Order shipped"));
assert.ok(incomplete.summary.totalCost > 0);

const dirtyEvents = [
  { order_id: "BAD-001", activity: "Order received", timestamp: "2026-01-05T08:00:00Z" },
  { order_id: "BAD-001", activity: "", timestamp: "2026-01-05T08:10:00Z" },
  { order_id: "", activity: "Payment verified", timestamp: "2026-01-05T08:20:00Z" },
  { order_id: "BAD-002", activity: "Order received", timestamp: "not-a-date" },
  { order_id: "BAD-003", activity: "Order received", timestamp: "2026-01-05T09:00:00Z" },
  { order_id: "BAD-003", activity: "Order received", timestamp: "2026-01-05T09:00:00Z" }
];
const dirtyQuality = validateEvents(dirtyEvents, ["order_id", "activity", "timestamp"]);
assert.equal(dirtyQuality.valid, false);
assert.equal(dirtyQuality.invalidTimestamps, 1);
assert.equal(dirtyQuality.duplicateEvents, 1);
assert.deepEqual(dirtyQuality.missingValues.sort(), ["activity: 1 missing", "order_id: 1 missing"]);

const scale = runScenario("Scale test", makeScenario({
  orderCount: 5000,
  waitFor: (orderIndex, transitionIndex) => transitionIndex === 2 && orderIndex % 4 === 0 ? 6 : standardWaits[transitionIndex],
  repeatFor: (orderIndex, activity) => activity === "Order picked" && orderIndex % 20 === 0
}));
assert.equal(scale.orders.length, 5000);
assert.ok(scale.elapsedMs < 10000, `Scale simulation exceeded 10 seconds: ${scale.elapsedMs.toFixed(0)}ms`);

const results = [baseline, warehouse, carrier, incomplete, scale].map(result => ({
  scenario: result.name,
  orders: result.orders.length,
  events: result.orders.reduce((total, order) => total + order.events.length, 0),
  avgCycleHours: Number(result.summary.avgCycle.toFixed(2)),
  lateRate: `${(result.summary.lateRate * 100).toFixed(1)}%`,
  reworkRate: `${(result.summary.reworkRate * 100).toFixed(1)}%`,
  topOpportunity: result.opportunities[0]?.title || "None",
  elapsedMs: Number(result.elapsedMs.toFixed(1))
}));

console.table(results);
console.log("Simulation checks passed.");

