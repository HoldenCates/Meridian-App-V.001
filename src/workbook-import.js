(function attachMeridianWorkbookImport(root) {
  const analysis = root.MeridianAnalysis || (typeof require !== "undefined" ? require("./analysis.js") : null);
  const defaultLibrary = root.XLSX || (typeof require !== "undefined" ? require("../vendor/xlsx.full.min.js") : null);

  function parseWorkbook(buffer, selectedSheet, library = defaultLibrary) {
    if (!library) throw new Error("Excel import library is unavailable.");
    const workbook = library.read(buffer, { type: "array", cellDates: true });
    const sheetNames = workbook.SheetNames || [];
    const sheetName = selectedSheet && sheetNames.includes(selectedSheet) ? selectedSheet : sheetNames[0];
    if (!sheetName) throw new Error("The workbook does not contain a worksheet.");
    const rows = library.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    return { sheetNames, sheetName, parsed: analysis.parseTabularRows(rows) };
  }

  const api = { parseWorkbook };
  root.MeridianWorkbookImport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
