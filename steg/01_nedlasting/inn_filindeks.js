const { http, log } = require("lastejobb")
const config = require("../../config")

// Laster ned bounding bokser for koder
http.downloadJson(config.datakilde.filindeks, "filindeks.json").catch(err => {
  log.fatal(err)
})
