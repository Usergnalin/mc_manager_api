const agent_model = require("../models/agentModel.js")
const { db_events } = require("../services/events")
const { redis_events } = require("../services/events")
const { get_path, set_path, create_stream, filter_object} = require("../utils.js")

redis_events.on('agent_expired', (agent_id) => {
    agent_model.update_by_agent_id({ agent_id, agent_status: 'offline' }, ['agent_status'], (error, results) => {
        if (error) {
            console.error("Error agent_model update_by_id:", error)
        }
    })
})

module.exports.create_agent_by_linking_code = ({agent_data_path = "agent_data", linking_code_path = "linking_code", output_agent_data_path = "agent_data"} = {}) => {
    return (req, res, next) => {
        const { agent_name, public_key } = get_path(res, agent_data_path)
        const { linking_code } = get_path(res, linking_code_path)
        if (agent_name === undefined || linking_code === undefined || public_key === undefined) {
            console.error("No data found at path(s):", agent_data_path, linking_code_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        agent_model.insert_by_linking_code({ agent_name, public_key, linking_code }, (error, results) => {
            if (error) {
                console.error("Error agent_model create_by_linking_code:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            if (results === null) {
                return res.status(403).json({ message: "Invalid linking code" })
            }
            set_path(res, output_agent_data_path, {
                agent_id: results.agent_id
            })
            next()
        })
    }
}

module.exports.create_agent_linking_code = ({team_id_path = "team_id", output_linking_code_path = "linking_code"} = {}) => {
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

module.exports.get_by_agent_id = ({fields, agent_id_path = "agent_id", output_agent_data_path = "agent_data"} = {}) => {
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

module.exports.get_by_team_id = ({fields, team_id_path = "team_id", output_agent_data_path = "agent_data"} = {}) => {
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

module.exports.stream_agent_by_team_id = ({ fields, team_id_path = "team_id" } = {}) => {
    return (req, res, next) => {
        const team_id = get_path(res, team_id_path)

        if (team_id === undefined) {
            console.error("No data found at path:", team_id)
            return res.status(500).json({ message: "Internal server error" })
        }

        const event_name = `agent:team:${team_id}`

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
            }
        })

        db_events.on(event_name, on_event)
    }
}

module.exports.check_access_by_user_id_and_role = ({agent_id_path = "agent_id", user_id_path = "user_id", role = []} = {}) => {
    return (req, res, next) => {
        const agent_id = get_path(res, agent_id_path)
        const user_id = get_path(res, user_id_path)
        if (agent_id === undefined || user_id === undefined) {
            console.error("No data found at path(s):", agent_id_path, user_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        agent_model.check_access_by_user_id_and_role({ agent_id, user_id, role }, (error, results) => {
            if (error) {
                console.error("Error agent_model check_access_by_user_id_and_role:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            if (results[0].has_access === 0) {
                return res.status(403).json({ message: "User does not have access to this agent" })
            }
            next()
        })
    }
}

