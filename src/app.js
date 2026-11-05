const { importFields, parseCsv, suggestMappings, mapEvents, validateMapping, validateEvents, analyzeEvents, filterOrders, filterAndSortCases, summarizeOrders, buildVariants, buildProcessGraph, rankOpportunities } = window.MeridianAnalysis;
const { parseWorkbook } = window.MeridianWorkbookImport;
const { syntheticEvents } = window.MeridianSampleData;
const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
let currentOrders = analyzeEvents(syntheticEvents);
let currentSource = "synthetic pilot data";
let pendingImport = null;
let pendingWorkbook = null;
let activeAnalysisOrders = [];
let currentProcessGraph = { nodes: [], edges: [], dominantPath: [], variants: [], orders: 0 };
let currentProcessOverlay = "frequency";
let selectedProcessElement = null;
let selectedOrderId = null;
const fieldLabels = { order_id: "Order identifier", activity: "Activity / process step", timestamp: "Event timestamp", department: "Department", resource: "Employee / resource", event_cost: "Event cost" };

function setImportStatus(kind, title, message) {
  const status = document.querySelector("#import-status");
  status.className = `status-panel ${kind}`;
  status.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
}

function showQuality(result, source) {
  const quality = document.querySelector("#data-quality");
  const issues = [...result.missingColumns.map(column => `Missing required column: ${column}`), ...result.missingValues, result.invalidTimestamps ? `Invalid timestamps: ${result.invalidTimestamps}` : "", result.duplicateEvents ? `Duplicate events: ${result.duplicateEvents}` : ""].filter(Boolean);
  quality.className = `quality ${issues.length ? "warn" : "good"}`;
  quality.innerHTML = `<strong>${escapeHtml(source)}: ${result.valid && !issues.length ? "Ready for analysis" : "Loaded with warnings"}</strong><ul>${issues.length ? issues.map(issue => `<li>${escapeHtml(issue)}</li>`).join("") : "<li>Required fields are present and timestamps are valid.</li>"}</ul>`;
}

function populateDepartments(orders) {
  const select = document.querySelector("#department-filter");
  const selected = select.value;
  const departments = [...new Set(orders.flatMap(order => order.departments))].sort();
  select.innerHTML = `<option value="all">All departments</option>${departments.map(department => `<option value="${escapeHtml(department)}">${escapeHtml(department)}</option>`).join("")}`;
  if (departments.includes(selected)) select.value = selected;
}

function renderMapping(parsed, fileName) {
  pendingImport = { ...parsed, fileName };
  const suggestions = suggestMappings(parsed.columns);
  const options = field => `<option value="">${["order_id", "activity", "timestamp"].includes(field) ? "Select a column" : "Not provided"}</option>${parsed.columns.map(column => `<option value="${escapeHtml(column.key)}">${escapeHtml(column.label)}</option>`).join("")}`;
  document.querySelector("#mapping-fields").innerHTML = importFields.map(field => `<div class="filter"><label for="map-${field}">${escapeHtml(fieldLabels[field])}${["order_id", "activity", "timestamp"].includes(field) ? " *" : ""}</label><select id="map-${field}" data-map-field="${field}">${options(field)}</select></div>`).join("");
  importFields.forEach(field => { document.querySelector(`#map-${field}`).value = suggestions[field]; });
  const previewRows = parsed.events.slice(0, 4);
  document.querySelector("#mapping-preview").innerHTML = `<thead><tr>${parsed.columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${previewRows.map(row => `<tr>${parsed.columns.map(column => `<td>${escapeHtml(row[column.key])}</td>`).join("")}</tr>`).join("")}</tbody>`;
  document.querySelector("#mapping-panel").classList.remove("hidden");
  const quality = document.querySelector("#data-quality");
  quality.className = "quality good";
  quality.innerHTML = `<strong>${escapeHtml(fileName)} loaded</strong><ul><li>${parsed.events.length} rows and ${parsed.columns.length} columns found. Review the suggested mapping before analysis.</li></ul>`;
  setImportStatus("info", "File read successfully", "Confirm the suggested column mapping, then analyze the data.");
}

function showImportError(message) {
  const quality = document.querySelector("#data-quality");
  quality.className = "quality warn";
  quality.innerHTML = `<strong>File could not be loaded</strong><ul><li>${escapeHtml(message)}</li></ul>`;
  setImportStatus("warn", "Import stopped", message);
}

