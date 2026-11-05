(function attachMeridianAnalysis(root) {
  const requiredColumns = ["order_id", "activity", "timestamp"];
  const importFields = ["order_id", "activity", "timestamp", "department", "resource", "event_cost"];
  const fieldAliases = {
    order_id: ["order_id", "order id", "order number", "order_number", "order no", "case_id", "case id", "case", "id"],
    activity: ["activity", "activity name", "event", "event name", "step", "process step", "status", "action"],
    timestamp: ["timestamp", "event time", "event_time", "datetime", "date time", "completed at", "completed_at", "created at", "created_at", "date"],
    department: ["department", "team", "function", "business unit", "business_unit", "group"],
    resource: ["resource", "employee", "user", "owner", "assignee", "operator", "person"],
    event_cost: ["event_cost", "event cost", "cost", "handling cost", "handling_cost", "labor cost", "labour cost"]
  };
  const average = values => values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
  const hoursBetween = (start, end) => (new Date(end) - new Date(start)) / 36e5;
  const normalizeHeader = value => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"') {
        if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
        else quoted = !quoted;
      } else if (character === "," && !quoted) {
        row.push(value.trim()); value = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        row.push(value.trim());
        if (row.some(cell => cell !== "")) rows.push(row);
        row = []; value = "";
      } else value += character;
    }
    row.push(value.trim());
    if (row.some(cell => cell !== "")) rows.push(row);
    return rows;
  }

  function parseCsv(text) {
    const rows = parseCsvRows(String(text).replace(/^\uFEFF/, ""));
    return parseTabularRows(rows);
  }

  function parseTabularRows(rows) {
    const normalizedRows = (rows || []).map(row => row.map(value => value instanceof Date ? value.toISOString() : String(value ?? "").trim()));
    const labels = normalizedRows.shift() || [];
    const seen = {};
    const headers = labels.map((label, index) => {
      const base = normalizeHeader(label) || `column_${index + 1}`;
      seen[base] = (seen[base] || 0) + 1;
      return seen[base] === 1 ? base : `${base}_${seen[base]}`;
    });
    return {
      headers,
      columns: headers.map((key, index) => ({ key, label: labels[index] || key })),
      events: normalizedRows.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
    };
  }

  function suggestMappings(columns) {
    const candidates = (columns || []).map(column => typeof column === "string" ? { key: column, label: column } : column);
    return Object.fromEntries(importFields.map(field => {
      const aliases = fieldAliases[field].map(normalizeHeader);
      const exact = candidates.find(column => aliases.includes(normalizeHeader(column.key)) || aliases.includes(normalizeHeader(column.label)));
      const partial = candidates.find(column => aliases.some(alias => alias.length > 3 && (normalizeHeader(column.key).includes(alias) || alias.includes(normalizeHeader(column.key)))));
      return [field, (exact || partial)?.key || ""];
    }));
  }

  function mapEvents(events, mapping) {
    return events.map(event => Object.fromEntries(importFields.map(field => [field, mapping[field] ? event[mapping[field]] ?? "" : ""])));
  }

  function validateMapping(mapping) {
    const missingRequired = requiredColumns.filter(field => !mapping[field]);
    const selected = Object.entries(mapping).filter(([, source]) => source);
    const duplicatedSources = [...new Set(selected.map(([, source]) => source).filter((source, index, sources) => sources.indexOf(source) !== index))];
    return { missingRequired, duplicatedSources, valid: missingRequired.length === 0 && duplicatedSources.length === 0 };
  }

  function validateEvents(events, headers) {
    const missingColumns = requiredColumns.filter(column => !headers.includes(column));
    const missingValues = requiredColumns
      .filter(column => events.some(event => !event[column]))
      .map(column => `${column}: ${events.filter(event => !event[column]).length} missing`);
    const invalidTimestamps = events.filter(event => event.timestamp && Number.isNaN(new Date(event.timestamp).getTime())).length;
    const duplicateEvents = events.length - new Set(events.map(event => `${event.order_id}|${event.activity}|${event.timestamp}`)).size;
    return { missingColumns, missingValues, invalidTimestamps, duplicateEvents, valid: missingColumns.length === 0 && missingValues.length === 0 && invalidTimestamps === 0 && events.length > 0 };
  }

  function analyzeEvents(events) {
    const groups = events.reduce((acc, event) => ((acc[event.order_id] ??= []).push(event), acc), {});
    return Object.entries(groups).map(([order_id, orderEvents]) => {
      const sorted = orderEvents
        .filter(event => event.timestamp && !Number.isNaN(new Date(event.timestamp).getTime()))
        .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
      if (!sorted.length) return null;
      const waits = sorted.slice(1).map((event, index) => ({
        order_id,
        from: sorted[index].activity,
        to: event.activity,
        hours: hoursBetween(sorted[index].timestamp, event.timestamp),
        cost: Number(event.event_cost) || 0
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
        reworkCost: sorted.reduce((sum, event, index) => sum + (activityNames.indexOf(event.activity) < index ? Number(event.event_cost) || 0 : 0), 0),
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

  function buildProcessGraph(orders) {
    const nodeMap = {};
    const edgeMap = {};
    orders.forEach(order => {
      const seenActivities = new Set();
      order.events.forEach(event => {
        const node = nodeMap[event.activity] ??= { id: event.activity, name: event.activity, caseIds: new Set(), occurrences: 0, reworkOccurrences: 0, totalCost: 0 };
        node.caseIds.add(order.order_id);
        node.occurrences += 1;
        node.totalCost += Number(event.event_cost) || 0;
        if (seenActivities.has(event.activity)) node.reworkOccurrences += 1;
        seenActivities.add(event.activity);
      });
      order.waits.forEach(wait => {
        const id = `${wait.from}|||${wait.to}`;
        const edge = edgeMap[id] ??= { id, source: wait.from, target: wait.to, caseIds: new Set(), occurrences: 0, totalHours: 0, totalCost: 0 };
        edge.caseIds.add(order.order_id);
        edge.occurrences += 1;
        edge.totalHours += wait.hours;
        edge.totalCost += wait.cost;
      });
    });
    const variants = buildVariants(orders);
    const dominantPath = variants[0]?.path.split(" → ") || [];
    const activityOrder = [...new Set([...dominantPath, ...Object.keys(nodeMap).sort()])];
    const nodes = activityOrder.map((id, index) => {
      const node = nodeMap[id];
      return {
        ...node,
        caseIds: [...node.caseIds].sort(),
        cases: node.caseIds.size,
        avgCost: node.totalCost / (node.occurrences || 1),
        order: index
      };
    });
    const edges = Object.values(edgeMap).map(edge => ({
      ...edge,
      caseIds: [...edge.caseIds].sort(),
      cases: edge.caseIds.size,
      avgHours: edge.totalHours / (edge.occurrences || 1),
      avgCost: edge.totalCost / (edge.occurrences || 1)
    })).sort((left, right) => right.occurrences - left.occurrences || right.avgHours - left.avgHours);
    return { nodes, edges, dominantPath, variants, orders: orders.length };
  }

  function rankOpportunities(orders, assumptions = {}) {
    const waitTargetHours = Math.max(0, Number(assumptions.waitTargetHours) || 0);
    const valuePerHour = Math.max(0, Number(assumptions.valuePerHour) || 0);
    const transitions = orders.flatMap(order => order.waits).reduce((acc, wait) => {
      const key = `${wait.from} → ${wait.to}`;
      if (wait.hours > waitTargetHours) {
        const item = acc[key] ??= { title: `Reduce ${key} waiting`, source: wait.from, target: wait.to, excessHours: 0, orderIds: new Set(), occurrences: 0 };
        item.excessHours += wait.hours - waitTargetHours;
        item.orderIds.add(wait.order_id);
        item.occurrences += 1;
      }
      return acc;
    }, {});
    const delayOpportunities = Object.values(transitions).map(item => ({
      type: "Flow delay",
      title: item.title,
      processElementId: `${item.source}|||${item.target}`,
      caseIds: [...item.orderIds].sort(),
      affectedOrders: item.orderIds.size,
      occurrences: item.occurrences,
      recoverableHours: item.excessHours,
      estimatedValue: item.excessHours * valuePerHour,
      valueLabel: "Modeled capacity value",
      confidence: item.occurrences >= 5 ? "Strong" : item.occurrences >= 3 ? "Moderate" : "Directional",
      evidence: `${item.occurrences} waits exceeded the ${waitTargetHours}-hour handoff target.`
    }));
    const reworkOrders = orders.filter(order => order.rework);
    const reworkCost = reworkOrders.reduce((sum, order) => sum + order.reworkCost, 0);
    const reworkOpportunity = reworkOrders.length ? [{
      type: "Rework",
      title: "Prevent repeated fulfillment activities",
      processElementId: null,
      caseIds: reworkOrders.map(order => order.order_id).sort(),
      affectedOrders: reworkOrders.length,
      occurrences: reworkOrders.length,
      recoverableHours: 0,
      estimatedValue: reworkCost,
      valueLabel: "Observed duplicate handling cost",
      confidence: reworkOrders.length >= 5 ? "Strong" : reworkOrders.length >= 3 ? "Moderate" : "Directional",
      evidence: `${reworkOrders.length} orders repeated an activity; value uses duplicate event_cost only.`
    }] : [];
    return [...delayOpportunities, ...reworkOpportunity]
      .sort((left, right) => right.estimatedValue - left.estimatedValue || right.affectedOrders - left.affectedOrders);
  }

  function filterAndSortCases(orders, options = {}) {
    const query = String(options.query || "").trim().toLowerCase();
    const statusRank = order => order.late ? 0 : order.rework ? 1 : 2;
    return orders
      .filter(order => !query || order.order_id.toLowerCase().includes(query))
      .sort((left, right) => {
        if (options.sort === "cycle-desc") return right.cycle - left.cycle || left.order_id.localeCompare(right.order_id);
        if (options.sort === "status") return statusRank(left) - statusRank(right) || left.order_id.localeCompare(right.order_id);
        return left.order_id.localeCompare(right.order_id);
      });
  }

  const api = { requiredColumns, importFields, parseCsv, parseTabularRows, suggestMappings, mapEvents, validateMapping, validateEvents, analyzeEvents, filterOrders, filterAndSortCases, summarizeOrders, buildVariants, buildProcessGraph, rankOpportunities };
  root.MeridianAnalysis = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
