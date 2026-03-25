import express from "express"
const router = express.Router()
import * as session_handler from "../middlewares/sessionHandler.js"
import * as global_controller from "../controllers/globalController.js"
import * as team_controller from "../controllers/teamController.js"

// Create new team (user)
router.post(
    "/",
    session_handler.verify_session_token(),
    global_controller.load_body_data({ fields: ["team_name"], data_path: "team_data" }),
    team_controller.create_team(),
    global_controller.send_data({ data_path: "team_data" }),
)

export default router
