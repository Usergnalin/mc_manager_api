import pool from "../services/db.js"
import { db_events } from "../services/events.js"

export const insert = (data, server_id, bulk, callback) => {
    let statement = ""
    let values = []

    if (bulk && Array.isArray(data)) {
        const row_placeholders = data.map(() => "(UUID_TO_BIN(?), UUID_TO_BIN(?), ?)").join(", ")
        statement = `INSERT INTO Mods (mod_id, server_id, file_name) VALUES ${row_placeholders}`
        values = data.flatMap(item => [
            item.mod_id,
            server_id,
            item.file_name
        ])
    } else {
        statement = `
            INSERT INTO Mods (mod_id, server_id, file_name)
            VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?)
        `
        values = [
            data.mod_id,
            server_id,
            data.file_name,
        ]
    }

    pool.query(statement, values, (error, results) => {
        if (error) {
            return callback(error, null)
        }
        if (bulk && Array.isArray(data)) {
            data.forEach(item => {
                const payload = JSON.stringify(item)
                db_events.emit(`create:mod:mod:${item.mod_id}`, payload)
                db_events.emit(`create:mod:server:${server_id}`, payload)
            })
        } else {
            const payload = JSON.stringify(data);
            db_events.emit(`create:mod:mod:${data.mod_id}`, payload)
            db_events.emit(`create:mod:server:${server_id}`, payload)
        }
        callback(null, results)
    })
}

export const delete_by_mod_id = (data, callback) => {
    const statement = `
    SET @captured_server_id := NULL;
    START TRANSACTION;
        SELECT BIN_TO_UUID(server_id) INTO @captured_server_id 
        FROM Mods 
        WHERE mod_id = UUID_TO_BIN(?) 
        FOR UPDATE;

        DELETE FROM Mods 
        WHERE mod_id = UUID_TO_BIN(?);

        SELECT @captured_server_id AS server_id;
    COMMIT;
    `
    pool.query(statement, [data.mod_id, data.mod_id], (error, results) => {
        if (error) return callback(error, null)
        if (results[3].affectedRows === 1) {
            const server_id = results[4][0]?.server_id
            const payload = JSON.stringify({ ...data, server_id })
            db_events.emit(`delete:mod:mod:${data.mod_id}`, payload)
            db_events.emit(`delete:mod:server:${server_id}`, payload)
        }
        callback(null, results[3])
    })
}

export const select_by_server_id = (data, columns, callback) => {
    const formatted_columns = columns.map((column) => {
        if (column === "mod_id") return "BIN_TO_UUID(mod_id) AS mod_id"
        return column
    })
    const statement = `
    SELECT ${formatted_columns.join(", ")}
    FROM Mods
    WHERE server_id = UUID_TO_BIN(?)
    `
    const values = [data.server_id]
    pool.query(statement, values, callback)
}
