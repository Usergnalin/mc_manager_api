import express from "express"
const router = express.Router()
import userRoutes from "./userRoutes.js"
import teamRoutes from "./teamRoutes.js"
import agentRoutes from "./agentRoutes.js"
import commandRoutes from "./commandRoutes.js"
import serverRoutes from "./serverRoutes.js"
import modRoutes from "./modRoutes.js"
import { read_constants } from "../configs/constants.js"

router.use("/user", userRoutes)
router.use("/team", teamRoutes)
router.use("/agent", agentRoutes)
router.use("/command", commandRoutes)
router.use("/server", serverRoutes)
router.use("/mod", modRoutes)

router.get("/constants", read_constants)

export default router
