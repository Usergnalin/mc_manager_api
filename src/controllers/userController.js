const user_model = require("../models/userModel.js")
const { get_path, set_path } = require("../utils.js")

// === Database operations ===

module.exports.create_user = ({user_data_path = "user_data", output_user_team_data_path = "user_team_data"} = {}) => {
    return (req, res, next) => {
        const { username, password } = get_path(res, user_data_path)
        if (username === undefined || password === undefined) {
            console.error("No data found at path(s):", user_data_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        user_model.insert_single({ username, password }, (error, results) => {
            if (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({ message: "Username already exists" })
                } else {
                    console.error("Error user_model insert_single:", error)
                    return res.status(500).json({ message: "Internal server error" })
                }
            }
            set_path(res, output_user_team_data_path, {
                user_id: results.user_id,
                team_id: results.team_id,
                slug: results.slug
            })
            next()
        })
    }
}

module.exports.get_user_by_id = ({fields, user_id_path = "user_id", user_data_path = "user_data"} = {}) => {
    return (req, res, next) => {
        if (!Array.isArray(fields)) {
            console.error("Invalid fields:", fields)
            return res.status(500).json({ message: "Internal server error" })
        }
        const user_id = get_path(res, user_id_path)
        if (user_id === undefined) {
            console.error("No data found at path(s):", user_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        user_model.select_by_id({ user_id }, fields, (error, results) => {
            if (error) {
                console.error("Error user_model select_by_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            if (results.length === 0) {
                return res.status(404).json({ message: "User not found" })
            }
            set_path(res, user_data_path, results[0])
            next()
        })
    }
}

module.exports.get_user_by_username = ({fields, username_path = "user_data.username", user_data_path = "user_data"} = {}) => {
    return (req, res, next) => {
        if (!Array.isArray(fields)) {
            console.error("Invalid fields:", fields)
            return res.status(500).json({ message: "Internal server error" })
        }
        const username = get_path(res, username_path)
        if (username === undefined) {
            console.error("No data found at path(s):", username_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        user_model.select_by_username({ username }, fields, (error, results) => {
            if (error) {
                console.error("Error user_model select_by_username:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            if (results.length === 0) {
                return res.status(404).json({ message: "User not found" })
            }
            set_path(res, user_data_path, results[0])
            next()
        })
    }
}

module.exports.update_user_by_id = ({fields, user_id_path = "user_id", user_data_path = "user_data"} = {}) => {
    return (req, res, next) => {
        if (!Array.isArray(fields)) {
            console.error("Invalid fields:", fields)
            return res.status(500).json({ message: "Internal server error" })
        }
        const user_id = get_path(res, user_id_path)
        const user_data = get_path(res, user_data_path)
        if (user_id === undefined || user_data === undefined) {
            console.error("No data found at path(s):", user_id_path, user_data_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        user_model.update_by_id({user_id, ...user_data}, fields, (error, results) => {
            if (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({ message: "Username already exists" })
                } else {
                    console.error("Error user_model update_by_id:", error)
                    return res.status(500).json({ message: "Internal server error" })
                }
            }
            if (results.affectedRows === 0) {
                return res.status(404).json({ message: "User not found" })
            }
            next()
        })
    }
}