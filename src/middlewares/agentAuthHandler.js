import nacl from "tweetnacl"
import { Buffer } from "node:buffer"
import { get_path } from "../utils.js"
import ms from "ms"
import jwt from "jsonwebtoken"
import { set_path } from "../utils.js"

const agent_token_duration_ms = ms(process.env.AGENT_TOKEN_DURATION)
const agent_token_duration_s = agent_token_duration_ms / 1000

const token_secret = process.env.TOKEN_SECRET
const token_algorithm = process.env.TOKEN_ALGORITHM

export const verify_signature = ({
    public_key_path = "agent_data.public_key",
    agent_id_path = "agent_id",
} = {}) => {
    return (req, res, next) => {
        const signature = req.headers["x-agent-signature"]
        const timestamp = req.headers["x-agent-timestamp"]
        const nonce = req.headers["x-agent-nonce"]

        if (!signature || !timestamp || !nonce) {
            return res.status(400).json({ message: "Missing security headers" })
        }

        if (isNaN(timestamp)) {
            return res.status(400).json({ message: "Invalid timestamp" })
        }

        const base64_regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
        if (!base64_regex.test(signature)) {
            return res.status(400).json({ message: "Invalid signature" })
        }

        const public_key = get_path(res, public_key_path)
        const agent_id = get_path(res, agent_id_path)

        if (!public_key || !agent_id) {
            return res.status(500).json({ message: "Internal server error" })
        }

        try {
            const message = `${agent_id}:${timestamp}:${nonce}`

            const is_valid = nacl.sign.detached.verify(
                Buffer.from(message, "utf8"),
                Buffer.from(signature, "base64"),
                Buffer.from(public_key, "base64"),
            )
            if (!is_valid) {
                return res.status(403).json({ message: "Invalid signature" })
            }
            next()
        } catch (err) {
            return res.status(500).json({ message: "Internal server error" })
        }
    }
}

export const generate_agent_token = ({ agent_id_path = "agent_id" } = {}) => {
    return (req, res, next) => {
        const agent_id = get_path(res, agent_id_path)
        if (agent_id === undefined) {
            console.error("No data found at path(s):", agent_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        const payload = {
            agent_id: agent_id,
        }
        const options = {
            algorithm: token_algorithm,
            expiresIn: agent_token_duration_s,
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

export const verify_agent_token = ({ agent_id_path = "agent_id" } = {}) => {
    return (req, res, next) => {
        const auth_header = req.headers.authorization;
        if (!auth_header || !auth_header.startsWith("Bearer ")) {
            return res.status(401).json({ message: "No token provided" });
        }
        const token = auth_header.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: "Malformed authorization header" });
        }
        jwt.verify(token, token_secret, (error, decoded) => {
            if (error) {
                return res.status(401).json({ message: "Invalid token" })
            }
            set_path(res, agent_id_path, decoded.agent_id)
            res.locals.session_expiry = decoded.exp * 1000
            next()
        })
    }
}
