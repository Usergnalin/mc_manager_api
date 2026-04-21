import * as module_model from '../models/moduleModel.js'
import {db_events} from '../services/events.js'
import {get_path, set_path, create_stream, filter_object} from '../utils.js'
import logger from '../services/logger.js'

export const create_module = ({module_data_path = 'module_data', server_id_path = 'server_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const module_data = get_path(res, module_data_path)
            const server_id = get_path(res, server_id_path)
            await module_model.insert(module_data, server_id)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const get_module_by_server_id = ({fields, server_id_path = 'server_id', output_module_data_path = 'module_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const server_id = get_path(res, server_id_path)
            const results = await module_model.select_by_server_id(server_id, fields)
            set_path(res, output_module_data_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const update_by_module_id = ({fields, module_id_path = 'module_id', module_data_path = 'module_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const module_id = get_path(res, module_id_path)
            const module_data = get_path(res, module_data_path)
            const results = await module_model.update_by_module_id(module_id, module_data, fields)
            if (results.affectedRows === 0) {
                return res.status(404).json({message: 'Module not found'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const check_access_by_user_id_and_role = ({module_id_path = 'module_id', user_id_path = 'user_id', role = []} = {}) => {
    return async (req, res, next) => {
        try {
            const module_id = get_path(res, module_id_path)
            const user_id = get_path(res, user_id_path)
            const results = await module_model.check_access_by_user_id_and_role(module_id, user_id, role)
            if (!results.user_exists) {
                return res.status(404).json({message: 'User not found'})
            }
            if (!results.module_exists) {
                return res.status(404).json({message: 'Module not found'})
            }
            if (!results.has_access) {
                return res.status(403).json({message: 'User does not have access to this module'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const check_access_by_agent_id = ({module_id_path = 'module_id', agent_id_path = 'agent_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const module_id = get_path(res, module_id_path)
            const agent_id = get_path(res, agent_id_path)
            const results = await module_model.check_access_by_agent_id(module_id, agent_id)
            if (!results.agent_exists) {
                return res.status(404).json({message: 'Agent not found'})
            }
            if (!results.module_exists) {
                return res.status(404).json({message: 'Module not found'})
            }
            if (!results.has_access) {
                return res.status(403).json({message: 'Agent does not have access to this module'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const delete_module_by_module_id = ({module_id_path = 'module_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const module_id = get_path(res, module_id_path)
            await module_model.delete_by_module_id(module_id)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const stream_module_by_server_id = ({fields, server_id_path = 'server_id', session_id_path = 'session_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const server_id = get_path(res, server_id_path)
            const session_id = get_path(res, session_id_path)

            const event_names = [`create:module:server:${server_id}`, `update:module:server:${server_id}`, `delete:module:server:${server_id}`]

            const subscriptions = new Map()

            const on_event = (event, payload) => {
                try {
                    const action = event.split(':')[0]
                    const filtered_payload = {
                        ...filter_object(payload, fields),
                        _action: action,
                    }
                    sse.send(filtered_payload)
                } catch (error) {
                    logger.error({err: error, event: event}, 'Error SSE on_event')
                }
            }

            const on_close = () => {
                subscriptions.forEach((handler, event) => {
                    db_events.off(event, handler)
                })
                subscriptions.clear()
            }

            const sse = create_stream(res, {
                session_expiry: res.locals.session_expiry,
                session_id,
                on_heartbeat: (_stop) => {},
                on_close,
            })
            event_names.forEach((event) => {
                const handler = (payload) => on_event(event, payload)
                subscriptions.set(event, handler)
                db_events.on(event, handler)
            })
        } catch (error) {
            next(error)
        }
    }
}
