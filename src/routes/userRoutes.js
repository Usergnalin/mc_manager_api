import express from "express"
const router = express.Router()
import * as token_handler from "../middlewares/tokenHandler.js"
import * as password_handler from "../middlewares/passwordHandler.js"
import * as global_controller from "../controllers/globalController.js"
import * as user_controller from "../controllers/userController.js"

// Create new user and login (user)
router.post(
    "/",
    global_controller.load_body_data({ fields: ["username", "password"], data_path: "user_data" }),
    password_handler.hash_password(),
    user_controller.create_user(),
    token_handler.generate_token_cookie({ id_path: "user_team_data.user_id" }),
    global_controller.send_data({ data_path: "user_team_data" }),
)

// Login (user)
router.post(
    "/login",
    global_controller.load_body_data({ fields: ["username", "password"], data_path: "login_data" }),
    user_controller.get_user_by_username({
        fields: ["user_id", "password"],
        username_path: "login_data.username",
    }),
    password_handler.compare_password(),
    token_handler.generate_token_cookie({ id_path: "user_data.user_id" }),
    global_controller.send_empty(),
)

// Get user by id (user)
router.get(
    "/",
    token_handler.verify_token(),
    user_controller.get_user_by_id({ fields: ["user_id", "username", "created_at"] }),
    global_controller.send_data({ data_path: "user_data" }),
)

// Update username by id (user)
router.put(
    "/",
    token_handler.verify_token(),
    global_controller.load_body_data({ fields: ["username"], data_path: "user_data" }),
    user_controller.update_user_by_id({ fields: ["username"] }),
    global_controller.send_empty(),
)

export default router
