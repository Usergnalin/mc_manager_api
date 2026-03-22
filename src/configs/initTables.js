import pool from "../services/db.js"
import { redis_client, initialise_redis } from "../services/redis.js"
import { COMMAND_STATUS, SERVER_STATUS, AGENT_STATUS, TEAM_ROLES } from "../configs/constants.js"

const SQLSTATEMENT = `
DROP TABLE IF EXISTS UserTeam;
DROP TABLE IF EXISTS Command;
DROP TABLE IF EXISTS User;
DROP TABLE IF EXISTS Server;
DROP TABLE IF EXISTS Agent;
DROP TABLE IF EXISTS Team;
DROP TABLE IF EXISTS Session;

CREATE TABLE User (
  user_id BINARY(16) PRIMARY KEY,
  username VARCHAR(63) NOT NULL UNIQUE,
  password VARCHAR(63) NOT NULL,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);

CREATE TABLE Team (
  team_id BINARY(16) PRIMARY KEY,
  team_name VARCHAR(255) NOT NULL,
  slug VARCHAR(15) NOT NULL,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT unqiue_full_name UNIQUE (team_name, slug)
);

CREATE TABLE UserTeam (
  user_id BINARY(16) NOT NULL,
  team_id BINARY(16) NOT NULL,
  role ENUM(${TEAM_ROLES.map((r) => `'${r}'`).join(",")}) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id, team_id),
  FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES Team(team_id) ON DELETE CASCADE
);

CREATE TABLE Agent (
  agent_id BINARY(16) PRIMARY KEY,
  team_id BINARY(16) NOT NULL,
  agent_name VARCHAR(255) NOT NULL,
  agent_status ENUM(${AGENT_STATUS.map((r) => `'${r}'`).join(",")}) NOT NULL DEFAULT 'offline',
  public_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  FOREIGN KEY (team_id) REFERENCES Team(team_id) ON DELETE CASCADE
);

CREATE TABLE Command (
  command_id BINARY(16) PRIMARY KEY,
  agent_id BINARY(16) NOT NULL,
  user_id BINARY(16) NULL,
  command JSON NOT NULL,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  command_status ENUM(${COMMAND_STATUS.map((r) => `'${r}'`).join(",")}) NOT NULL DEFAULT 'pending',
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
  status ENUM(${SERVER_STATUS.map((r) => `'${r}'`).join(",")}) NOT NULL DEFAULT 'offline',
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  FOREIGN KEY (agent_id) REFERENCES Agent(agent_id) ON DELETE CASCADE
);
`

const init_tables = async () => {
    try {
        await initialise_redis()
        console.log("Redis Connected")
        redis_client
            .flushAll()
            .then(() => {
                console.log("Redis wiped successfully")
                pool.query(SQLSTATEMENT, (error, results) => {
                    if (error) {
                        console.error("Error creating tables:", error)
                    } else {
                        console.log("MySQL Tables created successfully")
                    }
                    process.exit()
                })
            })
            .catch((redis_error) => {
                console.error("Failed to wipe Redis:", redis_error)
                process.exit(1)
            })
    } catch (error) {
        console.error("Startup Error:", error)
        process.exit(1)
    }
}

init_tables()
