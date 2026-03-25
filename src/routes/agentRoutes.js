import express from "express"
const router = express.Router()
import * as nonce_handler from "../middlewares/nonceHandler.js"
import * as session_handler from "../middlewares/sessionHandler.js"
import * as agent_auth_handler from "../middlewares/agentAuthHandler.js"
import * as global_controller from "../controllers/globalController.js"
import * as agent_controller from "../controllers/agentController.js"
import * as team_controller from "../controllers/teamController.js"

// Create new agent (agent)
router.post(
    "/",
    global_controller.load_body_data({
        fields: ["agent_name", "public_key"],
        data_path: "agent_data",
    }),
    global_controller.load_body_data({ fields: ["linking_code"], data_path: "linking_code" }),
    agent_controller.create_agent_by_linking_code(),
    global_controller.send_data({ data_path: "agent_data" }),
)

// Create linking code (user)
router.post(
    "/:team_id/link",
    session_handler.verify_session_token(),
    global_controller.load_param_data({ field: "team_id", data_path: "team_id" }),
    team_controller.check_access_by_user_id_and_role({ role: ["admin"] }),
    agent_controller.create_agent_linking_code(),
    global_controller.send_data({ data_path: "linking_code" }),
)

// Refresh agent token (agent)
router.get(
    "/:agent_id/refresh",
    nonce_handler.verify_nonce(),
    global_controller.load_param_data({ field: "agent_id", data_path: "agent_id" }),
    agent_controller.get_by_agent_id({ fields: ["public_key"] }),
    agent_auth_handler.verify_signature(),
    agent_auth_handler.generate_agent_token(),
)

// Get agents by team id (user)
router.get(
    "/team/:team_id",
    session_handler.verify_session_token(),
    global_controller.load_param_data({ field: "team_id", data_path: "team_id" }),
    team_controller.check_access_by_user_id_and_role({ role: ["admin", "user"] }),
    agent_controller.get_by_team_id({
        fields: ["agent_id", "agent_name", "agent_status", "updated_at"],
    }),
    global_controller.send_data({ data_path: "agent_data" }),
)

// Stream agents by team id (user)
router.get(
    "/team/:team_id/stream",
    session_handler.verify_session_token(),
    global_controller.load_param_data({ field: "team_id", data_path: "team_id" }),
    team_controller.check_access_by_user_id_and_role({ role: ["admin", "user"] }),
    agent_controller.stream_agent_by_team_id({
        fields: ["agent_id", "agent_name", "agent_status", "updated_at"],
    }),
)

// Update agent by agent id (agent)
router.put(
    "/",
    agent_auth_handler.verify_agent_token(),
    global_controller.load_body_data({ fields: ["agent_status"], data_path: "agent_data" }),
    agent_controller.update_by_agent_id({ fields: ["agent_status"] }),
    global_controller.send_empty()
)

export default router
