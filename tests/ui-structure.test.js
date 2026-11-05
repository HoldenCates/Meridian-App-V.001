const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML IDs must be unique");

const tabs = [...html.matchAll(/<button[^>]+role="tab"[^>]+aria-controls="([^"]+)"[^>]*>/g)];
const panels = [...html.matchAll(/<section[^>]+role="tabpanel"[^>]+aria-labelledby="([^"]+)"[^>]*>/g)];
assert.equal(tabs.length, 5);
assert.equal(panels.length, 5);
tabs.forEach(match => assert.ok(ids.includes(match[1]), `Missing tab panel ${match[1]}`));
panels.forEach(match => assert.ok(ids.includes(match[1]), `Missing tab ${match[1]}`));

const requiredElements = ["metrics", "findings", "process-chart", "process-transitions", "process-detail", "variants", "opportunities", "orders", "timeline", "case-search", "case-sort", "case-result-count", "csv-file", "import-status", "data-summary", "mapping-panel", "department-filter", "wait-target"];
requiredElements.forEach(id => assert.ok(ids.includes(id), `Missing application element ${id}`));
assert.match(html, /<link rel="stylesheet" href="src\/styles\.css">/);
assert.match(html, /<script src="src\/ui\.js"><\/script>/);
assert.match(appSource, /function renderCaseList\(\)/);
assert.match(appSource, /function inspectOpportunity\(opportunity\)/);
assert.match(appSource, /setImportStatus\("good", "Dataset ready"/);

console.log("UI structure checks passed.");
