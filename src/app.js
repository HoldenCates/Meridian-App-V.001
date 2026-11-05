const { importFields, parseCsv, suggestMappings, mapEvents, validateMapping, validateEvents, analyzeEvents, filterOrders, summarizeOrders, buildVariants, rankOpportunities } = window.MeridianAnalysis;
const { parseWorkbook } = window.MeridianWorkbookImport;
const { syntheticEvents } = window.MeridianSampleData;
const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
let currentOrders = analyzeEvents(syntheticEvents);
let currentSource = "synthetic pilot data";
let pendingImport = null;
let pendingWorkbook = null;
const fieldLabels = { order_id: "Order identifier", activity: "Activity / process step", timestamp: "Event timestamp", department: "Department", resource: "Employee / resource", event_cost: "Event cost" };

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
}

function showImportError(message) {
  const quality = document.querySelector("#data-quality");
  quality.className = "quality warn";
  quality.innerHTML = `<strong>File could not be loaded</strong><ul><li>${escapeHtml(message)}</li></ul>`;
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
    return;
  }
  const mappedEvents = mapEvents(pendingImport.events, mapping);
  const validation = validateEvents(mappedEvents, importFields.filter(field => mapping[field]));
  showQuality(validation, pendingImport.fileName);
  if (validation.valid) {
    currentOrders = analyzeEvents(mappedEvents);
    currentSource = `${pendingImport.fileName} (mapped import)`;
    populateDepartments(currentOrders);
    render();
  }
}

function getFilters() {
  return { department: document.querySelector("#department-filter").value, status: document.querySelector("#status-filter").value, from: document.querySelector("#from-filter").value, to: document.querySelector("#to-filter").value };
}

function render() {
  const filteredOrders = filterOrders(currentOrders, getFilters());
  const analysis = summarizeOrders(filteredOrders);
  const metric = (label, value) => `<div class="card"><div class="metric-label">${label}</div><div class="metric-value">${value}</div></div>`;
  document.querySelector("#result-count").textContent = `Showing ${filteredOrders.length} of ${currentOrders.length} orders`;
  document.querySelector("#metrics").innerHTML = [metric("Orders analyzed", analysis.orders.length), metric("Avg. cycle time", `${analysis.avgCycle.toFixed(1)} hrs`), metric("Avg. waiting time", `${analysis.avgWait.toFixed(1)} hrs`), metric("Late shipments", `${(analysis.lateRate * 100).toFixed(0)}%`), metric("Rework rate", `${(analysis.reworkRate * 100).toFixed(0)}%`)].join("");
  const topWait = analysis.waitByTransition[0] || { transition: "Not enough events", hours: 0, occurrences: 0 };
  document.querySelector("#findings").innerHTML = filteredOrders.length ? [
    `<div class="finding"><strong>Primary bottleneck: ${escapeHtml(topWait.transition)}</strong><span>${topWait.hours.toFixed(1)} average hours of waiting across ${topWait.occurrences} transitions.</span><br><small>Evidence: calculated from ordered event timestamps.</small></div>`,
    `<div class="finding"><strong>Rework detected in ${analysis.orders.filter(order => order.rework).map(order => order.order_id).join(", ") || "none"}</strong><span>Repeated activities increase handling effort and should be investigated.</span><br><small>Confidence: based on ${escapeHtml(currentSource)}.</small></div>`,
    `<div class="finding"><strong>${analysis.orders.filter(order => order.late).length} late shipments</strong><span>Orders exceeding the 24-hour pilot fulfillment target.</span><br><small>Estimated event cost in selection: $${analysis.totalCost.toFixed(2)}.</small></div>`
  ].join("") : `<p class="muted">No orders match the selected filters.</p>`;
  document.querySelector("#orders").innerHTML = analysis.orders.map(order => `<button data-order="${escapeHtml(order.order_id)}">${escapeHtml(order.order_id)} <span class="pill ${order.late ? "bad" : order.rework ? "warn" : "good"}">${order.late ? "Late" : order.rework ? "Rework" : "On track"}</span></button>`).join(" ");
  const renderTimeline = orderId => {
    const order = analysis.orders.find(item => item.order_id === orderId);
    document.querySelector("#timeline").innerHTML = order ? `<h3>${escapeHtml(order.order_id)} timeline</h3>${order.events.map(event => `<div class="event"><div class="event-time">${new Date(event.timestamp).toLocaleString()}</div><div><strong>${escapeHtml(event.activity)}</strong><br><small>${escapeHtml(event.department || "Unassigned")} · ${escapeHtml(event.resource || "Unassigned")}</small></div></div>`).join("")}` : "";
  };
  document.querySelectorAll("[data-order]").forEach(button => button.addEventListener("click", () => renderTimeline(button.dataset.order)));
  renderTimeline(analysis.orders[0]?.order_id);
  const variants = buildVariants(filteredOrders);
  document.querySelector("#variants").innerHTML = variants.length ? variants.map((variant, index) => `<tr><td>${index + 1}</td><td class="variant-path">${escapeHtml(variant.path)}</td><td>${variant.count}</td><td>${variant.avgCycle.toFixed(1)} hrs</td><td>${variant.late}</td><td>${variant.rework}</td></tr>`).join("") : `<tr><td colspan="6" class="muted">No process variants match the selected filters.</td></tr>`;
  const assumptions = { waitTargetHours: document.querySelector("#wait-target").value, valuePerHour: document.querySelector("#hour-value").value };
  const opportunities = rankOpportunities(filteredOrders, assumptions).slice(0, 5);
  document.querySelector("#opportunities").innerHTML = opportunities.length ? opportunities.map((opportunity, index) => `<article class="opportunity"><div class="opportunity-rank">${index + 1}</div><div><div class="opportunity-heading"><strong>${escapeHtml(opportunity.title)}</strong><span class="pill ${opportunity.confidence === "Strong" ? "good" : "warn"}">${opportunity.confidence} evidence</span></div><p>${escapeHtml(opportunity.evidence)}</p><div class="opportunity-impact"><span><b>${opportunity.affectedOrders}</b> affected orders</span><span><b>${opportunity.recoverableHours.toFixed(1)}</b> recoverable hours</span><span><b>$${opportunity.estimatedValue.toFixed(2)}</b> ${escapeHtml(opportunity.valueLabel.toLowerCase())}</span></div></div></article>`).join("") : `<p class="muted">No opportunities exceed the current assumptions.</p>`;
}

document.querySelector("#csv-file").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
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