function loadWorkbookSheet(sheetName) {
  try {
    const result = parseWorkbook(pendingWorkbook.buffer, sheetName);
    const sheetSelect = document.querySelector("#sheet-select");
    sheetSelect.innerHTML = result.sheetNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    sheetSelect.value = result.sheetName;
    document.querySelector("#workbook-controls").classList.remove("hidden");
    renderMapping(result.parsed, `${pendingWorkbook.fileName} — ${result.sheetName}`);
  } catch (error) {
    showImportError(error.message);
  }
}

function applyMapping() {
  if (!pendingImport) return;
  const mapping = Object.fromEntries([...document.querySelectorAll("[data-map-field]")].map(select => [select.dataset.mapField, select.value]));
  const mappingValidation = validateMapping(mapping);
  if (!mappingValidation.valid) {
    const issues = [...mappingValidation.missingRequired.map(field => `Map the required ${field} field.`), ...mappingValidation.duplicatedSources.map(source => `The ${source} column is mapped more than once.`)];
    const quality = document.querySelector("#data-quality");
    quality.className = "quality warn";
    quality.innerHTML = `<strong>Mapping needs attention</strong><ul>${issues.map(issue => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>`;
    setImportStatus("warn", "Mapping needs attention", "Complete the required fields and ensure each source column is used once.");
    return;
  }
  setImportStatus("info", "Analyzing mapped data", "Meridian is validating events and rebuilding every view.");
  const mappedEvents = mapEvents(pendingImport.events, mapping);
  const validation = validateEvents(mappedEvents, importFields.filter(field => mapping[field]));
  showQuality(validation, pendingImport.fileName);
  if (validation.valid) {
    currentOrders = analyzeEvents(mappedEvents);
    currentSource = `${pendingImport.fileName} (mapped import)`;
    populateDepartments(currentOrders);
    render();
    setImportStatus("good", "Dataset ready", `${currentOrders.length} orders are available across every view.`);
    window.MeridianUI.activateTab("overview");
  }
}

function getFilters() {
  return { department: document.querySelector("#department-filter").value, status: document.querySelector("#status-filter").value, from: document.querySelector("#from-filter").value, to: document.querySelector("#to-filter").value };
}

function renderOrderTimeline(orderId) {
  const order = activeAnalysisOrders.find(item => item.order_id === orderId);
  selectedOrderId = order?.order_id || null;
  document.querySelectorAll("[data-order]").forEach(button => button.setAttribute("aria-current", String(button.dataset.order === selectedOrderId)));
  document.querySelector("#timeline").innerHTML = order ? `<h3>${escapeHtml(order.order_id)} timeline</h3>${order.events.map(event => `<div class="event"><div class="event-time">${new Date(event.timestamp).toLocaleString()}</div><div><strong>${escapeHtml(event.activity)}</strong><br><small>${escapeHtml(event.department || "Unassigned")} · ${escapeHtml(event.resource || "Unassigned")}</small></div></div>`).join("")}` : `<p class="muted">Select an order to inspect its source events.</p>`;
}

function renderCaseList() {
  const query = document.querySelector("#case-search").value;
  const sort = document.querySelector("#case-sort").value;
  const cases = filterAndSortCases(activeAnalysisOrders, { query, sort });
  document.querySelector("#case-result-count").textContent = `${cases.length} of ${activeAnalysisOrders.length} orders`;
  document.querySelector("#orders").innerHTML = cases.length ? cases.map(order => {
    const status = order.late ? "Late" : order.rework ? "Rework" : "On track";
    const statusClass = order.late ? "bad" : order.rework ? "warn" : "good";
    return `<button type="button" data-order="${escapeHtml(order.order_id)}" aria-current="${order.order_id === selectedOrderId}"><span class="case-row-copy"><strong>${escapeHtml(order.order_id)}</strong><small>${order.cycle.toFixed(1)} hour cycle</small></span><span class="pill ${statusClass}">${status}</span></button>`;
  }).join("") : `<p class="muted">No order IDs match this search.</p>`;
  document.querySelectorAll("[data-order]").forEach(button => button.addEventListener("click", () => renderOrderTimeline(button.dataset.order)));
  if (!cases.some(order => order.order_id === selectedOrderId)) renderOrderTimeline(cases[0]?.order_id);
}

