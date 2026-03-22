import { db_events } from "../services/events.js"
import * as command_model from "../models/commandModel.js"
import * as agent_model from "../models/agentModel.js"
import ms from "ms"
import { redis_client_presence } from "../services/redis.js"
import { get_path, set_path, filter_object, create_stream } from "../utils.js"
import { AGENT_HEARTBEAT_EXPIRY } from "../configs/constants.js"

const agent_heartbeat_expiry = ms(AGENT_HEARTBEAT_EXPIRY)

export const create_command = ({
    command_data_path = "command_data",
    agent_id_path = "agent_id",
    user_id_path = "user_id",
    output_command_data_path = "command_data",
} = {}) => {
    return (req, res, next) => {
        const { command } = get_path(res, command_data_path)
        const agent_id = get_path(res, agent_id_path)
        const user_id = get_path(res, user_id_path)
        if (command === undefined || agent_id === undefined || user_id === undefined) {
            console.error(
                "No data found at path(s):",
                command_data_path,
                agent_id_path,
                user_id_path,
            )
            return res.status(500).json({ message: "Internal server error" })
        }
        command_model.insert_single({ agent_id, user_id, command }, (error, results) => {
            if (error) {
                console.error("Error command_model insert_single:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            set_path(res, output_command_data_path, {
                command_id: results.command_id,
            })
            next()
        })
    }
}

