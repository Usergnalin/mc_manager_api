import * as agent_model from "../models/agentModel.js"
import { db_events } from "../services/events.js"
import { redis_events } from "../services/events.js"
import { get_path, set_path, create_stream, filter_object } from "../utils.js"

redis_events.on("agent_expired", (agent_id) => {
    agent_model.update_by_agent_id(
        { agent_id, agent_status: "offline" },
        ["agent_status"],
        (error, results) => {
            if (error) {
                console.error("Error agent_model update_by_id:", error)
            }
        },
    )
})

export const create_agent_by_linking_code = ({
    agent_data_path = "agent_data",
    linking_code_path = "linking_code",
    output_agent_data_path = "agent_data",
} = {}) => {
    return (req, res, next) => {
        const { agent_name, public_key } = get_path(res, agent_data_path)
        const { linking_code } = get_path(res, linking_code_path)
        if (agent_name === undefined || linking_code === undefined || public_key === undefined) {
            console.error("No data found at path(s):", agent_data_path, linking_code_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        agent_model.insert_by_linking_code(
            { agent_name, public_key, linking_code },
            (error, results) => {
                if (error) {
                    console.error("Error agent_model create_by_linking_code:", error)
                    return res.status(500).json({ message: "Internal server error" })
                }
                if (results === null) {
                    return res.status(403).json({ message: "Invalid linking code" })
                }
                set_path(res, output_agent_data_path, {
                    agent_id: results.agent_id,
                })
                next()
            },
        )
    }
}

export const create_agent_linking_code = ({
    team_id_path = "team_id",
    output_linking_code_path = "linking_code",
} = {}) => {
    return (req, res, next) => {
        const team_id = get_path(res, team_id_path)
        if (team_id === undefined) {
            console.error("No data found at path(s):", team_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        agent_model.create_linking_code({ team_id }, (error, results) => {
            if (error) {
                console.error("Error agent_model create_linking_code:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            set_path(res, output_linking_code_path, results.linking_code)
            next()
        })
    }
}

export const update_by_agent_id = ({
    fields,
    agent_id_path = "agent_id",
    agent_data_path = "agent_data"
} = {}) => {
    return (req, res, next) => {
        if (!Array.isArray(fields)) {
            console.error("Invalid fields:", fields)
        }
        const agent_id = get_path(res, agent_id_path)
        const agent_data = get_path(res, agent_data_path)
        if (agent_id === undefined || agent_data === undefined) {
            console.error("No data found at path(s):", agent_id_path, agent_data_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        agent_model.update_by_agent_id({ agent_id, ...agent_data }, fields, (error, results) => {
            if (error) {
                console.error("Error agent_model update_by_agent_id:", error)
            }
            if (results.affectedRows === 0) {
                return res.status(404).json({ message: "Agent not found" })
            }
            next()
        })
    }
}

export const get_by_agent_id = ({
    fields,
    agent_id_path = "agent_id",
    output_agent_data_path = "agent_data",
} = {}) => {
    return (req, res, next) => {
        if (!Array.isArray(fields)) {
            console.error("Invalid fields:", fields)
        }
        const agent_id = get_path(res, agent_id_path)
        if (agent_id === undefined) {
            console.error("No data found at path(s):", agent_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        agent_model.select_by_agent_id({ agent_id }, fields, (error, results) => {
            if (error) {
                console.error("Error agent_model select_by_agent_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            if (results.length === 0) {
                return res.status(404).json({ message: "Agent not found" })
            }
            set_path(res, output_agent_data_path, results[0])
            next()
        })
    }
}

export const get_by_team_id = ({
    fields,
    team_id_path = "team_id",
    output_agent_data_path = "agent_data",
} = {}) => {
    return (req, res, next) => {
        if (!Array.isArray(fields)) {
            console.error("Invalid fields:", fields)
        }
        const team_id = get_path(res, team_id_path)
        if (team_id === undefined) {
            console.error("No data found at path(s):", team_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        agent_model.select_by_team_id({ team_id }, fields, (error, results) => {
            if (error) {
                console.error("Error agent_model select_by_team_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            set_path(res, output_agent_data_path, results)
            next()
        })
    }
}

export const stream_agent_by_team_id = ({ fields, team_id_path = "team_id", session_id_path = "session_id"} = {}) => {
    return (req, res, next) => {
        const team_id = get_path(res, team_id_path)
        const session_id = get_path(res, session_id_path)

        if (team_id === undefined, session_id === undefined) {
            console.error("No data found at path:", team_id_path, session_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }

        const event_names = [
            `create:agent:team:${team_id}`,
            `update:agent:team:${team_id}`,
            `delete:agent:team:${team_id}`
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

export const check_access_by_user_id_and_role = ({
    agent_id_path = "agent_id",
    user_id_path = "user_id",
    role = [],
} = {}) => {
    return (req, res, next) => {
        const agent_id = get_path(res, agent_id_path)
        const user_id = get_path(res, user_id_path)
        if (agent_id === undefined || user_id === undefined) {
            console.error("No data found at path(s):", agent_id_path, user_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        agent_model.check_access_by_user_id_and_role(
            { agent_id, user_id, role },
            (error, results) => {
                if (error) {
                    console.error("Error agent_model check_access_by_user_id_and_role:", error)
                    return res.status(500).json({ message: "Internal server error" })
                }
                if (results[0].has_access === 0) {
                    return res
                        .status(403)
                        .json({ message: "User does not have access to this agent" })
                }
                next()
            },
        )
    }
}
