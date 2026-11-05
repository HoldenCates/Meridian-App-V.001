# Vendored browser dependency

`xlsx.full.min.js` is the unmodified SheetJS Community Edition 0.20.3 standalone browser build downloaded from the authoritative SheetJS CDN:

https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js

SHA-256: `CC015130AA8521E7F088F88898EBA949CCDCBFB38DF0BD129B44B7273C3A6F41`

The dependency is stored locally so Excel import works without an internet connection. Its Apache License 2.0 text is included in `LICENSE-SheetJS.txt`.

## Apache ECharts

`echarts.min.js` is the unmodified Apache ECharts 6.1.0 browser build downloaded from the npm distribution through jsDelivr:

https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js

SHA-256: `B66B25AEB4DF84E33199DC21694014D336D222CBD9DEB0E5A7C14BD6AA0D0FD0`

The dependency is stored locally so process visualization works without an internet connection. Its Apache License 2.0 text is included in `LICENSE-ECharts.txt`.

## Interface fonts

The `fonts` directory contains only the browser files used by Meridian, extracted from the official npm packages so typography remains available offline:

- IBM Plex Mono Regular from `@ibm/plex-mono` 2.5.0 — SHA-256 `BA204497F16B6D334CEE9D1E963A831B73E3A56E1D6300A8489D18DF7214B350`
- IBM Plex Mono SemiBold from `@ibm/plex-mono` 2.5.0 — SHA-256 `6A825B4824C01CBB401E829E5A066A1818411BCB3538B5A5792C5CA9B82343C3`

IBM Plex Mono uses the SIL Open Font License 1.1. Its license text is included beside the font files.
