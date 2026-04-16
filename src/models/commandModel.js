import pool from '../services/db.js'
import {format_columns_select} from '../utils.js'
import {db_events} from '../services/events.js'
import {v7 as uuid} from 'uuid'

// export const insert_single = (data, callback) => {
//     const statement = `
//     INSERT INTO Command (command_id, agent_id, user_id, command, command_status)
//     VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)
//     `
//     const command_id = uuid()
//     const command_status = 'queued'
//     const values = [command_id, data.agent_id, data.user_id, JSON.stringify(data.command), command_status]
//     pool.query(statement, values, (error, results) => {
//         if (error) {
//             return callback(error, null)
//         }
//         const payload = JSON.stringify({
//             command_id: command_id,
//             agent_id: data.agent_id,
//             user_id: data.user_id,
//             command: data.command,
//             command_status: command_status,
//         })
//         db_events.emit(`create:command:command:${command_id}`, payload)
//         db_events.emit(`create:command:agent:${data.agent_id}`, payload)
//         if (results) {
//             results.command_id = command_id
//         }
//         callback(error, results)
//     })
// }

// export const insert_single = (data, callback) => {
//     const statement = `
//     INSERT INTO Command (command_id, agent_id, user_id, command, command_status)
//     VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)
//     `
//     const command_id = uuid()
//     const command_status = 'queued'
//     const values = [command_id, data.agent_id, data.user_id, JSON.stringify(data.command), command_status]
//     pool.query(statement, values, (error, results) => {
//         if (error) {
//             return callback(error, null)
//         }
//         const payload = JSON.stringify({
//             command_id: command_id,
//             agent_id: data.agent_id,
//             user_id: data.user_id,
//             command: data.command,
//             command_status: command_status,
//         })
//         db_events.emit(`create:command:command:${command_id}`, payload)
//         db_events.emit(`create:command:agent:${data.agent_id}`, payload)
//         if (results) {
//             results.command_id = command_id
//         }
//         callback(error, results)
//     })
// }

export const insert_single = async (agent_id, user_id, data) => {
    const command_id = uuid()
    const command_status = 'queued'
    const [results] = await pool.query(
        `
        INSERT INTO Command (command_id, agent_id, user_id, command, command_status)
        VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)`,
        [command_id, agent_id, user_id, JSON.stringify(data.command), command_status],
    )
    const payload = {...data, agent_id, user_id, command_id, command_status}
    db_events.emit(`create:command:command:${command_id}`, payload)
    db_events.emit(`create:command:agent:${agent_id}`, payload)
    return {...results, data: payload}
}

// export const select_by_agent_id_and_mark_sent = (data, columns, callback) => {
//     const formatted_columns = columns.map((column) => {
//         if (column === 'command_id') return 'BIN_TO_UUID(command_id) AS command_id'
//         return column
//     })
//     const statement = `
//     SET @target_id := NULL;
//     START TRANSACTION;
//         SELECT command_id INTO @target_id
//         FROM Command
//         WHERE agent_id = UUID_TO_BIN(?) AND command_status = 'queued'
//         LIMIT 1
//         FOR UPDATE SKIP LOCKED;

//         SELECT ${formatted_columns.join(', ')}
//         FROM Command
//         WHERE command_id = @target_id;

//         UPDATE Command
//         SET command_status = 'sent'
//         WHERE command_id = @target_id;
//     COMMIT;
//     `
//     const values = [data.agent_id, data.agent_id]
//     pool.query(statement, values, (error, results) => {
//         if (error) {
//             return callback(error, null)
//         }
//         results[3].forEach((command) => {
//             const payload = JSON.stringify({
//                 command_id: command.command_id,
//                 command_status: 'sent',
//                 agent_id: data.agent_id,
//             })
//             db_events.emit(`update:command:command:${command.command_id}`, payload)
//             db_events.emit(`update:command:agent:${data.agent_id}`, payload)
//         })
//         callback(null, results[3])
//     })
// }

