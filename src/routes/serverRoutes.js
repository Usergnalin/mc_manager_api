import express from "express"
const router = express.Router()
import * as token_handler from "../middlewares/tokenHandler.js"
import * as global_controller from "../controllers/globalController.js"
import * as agent_controller from "../controllers/agentController.js"
import * as server_controller from "../controllers/serverController.js"

// Create new server (agent)
router.post(
    "/",
    token_handler.verify_token({ id_path: "agent_id" }),
    global_controller.load_body_data({
        fields: ["server_id", "server_name", "properties"],
        data_path: "server_data",
    }),
    server_controller.create_server(),
    global_controller.send_empty(),
)

// Update server status (agent)
router.put(
    "/:server_id/status",
    token_handler.verify_token({ id_path: "agent_id" }),
    global_controller.load_param_data({ field: "server_id", data_path: "server_id" }),
    global_controller.load_body_data({ fields: ["status"], data_path: "server_data" }),
    server_controller.check_access_by_agent_id(),
    server_controller.update_by_server_id({ fields: ["status"] }),
    global_controller.send_empty(),
)

// Update server properties (agent)
router.put(
    "/:server_id/properties/agent",
    token_handler.verify_token({ id_path: "agent_id" }),
    global_controller.load_param_data({ field: "server_id", data_path: "server_id" }),
    global_controller.load_body_data({ fields: ["properties"], data_path: "server_data" }),
    server_controller.check_access_by_agent_id(),
    server_controller.update_by_server_id({ fields: ["properties"] }),
    global_controller.send_empty(),
)

// Get server details by server id (user)
router.get(
    "/:server_id",
    token_handler.verify_token(),
    global_controller.load_param_data({ field: "server_id", data_path: "server_id" }),
    server_controller.check_access_by_user_id(),
    server_controller.get_server_by_id({ fields: ["server_name", "properties", "status"] }),
    global_controller.send_data({ data_path: "server_data" }),
)

// Get server details by agent id (user)
router.get(
    "/agent/:agent_id",
    token_handler.verify_token(),
    global_controller.load_param_data({ field: "agent_id", data_path: "agent_id" }),
    agent_controller.check_access_by_user_id_and_role({ role: ["admin", "user"] }),
    server_controller.get_server_by_agent_id({
        fields: ["server_id", "server_name", "status", "properties", "updated_at"],
    }),
    global_controller.send_data({ data_path: "server_data" }),
)

// Stream server details by agent id (user)
router.get(
    "/agent/:agent_id/stream",
    token_handler.verify_token(),
    global_controller.load_param_data({ field: "agent_id", data_path: "agent_id" }),
    agent_controller.check_access_by_user_id_and_role({ role: ["admin", "user"] }),
    server_controller.stream_server_by_agent_id({
        fields: ["server_id", "server_name", "status", "properties", "updated_at"],
    }),
)

export default router