function openOrderEvidence(orderId) {
  document.querySelector("#case-search").value = "";
  renderCaseList();
  window.MeridianUI.activateTab("cases");
  renderOrderTimeline(orderId);
}

function inspectOpportunity(opportunity) {
  if (opportunity.processElementId) {
    const edge = currentProcessGraph.edges.find(item => item.id === opportunity.processElementId);
    window.MeridianUI.activateTab("process");
    if (edge) renderProcessDetail("edge", edge, true);
    return;
  }
  if (opportunity.caseIds?.length) openOrderEvidence(opportunity.caseIds[0]);
}

function bindOpportunityActions(opportunities) {
  document.querySelectorAll("[data-opportunity-index]").forEach(button => button.addEventListener("click", () => inspectOpportunity(opportunities[Number(button.dataset.opportunityIndex)])));
}

function renderProcessDetail(type, item, selectOnChart = false) {
  selectedProcessElement = item ? { type, id: item.id } : null;
  const detail = document.querySelector("#process-detail");
  if (!item) {
    detail.innerHTML = `<h2>Process evidence</h2><p class="muted">Select an activity or transition to inspect the supporting orders.</p>`;
    return;
  }
  const isEdge = type === "edge";
  const title = isEdge ? `${item.source} → ${item.target}` : item.name;
  const metrics = isEdge ? [
    ["Orders", item.cases], ["Transitions", item.occurrences], ["Average wait", `${item.avgHours.toFixed(1)} hrs`], ["Event cost", `$${item.totalCost.toFixed(2)}`]
  ] : [
    ["Orders", item.cases], ["Events", item.occurrences], ["Repeated", item.reworkOccurrences], ["Event cost", `$${item.totalCost.toFixed(2)}`]
  ];
  detail.innerHTML = `<div class="process-detail-kicker">${isEdge ? "Transition" : "Activity"}</div><h2>${escapeHtml(title)}</h2><p class="muted">${isEdge ? "Waiting time is measured between consecutive event timestamps." : "Counts reflect the currently filtered orders."}</p><div class="detail-metrics">${metrics.map(([label, value]) => `<div class="detail-metric"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div><strong style="font-size:12px">Supporting orders</strong><div class="evidence-list">${item.caseIds.map(orderId => `<button type="button" data-process-order="${escapeHtml(orderId)}">${escapeHtml(orderId)}</button>`).join("")}</div><p class="muted">Select an order to open its complete event timeline.</p>`;
  document.querySelectorAll("[data-process-order]").forEach(button => button.addEventListener("click", () => openOrderEvidence(button.dataset.processOrder)));
  if (selectOnChart) window.MeridianProcessView.select(type, item.id, currentProcessGraph);
}

function renderProcessChart() {
  window.MeridianProcessView.render(document.querySelector("#process-chart"), currentProcessGraph, currentProcessOverlay, (type, item) => renderProcessDetail(type, item));
}

function updateProcessView(orders) {
  currentProcessGraph = buildProcessGraph(orders);
  const overlayLabels = { frequency: "Edge width shows transition frequency.", duration: "Edge width and color show average waiting time.", cost: "Edge width and color show total target-event cost." };
  document.querySelector("#process-legend").textContent = overlayLabels[currentProcessOverlay];
  document.querySelectorAll("[data-process-overlay]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.processOverlay === currentProcessOverlay)));
  const metric = edge => currentProcessOverlay === "duration" ? edge.avgHours : currentProcessOverlay === "cost" ? edge.totalCost : edge.occurrences;
  const sortedEdges = [...currentProcessGraph.edges].sort((left, right) => metric(right) - metric(left));
  document.querySelector("#process-transitions").innerHTML = sortedEdges.length ? sortedEdges.map(edge => `<tr><td>${escapeHtml(edge.source)} → ${escapeHtml(edge.target)}</td><td>${edge.cases}</td><td>${edge.occurrences}</td><td>${edge.avgHours.toFixed(1)} hrs</td><td>$${edge.totalCost.toFixed(2)}</td><td><button class="transition-button" type="button" data-transition-id="${escapeHtml(edge.id)}">Inspect</button></td></tr>`).join("") : `<tr><td colspan="6" class="muted">No transitions match the active filters.</td></tr>`;
  document.querySelectorAll("[data-transition-id]").forEach(button => button.addEventListener("click", () => {
    const edge = currentProcessGraph.edges.find(item => item.id === button.dataset.transitionId);
    renderProcessDetail("edge", edge, true);
  }));
  const existing = selectedProcessElement?.type === "edge" ? currentProcessGraph.edges.find(item => item.id === selectedProcessElement.id) : currentProcessGraph.nodes.find(item => item.id === selectedProcessElement?.id);
  const defaultItem = existing || sortedEdges[0] || currentProcessGraph.nodes[0];
  renderProcessDetail(existing ? selectedProcessElement.type : sortedEdges[0] ? "edge" : "node", defaultItem);
  if (!document.querySelector("#panel-process").hidden) renderProcessChart();
}

function render() {
  const filteredOrders = filterOrders(currentOrders, getFilters());
  const analysis = summarizeOrders(filteredOrders);
  const isDemo = currentSource === "synthetic pilot data";
  document.querySelector("#dataset-name").textContent = currentSource;
  document.querySelector("#dataset-meta").textContent = `${currentOrders.length} orders · ${isDemo ? "Demonstration data" : "Imported data"}`;
  document.querySelector("#dataset-notice").hidden = !isDemo;
  const metric = (label, value) => `<div class="card metric-card"><div class="metric-label">${label}</div><div class="metric-value">${value}</div></div>`;
  document.querySelector("#result-count").textContent = `Showing ${filteredOrders.length} of ${currentOrders.length} orders`;
  document.querySelector("#metrics").innerHTML = [metric("Orders analyzed", analysis.orders.length), metric("Avg. cycle time", `${analysis.avgCycle.toFixed(1)} hrs`), metric("Avg. waiting time", `${analysis.avgWait.toFixed(1)} hrs`), metric("Late shipments", `${(analysis.lateRate * 100).toFixed(0)}%`), metric("Rework rate", `${(analysis.reworkRate * 100).toFixed(0)}%`)].join("");
  const topWait = analysis.waitByTransition[0] || { transition: "Not enough events", hours: 0, occurrences: 0 };
  document.querySelector("#findings").innerHTML = filteredOrders.length ? [
    `<div class="finding"><strong>Primary bottleneck: ${escapeHtml(topWait.transition)}</strong><span>${topWait.hours.toFixed(1)} average hours of waiting across ${topWait.occurrences} transitions.</span><br><small>Evidence: calculated from ordered event timestamps.</small></div>`,
    `<div class="finding"><strong>Rework detected in ${analysis.orders.filter(order => order.rework).map(order => order.order_id).join(", ") || "none"}</strong><span>Repeated activities increase handling effort and should be investigated.</span><br><small>Confidence: based on ${escapeHtml(currentSource)}.</small></div>`,
    `<div class="finding"><strong>${analysis.orders.filter(order => order.late).length} late shipments</strong><span>Orders exceeding the 24-hour pilot fulfillment target.</span><br><small>Estimated event cost in selection: $${analysis.totalCost.toFixed(2)}.</small></div>`
  ].join("") : `<p class="muted">No orders match the selected filters.</p>`;
  activeAnalysisOrders = analysis.orders;
  renderCaseList();
  const variants = buildVariants(filteredOrders);
  document.querySelector("#variants").innerHTML = variants.length ? variants.map((variant, index) => `<tr><td>${index + 1}</td><td class="variant-path">${escapeHtml(variant.path)}</td><td>${variant.count}</td><td>${variant.avgCycle.toFixed(1)} hrs</td><td>${variant.late}</td><td>${variant.rework}</td></tr>`).join("") : `<tr><td colspan="6" class="muted">No process variants match the selected filters.</td></tr>`;
  updateProcessView(filteredOrders);
  const assumptions = { waitTargetHours: document.querySelector("#wait-target").value, valuePerHour: document.querySelector("#hour-value").value };
  const opportunities = rankOpportunities(filteredOrders, assumptions).slice(0, 5);
  document.querySelector("#opportunities").innerHTML = opportunities.length ? opportunities.map((opportunity, index) => `<article class="opportunity"><div class="opportunity-rank">${index + 1}</div><div><div class="opportunity-heading"><strong>${escapeHtml(opportunity.title)}</strong><span class="pill ${opportunity.confidence === "Strong" ? "good" : "warn"}">${opportunity.confidence} evidence</span></div><p>${escapeHtml(opportunity.evidence)}</p><div class="opportunity-impact"><span><b>${opportunity.affectedOrders}</b> affected orders</span><span><b>${opportunity.recoverableHours.toFixed(1)}</b> recoverable hours</span><span><b>$${opportunity.estimatedValue.toFixed(2)}</b> ${escapeHtml(opportunity.valueLabel.toLowerCase())}</span></div><button class="opportunity-action" type="button" data-opportunity-index="${index}">${opportunity.processElementId ? "Inspect in Process" : "View supporting case"}</button></div></article>`).join("") : `<p class="muted">No opportunities exceed the current assumptions.</p>`;
  const priority = opportunities[0];
  document.querySelector("#overview-priority").innerHTML = priority ? `<div class="card-heading"><div><h2>Top priority</h2><p class="muted">Highest modeled value in the active scope.</p></div><span class="pill ${priority.confidence === "Strong" ? "good" : "warn"}">${priority.confidence}</span></div><p class="priority-title"><strong>${escapeHtml(priority.title)}</strong></p><div class="priority-value">$${priority.estimatedValue.toFixed(0)}</div><p class="muted">${priority.affectedOrders} affected orders · ${priority.recoverableHours.toFixed(1)} recoverable hours</p><button class="priority-action" type="button" data-opportunity-index="0">Review supporting evidence</button>` : `<h2>Top priority</h2><p class="muted">No opportunity exceeds the current assumptions.</p>`;
  bindOpportunityActions(opportunities);
  document.querySelector("#data-summary").innerHTML = `<div class="card-heading"><div><h2>Active dataset</h2><p class="muted">The source currently driving every Meridian view.</p></div><span class="pill ${isDemo ? "warn" : "good"}">${isDemo ? "Demonstration" : "Imported"}</span></div><div class="data-summary-grid"><div class="detail-metric"><span>Source</span><strong>${escapeHtml(currentSource)}</strong></div><div class="detail-metric"><span>Orders</span><strong>${currentOrders.length}</strong></div><div class="detail-metric"><span>Events</span><strong>${currentOrders.reduce((total, order) => total + order.events.length, 0)}</strong></div></div>`;
}

document.querySelector("#csv-file").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  document.querySelector("#mapping-panel").classList.add("hidden");
  setImportStatus("info", "Reading file", `${file.name} is being opened on this computer.`);
  const reader = new FileReader();
  reader.onload = () => {
    if (/\.(xlsx|xls|xlsb)$/i.test(file.name)) {
      pendingWorkbook = { buffer: reader.result, fileName: file.name };
      loadWorkbookSheet();
    } else {
      pendingWorkbook = null;
      document.querySelector("#workbook-controls").classList.add("hidden");
      renderMapping(parseCsv(reader.result), file.name);
    }
  };
  reader.onerror = () => showImportError("The browser could not read the selected file.");
  if (/\.(xlsx|xls|xlsb)$/i.test(file.name)) reader.readAsArrayBuffer(file);
  else reader.readAsText(file);
});

document.querySelector("#apply-mapping").addEventListener("click", applyMapping);
document.querySelector("#sheet-select").addEventListener("change", event => loadWorkbookSheet(event.target.value));
document.querySelector("#case-search").addEventListener("input", renderCaseList);
document.querySelector("#case-sort").addEventListener("change", renderCaseList);

document.querySelectorAll("[data-process-overlay]").forEach(button => button.addEventListener("click", () => {
  currentProcessOverlay = button.dataset.processOverlay;
  updateProcessView(activeAnalysisOrders);
}));
window.addEventListener("meridian:tabchange", event => { if (event.detail.name === "process") renderProcessChart(); });

document.querySelectorAll("#department-filter, #status-filter, #from-filter, #to-filter").forEach(control => control.addEventListener("change", render));
document.querySelectorAll("#wait-target, #hour-value").forEach(control => control.addEventListener("input", render));
document.querySelector("#reset-filters").addEventListener("click", () => {
  document.querySelector("#department-filter").value = "all";
  document.querySelector("#status-filter").value = "all";
  document.querySelector("#from-filter").value = "";
  document.querySelector("#to-filter").value = "";
  render();
});

showQuality(validateEvents(syntheticEvents, ["order_id", "activity", "timestamp", "department", "resource", "event_cost"]), "Synthetic pilot data");
populateDepartments(currentOrders);
render();
