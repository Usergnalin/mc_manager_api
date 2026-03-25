import express from "express"
const router = express.Router()
import * as session_handler from "../middlewares/sessionHandler.js"
import * as agent_auth_handler from "../middlewares/agentAuthHandler.js"
import * as global_controller from "../controllers/globalController.js"
import * as agent_controller from "../controllers/agentController.js"
import * as server_controller from "../controllers/serverController.js"
import * as mod_controller from "../controllers/modController.js"

// Create new mods (agent)
router.post(
    "/:server_id",
    agent_auth_handler.verify_agent_token(),
    global_controller.load_param_data({ field: "server_id", data_path: "server_id" }),
    server_controller.check_access_by_agent_id(),
    global_controller.load_body_data({
        fields: ["mod_id", "file_name"],
        data_path: "mod_data",
        bulk: true,
    }),
    mod_controller.create_mod({bulk: true}),
    global_controller.send_empty(),
)

// Get mods by server id (user)
router.get(
    "/server/:server_id",
    session_handler.verify_session_token(),
    global_controller.load_param_data({ field: "server_id", data_path: "server_id" }),
    server_controller.check_access_by_user_id_and_role({ role: ["admin", "user"] }),
    mod_controller.get_mod_by_server_id({ fields: ["mod_id", "file_name"]}),
    global_controller.send_data({ data_path: "mod_data" })
)

// Stream mods by server id (user)
router.get(
    "/server/:server_id/stream",
    session_handler.verify_session_token(),
    global_controller.load_param_data({ field: "server_id", data_path: "server_id" }),
    server_controller.check_access_by_user_id_and_role({ role: ["admin", "user"] }),
    mod_controller.stream_mod_by_server_id({fields: ["mod_id", "file_name"]}),
)

export default router
