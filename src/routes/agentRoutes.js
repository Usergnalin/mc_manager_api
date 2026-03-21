const express = require("express")
const router = express.Router()
const token_handler = require("../middlewares/tokenHandler")
const nonce_handler = require("../middlewares/nonceHandler")
const agent_auth_handler = require("../middlewares/agentAuthHandler")
const global_controller = require("../controllers/globalController")
const agent_controller = require("../controllers/agentController")
const team_controller = require("../controllers/teamController")

// Create new agent (agent)
router.post(
    "/",
    global_controller.load_body_data({fields: ["agent_name", "public_key"], data_path: "agent_data"}),
    global_controller.load_body_data({fields: ["linking_code"], data_path: "linking_code"}),
    agent_controller.create_agent_by_linking_code(),
    global_controller.send_data({data_path: "agent_data"})
)

// Create linking code (user)
router.post(
    "/:team_id/link",
    token_handler.verify_token(),
    global_controller.load_param_data({field: "team_id", data_path: "team_id"}),
    team_controller.check_access_by_user_id_and_role({role: ["admin"]}),
    agent_controller.create_agent_linking_code(),
    global_controller.send_data({data_path: "linking_code"})
)

// Refresh agent token (agent)
router.get(
    "/:agent_id/refresh",
    nonce_handler.verify_nonce(),
    global_controller.load_param_data({field: "agent_id", data_path: "agent_id"}),
    agent_controller.get_by_agent_id({fields: ["public_key"]}),
    agent_auth_handler.verify_signature(),
    token_handler.generate_token({id_path: "agent_id"})
)

// Get agents by team id (user)
router.get(
    "/team/:team_id",
    token_handler.verify_token(),
    global_controller.load_param_data({field: "team_id", data_path: "team_id"}),
    team_controller.check_access_by_user_id_and_role({role: ["admin", "user"]}),
    agent_controller.get_by_team_id({fields: ["agent_id", "agent_name", "agent_status", "updated_at"]}),
    global_controller.send_data({data_path: "agent_data"})
)

// Stream agents by team id (user)
router.get(
    "/team/:team_id/stream",
    token_handler.verify_token(),
    global_controller.load_param_data({field: "team_id", data_path: "team_id"}),
    team_controller.check_access_by_user_id_and_role({role: ["admin", "user"]}),
    agent_controller.stream_agent_by_team_id({fields: ["agent_id", "agent_name", "agent_status", "updated_at"]})
)

module.exports = router