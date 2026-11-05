(function attachMeridianAnalysis(root) {
  const requiredColumns = ["order_id", "activity", "timestamp"];
  const average = values => values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
  const hoursBetween = (start, end) => (new Date(end) - new Date(start)) / 36e5;

  function parseCsv(text) {
    const rows = String(text).trim().split(/\r?\n/).map(row => row.split(",").map(value => value.trim().replace(/^"|"$/g, "")));
    const headers = (rows.shift() || []).map(header => header.toLowerCase());
    return {
      headers,
      events: rows.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
    };
  }

  function validateEvents(events, headers) {
    const missingColumns = requiredColumns.filter(column => !headers.includes(column));
    const missingValues = requiredColumns
      .filter(column => events.some(event => !event[column]))
      .map(column => `${column}: ${events.filter(event => !event[column]).length} missing`);
    const invalidTimestamps = events.filter(event => event.timestamp && Number.isNaN(new Date(event.timestamp).getTime())).length;
    const duplicateEvents = events.length - new Set(events.map(event => `${event.order_id}|${event.activity}|${event.timestamp}`)).size;
    return { missingColumns, missingValues, invalidTimestamps, duplicateEvents, valid: missingColumns.length === 0 && events.length > 0 };
  }

  function analyzeEvents(events) {
    const groups = events.reduce((acc, event) => ((acc[event.order_id] ??= []).push(event), acc), {});
    return Object.entries(groups).map(([order_id, orderEvents]) => {
      const sorted = orderEvents
        .filter(event => event.timestamp && !Number.isNaN(new Date(event.timestamp).getTime()))
        .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
      if (!sorted.length) return null;
      const waits = sorted.slice(1).map((event, index) => ({
        from: sorted[index].activity,
        to: event.activity,
        hours: hoursBetween(sorted[index].timestamp, event.timestamp)
      }));
      const activityNames = sorted.map(event => event.activity);
      const cycle = sorted.length > 1 ? hoursBetween(sorted[0].timestamp, sorted.at(-1).timestamp) : 0;
      return {
        order_id,
        events: sorted,
        waits,
        cycle,
        start: sorted[0].timestamp,
        end: sorted.at(-1).timestamp,
        departments: [...new Set(sorted.map(event => event.department).filter(Boolean))],
        rework: new Set(activityNames).size < activityNames.length,
        late: cycle > 24,
        variant: activityNames.join(" → "),
        cost: sorted.reduce((sum, event) => sum + (Number(event.event_cost) || 0), 0)
      };
    }).filter(Boolean);
  }

  function filterOrders(orders, filters = {}) {
    return orders.filter(order => {
      const statusMatch = !filters.status || filters.status === "all" ||
        (filters.status === "late" && order.late) ||
        (filters.status === "rework" && order.rework) ||
        (filters.status === "on-track" && !order.late && !order.rework);
      const departmentMatch = !filters.department || filters.department === "all" || order.departments.includes(filters.department);
      const orderDate = order.start.slice(0, 10);
      const fromMatch = !filters.from || orderDate >= filters.from;
      const toMatch = !filters.to || orderDate <= filters.to;
      return statusMatch && departmentMatch && fromMatch && toMatch;
    });
  }

  function summarizeOrders(orders) {
    const waits = orders.flatMap(order => order.waits);
    const waitByTransition = Object.entries(waits.reduce((acc, wait) => {
      const key = `${wait.from} → ${wait.to}`;
      (acc[key] ??= []).push(wait.hours);
      return acc;
    }, {})).map(([transition, values]) => ({ transition, hours: average(values), occurrences: values.length }))
      .sort((left, right) => right.hours - left.hours);
    return {
      orders,
      waitByTransition,
      avgCycle: average(orders.map(order => order.cycle)),
      avgWait: average(waits.map(wait => wait.hours)),
      lateRate: orders.filter(order => order.late).length / (orders.length || 1),
      reworkRate: orders.filter(order => order.rework).length / (orders.length || 1),
      totalCost: orders.reduce((sum, order) => sum + order.cost, 0)
    };
  }

  function buildVariants(orders) {
    return Object.entries(orders.reduce((acc, order) => {
      (acc[order.variant] ??= []).push(order);
      return acc;
    }, {})).map(([path, variantOrders]) => ({
      path,
      count: variantOrders.length,
      avgCycle: average(variantOrders.map(order => order.cycle)),
      late: variantOrders.filter(order => order.late).length,
      rework: variantOrders.filter(order => order.rework).length
    })).sort((left, right) => right.count - left.count || left.avgCycle - right.avgCycle);
  }

  const api = { requiredColumns, parseCsv, validateEvents, analyzeEvents, filterOrders, summarizeOrders, buildVariants };
  root.MeridianAnalysis = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
