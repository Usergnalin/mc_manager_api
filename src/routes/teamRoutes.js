const express = require("express")
const router = express.Router()
const token_handler = require("../middlewares/tokenHandler")
const global_controller = require("../controllers/globalController")
const team_controller = require("../controllers/teamController")

// Create new team (user)
router.post(
    "/",
    token_handler.verify_token(),
    global_controller.load_body_data({fields: ["team_name"], data_path: "team_data"}),
    team_controller.create_team(),
    global_controller.send_data({data_path: "team_data"})
)

module.exports = router