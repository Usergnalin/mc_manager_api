import pool from "../services/db.js"
import { db_events } from "../services/events.js"

export const insert_single = (data, callback) => {
    const statement = `
    INSERT INTO Server (server_id, agent_id, server_name, properties)
    VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)
    `
    const values = [
        data.server_id,
        data.agent_id,
        data.server_name,
        JSON.stringify(data.properties),
    ]
    pool.query(statement, values, (error, results) => {
        if (error) {
            return callback(error, null)
        }
        const payload = JSON.stringify(data)
        db_events.emit(`create:server:server:${data.server_id}`, payload)
        db_events.emit(`create:server:agent:${data.agent_id}`, payload)
        callback(null, results)
    })
}

export const check_access_by_agent_id = (data, callback) => {
    const statement = `
        SELECT EXISTS (
            SELECT 1
            FROM Server
            WHERE server_id = UUID_TO_BIN(?)
            AND agent_id = UUID_TO_BIN(?)
        ) AS has_access
    `
    const values = [data.server_id, data.agent_id]
    pool.query(statement, values, callback)
}

export const check_access_by_user_id_and_role = (data, callback) => {
    const statement = `
    SELECT EXISTS (
        SELECT 1 
        FROM Server
        JOIN Agent ON Server.agent_id = Agent.agent_id
        JOIN UserTeam ON Agent.team_id = UserTeam.team_id
        WHERE Server.server_id = UUID_TO_BIN(?)
            AND UserTeam.user_id = UUID_TO_BIN(?)
            AND UserTeam.role IN (?)
    ) AS has_access
    `
    const values = [data.server_id, data.user_id, data.role]
    pool.query(statement, values, callback)
}

export const update_by_server_id = (data, columns, callback) => {
    const fields = []
    const values = []
    columns.forEach((column) => {
        if (data[column] !== undefined) {
            if (column === "properties") {
                data[column] = JSON.stringify(data[column])
            }
            fields.push(`${column} = ?`)
            values.push(data[column])
        }
    })
    const statement = `
    SET @captured_agent_id := NULL;
    START TRANSACTION;
        SELECT BIN_TO_UUID(agent_id) INTO @captured_agent_id 
        FROM Server 
        WHERE server_id = UUID_TO_BIN(?) 
        FOR UPDATE;

        UPDATE Server 
        SET ${fields.join(", ")} 
        WHERE server_id = UUID_TO_BIN(?);

        SELECT @captured_agent_id AS agent_id;
    COMMIT;
    `
    pool.query(statement, [data.server_id, ...values, data.server_id], (error, results) => {
        if (error) return callback(error, null)
        if (results[3].affectedRows === 1) {
            const agent_id = results[4][0]?.agent_id
            const payload = JSON.stringify({ ...data, agent_id })
            db_events.emit(`update:server:server:${data.server_id}`, payload)
            db_events.emit(`update:server:agent:${agent_id}`, payload)
        }
        callback(null, results[3])
    })
}

export const select_by_server_id = (data, columns, callback) => {
    const formatted_columns = columns.map((column) => {
        if (column === "server_id") return "BIN_TO_UUID(server_id) AS server_id"
        return column
    })
    const statement = `
    SELECT ${formatted_columns.join(", ")}
    FROM Server
    WHERE server_id = UUID_TO_BIN(?)
    `
    const values = [data.server_id]
    pool.query(statement, values, callback)
}

export const select_by_agent_id = (data, columns, callback) => {
    const formatted_columns = columns.map((column) => {
        if (column === "server_id") return "BIN_TO_UUID(server_id) AS server_id"
        return column
    })
    const statement = `
    SELECT ${formatted_columns.join(", ")}
    FROM Server
    WHERE agent_id = UUID_TO_BIN(?)
    `
    const values = [data.agent_id]
    pool.query(statement, values, callback)
}
