import express from 'express'
const router = express.Router()
import * as rate_limiter from '../services/rateLimiter.js'
import * as password_handler from '../middlewares/passwordHandler.js'
import * as session_handler from '../middlewares/sessionHandler.js'
import * as global_controller from '../controllers/globalController.js'
import * as user_controller from '../controllers/userController.js'

// Login (user)
router.post(
    '/login',
    rate_limiter.slow,
    global_controller.load_body_data({fields: ['username', 'password'], data_path: 'login_data'}),
    user_controller.get_user_by_username({fields: ['user_id', 'password'], username_path: 'login_data.username'}),
    password_handler.compare_password(),
    session_handler.create_session({user_id_path: 'user_data.user_id', output_session_id_path: 'session_id'}),
    session_handler.generate_session_token({user_id_path: 'user_data.user_id', session_id_path: 'session_id'}),
    global_controller.send_empty(),
)

// Refresh session (user)
router.post(
    '/refresh',
    rate_limiter.slow,
    session_handler.rotate_session({output_user_id_path: 'user_id', output_session_id_path: 'session_id'}),
    session_handler.generate_session_token({user_id_path: 'user_id', session_id_path: 'session_id'}),
    global_controller.send_empty(),
)

// Logout (user)
router.post(
    '/logout',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    session_handler.delete_session_by_session_id(),
    session_handler.delete_token_cookies(),
    global_controller.send_empty()
)

// Logout from all devices (user)
router.post(
    '/logoutall',
    rate_limiter.slow,
    session_handler.verify_session_token(),
    session_handler.delete_session_by_user_id(),
    session_handler.delete_token_cookies(),
    global_controller.send_empty()
)

export default router