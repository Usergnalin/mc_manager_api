export const MAX_INT_UNSIGNED = 4294967295
export const PASSWORD_MIN_SCORE = 2
export const COMMAND_STATUS = ["pending", "queued", "sent", "success", "failure"]
export const SERVER_STATUS = ["online", "offline", "starting", "stopping"]
export const AGENT_STATUS = ["online", "offline"]
export const TEAM_ROLES = ["user", "admin"]
export const SSE_HEARTBEAT_INTERVAL = "20s"
export const AGENT_HEARTBEAT_EXPIRY = "30s"
export const SLUG_LENGTH = 5

export const CONSTANTS = {
    MAX_INT_UNSIGNED,
    PASSWORD_MIN_SCORE,
    COMMAND_STATUS,
    SERVER_STATUS,
    AGENT_STATUS,
    TEAM_ROLES,
    SSE_HEARTBEAT_INTERVAL,
    AGENT_HEARTBEAT_EXPIRY,
    SLUG_LENGTH,
}

export const read_constants = (req, res, next) => {
    return res.status(200).json(CONSTANTS)
}
