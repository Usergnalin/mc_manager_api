import pool from "../services/db.js"
import { db_events } from "../services/events.js"
import { v7 as uuid } from "uuid"

// module.exports.insert_single = (data, callback) => {
//     const insert_statement = `
//     INSERT INTO Command (command_id, agent_id, user_id, command, command_status)
//     VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)
//     `
//     const command_id = uuid()
//     const insert_values = [
//         command_id, data.agent_id, data.user_id, JSON.stringify(data.command), "pending"
//     ]
//     pool.query(insert_statement, insert_values, (error, results) => {
//         if (error) {
//             return callback(error, null)
//         }
//         const pending_payload = JSON.stringify({
//             command_id: command_id,
//             agent_id: data.agent_id,
//             user_id: data.user_id,
//             command: data.command,
//             command_status: 'pending',
//         })
//         db_events.emit(`command:command:${command_id}`, pending_payload)
//         db_events.emit(`command:agent:${data.agent_id}`, pending_payload)
//         redis_client.lPush(`agent:${data.agent_id}`, command_id).then(() => {
//             const update_statement = `
//                 UPDATE Command SET command_status = "queued"
//                 WHERE command_id = UUID_TO_BIN(?)
//             `
//             pool.query(update_statement, [command_id], (update_error) => {
//                 if (error) {
//                     return callback(error, null)
//                 }
//                 const queued_payload = JSON.stringify({
//                     command_id: command_id,
//                     command_status: 'queued',
//                     agent_id: data.agent_id
//                 })
//                 db_events.emit(`command:command:${command_id}`, queued_payload)
//                 db_events.emit(`command:agent:${data.agent_id}`, queued_payload)
//                 const finalResults = {
//                     ...results,
//                     command_id: command_id,
//                     command_status: update_error ? "pending" : "queued"
//                 };
//                 callback(null, finalResults)
//             })
//         })
//         .catch((redis_error) => {
//             console.error("Redis Error:", redis_error)
//             const fallbackResults = {
//                 ...results,
//                 command_id: command_id,
//                 command_status: "pending"
//             };
//             callback(null, fallbackResults)
//         })
//     })
// }

export const insert_single = (data, callback) => {
    const statement = `
    INSERT INTO Command (command_id, agent_id, user_id, command, command_status)
    VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)
    `
    const command_id = uuid()
    const command_status = "queued"
    const values = [
        command_id,
        data.agent_id,
        data.user_id,
        JSON.stringify(data.command),
        command_status,
    ]
    pool.query(statement, values, (error, results) => {
        if (error) {
            return callback(error, null)
        }
        const payload = JSON.stringify({
            command_id: command_id,
            agent_id: data.agent_id,
            user_id: data.user_id,
            command: data.command,
            command_status: command_status,
        })
        db_events.emit(`command:command:${command_id}`, payload)
        db_events.emit(`command:agent:${data.agent_id}`, payload)
        db_events.emit(`create:command:agent:${data.agent_id}`, payload)
        if (results) {
            results.command_id = command_id
        }
        callback(error, results)
    })
}

// module.exports.get_all_and_mark_sent = (data, callback) => {
//     const redis_key = `agent:${data.agent_id}`
//     redis_client.lRange(redis_key, 0, -1).then((command_ids) => {
//         if (command_ids.length === 0) {
//             return callback(null, [])
//         }
//         const placeholders = command_ids.map(() => 'UUID_TO_BIN(?)').join(',')
//         const select_statement = `
//             SELECT BIN_TO_UUID(command_id) AS command_id, command
//             FROM Command
//             WHERE command_id IN (${placeholders})
//         `
//         pool.query(select_statement, command_ids, (select_error, commands) => {
//             if (select_error) return callback(select_error, null)
//             const update_statement = `
//                 UPDATE Command
//                 SET command_status = 'sent'
//                 WHERE command_id IN (${placeholders})
//             `
//             pool.query(update_statement, command_ids, (update_error) => {
//                 if (update_error) return callback(update_error, null)
//                 commands.forEach(command => {
//                     const payload = JSON.stringify({
//                         command_id: command.command_id,
//                         command_status: 'sent',
//                         agent_id: data.agent_id
//                     })
//                     db_events.emit(`command:command:${command.command_id}`, payload)
//                     db_events.emit(`command:agent:${data.agent_id}`, payload)
//                 })
//                 redis_client.del(redis_key).then(() => {
//                     callback(null, commands)
//                 }).catch(redis_error => {
//                     console.error("Redis Error:", redis_error)
//                     callback(null, commands)
//                 })
//             })
//         })
//     }).catch((redis_error) => {
//         console.error("Redis Error:", redis_error)
//         callback(redis_error, null)
//     })
// }

