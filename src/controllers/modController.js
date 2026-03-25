import * as mod_model from "../models/modModel.js"
import { db_events } from "../services/events.js"
import { get_path, set_path, create_stream, filter_object } from "../utils.js"

export const create_mod = ({
    mod_data_path = "mod_data",
    server_id_path = "server_id",
    bulk = false,
} = {}) => {
    return (req, res, next) => {
        const mod_data = get_path(res, mod_data_path)
        const server_id = get_path(res, server_id_path)
        if (mod_data === undefined || server_id === undefined) {
            console.error("No data found at path(s):", mod_data_path, server_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        mod_model.insert(
            mod_data, server_id, bulk,
            (error, results) => {
                if (error) {
                    console.error("Error mod_model insert:", error)
                    return res.status(500).json({ message: "Internal server error" })
                }
                next()
            },
        )
    }
}

export const get_mod_by_server_id = ({
    fields,
    server_id_path = "server_id",
    output_mod_data_path = "mod_data",
} = {}) => {
    return (req, res, next) => {
        const server_id = get_path(res, server_id_path)
        if (server_id === undefined) {
            console.error("No data found at path(s):", server_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        mod_model.select_by_server_id({ server_id }, fields, (error, results) => {
            if (error) {
                console.error("Error mod_model select_by_server_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            set_path(res, output_mod_data_path, results)
            next()
        })
    }
}

export const stream_mod_by_server_id = ({ fields, server_id_path = "server_id", session_id_path = "session_id" } = {}) => {
    return (req, res, next) => {
        const server_id = get_path(res, server_id_path)
        const session_id = get_path(res, session_id_path)

        if (server_id === undefined, session_id === undefined) {
            console.error("No data found at path:", server_id_path, session_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }

        const event_names = [
            `create:mod:server:${server_id}`,
            `update:mod:server:${server_id}`,
            `delete:mod:server:${server_id}`
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