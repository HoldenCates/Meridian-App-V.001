# Meridian App V.002 — UI research and implementation plan

## Objective

Turn the V.001 working prototype into a clear internal operations product without changing its verified calculations, import controls, offline operation, or evidence trail.

V.002 will separate the major workflows into focused views, add an interactive process map and supporting charts, and establish a reusable visual system before realistic business simulation begins.

## Interfaces reviewed

### Apromore

Use as the behavior reference for process mining:

- Process map is the primary analysis surface.
- Top-level statistics summarize cases, variants, activities, duration, and cost.
- Filters update the map and supporting statistics together.
- Selecting a variant or activity drills into the same evidence.
- Frequency, duration, cost, and rework are alternate overlays rather than separate products.

Sources: [Apromore Process Discovery](https://documentation.apromore.org/discovery/index.html), [Discover Model](https://documentation.apromore.org/discovery/discovermodel.html), [Compare Variants](https://documentation.apromore.org/discovery/comparevariants.html), [open-source repository](https://github.com/apromore/ApromoreCore)

### Metabase

Use as the organization reference:

- Related questions are grouped into tabs.
- Cards create a predictable dashboard grid.
- Dashboard filters apply consistently across relevant cards.
- Clicking a chart can drive a filter or drill into supporting records.
- Filters that do not affect the active tab stay out of the way.

Sources: [dashboard introduction](https://www.metabase.com/docs/latest/dashboards/introduction), [dashboard filters](https://www.metabase.com/docs/latest/dashboards/filters), [open-source repository](https://github.com/metabase/metabase)

### Grafana

Use as the information-design reference:

- Each dashboard answers a defined question.
- Information progresses from general to specific.
- Consistent panels and variables reduce duplicate dashboards.
- Color communicates thresholds and exceptions, not decoration.
- Experimental views are tested before becoming the standard view.

Sources: [dashboard best practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/), [open-source repository](https://github.com/grafana/grafana)

### Tabler

Use as visual inspiration for the shell, cards, tables, controls, spacing, and responsive behavior. Do not import the complete framework. Meridian needs a much smaller component set and should not inherit unused plugins or a framework-wide dependency.

Source: [Tabler repository and demo](https://github.com/tabler/tabler)

## Recommended client-side approach

### Application shell

Keep the existing plain HTML, CSS, and JavaScript architecture. Build a small Meridian design system with CSS variables and reusable components. This avoids a React rewrite, build tooling, and server requirements while the product and workflows are still evolving.

### Visualization engine

Use one locally vendored Apache ECharts build for charts and the first process map. It supports graph and Sankey views, bar and line charts, Canvas and SVG rendering, click-driven drill-down, responsive sizing, and accessibility descriptions. Canvas is available when larger datasets make SVG inefficient.

Sources: [Apache ECharts repository](https://github.com/apache/echarts), [renderer guidance](https://github.com/apache/echarts-handbook/blob/master/contents/en/best-practices/canvas-vs-svg.md), [event and drill-down handling](https://echarts.apache.org/handbook/en/concepts/event/), [accessibility guidance](https://echarts.apache.org/handbook/en/best-practices/aria/)

Cytoscape.js remains the fallback if later process maps require advanced graph layout or graph-theory operations that ECharts cannot provide. BPMN visualization is deferred because Meridian currently discovers flows from event logs rather than loading BPMN models.

### Tabs

Use accessible horizontal tabs with keyboard navigation, active state, URL hash state, and persistent analysis filters. Follow the W3C tabs pattern for roles, focus, arrow keys, Home/End, and panel relationships.

Source: [W3C ARIA tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)

## Proposed V.002 views

1. **Overview** — dataset identity, quality status, KPI summary, top bottlenecks, late/rework trend, and top opportunities.
2. **Process** — interactive process map with frequency, duration, and cost overlays; shared filters; activity and transition drill-down.
3. **Opportunities** — ranked opportunities, assumptions, evidence strength, affected orders, modeled value, and overlap warnings.
4. **Cases** — searchable orders, variants, status, cycle time, and order timeline evidence.
5. **Data** — CSV/Excel upload, worksheet selection, mapping, preview, validation, and active dataset summary.

When no dataset is active, the app opens the Data view. With synthetic or imported data active, it opens Overview.

## Implementation workflow

### V.002.0 — Research and approval

- Review source interfaces and interaction patterns.
- Approve the five-view structure and visual direction.
- Freeze V.001 calculations as the regression baseline.

### V.002.1 — UI foundation vertical slice

- Add design tokens for color, typography, spacing, borders, elevation, and status states.
- Build the application header and accessible tab system.
- Build reusable card, KPI, table, filter, empty-state, warning, and button components.
- Move only Overview into the new shell first.
- Verify that all V.001 tests still pass before migrating more views.

### V.002.2 — Process visualization vertical slice

- Vendor one verified ECharts release locally with license and checksum.
- Build event-log-to-process-graph calculations with tests.
- Render activity nodes and transition edges.
- Add frequency, duration, and cost overlays.
- Connect node and edge selections to cases and supporting evidence.

### V.002.3 — Complete workflow migration

- Move Opportunities, Cases, and Data into their approved views.
- Preserve filters and selected dataset when switching views.
- Add empty, loading, warning, and no-result states.
- Remove the old single-page layout only after each migrated view passes regression checks.

### V.002.4 — Fine-tuning and validation

- Verify desktop, laptop, and narrow-window layouts.
- Test mouse and keyboard navigation.
- Check color contrast and non-color status cues.
- Capture repeatable screenshots using fixed datasets.
- Measure load, filter, tab-switch, and chart-redraw performance.
- Tune labels, density, spacing, and chart defaults after realistic datasets expose actual usage problems.

## Guardrails

- No AI features in V.002.
- No server, account, or network requirement.
- No rewrite of the analysis engine merely to support visual changes.
- One charting library, locally vendored.
- Every chart must answer a business question and provide access to underlying evidence.
- Financial estimates retain their existing assumptions and warnings.
- Color never acts as the only indicator of status.
- UI work is committed in small vertical slices with automated regression checks.

## Acceptance criteria

- All five views work from the local `index.html` file.
- Tabs are keyboard accessible and preserve application state.
- Filters produce consistent results across every relevant view.
- The process map supports frequency and performance investigation.
- A user can move from a KPI or opportunity to the supporting orders.
- CSV and Excel import behavior remains unchanged.
- The app works without internet access.
- Existing analysis and workbook tests remain green.
- Fixed test datasets produce repeatable screenshots and metrics.
