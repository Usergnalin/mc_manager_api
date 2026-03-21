const express = require("express")
const router = express.Router()
const token_handler = require("../middlewares/tokenHandler")
const global_controller = require("../controllers/globalController")
const agent_controller = require("../controllers/agentController")
const command_controller = require("../controllers/commandController")

// Create new command (user)
router.post(
    "/:agent_id",
    token_handler.verify_token(),
    global_controller.load_param_data({field: "agent_id", data_path: "agent_id"}),
    global_controller.load_body_data({fields: ["command"], data_path: "command_data"}),
    agent_controller.check_access_by_user_id_and_role({role: ["admin", "user"]}),
    command_controller.create_command(),
    global_controller.send_data({data_path: "command_data"})
)

// Get all commands by agent id and mark sent (agent)
router.get(
    "/:agent_id",
    token_handler.verify_token({id_path: "agent_id"}),
    command_controller.get_command_by_agent_id_and_mark_sent({fields: ["command_id", "command"]}),
    global_controller.send_data({data_path: "command_data"})
)

// Stream queued commands by agent id and mark sent (agent)
router.get(
    "/:agent_id/stream",
    token_handler.verify_token({id_path: "agent_id"}),
    command_controller.stream_command_by_agent_id_and_mark_sent({fields: ["command_id", "command"]})
)

// Get commands details by agent id (user)
router.get(
    "/agent/:agent_id",
    token_handler.verify_token(),
    global_controller.load_param_data({field: "agent_id", data_path: "agent_id"}),
    agent_controller.check_access_by_user_id_and_role({role: ["admin", "user"]}),
    command_controller.get_command_by_agent_id({fields: ["command_id", "command", "command_status", "created_at", "updated_at"]}),
    global_controller.send_data({data_path: "command_data"})
)

// Stream commands by agent id (user)
router.get(
    "/agent/:agent_id/stream",
    token_handler.verify_token(),
    global_controller.load_param_data({field: "agent_id", data_path: "agent_id"}),
    agent_controller.check_access_by_user_id_and_role({role: ["admin", "user"]}),
    command_controller.stream_command_by_agent_id({fields: ["command_id", "command", "command_status", "created_at", "updated_at"]})
)

// Update command status (agent)
router.put(
    "/:command_id/status",
    token_handler.verify_token({id_path: "agent_id"}),
    global_controller.load_param_data({field: "command_id", data_path: "command_id"}),
    global_controller.load_body_data({fields: ["command_status"], data_path: "command_data"}),
    command_controller.update_by_command_id({fields: ["command_status"]}),
    global_controller.send_empty()
)

module.exports = router