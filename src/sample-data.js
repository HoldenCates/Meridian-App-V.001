(function attachMeridianSampleData(root) {
  const activities = ["Order received", "Payment verified", "Inventory checked", "Order picked", "Order packed", "Shipment created", "Order shipped"];
  const resources = ["Avery", "Jordan", "Morgan", "Riley"];
  const activityDetails = Object.fromEntries(activities.map((activity, index) => [activity, {
    department: index < 3 ? "Order Desk" : index < 5 ? "Warehouse" : "Shipping",
    event_cost: index < 3 ? 1.5 : index < 5 ? 4.5 : 2.5
  }]));
  const syntheticEvents = Array.from({ length: 24 }, (_, orderIndex) => {
    const orderId = `ORD-${String(orderIndex + 1).padStart(3, "0")}`;
    const start = new Date(Date.UTC(2026, 9, 1, 8) + orderIndex * 8 * 36e5);
    const inventoryRework = orderIndex % 6 === 2;
    const pickRework = orderIndex % 7 === 3;
    const pickDelay = inventoryRework ? 1.8 : orderIndex % 5 === 0 ? 4.5 : 0.9;
    const sequence = [[activities[0], 0], [activities[1], 0.1], [activities[2], 0.35]];
    if (inventoryRework) sequence.push([activities[2], 1.1]);
    sequence.push([activities[3], pickDelay]);
    if (pickRework) sequence.push([activities[3], pickDelay + 0.6]);
    const packedAt = pickDelay + (pickRework ? 1 : 0.4);
    const shipmentAt = packedAt + 0.25;
    sequence.push([activities[4], packedAt], [activities[5], shipmentAt], [activities[6], shipmentAt + (orderIndex % 4 === 1 ? 30 : 3.5)]);
    return sequence.sort((left, right) => left[1] - right[1]).map(([activity, offset], eventIndex) => ({
      order_id: orderId,
      activity,
      timestamp: new Date(start.getTime() + offset * 36e5).toISOString(),
      department: activityDetails[activity].department,
      resource: resources[(orderIndex + eventIndex) % resources.length],
      event_cost: activityDetails[activity].event_cost
    }));
  }).flat();

  const api = { syntheticEvents };
  root.MeridianSampleData = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
