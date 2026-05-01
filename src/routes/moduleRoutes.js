import express from 'express'
const router = express.Router()
import * as rate_limiter from '../providers/rateLimiter.js'
import * as session_handler from '../middlewares/sessionHandler.js'
import * as agent_auth_handler from '../middlewares/agentAuthHandler.js'
import * as global_controller from '../controllers/globalController.js'
import * as server_controller from '../controllers/serverController.js'
import * as module_controller from '../controllers/moduleController.js'

// Create new modules (agent)
router.post(
    '/:server_id',
    rate_limiter.normal,
    agent_auth_handler.verify_agent_token(),
    global_controller.load_param_data({field: 'server_id', data_path: 'server_id'}),
    server_controller.check_access_by_agent_id(),
    global_controller.load_body_data({
        fields: ['module_id', 'module_name', 'module_type', 'module_metadata', 'module_enabled'],
        data_path: 'module_data',
        bulk: true,
    }),
    module_controller.create_module(),
    global_controller.send_empty(),
)

// Get modules by server id (user)
router.get(
    '/server/:server_id',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'server_id', data_path: 'server_id'}),
    server_controller.check_access_by_user_id_and_role({role: ['admin', 'user']}),
    module_controller.get_module_by_server_id({fields: ['module_id', 'module_name', 'module_type', 'module_enabled', 'module_metadata', 'revision']}),
    global_controller.send_data({data_path: 'module_data'}),
)

// Update module module_enabled (agent)
router.patch(
    '/:module_id',
    rate_limiter.normal,
    agent_auth_handler.verify_agent_token(),
    global_controller.load_param_data({field: 'module_id', data_path: 'module_id'}),
    module_controller.check_access_by_agent_id(),
    global_controller.load_body_data({fields: ['module_enabled'], data_path: 'module_data'}),
    module_controller.update_by_module_id({fields: ['module_enabled']}),
    global_controller.send_empty(),
)

// Delete module by module id (agent)
router.delete(
    '/:module_id',
    rate_limiter.normal,
    agent_auth_handler.verify_agent_token(),
    global_controller.load_param_data({field: 'module_id', data_path: 'module_id'}),
    module_controller.check_access_by_agent_id(),
    module_controller.delete_module_by_module_id(),
    global_controller.send_empty(),
)

// Stream modules by server id (user)
router.get(
    '/server/:server_id/stream',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'server_id', data_path: 'server_id'}),
    server_controller.check_access_by_user_id_and_role({role: ['admin', 'user']}),
    module_controller.stream_module_by_server_id({fields: ['module_id', 'module_name', 'module_type', 'module_enabled', 'module_metadata']}),
)

export default router