export const select_by_agent_id_and_mark_sent = async (agent_id, columns) => {
    const requested_id = columns.includes('command_id')
    const query_columns = requested_id ? columns : [...columns, 'command_id']
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const [select_results] = await connection.execute(
            `SELECT ${format_columns_select(query_columns)} FROM Command WHERE agent_id = UUID_TO_BIN(?) AND command_status = 'queued' FOR UPDATE SKIP LOCKED`,
            [agent_id],
        )
        if (select_results.length === 0) {
            await connection.rollback()
            return []
        }
        const command_ids = select_results.map((command) => command.command_id)
        const placeholders = command_ids.map(() => 'UUID_TO_BIN(?)').join(', ')
        await connection.execute(`UPDATE Command SET command_status = 'sent' WHERE command_id IN (${placeholders})`, command_ids)
        await connection.commit()
        select_results.forEach((command) => {
            const command_id = command.command_id
            const payload = {command_status: 'sent', agent_id, command_id}
            db_events.emit(`update:command:command:${command_id}`, payload)
            db_events.emit(`update:command:agent:${agent_id}`, payload)
            if (!requested_id) delete command.command_id
        })
        return select_results
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

// export const select_by_agent_id = (agent_id, columns) => {
//     const formatted_columns = columns.map((column) => {
//         if (column === 'command_id') return 'BIN_TO_UUID(command_id) AS command_id'
//         return column
//     })
//     const statement = `
//     SELECT ${formatted_columns.join(', ')}
//     FROM Command
//     WHERE agent_id = UUID_TO_BIN(?)
//     `
//     const values = [data.agent_id]
//     pool.query(statement, values, callback)
// }

export const select_by_agent_id = async (agent_id, columns) => {
    const [results] = await pool.query(
        `SELECT ${format_columns_select(columns)}
        FROM Command
        WHERE agent_id = UUID_TO_BIN(?)
        ORDER BY created_at DESC
        LIMIT 100`,
        [agent_id],
    )
    return results
}

// export const update_by_command_id = (data, columns, callback) => {
//     const fields = []
//     const values = []
//     columns.forEach((column) => {
//         if (data[column] !== undefined) {
//             if (column === 'command') {
//                 data[column] = JSON.stringify(data[column])
//             }
//             fields.push(`${column} = ?`)
//             values.push(data[column])
//         }
//     })
//     const statement = `
//     SET @captured_agent_id := NULL;
//     START TRANSACTION;
//         SELECT BIN_TO_UUID(agent_id) INTO @captured_agent_id
//         FROM Command
//         WHERE command_id = UUID_TO_BIN(?)
//         FOR UPDATE;

//         UPDATE Command
//         SET ${fields.join(', ')}
//         WHERE command_id = UUID_TO_BIN(?);

//         SELECT @captured_agent_id AS agent_id;
//     COMMIT;
//     `
//     pool.query(statement, [data.command_id, ...values, data.command_id], (error, results) => {
//         if (error) return callback(error, null)
//         if (results[3].affectedRows === 1) {
//             const agent_id = results[4][0]?.agent_id
//             const payload = JSON.stringify({...data, agent_id})
//             db_events.emit(`update:command:command:${data.command_id}`, payload)
//             db_events.emit(`update:command:agent:${agent_id}`, payload)
//         }
//         callback(null, results[3])
//     })
// }

export const update_by_command_id = async (command_id, data, columns) => {
    const fields = []
    const values = []
    columns.forEach((column) => {
        if (data[column] !== undefined) {
            let value = data[column]
            if (column === 'command') {
                value = JSON.stringify(value)
            }
            fields.push(`${column} = ?`)
            values.push(value)
        }
    })
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const [select_results] = await connection.execute(
            `SELECT BIN_TO_UUID(agent_id) AS agent_id
             FROM Command 
             WHERE command_id = UUID_TO_BIN(?) 
             FOR UPDATE`,
            [command_id],
        )
        if (select_results.length === 0) {
            await connection.rollback()
            return {affectedRows: 0}
        }
        const agent_id = select_results[0].agent_id
        const [update_results] = await connection.execute(`UPDATE Command SET ${fields.join(', ')} WHERE command_id = UUID_TO_BIN(?)`, [...values, command_id])
        await connection.commit()
        const payload = {...data, agent_id, command_id}
        db_events.emit(`update:command:command:${command_id}`, payload)
        db_events.emit(`update:command:agent:${agent_id}`, payload)
        return update_results
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}
