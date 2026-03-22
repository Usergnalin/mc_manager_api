import bcrypt from "bcrypt"
import zxcvbn from "zxcvbn"
import { PASSWORD_MIN_SCORE } from "../configs/constants.js"
import { get_path, set_path } from "../utils.js"

export const compare_password = ({
    input_password_path = "login_data.password",
    stored_hash_path = "user_data.password",
} = {}) => {
    return (req, res, next) => {
        const input_password = get_path(res, input_password_path)
        set_path(res, input_password_path, null)
        const stored_hash = get_path(res, stored_hash_path)
        if (input_password === undefined || stored_hash === undefined) {
            console.error("No data found at path(s):", input_password_path, stored_hash_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        bcrypt.compare(input_password, stored_hash, (error, match) => {
            if (error) {
                console.error("Error bcrypt:", error)
                res.status(500).json({ message: "Internal server error" })
            } else {
                if (match) {
                    next()
                } else {
                    return res.status(401).json({ message: "Username or Password incorrect" })
                }
            }
        })
    }
}

export const hash_password = ({
    password_path = "user_data.password",
    hash_path = "user_data.password",
} = {}) => {
    return (req, res, next) => {
        const password = get_path(res, password_path)
        set_path(res, password_path, null)
        if (password === undefined) {
            console.error("No data found at path(s):", password_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        if (zxcvbn(password).score < PASSWORD_MIN_SCORE) {
            return res.status(400).json({ message: "Password too weak" })
        }
        const rounds = parseInt(process.env.SALT_ROUNDS)
        bcrypt.hash(password, rounds, (error, hash) => {
            if (error) {
                console.error("Error bcrypt:", error)
                res.status(500).json({ message: "Internal server error" })
            } else {
                set_path(res, hash_path, hash)
                next()
            }
        })
    }
}
