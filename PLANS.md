# Build plan

## Phase 00 — Pilot foundation

- [x] Write pilot scope and acceptance criteria
- [x] Define synthetic event schema
- [x] Establish portable project structure

## Phase 01 — First vertical slice

- [x] Generate synthetic order-fulfillment events
- [x] Calculate cycle time, waiting time, rework, and late shipments
- [x] Display KPI summary and bottleneck findings
- [x] Display order-level evidence
- [x] Add launch instructions

## Phase 02 — CSV and data quality

- [x] Add CSV import using the same event schema
- [x] Add a data-quality report
- [x] Add a sample order event log
- [x] Add filters and process-variant comparison
- [x] Add automated checks for analysis calculations

## Phase 03 — Stakeholder review

- [x] Expand the synthetic dataset for meaningful review
- [x] Define stakeholder decision questions
- [x] Rank opportunities by time and modeled financial impact
- [x] Expose assumptions and financial guardrails
- [ ] Review results with Meridian stakeholders

## Phase 04 — Business-ready imports

- [x] Suggest mappings for common business column names
- [x] Let users review required and optional field mappings
- [x] Preview source rows before analysis
- [x] Support quoted CSV values and duplicate column names
- [x] Add Excel workbook import and worksheet selection
- [ ] Validate import with larger and intentionally messy workbooks

## Phase 05 — UI and scenario validation

- [ ] Separate major workflows into tabs
- [ ] Complete the Meridian UI redesign
- [ ] Build several realistic business datasets
- [ ] Run end-to-end shipment and fulfillment scenarios
- [ ] Test portable deployment on another computer
