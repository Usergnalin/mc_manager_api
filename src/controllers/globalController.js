import { get_path } from "../utils.js"
import { validate as validate_uuid } from "uuid"
import { SERVER_STATUS, COMMAND_STATUS, AGENT_STATUS } from "../configs/constants.js"

// === Request handlers ===

const validation_logic = {
    username: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 63 ? trimmed : null
    },
    password: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 63 ? trimmed : null
    },
    team_name: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    team_id: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return validate_uuid(trimmed) ? trimmed : null
    },
    agent_name: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    agent_id: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return validate_uuid(trimmed) ? trimmed : null
    },
    command: (value) => {
        let payload
        if (typeof value === "string") {
            try {
                payload = JSON.parse(value)
            } catch (error) {
                return null
            }
        } else if (typeof value === "object") {
            payload = value
        } else {
            return null
        }
        return typeof payload !== "object" || payload === null ? null : payload
    },
    linking_code: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim().toLowerCase()
        if (trimmed.length === 0) return null
        const parts = trimmed.split("-")
        if (parts.length !== 4) return null
        if (parts.some((part) => part.length === 0)) return null
        return trimmed
    },
    public_key: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    server_name: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    properties: (value) => {
        let payload
        if (typeof value === "string") {
            try {
                payload = JSON.parse(value)
            } catch (error) {
                return null
            }
        } else if (typeof value === "object") {
            payload = value
        } else {
            return null
        }
        return typeof payload !== "object" || payload === null ? null : payload
    },
    server_id: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return validate_uuid(trimmed) ? trimmed : null
    },
    command_id: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return validate_uuid(trimmed) ? trimmed : null
    },
    status: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim().toLowerCase()
        if (!SERVER_STATUS.includes(trimmed)) return null
        return trimmed
    },
    command_status: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim().toLowerCase()
        if (!COMMAND_STATUS.includes(trimmed)) return null
        return trimmed
    },
    agent_status: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim().toLowerCase()
        if (!AGENT_STATUS.includes(trimmed)) return null
        return trimmed
    },
    mod_id: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return validate_uuid(trimmed) ? trimmed : null
    },
    file_name: (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
}

// export const load_body_data = ({ fields, data_path } = {}) => {
//     return (req, res, next) => {
//         if (req.body === undefined) {
//             return res.status(422).json({ message: "Missing body" })
//         }
//         res.locals[data_path] = res.locals[data_path] || {}
//         for (const field of fields) {
//             const raw_value = req.body[field]
//             if (raw_value === undefined) {
//                 return res.status(422).json({ message: `Missing ${field}` })
//             }
//             if (!validation_logic[field]) {
//                 console.error(`No validation logic for field "${field}"`)
//                 return res.status(500).json({ message: "Internal server error" })
//             }
//             const validated_value = validation_logic[field](raw_value)
//             if (validated_value === null) {
//                 return res.status(400).json({ message: `Invalid ${field}` })
//             }
//             res.locals[data_path][field] = validated_value
//         }
//         next()
//     }
// }

export const load_body_data = ({ fields, data_path, bulk = false } = {}) => {
    return (req, res, next) => {
        if (req.body === undefined) {
            return res.status(422).json({ message: "Missing body" })
        }

        const is_input_array = Array.isArray(req.body)

        if (is_input_array && !bulk) {
            return res.status(400).json({ message: "Bulk data not allowed" })
        }
        if (!is_input_array && bulk) {
            return res.status(400).json({ message: "Array of items expected" })
        }

        const items = is_input_array ? req.body : [req.body]
        const validated_items = []

        for (const [index, item] of items.entries()) {
            const current_validated = {}
            for (const field of fields) {
                const raw_value = item[field]
                
                if (raw_value === undefined) {
                    return res.status(422).json({ 
                        message: bulk ? `Item ${index}: Missing ${field}` : `Missing ${field}` 
                    })
                }

                const validated_value = validation_logic[field](raw_value)
                if (validated_value === null) {
                    return res.status(400).json({ 
                        message: bulk ? `Item ${index}: Invalid ${field}` : `Invalid ${field}` 
                    })
                }
                current_validated[field] = validated_value
            }
            validated_items.push(current_validated)
        }

        res.locals[data_path] = bulk ? validated_items : validated_items[0]
        next()
    }
}

export const load_param_data = ({ field, data_path } = {}) => {
    return (req, res, next) => {
        if (req.params === undefined) {
            return res.status(422).json({ message: "Missing params" })
        }
        const raw_value = req.params[field]
        if (raw_value === undefined) {
            return res.status(422).json({ message: `Missing param: ${field}` })
        }
        if (!validation_logic[field]) {
            console.error(`No validation logic for param "${field}"`)
            return res.status(500).json({ message: "Internal server error" })
        }
        const validated_value = validation_logic[field](raw_value)
        if (validated_value === null) {
            return res.status(400).json({ message: `Invalid ${field}` })
        }
        res.locals[data_path] = validated_value
        next()
    }
}

// === Response handlers ===

export const send_data = ({ data_path, status_code = 200 } = {}) => {
    return (req, res, next) => {
        const data = get_path(res, data_path)
        if (data === undefined) {
            console.error("No data found at path(s)", data_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        res.status(status_code).json(data)
    }
}

export const send_empty = () => {
    return (req, res, next) => {
        res.status(204).send()
    }
}
