const server_model = require("../models/serverModel.js")
const { db_events } = require("../services/events")
const { get_path, set_path, create_stream, filter_object } = require("../utils.js")

module.exports.create_server = ({server_data_path = "server_data", agent_id_path = "agent_id"} = {}) => {
    return (req, res, next) => {
        const { server_id, server_name, properties } = get_path(res, server_data_path)
        const agent_id = get_path(res, agent_id_path)
        if (server_id === undefined || server_name === undefined || properties === undefined || agent_id === undefined) {
            console.error("No data found at path(s):", server_data_path, agent_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        server_model.insert_single({ server_id, server_name, properties, agent_id }, (error, results) => {
            if (error) {
                console.error("Error server_model insert_single:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            next()
        })
    }
}

module.exports.update_by_server_id = ({fields, server_id_path = "server_id", server_data_path = "server_data"} = {}) => {
    return (req, res, next) => {
        const server_id = get_path(res, server_id_path)
        const server_data = get_path(res, server_data_path)
        if (server_id === undefined || server_data === undefined) {
            console.error("No data found at path(s):", server_id_path, server_data_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        server_model.update_by_server_id({ server_id, ...server_data }, fields, (error, results) => {
            if (error) {
                console.error("Error server_model update_by_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            if (results.affectedRows === 0) {
                return res.status(404).json({ message: "Server not found" })
            }
            next()
        })
    }
}

module.exports.get_server_by_agent_id = ({fields, agent_id_path = "agent_id", output_server_data_path = "server_data"} = {}) => {
    return (req, res, next) => {
        const agent_id = get_path(res, agent_id_path)
        if (agent_id === undefined) {
            console.error("No data found at path(s):", agent_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        server_model.select_by_agent_id({agent_id}, fields, (error, results) => {
            if (error) {
                console.error("Error server_model select_by_agent_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            set_path(res, output_server_data_path, results)
            next()
        })
    }
}

module.exports.stream_server_by_agent_id = ({ fields, agent_id_path = "agent_id" } = {}) => {
    return (req, res, next) => {
        const agent_id = get_path(res, agent_id_path)

        if (agent_id === undefined) {
            console.error("No data found at path:", agent_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }

        const event_name = `server:agent:${agent_id}`

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

module.exports.check_access_by_agent_id = ({server_id_path = "server_id", agent_id_path = "agent_id"} = {}) => {
    return (req, res, next) => {
        const server_id = get_path(res, server_id_path)
        const agent_id = get_path(res, agent_id_path)
        if (server_id === undefined || agent_id === undefined) {
            console.error("No data found at path(s):", server_id_path, agent_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        server_model.check_access_by_agent_id({agent_id, server_id}, (error, results) => {
            if (error) {
                console.error("Error server_model check_access_by_agent_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            if (results[0].has_access === 0) {
                return res.status(403).json({ message: "Agent does not have access to this server" })
            }
            next()
        })
    }
}

module.exports.check_access_by_user_id = ({server_id_path = "server_id", user_id_path = "user_id"} = {}) => {
    return (req, res, next) => {
        const server_id = get_path(res, server_id_path)
        const user_id = get_path(res, user_id_path)
        if (server_id === undefined || user_id === undefined) {
            console.error("No data found at path(s):", server_id_path, user_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        server_model.check_access_by_user_id({user_id, server_id}, (error, results) => {
            if (error) {
                console.error("Error server_model check_access_by_user_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            if (results[0].has_access === 0) {
                return res.status(403).json({ message: "User does not have access to this server" })
            }
            next()
        })
    }
}

module.exports.get_server_by_id = ({fields, server_id_path = "server_id", output_server_data_path = "server_data"}) => {
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