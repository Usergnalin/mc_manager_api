import jwt from "jsonwebtoken"
import ms from "ms"
import { get_path, set_path } from "../utils.js"

const token_secret = process.env.TOKEN_SECRET
const user_token_duration = process.env.USER_TOKEN_DURATION
const agent_token_duration = process.env.AGENT_TOKEN_DURATION
const token_algorithm = process.env.TOKEN_ALGORITHM

export const generate_token_cookie = ({ id_path = "user_id" } = {}) => {
    return (req, res, next) => {
        const id = get_path(res, id_path)
        if (id === undefined) {
            console.error("No data found at path(s):", id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        const payload = {
            id: id,
        }
        const options = {
            algorithm: token_algorithm,
            expiresIn: user_token_duration,
        }
        jwt.sign(payload, token_secret, options, (error, token) => {
            if (error) {
                console.error("Error jwt:", error)
                res.status(500).json({ message: "Internal server error" })
            } else {
                res.cookie("access_token", token, {
                    path: "/api",
                    httpOnly: true,
                    secure: true,
                    sameSite: "strict",
                    maxAge: ms(user_token_duration),
                })
                next()
            }
        })
    }
}

export const generate_token = ({ id_path = "agent_id" } = {}) => {
    return (req, res, next) => {
        const id = get_path(res, id_path)
        if (id === undefined) {
            console.error("No data found at path(s):", id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        const payload = {
            id: id,
        }
        const options = {
            algorithm: token_algorithm,
            expiresIn: agent_token_duration,
        }
        jwt.sign(payload, token_secret, options, (error, token) => {
            if (error) {
                console.error("Error jwt:", error)
                return res.status(500).json({ message: "Internal server error" })
            } else {
                return res.status(200).json(token)
            }
        })
    }
}

export const verify_token = ({ id_path = "user_id" } = {}) => {
    return (req, res, next) => {
        let token
        const authorization_header = req.headers.authorization
        if (authorization_header && authorization_header.startsWith("Bearer ")) {
            token = authorization_header.split(" ")[1]
        } else if (req.cookies) {
            token = req.cookies.access_token
        }

        if (token === undefined) {
            return res.status(401).json({ message: "No token provided" })
        }
        jwt.verify(token, token_secret, (error, decoded) => {
            if (error) {
                return res.status(401).json({ message: "Invalid token" })
            }
            set_path(res, id_path, decoded.id)
            res.locals.session_expiry = decoded.exp * 1000
            next()
        })
    }
}

export const delete_token_cookie = () => {
    return (req, res, next) => {
        res.clearCookie("access_token", {
            path: "/api",
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        })
        res.locals.response_code = 204
        next()
    }
}
