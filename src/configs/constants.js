const CONSTANTS = {
    MAX_INT_UNSIGNED: 4294967295,
    PASSWORD_MIN_SCORE: 2,
    COMMAND_STATUS: ['pending', 'queued', 'sent', 'success', 'failure'],
    SERVER_STATUS: ['online', 'offline', 'starting', 'stopping'],
    AGENT_STATUS: ['online', 'offline'],
    TEAM_ROLES: ['user', 'admin'],
    SSE_HEARTBEAT_INTERVAL: "20s",
    AGENT_HEARTBEAT_EXPIRY: "30s",
    SLUG_LENGTH: 5,
}

const read_constants = (req, res, next) => {
    return res.status(200).json(CONSTANTS)
}

module.exports = {
    ...CONSTANTS,
    read_constants,
}
