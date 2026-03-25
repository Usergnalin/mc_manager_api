import * as server_model from "../models/serverModel.js"
import { db_events } from "../services/events.js"
import { get_path, set_path, create_stream, filter_object } from "../utils.js"

export const create_server = ({
    server_data_path = "server_data",
    agent_id_path = "agent_id",
} = {}) => {
    return (req, res, next) => {
        const { server_id, server_name, properties } = get_path(res, server_data_path)
        const agent_id = get_path(res, agent_id_path)
        if (
            server_id === undefined ||
            server_name === undefined ||
            properties === undefined ||
            agent_id === undefined
        ) {
            console.error("No data found at path(s):", server_data_path, agent_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        server_model.insert_single(
            { server_id, server_name, properties, agent_id },
            (error, results) => {
                if (error) {
                    console.error("Error server_model insert_single:", error)
                    return res.status(500).json({ message: "Internal server error" })
                }
                next()
            },
        )
    }
}

export const update_by_server_id = ({
    fields,
    server_id_path = "server_id",
    server_data_path = "server_data",
} = {}) => {
    return (req, res, next) => {
        const server_id = get_path(res, server_id_path)
        const server_data = get_path(res, server_data_path)
        if (server_id === undefined || server_data === undefined) {
            console.error("No data found at path(s):", server_id_path, server_data_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        server_model.update_by_server_id(
            { server_id, ...server_data },
            fields,
            (error, results) => {
                if (error) {
                    console.error("Error server_model update_by_id:", error)
                    return res.status(500).json({ message: "Internal server error" })
                }
                if (results.affectedRows === 0) {
                    return res.status(404).json({ message: "Server not found" })
                }
                next()
            },
        )
    }
}

export const get_server_by_agent_id = ({
    fields,
    agent_id_path = "agent_id",
    output_server_data_path = "server_data",
} = {}) => {
    return (req, res, next) => {
        const agent_id = get_path(res, agent_id_path)
        if (agent_id === undefined) {
            console.error("No data found at path(s):", agent_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        server_model.select_by_agent_id({ agent_id }, fields, (error, results) => {
            if (error) {
                console.error("Error server_model select_by_agent_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            set_path(res, output_server_data_path, results)
            next()
        })
    }
}

export const stream_server_by_agent_id = ({ fields, agent_id_path = "agent_id", session_id_path = "session_id" } = {}) => {
    return (req, res, next) => {
        const agent_id = get_path(res, agent_id_path)
        const session_id = get_path(res, session_id_path)

        if (agent_id === undefined, session_id === undefined) {
            console.error("No data found at path:", agent_id_path, session_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }

        const event_names = [
            `create:server:agent:${agent_id}`,
            `update:server:agent:${agent_id}`,
            `delete:server:agent:${agent_id}`
        ]

        const subscriptions = new Map()

        const on_event = (event, payload) => {
            try {
                const action = event.split(':')[0]
                const parsed_payload = JSON.parse(payload)
                const filtered_payload = { 
                    ...filter_object(parsed_payload, fields), 
                    _action: action 
                }
                sse.send(filtered_payload)
            } catch (parse_error) {
                console.error("Payload parse error:", parse_error)
            }
        }

        const sse = create_stream(res, {
            session_expiry: res.locals.session_expiry,
            session_id: session_id,
            on_heartbeat: (stop) => {},
            on_close: () => {
                subscriptions.forEach((handler, event) => {
                    db_events.off(event, handler)
                })
                subscriptions.clear()
            },
        })

        event_names.forEach(event => {
            const handler = (payload) => on_event(event, payload)
            subscriptions.set(event, handler)
            db_events.on(event, handler)
        })
    }
}

export const check_access_by_agent_id = ({
    server_id_path = "server_id",
    agent_id_path = "agent_id",
} = {}) => {
    return (req, res, next) => {
        const server_id = get_path(res, server_id_path)
        const agent_id = get_path(res, agent_id_path)
        if (server_id === undefined || agent_id === undefined) {
            console.error("No data found at path(s):", server_id_path, agent_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        server_model.check_access_by_agent_id({ agent_id, server_id }, (error, results) => {
            if (error) {
                console.error("Error server_model check_access_by_agent_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            if (results[0].has_access === 0) {
                return res
                    .status(403)
                    .json({ message: "Agent does not have access to this server" })
            }
            next()
        })
    }
}

export const check_access_by_user_id_and_role = ({
    server_id_path = "server_id",
    user_id_path = "user_id",
    role = [],
} = {}) => {
    return (req, res, next) => {
        const server_id = get_path(res, server_id_path)
        const user_id = get_path(res, user_id_path)
        if (server_id === undefined || user_id === undefined) {
            console.error("No data found at path(s):", server_id_path, user_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        server_model.check_access_by_user_id_and_role({ user_id, server_id, role }, (error, results) => {
            if (error) {
                console.error("Error server_model check_access_by_user_id_and_role:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            if (results[0].has_access === 0) {
                return res.status(403).json({ message: "User does not have access to this server" })
            }
            next()
        })
    }
}

export const get_server_by_id = ({
    fields,
    server_id_path = "server_id",
    output_server_data_path = "server_data",
}) => {
    return (req, res, next) => {
        if (!Array.isArray(fields)) {
            console.error("Invalid fields:", fields)
            return res.status(500).json({ message: "Internal server error" })
        }
        const server_id = get_path(res, server_id_path)
        if (server_id === undefined) {
            console.error("No data found at path(s):", server_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        server_model.select_by_server_id({ server_id }, fields, (error, results) => {
            if (error) {
                console.error("Error server_model select_by_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            if (results.length === 0) {
                return res.status(404).json({ message: "Server not found" })
            }
            set_path(res, output_server_data_path, results[0])
            next()
        })
    }
}
