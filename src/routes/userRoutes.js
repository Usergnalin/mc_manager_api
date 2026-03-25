import express from "express"
const router = express.Router()
import * as token_handler from "../middlewares/tokenHandler.js"
import * as password_handler from "../middlewares/passwordHandler.js"
import * as session_handler from "../middlewares/sessionHandler.js"
import * as global_controller from "../controllers/globalController.js"
import * as user_controller from "../controllers/userController.js"

// Create new user and login (user)
router.post(
    "/",
    global_controller.load_body_data({ fields: ["username", "password"], data_path: "user_data" }),
    password_handler.hash_password(),
    user_controller.create_user(),
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
    session_handler.create_session({ user_id_path: "user_data.user_id", output_session_id_path: "session_id" }),
    session_handler.generate_session_token({ user_id_path: "user_data.user_id", session_id_path: "session_id"}),
    global_controller.send_empty(),
)

// Refresh session (user)
router.post(
    "/refresh",
    session_handler.rotate_session({ output_user_id_path: "user_id", output_session_id_path: "session_id" }),
    session_handler.generate_session_token({ user_id_path: "user_id", session_id_path: "session_id"}),
    global_controller.send_empty()
)

// Logout (user)
router.post(
    "/logout",
    session_handler.verify_session_token(),
    session_handler.delete_session_by_session_id(),
    session_handler.delete_token_cookies(),
    global_controller.send_empty()
)

// Logout from all devices (user)
router.post(
    "/logoutall",
    session_handler.verify_session_token(),
    session_handler.delete_session_by_user_id(),
    session_handler.delete_token_cookies(),
    global_controller.send_empty()
)

// Get user by id (user)
router.get(
    "/",
    session_handler.verify_session_token(),
    user_controller.get_user_by_id({ fields: ["user_id", "username", "created_at"] }),
    global_controller.send_data({ data_path: "user_data" }),
)

// Update username by id (user)
router.put(
    "/",
    session_handler.verify_session_token(),
    global_controller.load_body_data({ fields: ["username"], data_path: "user_data" }),
    user_controller.update_user_by_id({ fields: ["username"] }),
    global_controller.send_empty(),
)

export default router