export const select_by_agent_id_and_mark_sent = (data, columns, callback) => {
    const formatted_columns = columns.map((column) => {
        if (column === "command_id") return "BIN_TO_UUID(command_id) AS command_id"
        return column
    })
    const statement = `
    SET @target_id := NULL;
    START TRANSACTION;
        SELECT command_id INTO @target_id
        FROM Command
        WHERE agent_id = UUID_TO_BIN(?) AND command_status = 'queued'
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        SELECT ${formatted_columns.join(", ")}
        FROM Command
        WHERE command_id = @target_id;

        UPDATE Command
        SET command_status = 'sent'
        WHERE command_id = @target_id;
    COMMIT;
    `
    const values = [data.agent_id, data.agent_id]
    pool.query(statement, values, (error, results) => {
        if (error) {
            return callback(error, null)
        }
        results[3].forEach((command) => {
            const payload = JSON.stringify({
                command_id: command.command_id,
                command_status: "sent",
                agent_id: data.agent_id,
            })
            db_events.emit(`command:command:${command.command_id}`, payload)
            db_events.emit(`command:agent:${data.agent_id}`, payload)
        })
        callback(null, results[3])
    })
}

export const select_by_agent_id = (data, columns, callback) => {
    const formatted_columns = columns.map((column) => {
        if (column === "command_id") return "BIN_TO_UUID(command_id) AS command_id"
        return column
    })
    const statement = `
    SELECT ${formatted_columns.join(", ")}
    FROM Command
    WHERE agent_id = UUID_TO_BIN(?)
    `
    const values = [data.agent_id]
    pool.query(statement, values, callback)
}

// module.exports.update_by_command_id = (data, columns, callback) => {
//     const select_statement = `
//     SELECT BIN_TO_UUID(agent_id) as agent_id
//     FROM Command
//     WHERE command_id = UUID_TO_BIN(?)
//     `
//     pool.query(select_statement, [data.command_id], (select_error, select_results) => {
//         if (select_error) {
//             return callback(select_error, null)
//         }
//         if (select_results.length === 0) {
//             return callback(null, {affectedRows: 0})
//         }
//         const agent_id = select_results[0].agent_id
//         const fields = []
//         const values = []
//         columns.forEach(column => {
//             if (data[column] !== undefined) {
//                 if (column === 'command') {
//                     data[column] = JSON.stringify(data[column])
//                 }
//                 fields.push(`${column} = ?`)
//                 values.push(data[column])
//             }
//         })
//         const update_statement = `
//             UPDATE Command
//             SET ${fields.join(', ')}
//             WHERE command_id = UUID_TO_BIN(?)
//         `
//         values.push(data.command_id)
//         pool.query(update_statement, values, (update_error, update_results) => {
//             if (update_error) {
//                 return callback(update_error, null)
//             }
//             const payload = JSON.stringify({ ...data, agent_id })
//             db_events.emit(`command:command:${data.command_id}`, payload)
//             db_events.emit(`command:agent:${agent_id}`, payload)
//             callback(null, update_results)
//         })
//     })
// }

export const update_by_command_id = (data, columns, callback) => {
    const fields = []
    const values = []
    columns.forEach((column) => {
        if (data[column] !== undefined) {
            if (column === "command") {
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
        FROM Command 
        WHERE command_id = UUID_TO_BIN(?) 
        FOR UPDATE;

        UPDATE Command 
        SET ${fields.join(", ")} 
        WHERE command_id = UUID_TO_BIN(?);

        SELECT @captured_agent_id AS agent_id;
    COMMIT;
    `
    pool.query(statement, [data.command_id, ...values, data.command_id], (error, results) => {
        if (error) return callback(error, null)
        if (results[3].affectedRows === 1) {
            const agent_id = results[4][0]?.agent_id
            const payload = JSON.stringify({ ...data, agent_id })
            db_events.emit(`command:command:${data.command_id}`, payload)
            db_events.emit(`command:agent:${agent_id}`, payload)
        }
        callback(null, results[3])
    })
}
