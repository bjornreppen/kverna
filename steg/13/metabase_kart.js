const config = require("../../config")
const io = require("../../lib/io")
const log = require("log-less-fancy")()
const typesystem = require("@artsdatabanken/typesystem")
const path = require("path")
let tre = io.lesDatafil("metabase_med_url")
let hierarki = io.lesDatafil("kodehierarki")
const barnAv = hierarki.barn

let ukjentBbox = 0
// Forventer følgende katalogstruktur på tile serveren:
// /type/subtype/.../format.projeksjon.filtype
// Dvs. at rotkatalog betraktes som klasse av data, eks. gradient eller trinn
const mapfiles = readMbtiles()

addKartformat()
normaliserGradienter()
if (ukjentBbox > 0) log.info("bbox for '" + ukjentBbox + "' koder.")
zoomlevels(typesystem.rotkode)
io.skrivDatafil(__filename, tre)

function readMbtiles() {
  let mbtiles = io.lesDatafil("inn_mbtiles")
  const r = {}
  Object.keys(mbtiles).forEach(mapfile => {
    const p = path.parse(mapfile)
    const url = p.dir
    if (!r[url]) r[url] = []
    r[url].push(mbtiles[mapfile])
  })
  return r
}

function avrund1d(num) {
  return Math.round(parseFloat(num) * 1000) / 1000
}

function avrund4d(bounds) {
  const bbox = bounds.split(",")
  const bboxjson = bbox.map(f => avrund1d(f))
  const ll = [bboxjson[1], bboxjson[0]]
  const ur = [bboxjson[3], bboxjson[2]]
  if (ll[0] > ur[0] || ll[1] > ur[1])
    throw new Error("Ugyldig bbox " + JSON.stringify(bboxjson))
  return [ll, ur]
}

function addKartformat() {
  Object.keys(tre).forEach(xkode => {
    const node = tre[xkode]
    const target = tre[xkode]
    const maps = mapfiles[node.url]
    if (!maps) return
    maps.forEach(mapfile => {
      if (".mbtiles.geojson".indexOf(path.extname(mapfile.filename)) < 0) return
      if (mapfile.filename.indexOf("3857") < 0) return
      if (!target.kart) target.kart = { format: {} }
      const format = target.kart.format
      const type = mapfile.filename.split(".").shift()
      if (!format[type]) format[type] = {}
      const cv = format[type]
      cv.url = config.webserver + node.url + "/" + mapfile.filename
      if (mapfile.maxzoom) {
        cv.zoom = [parseInt(mapfile.minzoom), parseInt(mapfile.maxzoom)]
      }
      cv.filnavn = mapfile.filename
      cv.størrelse = mapfile.size
      cv.oppdatert = mapfile.mtime
      if (mapfile.bounds) {
        // For now, no bounds for GeoJSON
        cv.zoom = [parseInt(mapfile.minzoom), parseInt(mapfile.maxzoom)]
        target.bbox = avrund4d(mapfile.bounds)
      }
      if (mapfile.format) cv.format = mapfile.format
    })
  })
}

// Regn ut fargeverdier for trinn i kartformat raster_gradient.mbtiles
function normaliserGradienter() {
  Object.keys(tre).forEach(kode => {
    const target = tre[kode]
    if (!target.kart) return
    const format = target.kart.format
    const rgrad = format["raster_gradient"]
    if (!rgrad) return
    const intervall = rgrad.intervall
    if (!intervall) return
    if (!intervall.original) {
      log.warn("Mangler opprinnelig intervall for " + kode)
      return
    }
    const barna = hierarki.barn[kode]
    barna.forEach(bkode => {
      const barn = tre[bkode]
      normaliserGradientTrinn(bkode, barn, rgrad)
    })
  })
}

function normaliserGradientTrinn(bkode, barn, rgrad) {
  if (barn.normalisertVerdi) {
    const bv = barn.normalisertVerdi
    if (!Array.isArray(bv)) barn.normalisertVerdi = [bv, bv + 1]
    return
  }
  const intervall = barn.intervall
  if (!intervall) return log.warn("Mangler intervall for " + bkode)
  if (Array.isArray(intervall)) return
  let { min, max } = intervall
  const [tmin, tmax] = rgrad.intervall.original
  min = Math.max(min, tmin)
  max = Math.min(max, tmax)
  intervall.min = min
  intervall.max = max
  const span = tmax - tmin
  const [nmin, nmax] = rgrad.intervall.normalisertVerdi
  const nrange = nmax - nmin
  const x1 = Math.trunc((nrange * (min - tmin)) / span) + nmin
  const x2 = Math.trunc((nrange * (max - tmin)) / span) + nmin
  barn.normalisertVerdi = [x1, x2]
}

function zoomlevels(kode, bbox, zoom) {
  if (!barnAv[kode]) return
  barnAv[kode].forEach(bkode => {
    const barn = tre[bkode]
    if (barn) {
      barn.bbox = barn.bbox || bbox
      barn.zoom = barn.zoom || zoom
      if (!barn) console.error(kode, bbox, zoom, barnAv[kode])
    }
  })
}