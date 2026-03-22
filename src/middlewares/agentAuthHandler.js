import nacl from "tweetnacl"
import { Buffer } from "node:buffer"
import { get_path } from "../utils.js"

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