export const get_command_by_agent_id_and_mark_sent = ({
    fields,
    agent_id_path = "agent_id",
    output_commands_path = "command_data",
} = {}) => {
    return (req, res, next) => {
        const agent_id = get_path(res, agent_id_path)
        if (agent_id === undefined) {
            console.error("No data found at path(s):", agent_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        command_model.select_by_agent_id_and_mark_sent({ agent_id }, fields, (error, results) => {
            if (error) {
                console.error("Error command_model select_by_agent_id_and_mark_sent:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            set_path(res, output_commands_path, results)
            next()
        })
    }
}

export const get_command_by_agent_id = ({
    fields,
    agent_id_path = "agent_id",
    output_command_data_path = "command_data",
} = {}) => {
    return (req, res, next) => {
        const agent_id = get_path(res, agent_id_path)
        if (agent_id === undefined) {
            console.error("No data found at path(s):", agent_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        command_model.select_by_agent_id({ agent_id }, fields, (error, results) => {
            if (error) {
                console.error("Error command_model select_by_agent_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            set_path(res, output_command_data_path, results)
            next()
        })
    }
}

export const update_by_command_id = ({
    fields,
    command_id_path = "command_id",
    command_data_path = "command_data",
} = {}) => {
    return (req, res, next) => {
        const command_id = get_path(res, command_id_path)
        const command_data = get_path(res, command_data_path)
        if (command_id === undefined || command_data === undefined) {
            console.error("No data found at path(s):", command_id_path, command_data_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        command_model.update_by_command_id(
            { command_id, ...command_data },
            fields,
            (error, results) => {
                if (error) {
                    console.error("Error command_model update_by_command_id:", error)
                    return res.status(500).json({ message: "Internal server error" })
                }
                if (results.affectedRows === 0) {
                    return res.status(404).json({ message: "Command not found" })
                }
                next()
            },
        )
    }
}

// module.exports.stream_command_by_agent_id = ({ fields, agent_id_path = "agent_id" } = {}) => {
//     return (req, res, next) => {
//         const agent_id = get_path(res, agent_id_path)
//         const session_expiry = res.locals.session_expiry
//         const stop_stream = () => {
//             clearInterval(keeper)
//             db_events.off(event_name, on_event)
//             res.end()
//         }
//         if (agent_id === undefined) {
//             console.error("No data found at path:", agent_id_path)
//             return res.status(500).json({ message: "Internal server error" })
//         }
//         res.setHeader('Content-Type', 'text/event-stream')
//         res.setHeader('Cache-Control', 'no-cache, no-transform')
//         res.setHeader('Connection', 'keep-alive')
//         res.setHeader('X-Accel-Buffering', 'no')
//         res.flushHeaders()
//         const event_name = `command:agent:${agent_id}`
//         const on_event = (payload) => {
//             if (session_expiry && Date.now() > session_expiry) {
//                 res.write(`data: {"message": "Session expired"}\n\n`)
//                 stop_stream()
//                 return
//             }
//             const parsed_payload = JSON.parse(payload)
//             const filtered_payload = JSON.stringify(filter_object(parsed_payload, fields))
//             res.write(`data: ${filtered_payload}\n\n`)
//         }
//         db_events.on(event_name, on_event)
//         res.write(': keep-alive\n\n')
//         const keeper = setInterval(() => {
//             if (session_expiry && Date.now() > session_expiry) {
//                 res.write(`data: {"message": "Session expired"}\n\n`)
//                 stop_stream()
//                 return
//             }
//             res.write(': keep-alive\n\n')
//         }, sse_keep_alive_interval)
//         req.on('close', stop_stream)
//     }
// }

export const stream_command_by_agent_id = ({ fields, agent_id_path = "agent_id" } = {}) => {
    return (req, res, next) => {
        const agent_id = get_path(res, agent_id_path)

        if (agent_id === undefined) {
            console.error("No data found at path:", agent_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }

        const event_name = `command:agent:${agent_id}`

        const on_event = (payload) => {
            try {
                const parsed_payload = JSON.parse(payload)
                const filtered_payload = filter_object(parsed_payload, fields)
                sse.send(filtered_payload)
            } catch (parse_error) {
                console.error("Payload parse error:", parse_error)
            }
        }

        const sse = create_stream(res, {
            session_expiry: res.locals.session_expiry,

            on_heartbeat: (stop) => {},

            on_close: () => {
                db_events.off(event_name, on_event)
            },
        })

        db_events.on(event_name, on_event)
    }
}

// module.exports.stream_command_by_agent_id_and_mark_sent = ({ fields, agent_id_path = "agent_id" } = {}) => {
//     return (req, res, next) => {
//         const agent_id = get_path(res, agent_id_path)
//         if (agent_id === undefined) {
//             console.error("No data found at path:", agent_id_path)
//             return res.status(500).json({ message: "Internal server error" })
//         }
//         agent_model.update_by_agent_id({ agent_id, "agent_status": "online" }, ["agent_status"], (error, results) => {
//             if (error) {
//                 console.error("Error agent_model update_by_agent_id:", error)
//                 return res.status(500).json({ message: "Internal server error" })
//             }
//             if (results.affectedRows === 0) {
//                 return res.status(404).json({ message: "Agent not found" })
//             }
//             const session_expiry = res.locals.session_expiry
//             const stop_stream = () => {
//                 clearInterval(keeper)
//                 db_events.off(event_name, on_event)
//                 res.end()
//             }
//             res.setHeader('Content-Type', 'text/event-stream')
//             res.setHeader('Cache-Control', 'no-cache, no-transform')
//             res.setHeader('Connection', 'keep-alive')
//             res.setHeader('X-Accel-Buffering', 'no')
//             res.flushHeaders()
//             const event_name = `create:command:agent:${agent_id}`
//             const on_event = (payload) => {
//                 if (session_expiry && Date.now() > session_expiry) {
//                     res.write(`data: {"message": "Session expired"}\n\n`)
//                     stop_stream()
//                     return
//                 }
//                 const parsed_payload = JSON.parse(payload)
//                 const { command_id } = parsed_payload
//                 const filtered_payload = JSON.stringify(filter_object(parsed_payload, fields))
//                 if (res.write(`data: ${filtered_payload}\n\n`)) {
//                     command_model.update_by_command_id({ command_id, "command_status": "sent" }, ["command_status"], (error, results) => {
//                         if (error) {
//                             console.error("Error command_model update_by_command_id:", error)
//                             res.write(`data: { "message": "Internal server error" }\n\n`)
//                             stop_stream()
//                             return
//                         }
//                     })
//                 }
//             }
//             db_events.on(event_name, on_event)
//             res.write(': keep-alive\n\n')
//             const keeper = setInterval(() => {
//                 if (session_expiry && Date.now() > session_expiry) {
//                     res.write(`data: {"message": "Session expired"}\n\n`)
//                     stop_stream()
//                     return
//                 }
//                 if (res.write(': keep-alive\n\n')) {
//                     redis_client_presence.set(`agent:presence:${agent_id}`, 1, {
//                         EX: agent_heartbeat_expiry / 1000
//                     }).catch(() => {
//                         stop_stream()
//                     })
//                 } else {
//                     stop_stream()
//                 }
//             }, sse_keep_alive_interval)
//             req.on('close', stop_stream)
//         })
//     }
// }

export const stream_command_by_agent_id_and_mark_sent = ({
    fields,
    agent_id_path = "agent_id",
} = {}) => {
    return (req, res, next) => {
        const agent_id = get_path(res, agent_id_path)

        if (agent_id === undefined) {
            console.error("No data found at path:", agent_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }

        agent_model.update_by_agent_id(
            { agent_id, agent_status: "online" },
            ["agent_status"],
            (error, results) => {
                if (error) {
                    console.error("Error agent_model update_by_agent_id:", error)
                    return res.status(500).json({ message: "Internal server error" })
                }

                if (results.affectedRows === 0) {
                    return res.status(404).json({ message: "Agent not found" })
                }

                const event_name = `create:command:agent:${agent_id}`

                const sse = create_stream(res, {
                    session_expiry: res.locals.session_expiry,
                    on_heartbeat: (stop) => {
                        redis_client_presence
                            .set(`agent:presence:${agent_id}`, 1, {
                                EX: agent_heartbeat_expiry / 1000,
                            })
                            .catch(stop)
                    },
                    on_close: () => {
                        db_events.off(event_name, on_event)
                    },
                })

                const on_event = (payload) => {
                    try {
                        const parsed_payload = JSON.parse(payload)
                        const { command_id } = parsed_payload
                        const filtered_payload = filter_object(parsed_payload, fields)
                        if (sse.send(filtered_payload)) {
                            command_model.update_by_command_id(
                                { command_id, command_status: "sent" },
                                ["command_status"],
                                (error, results) => {
                                    if (error) {
                                        console.error("Error updating command_status:", error)
                                    }
                                },
                            )
                        }
                    } catch (parse_error) {
                        console.error("Payload parse error:", parse_error)
                    }
                }
                db_events.on(event_name, on_event)
            },
        )
    }
}
