import pool from "../services/db.js"
import { db_events } from "../services/events.js"
import { redis_client } from "../services/redis.js"
import ms from "ms"
import { v7 as uuid } from "uuid"
import { generate_phrase } from "../utils.js"

const linking_code_expiry = ms(process.env.LINKING_CODE_EXPIRY) / 1000

export const insert_by_linking_code = (data, callback) => {
    const redis_key = `linking_code:${data.linking_code}`
    redis_client
        .get(redis_key)
        .then((team_id) => {
            if (team_id === null) {
                return callback(null, null)
            }
            const statement = `
        INSERT INTO Agent (agent_id, team_id, agent_name, public_key)
        VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)
        `
            const agent_id = uuid()
            const values = [agent_id, team_id, data.agent_name, data.public_key]
            pool.query(statement, values, (error, results) => {
                if (error) {
                    return callback(error, null)
                }
                const payload = JSON.stringify(data)
                db_events.emit(`agent:agent:${agent_id}`, payload)
                db_events.emit(`agent:team:${team_id}`, payload)

                results.agent_id = agent_id
                redis_client
                    .del(redis_key)
                    .then(() => {
                        callback(null, results)
                    })
                    .catch((del_error) => {
                        console.error("Redis Error:", del_error)
                        callback(null, results)
                    })
            })
        })
        .catch((redis_error) => {
            console.error("Redis Error:", redis_error)
            callback(redis_error, null)
        })
}

export const select_by_agent_id = (data, columns, callback) => {
    const formatted_columns = columns.map((column) => {
        if (column === "agent_id") return "BIN_TO_UUID(agent_id) AS agent_id"
        return column
    })
    const statement = `
    SELECT ${formatted_columns.join(", ")}
    FROM Agent
    WHERE agent_id = UUID_TO_BIN(?)
    `
    const values = [data.agent_id]
    pool.query(statement, values, callback)
}

export const select_by_team_id = (data, columns, callback) => {
    const formatted_columns = columns.map((column) => {
        if (column === "agent_id") return "BIN_TO_UUID(agent_id) AS agent_id"
        return column
    })
    const statement = `
    SELECT ${formatted_columns.join(", ")}
    FROM Agent
    WHERE team_id = UUID_TO_BIN(?)
    `
    const values = [data.team_id]
    pool.query(statement, values, callback)
}

export const update_by_agent_id = (data, columns, callback) => {
    const fields = []
    const values = []
    columns.forEach((column) => {
        if (data[column] !== undefined) {
            fields.push(`${column} = ?`)
            values.push(data[column])
        }
    })
    const statement = `
    SET @captured_team_id := NULL;
    START TRANSACTION;
        SELECT BIN_TO_UUID(team_id) INTO @captured_team_id
        FROM Agent
        WHERE agent_id = UUID_TO_BIN(?) 
        FOR UPDATE;

        UPDATE Agent 
        SET ${fields.join(", ")} 
        WHERE agent_id = UUID_TO_BIN(?);

        SELECT @captured_team_id AS team_id;
    COMMIT;
    `
    pool.query(statement, [data.agent_id, ...values, data.agent_id], (error, results) => {
        if (error) return callback(error, null)
        if (results[3].affectedRows === 1) {
            const team_id = results[4][0]?.team_id
            const payload = JSON.stringify({ ...data, team_id })
            db_events.emit(`agent:agent:${data.agent_id}`, payload)
            db_events.emit(`agent:team:${team_id}`, payload)
        }
        callback(null, results[3])
    })
}

export const update_all = (data, columns, callback) => {
    const fields = []
    const values = []
    columns.forEach((column) => {
        if (data[column] !== undefined) {
            fields.push(`${column} = ?`)
            values.push(data[column])
        }
    })
    const statement = `
    UPDATE Agent 
    SET ${fields.join(", ")}
    `
    pool.query(statement, values, callback)
}

export const check_access_by_user_id_and_role = (data, callback) => {
    const statement = `
        SELECT EXISTS (
            SELECT 1 
            FROM UserTeam
            JOIN Agent ON UserTeam.team_id = Agent.team_id
            WHERE UserTeam.user_id = UUID_TO_BIN(?)
              AND Agent.agent_id = UUID_TO_BIN(?)
              AND UserTeam.role IN (?)
        ) AS has_access
    `
    const values = [data.user_id, data.agent_id, data.role]
    pool.query(statement, values, callback)
}

export const create_linking_code = (data, callback) => {
    const linking_code = generate_phrase()
    redis_client
        .set(`linking_code:${linking_code}`, data.team_id, {
            EX: linking_code_expiry,
        })
        .then(() => {
            callback(null, { linking_code })
        })
        .catch((redis_error) => {
            console.error("Redis Error:", redis_error)
            callback(redis_error, null)
        })
}
