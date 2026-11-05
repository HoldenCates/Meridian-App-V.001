const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
const personalTheme = fs.readFileSync(path.join(__dirname, "..", "src", "theme-holden.css"), "utf8");
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
assert.match(html, /<link rel="stylesheet" href="src\/theme-holden\.css">/);
assert.match(html, /<body data-theme="holden-console">/);
assert.match(html, /<script src="src\/ui\.js"><\/script>/);
assert.match(appSource, /function renderCaseList\(\)/);
assert.match(appSource, /function inspectOpportunity\(opportunity\)/);
assert.match(appSource, /setImportStatus\("good", "Dataset ready"/);
assert.match(styles, /font-family:\"IBM Plex Mono\"/);
assert.match(styles, /body \{[^}]+font-family:var\(--font-mono\)/);
assert.doesNotMatch(styles, /Geist Pixel/);
assert.match(styles, /--accent-600:#c9a227/);
assert.match(personalTheme, /--canvas:#000000/);
assert.match(personalTheme, /content:attr\(data-console-label\)/);
assert.match(personalTheme, /@keyframes consoleReveal/);
assert.match(appSource, /buildProcessGraph/);
["IBMPlexMono-Regular.woff2", "IBMPlexMono-SemiBold.woff2", "LICENSE-IBM-Plex.txt"].forEach(file => {
  assert.ok(fs.existsSync(path.join(__dirname, "..", "vendor", "fonts", file)), `Missing vendored font asset ${file}`);
});
const fontHashes = {
  "IBMPlexMono-Regular.woff2": "BA204497F16B6D334CEE9D1E963A831B73E3A56E1D6300A8489D18DF7214B350",
  "IBMPlexMono-SemiBold.woff2": "6A825B4824C01CBB401E829E5A066A1818411BCB3538B5A5792C5CA9B82343C3"
};
Object.entries(fontHashes).forEach(([file, hash]) => {
  const bytes = fs.readFileSync(path.join(__dirname, "..", "vendor", "fonts", file));
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), hash, `Unexpected font bytes for ${file}`);
});

console.log("UI structure checks passed.");
