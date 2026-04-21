import {db_events} from '../services/events.js'
import * as command_model from '../models/commandModel.js'
import * as agent_model from '../models/agentModel.js'
import logger from '../services/logger.js'
import ms from 'ms'
import {redis_client_presence} from '../services/redis.js'
import {get_path, set_path, filter_object, create_stream} from '../utils.js'
import {AGENT_HEARTBEAT_EXPIRY} from '../configs/constants.js'

const agent_heartbeat_expiry = ms(AGENT_HEARTBEAT_EXPIRY)

export const create_command = ({command_data_path = 'command_data', agent_id_path = 'agent_id', user_id_path = 'user_id', output_command_data_path = 'command_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const command_data = get_path(res, command_data_path)
            const agent_id = get_path(res, agent_id_path)
            const user_id = get_path(res, user_id_path)
            const results = await command_model.insert_single(agent_id, user_id, command_data)
            set_path(res, output_command_data_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const get_command_by_agent_id_and_mark_sent = ({fields, agent_id_path = 'agent_id', output_commands_path = 'command_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const agent_id = get_path(res, agent_id_path)
            const results = await command_model.select_by_agent_id_and_mark_sent(agent_id, fields)
            set_path(res, output_commands_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const get_command_by_agent_id = ({fields, agent_id_path = 'agent_id', output_command_data_path = 'command_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const agent_id = get_path(res, agent_id_path)
            const results = await command_model.select_by_agent_id(agent_id, fields)
            set_path(res, output_command_data_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const update_by_command_id = ({fields, command_id_path = 'command_id', command_data_path = 'command_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const command_id = get_path(res, command_id_path)
            const command_data = get_path(res, command_data_path)
            const results = await command_model.update_by_command_id(command_id, command_data, fields)
            if (results.affectedRows === 0) {
                return res.status(404).json({message: 'Command not found'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const stream_command_by_agent_id = ({fields, agent_id_path = 'agent_id', session_id_path = 'session_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const agent_id = get_path(res, agent_id_path)
            const session_id = get_path(res, session_id_path)

            const event_names = [`create:command:agent:${agent_id}`, `update:command:agent:${agent_id}`, `delete:command:agent:${agent_id}`]

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

export const stream_command_by_agent_id_and_mark_sent = ({fields, agent_id_path = 'agent_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const agent_id = get_path(res, agent_id_path)

            await agent_model.update_by_agent_id(agent_id, {agent_status: 'online'}, ['agent_status'])

            const event_names = [`create:command:agent:${agent_id}`]

            const subscriptions = new Map()

            const on_event = async (event, payload) => {
                try {
                    const action = event.split(':')[0]
                    const filtered_payload = {
                        ...filter_object(payload, fields),
                        _action: action,
                    }
                    if (sse.send(filtered_payload)) {
                        await command_model.update_by_command_id(payload.command_id, {command_status: 'sent'}, ['command_status'])
                    }
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
                on_heartbeat: (stop) => {
                    redis_client_presence
                        .set(`agent:presence:${agent_id}`, 1, {
                            EX: agent_heartbeat_expiry / 1000,
                        })
                        .catch(stop)
                },
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
