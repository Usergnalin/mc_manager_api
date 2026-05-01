import {logs_events} from '../providers/events.js'
import * as command_model from '../models/commandModel.js'
import * as server_model from '../models/serverModel.js'
import {v7 as uuid} from 'uuid'
import {get_path, create_stream} from '../utils.js'
import logger from '../providers/logger.js'

export const stream_logs_by_server_id = ({server_id_path = 'server_id', session_id_path = 'session_id', user_id_path = 'user_id', logs_history_lines_path = 'logs_history_lines'} = {}) => {
    return async (req, res, next) => {
        try {
            const server_id = get_path(res, server_id_path)
            const session_id = get_path(res, session_id_path)
            const user_id = get_path(res, user_id_path)
            const logs_history_lines = get_path(res, logs_history_lines_path)
            const request_id = uuid()

            const select_results = await server_model.select_by_server_id(server_id, ['agent_id'])

            const agent_id = select_results.agent_id

            await command_model.insert_single(agent_id, user_id, {
                command: {
                    type: 'start_server_log_stream',
                    logs_history_lines: logs_history_lines,
                    request_id: request_id,
                    server_id: server_id,
                },
            })

            const event_names = [`log:server:${server_id}`]

            const subscriptions = new Map()

            const on_event = (event, payload) => {
                try {
                    sse.send(payload)
                } catch (error) {
                    logger.error({err: error, event: event}, 'Error SSE on_event')
                }
            }

            const on_close = async () => {
                subscriptions.forEach((handler, event) => {
                    logs_events.off(event, handler)
                })
                subscriptions.clear()
                try {
                    await command_model.insert_single(agent_id, user_id, {
                        command: {
                            type: 'stop_server_log_stream',
                            request_id: request_id,
                            server_id: server_id,
                        },
                    })
                } catch (error) {
                    logger.error({err: error}, 'Error on sending stop log command')
                }
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
                logs_events.on(event, handler)
            })
        } catch (error) {
            next(error)
        }
    }
}

export const stream_logs_by_agent_id = ({agent_id_path = 'agent_id', session_id_path = 'session_id', user_id_path = 'user_id', logs_history_lines_path = 'logs_history_lines'} = {}) => {
    return async (req, res, next) => {
        try {
            const agent_id = get_path(res, agent_id_path)
            const session_id = get_path(res, session_id_path)
            const user_id = get_path(res, user_id_path)
            const logs_history_lines = get_path(res, logs_history_lines_path)
            const request_id = uuid()

            await command_model.insert_single(agent_id, user_id, {
                command: {
                    type: 'start_agent_log_stream',
                    logs_history_lines: logs_history_lines,
                    request_id: request_id,
                },
            })

            const event_names = [`log:agent:${agent_id}`]

            const subscriptions = new Map()

            const on_event = (event, payload) => {
                try {
                    sse.send(payload)
                } catch (error) {
                    logger.error({err: error, event: event}, 'Error SSE on_event')
                }
            }

            const on_close = async () => {
                subscriptions.forEach((handler, event) => {
                    logs_events.off(event, handler)
                })
                subscriptions.clear()
                try {
                    await command_model.insert_single(agent_id, user_id, {
                        command: {
                            type: 'stop_agent_log_stream',
                            request_id: request_id,
                        },
                    })
                } catch (error) {
                    logger.error({err: error}, 'Error on sending stop log command')
                }
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
                logs_events.on(event, handler)
            })
        } catch (error) {
            next(error)
        }
    }
}

export const create_server_log = ({log_data_path = 'log_data', server_id_path = 'server_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const log_data = get_path(res, log_data_path)
            const server_id = get_path(res, server_id_path)
            logs_events.emit(`log:server:${server_id}`, log_data)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const create_agent_log = ({log_data_path = 'log_data', agent_id_path = 'agent_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const log_data = get_path(res, log_data_path)
            const agent_id = get_path(res, agent_id_path)
            logs_events.emit(`log:agent:${agent_id}`, log_data)
            next()
        } catch (error) {
            next(error)
        }
    }
}
