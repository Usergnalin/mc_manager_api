import pool from '../providers/db.js'
import logger from '../providers/logger.js'
import {redis_client, initialise_redis} from '../providers/redis.js'
import {COMMAND_STATUS, SERVER_STATUS, AGENT_STATUS, TEAM_ROLES, MODULE_TYPES} from '../configs/constants.js'

const SQLSTATEMENT = `
DROP TABLE IF EXISTS Module;
DROP TABLE IF EXISTS Session;
DROP TABLE IF EXISTS UserTeam;
DROP TABLE IF EXISTS Command;
DROP TABLE IF EXISTS User;
DROP TABLE IF EXISTS Server;
DROP TABLE IF EXISTS Agent;
DROP TABLE IF EXISTS Team;

CREATE TABLE User (
    user_id BINARY(16) PRIMARY KEY,
    username VARCHAR(63) NOT NULL UNIQUE,
    password VARCHAR(63) NOT NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0
);

CREATE TABLE Session (
    session_id BINARY(16) PRIMARY KEY,
    user_id BINARY(16) NOT NULL,
    refresh_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    INDEX (user_id),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0
);

CREATE TABLE Team (
    team_id BINARY(16) PRIMARY KEY,
    team_name VARCHAR(255) NOT NULL,
    slug VARCHAR(15) NOT NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    CONSTRAINT unqiue_full_name UNIQUE (team_name, slug)
);

CREATE TABLE UserTeam (
    user_id BINARY(16) NOT NULL,
    team_id BINARY(16) NOT NULL,
    role ENUM(${TEAM_ROLES.map((r) => `'${r}'`).join(',')}) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, team_id),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES Team(team_id) ON DELETE CASCADE
);

CREATE TABLE Agent (
    agent_id BINARY(16) PRIMARY KEY,
    team_id BINARY(16) NOT NULL,
    agent_name VARCHAR(255) NOT NULL,
    agent_status ENUM(${AGENT_STATUS.map((r) => `'${r}'`).join(',')}) NOT NULL DEFAULT 'offline',
    last_online DATETIME NULL,
    public_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (team_id) REFERENCES Team(team_id) ON DELETE CASCADE
);

CREATE TABLE Command (
    command_id BINARY(16) PRIMARY KEY,
    agent_id BINARY(16) NOT NULL,
    user_id BINARY(16) NULL,
    command JSON NOT NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    command_status ENUM(${COMMAND_STATUS.map((r) => `'${r}'`).join(',')}) NOT NULL DEFAULT 'pending',
    command_feedback VARCHAR(1023) NULL,
    FOREIGN KEY (agent_id) REFERENCES Agent(agent_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE SET NULL,
    INDEX (agent_id, command_status),
    INDEX (agent_id, created_at DESC)
);

CREATE TABLE Server (
    server_id BINARY(16) PRIMARY KEY,
    agent_id BINARY(16) NOT NULL,
    server_name VARCHAR(255) NOT NULL,
    properties JSON NOT NULL,
    status ENUM(${SERVER_STATUS.map((r) => `'${r}'`).join(',')}) NOT NULL DEFAULT 'offline',
    last_online DATETIME NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (agent_id) REFERENCES Agent(agent_id) ON DELETE CASCADE
);

CREATE TABLE Module (
    module_id BINARY(16) PRIMARY KEY,
    server_id BINARY(16) NOT NULL,
    module_name VARCHAR(255) NOT NULL,
    module_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    module_type ENUM(${MODULE_TYPES.map((r) => `'${r}'`).join(',')}) NOT NULL,
    module_metadata JSON NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (server_id) REFERENCES Server(server_id) ON DELETE CASCADE,
    INDEX (server_id)
);

DELIMITER //

CREATE EVENT clean_old_commands
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
    DELETE FROM Command 
    WHERE created_at < NOW() - INTERVAL 1 DAY
    LIMIT 1000;
END //

DELIMITER ;
`

const init_tables = async () => {
    try {
        await initialise_redis()
        await redis_client.flushAll()
        logger.info({}, 'Redis flushed successfully')
        await pool.query(SQLSTATEMENT)
        logger.info({}, 'Tables initialised successfully')
        process.exit()
    } catch (error) {
        logger.error({err: error}, 'Failed to initialise tables')
        process.exit(1)
    }
}

init_tables()
