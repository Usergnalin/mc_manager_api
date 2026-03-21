const pool = require("../services/db")
const { db_events } = require("../services/events")

module.exports.insert_single = (data, callback) => {
    const statement = `
    INSERT INTO Server (server_id, agent_id, server_name, properties)
    VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)
    `
    const values = [
        data.server_id, data.agent_id, data.server_name, JSON.stringify(data.properties)
    ]
    pool.query(statement, values, (error, results) => {
        if (error) {
            return callback(error, null)
        }
        const payload = JSON.stringify(data)
        db_events.emit(`server:server:${data.server_id}`, payload)
        db_events.emit(`server:agent:${data.agent_id}`, payload)
        callback(null, results)
    })
}

module.exports.check_access_by_agent_id = (data, callback) => {
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

module.exports.check_access_by_user_id = (data, callback) => {
    const statement = `
    SELECT EXISTS (
        SELECT 1
        FROM UserTeam
        JOIN Agent ON UserTeam.team_id = Agent.team_id
        JOIN Server ON Agent.agent_id = Server.agent_id
        WHERE UserTeam.user_id = UUID_TO_BIN(?)
        AND Server.server_id = UUID_TO_BIN(?)
    ) AS has_access
    `
    const values = [data.user_id, data.server_id]
    pool.query(statement, values, callback)
}

module.exports.update_by_id = (data, columns, callback) => {
    const fields = []
    const values = []
    columns.forEach(column => {
        if (data[column] !== undefined) {
            if (column === 'properties') {
                data[column] = JSON.stringify(data[column])
            }
            fields.push(`${column} = ?`)
            values.push(data[column])
        }
    })
    const statement = `
        UPDATE Server
        SET ${fields.join(', ')}
        WHERE server_id = UUID_TO_BIN(?)
    `
    values.push(data.server_id)
    pool.query(statement, values, callback)
}

module.exports.update_by_server_id = (data, columns, callback) => {
    const fields = []
    const values = []
    columns.forEach(column => {
        if (data[column] !== undefined) {
            if (column === 'properties') {
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
        SET ${fields.join(', ')} 
        WHERE server_id = UUID_TO_BIN(?);

        SELECT @captured_agent_id AS agent_id;
    COMMIT;
    `
    pool.query(statement, [data.server_id, ...values, data.server_id], (error, results) => {
        if (error) return callback(error, null)
        if (results[3].affectedRows === 1) {
            const agent_id = results[4][0]?.agent_id
            const payload = JSON.stringify({ ...data, agent_id })
            db_events.emit(`server:server:${data.server_id}`, payload)
            db_events.emit(`server:agent:${agent_id}`, payload)
        }
        callback(null, results[3])
    })
}

module.exports.select_by_server_id = (data, columns, callback) => {
    const formatted_columns = columns.map(column => {
        if (column === 'server_id') return 'BIN_TO_UUID(server_id) AS server_id'
        return column
    })
    const statement = `
    SELECT ${formatted_columns.join(', ')}
    FROM Server
    WHERE server_id = UUID_TO_BIN(?)
    `
    const values = [data.server_id]
    pool.query(statement, values, callback)
}

module.exports.select_by_agent_id = (data, columns, callback) => {
    const formatted_columns = columns.map(column => {
        if (column === 'server_id') return 'BIN_TO_UUID(server_id) AS server_id'
        return column
    })
    const statement = `
    SELECT ${formatted_columns.join(', ')}
    FROM Server
    WHERE agent_id = UUID_TO_BIN(?)
    `
    const values = [data.agent_id]
    pool.query(statement, values, callback)
}