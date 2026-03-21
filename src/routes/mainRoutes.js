const express = require("express")
const router = express.Router()
const userRoutes = require("./userRoutes")
const teamRoutes = require("./teamRoutes")
const agentRoutes = require("./agentRoutes")
const commandRoutes = require("./commandRoutes")
const serverRoutes = require("./serverRoutes")
const constants = require("../configs/constants")

router.use("/user", userRoutes)
router.use("/team", teamRoutes)
router.use("/agent", agentRoutes)
router.use("/command", commandRoutes)
router.use("/server", serverRoutes)

router.get("/constants", constants.read_constants)

module.exports = router
