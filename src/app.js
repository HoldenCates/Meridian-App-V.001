const activities = [
  "Order received", "Payment verified", "Inventory checked", "Order picked",
  "Order packed", "Shipment created", "Order shipped"
];

const baseTimes = [
  ["2026-10-01T08:00:00", "2026-10-01T08:05:00", "2026-10-01T08:20:00", "2026-10-01T09:00:00", "2026-10-01T09:20:00", "2026-10-01T09:30:00", "2026-10-01T13:00:00"],
  ["2026-10-01T09:10:00", "2026-10-01T09:18:00", "2026-10-01T09:30:00", "2026-10-01T10:15:00", "2026-10-01T10:30:00", "2026-10-01T10:42:00", "2026-10-01T14:10:00"],
  ["2026-10-02T08:30:00", "2026-10-02T08:37:00", "2026-10-02T08:50:00", "2026-10-02T12:20:00", "2026-10-02T12:45:00", "2026-10-02T13:00:00", "2026-10-03T10:30:00"],
  ["2026-10-02T10:00:00", "2026-10-02T10:07:00", "2026-10-02T10:18:00", "2026-10-02T10:45:00", "2026-10-02T11:00:00", "2026-10-02T11:15:00", "2026-10-02T15:00:00"],
  ["2026-10-03T08:15:00", "2026-10-03T08:20:00", "2026-10-03T08:35:00", "2026-10-03T09:00:00", "2026-10-03T09:25:00", "2026-10-03T09:35:00", "2026-10-03T12:00:00"],
  ["2026-10-03T11:00:00", "2026-10-03T11:08:00", "2026-10-03T11:20:00", "2026-10-03T14:30:00", "2026-10-03T15:00:00", "2026-10-03T15:20:00", "2026-10-05T09:30:00"],
  ["2026-10-04T09:00:00", "2026-10-04T09:05:00", "2026-10-04T09:15:00", "2026-10-04T09:40:00", "2026-10-04T10:00:00", "2026-10-04T10:12:00", "2026-10-04T13:00:00"],
  ["2026-10-04T13:10:00", "2026-10-04T13:18:00", "2026-10-04T13:30:00", "2026-10-04T14:00:00", "2026-10-04T14:18:00", "2026-10-04T14:30:00", "2026-10-04T17:00:00"]
];

const resources = ["Avery", "Jordan", "Morgan", "Riley"];
const syntheticEvents = baseTimes.flatMap((times, index) => times.map((timestamp, activityIndex) => ({
  order_id: `ORD-${String(index + 1).padStart(3, "0")}`,
  activity: activities[activityIndex],
  timestamp,
  department: activityIndex < 3 ? "Order Desk" : activityIndex < 5 ? "Warehouse" : "Shipping",
  resource: resources[(index + activityIndex) % resources.length],
  event_cost: activityIndex < 3 ? 1.5 : activityIndex < 5 ? 4.5 : 2.5
})));

// Deliberate rework in ORD-003 and a late shipment in ORD-006.
syntheticEvents.splice(18, 0, { order_id: "ORD-003", activity: "Order picked", timestamp: "2026-10-02T12:05:00", department: "Warehouse", resource: "Riley", event_cost: 4.5 });

const byOrder = Object.groupBy ? Object.groupBy(syntheticEvents, e => e.order_id) : syntheticEvents.reduce((acc, event) => ((acc[event.order_id] ??= []).push(event), acc), {});
const hoursBetween = (a, b) => (new Date(b) - new Date(a)) / 36e5;
const orders = Object.entries(byOrder).map(([order_id, events]) => {
  const sorted = [...events].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  const waits = sorted.slice(1).map((event, i) => ({ from: sorted[i].activity, to: event.activity, hours: hoursBetween(sorted[i].timestamp, event.timestamp) }));
  const duplicates = sorted.map(e => e.activity).filter((a, i, arr) => arr.indexOf(a) !== i);
  return { order_id, events: sorted, cycle: hoursBetween(sorted[0].timestamp, sorted.at(-1).timestamp), waits, rework: new Set(duplicates).size > 0, late: hoursBetween(sorted[0].timestamp, sorted.at(-1).timestamp) > 24 };
});

const average = values => values.reduce((a,b) => a + b, 0) / (values.length || 1);
const allWaits = orders.flatMap(order => order.waits);
const waitByTransition = Object.entries(allWaits.reduce((acc, wait) => {
  const key = `${wait.from} → ${wait.to}`; (acc[key] ??= []).push(wait.hours); return acc;
}, {})).map(([transition, values]) => ({ transition, hours: average(values), occurrences: values.length })).sort((a,b) => b.hours - a.hours);
const avgCycle = average(orders.map(o => o.cycle));
const avgWait = average(allWaits.map(w => w.hours));
const lateRate = orders.filter(o => o.late).length / orders.length;
const reworkRate = orders.filter(o => o.rework).length / orders.length;
const totalCost = syntheticEvents.reduce((sum, event) => sum + event.event_cost, 0);

const metric = (label, value) => `<div class="card"><div class="metric-label">${label}</div><div class="metric-value">${value}</div></div>`;
document.querySelector("#metrics").innerHTML = [
  metric("Orders analyzed", orders.length), metric("Avg. cycle time", `${avgCycle.toFixed(1)} hrs`),
  metric("Avg. waiting time", `${avgWait.toFixed(1)} hrs`), metric("Late shipments", `${(lateRate * 100).toFixed(0)}%`),
  metric("Rework rate", `${(reworkRate * 100).toFixed(0)}%`)
].join("");

const topWait = waitByTransition[0];
document.querySelector("#findings").innerHTML = [
  `<div class="finding"><strong>Primary bottleneck: ${topWait.transition}</strong><span>${topWait.hours.toFixed(1)} average hours of waiting across ${topWait.occurrences} transitions.</span><br><small>Evidence: calculated from ordered event timestamps.</small></div>`,
  `<div class="finding"><strong>Rework detected in ${orders.filter(o => o.rework).map(o => o.order_id).join(", ")}</strong><span>Repeated activities increase handling effort and should be investigated.</span><br><small>Confidence: high for this synthetic dataset.</small></div>`,
  `<div class="finding"><strong>${orders.filter(o => o.late).length} late shipments</strong><span>Orders exceeding the 24-hour pilot fulfillment target.</span><br><small>Estimated event cost in sample: $${totalCost.toFixed(2)}.</small></div>`
].join("");

document.querySelector("#orders").innerHTML = orders.map(order => `<button data-order="${order.order_id}">${order.order_id} <span class="pill ${order.late ? "bad" : order.rework ? "warn" : "good"}">${order.late ? "Late" : order.rework ? "Rework" : "On track"}</span></button>`).join(" ");
const renderTimeline = orderId => {
  const order = orders.find(o => o.order_id === orderId);
  document.querySelector("#timeline").innerHTML = `<h3 style="font-size:15px;margin:14px 0 6px">${order.order_id} timeline</h3>${order.events.map(event => `<div class="event"><div class="event-time">${new Date(event.timestamp).toLocaleString()}</div><div><strong>${event.activity}</strong><br><small>${event.department} · ${event.resource}</small></div></div>`).join("")}`;
};
document.querySelectorAll("[data-order]").forEach(button => button.addEventListener("click", () => renderTimeline(button.dataset.order)));
renderTimeline("ORD-003");
