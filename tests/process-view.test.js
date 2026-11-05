const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const processSource = fs.readFileSync(path.join(root, "src", "process-view.js"), "utf8");
const echartsBytes = fs.readFileSync(path.join(root, "vendor", "echarts.min.js"));
const echarts = require("../vendor/echarts.min.js");
const { buildProcessGraph, analyzeEvents } = require("../src/analysis.js");
const { syntheticEvents } = require("../src/sample-data.js");
const { project } = require("../src/process-view.js");

assert.equal(echarts.version, "6.1.0");
assert.equal(crypto.createHash("sha256").update(echartsBytes).digest("hex").toUpperCase(), "B66B25AEB4DF84E33199DC21694014D336D222CBD9DEB0E5A7C14BD6AA0D0FD0");
assert.match(html, /id="process-chart"/);
assert.match(html, /id="process-transitions"/);
assert.equal((html.match(/data-process-overlay=/g) || []).length, 3);
assert.equal((html.match(/data-process-detail=/g) || []).length, 3);
assert.match(html, /id="process-map-stats"/);
assert.match(html, /id="process-activity-search"/);
assert.match(html, /id="fit-process-map"/);
assert.match(html, /vendor\/echarts\.min\.js/);
assert.match(html, /src\/process-view\.js/);
assert.match(processSource, /aria:\s*\{\s*enabled:\s*true/);
assert.match(processSource, /renderer:\s*"canvas"/);
assert.match(processSource, /getPropertyValue\(token\)/);
assert.match(processSource, /--chart-frequency/);
assert.match(processSource, /estimatedCenterGap/);
assert.match(processSource, /wrapActivityName/);

const graph = buildProcessGraph(analyzeEvents(syntheticEvents));
const core = project(graph, "core");
const exceptions = project(graph, "exceptions");
const full = project(graph, "full");
assert.equal(core.edges.length, graph.dominantPath.length - 1);
assert.ok(exceptions.edges.length >= core.edges.length);
assert.ok(exceptions.edges.length <= full.edges.length);
assert.equal(full.edges.length, graph.edges.length);
assert.equal(full.nodes.length, graph.nodes.length);
assert.equal(full.bottleneckIds.size, 1);
assert.equal(full.waitTargetHours, 2);
assert.equal(core.coverage.totalOrders, 24);

console.log("Process view checks passed.");
