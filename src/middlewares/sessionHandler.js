import jwt from "jsonwebtoken"
import { v7 as uuid } from "uuid"
import ms from "ms"
import crypto from "node:crypto"
import { get_path, set_path } from "../utils.js"
import * as session_model from "../models/sessionModel.js"
import { redis_client } from "../services/redis.js"

const token_secret = process.env.TOKEN_SECRET
const user_refresh_token_duration = ms(process.env.USER_REFRESH_TOKEN_DURATION) / 1000
const token_algorithm = process.env.TOKEN_ALGORITHM

const user_token_duration_ms = ms(process.env.USER_TOKEN_DURATION)
const user_token_duration_s = user_token_duration_ms / 1000

export const create_session = ({ user_id_path = "user_id", output_session_id_path = "session_id" } = {}) => {
    return (req, res, next) => {
        const user_id = get_path(res, user_id_path)
        if (user_id === undefined) {
            console.error("No data found at path:", user_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        const session_id = uuid()
        const refresh_token = jwt.sign({ session_id, user_id }, token_secret, {
            algorithm: token_algorithm
        })
        const refresh_token_hash = crypto.createHash("sha256").update(refresh_token).digest("base64")
        const old_refresh_token = req.cookies.refresh_token
        jwt.verify(old_refresh_token, token_secret, (error, decoded) => {
            const old_session_id = decoded?.session_id
            session_model.delete_by_session_id({ session_id: old_session_id }, (error, results) => {
                if (error) {
                    console.error("Error session_model delete_by_session_id:", error)
                    return res.status(500).json({ message: "Internal server error" })
                }
                session_model.insert_single({ session_id, user_id, refresh_token: refresh_token_hash, refresh_token_duration: user_refresh_token_duration}, (error, results) => {
                    if (error) {
                        console.error("Error session_model insert_single:", error)
                        return res.status(500).json({ message: "Internal server error" })
                    }
                    res.cookie("refresh_token", refresh_token, {
                        path: "/api/user",
                        httpOnly: true,
                        secure: true,
                        sameSite: "strict"
                    })
                    set_path(res, output_session_id_path, session_id)
                    next()
                })
            })
        })
    }
}

export const rotate_session = ({ output_user_id_path = "user_id", output_session_id_path = "session_id"} = {}) => {
    return (req, res, next) => {
        const cookie_refresh_token = req.cookies.refresh_token
        if (cookie_refresh_token === undefined) {
            return res.status(401).json({ message: "No refresh token provided" })
        }
        jwt.verify(cookie_refresh_token, token_secret, (error, decoded) => {
            if (error) {
                return res.status(401).json({ message: "Invalid refresh token" })
            }
            const session_id = decoded.session_id
            const user_id = decoded.user_id
            const old_refresh_token_hash = crypto.createHash("sha256").update(cookie_refresh_token).digest("base64")
            const new_refresh_token = jwt.sign({ session_id, user_id }, token_secret, {
                algorithm: token_algorithm
            })
            const new_refresh_token_hash = crypto.createHash("sha256").update(new_refresh_token).digest("base64")
            session_model.refresh_token({ session_id, old_refresh_token_hash, new_refresh_token_hash, new_refresh_token }, (error, results) => {
                if (error) {
                    console.error("Error session_model refresh_token:", error)
                    return res.status(500).json({ message: "Internal server error" })
                }
                if (results.status === "use_cached") {
                    res.cookie("refresh_token", results.refresh_token, {
                        path: "/api/user",
                        httpOnly: true,
                        secure: true,
                        sameSite: "strict"
                    })
                    set_path(res, output_user_id_path, results.user_id)
                    set_path(res, output_session_id_path, session_id)
                    next()
                } else if (results.status === "breach_detected") {
                    res.status(401).json({ message: "Invalid refresh token" })
                } else if (results.status === "session_expired") {
                    return res.status(401).json({ message: "Session expired" })
                } else if (results.status === "success") {
                    res.cookie("refresh_token", new_refresh_token, {
                        path: "/api/user",
                        httpOnly: true,
                        secure: true,
                        sameSite: "strict"
                    })
                    set_path(res, output_user_id_path, results.user_id)
                    set_path(res, output_session_id_path, session_id)
                    next()
                } else {
                    console.error("Unknown status:", results.status)
                    return res.status(500).json({ message: "Internal server error" })
                }
            })  
        })
    }
}

export const verify_session_token = ({ output_user_id_path = "user_id", output_session_id_path = "session_id" } = {}) => {
    return (req, res, next) => {
        const session_token = req.cookies.session_token
        if (session_token === undefined) {
            return res.status(401).json({ message: "No session token provided" })
        }
        jwt.verify(session_token, token_secret, (error, decoded) => {
            if (error) {
                return res.status(401).json({ message: "Invalid session token" })
            }
            redis_client.exists(`revoked_session:${decoded.session_id}`)
            .then(revoked => {
                if (revoked) {
                    return res.status(401).json({ message: "Invalid session token" })
                }
                set_path(res, output_user_id_path, decoded.user_id)
                set_path(res, output_session_id_path, decoded.session_id)
                res.locals.session_expiry = decoded.exp * 1000
                next()
            }).catch(redis_error => {
                console.error("Redis Error:", redis_error)
                return res.status(500).json({ message: "Internal server error" })
            })
        })
    }
}

export const generate_session_token = ({ user_id_path = "user_id", session_id_path = "session_id" } = {}) => {
    return (req, res, next) => {
        const user_id = get_path(res, user_id_path)
        const session_id = get_path(res, session_id_path)
        if (user_id === undefined || session_id === undefined) {
            console.error("No data found at path(s):", user_id_path, session_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        const payload = {
            user_id: user_id,
            session_id: session_id,
        }
        const options = {
            algorithm: token_algorithm,
            expiresIn: user_token_duration_s,
        }
        jwt.sign(payload, token_secret, options, (error, session_token) => {
            if (error) {
                console.error("Error jwt:", error)
                res.status(500).json({ message: "Internal server error" })
            } else {
                res.cookie("session_token", session_token, {
                    path: "/api",
                    httpOnly: true,
                    secure: true,
                    sameSite: "strict",
                    maxAge: user_token_duration_ms,
                })
                next()
            }
        })
    }
}

export const delete_session_by_session_id = ({session_id_path = "session_id"} = {}) => {
    return (req, res, next) => {
        const session_id = get_path(res, session_id_path)
        session_model.delete_by_session_id({ session_id }, (error, results) => {
            if (error){
                console.error("Error session_model delete_by_session_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            next()
        })
    }
}

export const delete_session_by_user_id = ({user_id_path = "user_id"} = {}) => {
    return (req, res, next) => {
        const user_id = get_path(res, user_id_path)
        session_model.delete_by_user_id({ user_id }, (error, results) => {
            if (error){
                console.error("Error session_model delete_by_user_id:", error)
                return res.status(500).json({ message: "Internal server error" })
            }
            next()
        })
    }
}

export const delete_token_cookies = () => {
    return (req, res, next) => {
        res.clearCookie("session_token", {
            path: "/api",
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        })
        res.clearCookie("refresh_token", {
            path: "/api/user",
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        })
        next()
    }
}