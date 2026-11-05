const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const processSource = fs.readFileSync(path.join(root, "src", "process-view.js"), "utf8");
const echartsBytes = fs.readFileSync(path.join(root, "vendor", "echarts.min.js"));
const echarts = require("../vendor/echarts.min.js");

assert.equal(echarts.version, "6.1.0");
assert.equal(crypto.createHash("sha256").update(echartsBytes).digest("hex").toUpperCase(), "B66B25AEB4DF84E33199DC21694014D336D222CBD9DEB0E5A7C14BD6AA0D0FD0");
assert.match(html, /id="process-chart"/);
assert.match(html, /id="process-transitions"/);
assert.equal((html.match(/data-process-overlay=/g) || []).length, 3);
assert.match(html, /vendor\/echarts\.min\.js/);
assert.match(html, /src\/process-view\.js/);
assert.match(processSource, /aria:\s*\{\s*enabled:\s*true/);
assert.match(processSource, /renderer:\s*"canvas"/);

console.log("Process view checks passed.");
