const assert = require("node:assert/strict");
const XLSX = require("../vendor/xlsx.full.min.js");
const { suggestMappings, mapEvents, validateEvents, analyzeEvents } = require("../src/analysis.js");
const { parseWorkbook } = require("../src/workbook-import.js");

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Instructions"], ["Choose the Events worksheet."]]), "Read Me");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  ["Order Number", "Process Step", "Completed At", "Team", "Event Cost"],
  ["XL-100", "Order received", new Date("2026-02-01T08:00:00Z"), "Order Desk", 1.5],
  ["XL-100", "Order shipped", new Date("2026-02-01T12:00:00Z"), "Shipping", 2.5]
]), "Events");

const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
const result = parseWorkbook(bytes, "Events", XLSX);
assert.deepEqual(result.sheetNames, ["Read Me", "Events"]);
assert.equal(result.sheetName, "Events");
assert.equal(result.parsed.events.length, 2);

const mapping = suggestMappings(result.parsed.columns);
const events = mapEvents(result.parsed.events, mapping);
assert.equal(validateEvents(events, Object.keys(mapping).filter(field => mapping[field])).valid, true);
assert.equal(events[0].timestamp, "2026-02-01T08:00:00.000Z");
assert.equal(analyzeEvents(events)[0].cycle, 4);

console.log("Workbook import checks passed.");
