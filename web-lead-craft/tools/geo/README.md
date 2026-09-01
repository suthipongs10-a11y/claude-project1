# tools/geo

`th-provinces.json` — Thailand's 77 provinces as GeoJSON polygons, WGS84.

Source: <https://github.com/apisit/thailand.json> (`thailandWithName.json`, the
simplified vector version), MIT licence, © 2012 Apisit Toompakdee. Derived by
the author from an ESRI shapefile of Thai administrative boundaries via
`ogr2ogr`.

Vendored rather than fetched so `route-map.mjs` runs with no network, and so a
future client site wanting a Thai map does not have to go looking again.

Province names are English (`properties.name`), e.g. `Nan`, `Loei`,
`Uttaradit`. A route file names the provinces it wants; everything else is
dropped at generation time, so the 167 KB here never reaches a deliverable.
