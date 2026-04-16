import pool from '../services/db.js'
import {format_columns_select} from '../utils.js'
import {db_events} from '../services/events.js'

export const insert = async (data, server_id, bulk) => {
    let statement
    let values

    if (bulk && Array.isArray(data)) {
        const row_placeholders = data.map(() => '(UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?)').join(', ')
        statement = `INSERT INTO Module (module_id, server_id, module_name, module_type, module_metadata) VALUES ${row_placeholders}`
        values = data.flatMap((item) => [item.module_id, server_id, item.module_name, item.module_type, JSON.stringify(item.module_metadata)])
    } else {
        statement = `
            INSERT INTO Module (module_id, server_id, module_name, module_type, module_metadata)
            VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?)
        `
        values = [data.module_id, server_id, data.module_name, data.module_type, JSON.stringify(data.module_metadata)]
    }

    await pool.query(statement, values)

    if (bulk && Array.isArray(data)) {
        data.forEach((item) => {
            db_events.emit(`create:module:module:${item.module_id}`, item)
            db_events.emit(`create:module:server:${server_id}`, item)
        })
    } else {
        db_events.emit(`create:module:module:${data.module_id}`, data)
        db_events.emit(`create:module:server:${server_id}`, data)
    }

    return
}

export const delete_by_module_id = async (module_id) => {
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const [select_results] = await connection.execute('SELECT BIN_TO_UUID(server_id) as server_id FROM Module WHERE module_id = UUID_TO_BIN(?) FOR UPDATE', [module_id])
        if (select_results.length === 0) {
            await connection.rollback()
            return {affectedRows: 0}
        }
        const server_id = select_results[0].server_id
        const [delete_results] = await connection.execute('DELETE FROM Module WHERE module_id = UUID_TO_BIN(?)', [module_id])
        await connection.commit()
        const payload = {server_id, module_id}
        db_events.emit(`delete:module:module:${module_id}`, payload)
        db_events.emit(`delete:module:server:${server_id}`, payload)
        return delete_results
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

export const select_by_server_id = async (server_id, columns) => {
    const [results] = await pool.query(
        `SELECT ${format_columns_select(columns)}
        FROM Module
        WHERE server_id = UUID_TO_BIN(?)`,
        [server_id],
    )
    return results
}

export const check_access_by_user_id_and_role = async (module_id, user_id, role) => {
    const results = await pool.query(
        `SELECT
        EXISTS (
            SELECT 1 FROM User WHERE user_id = UUID_TO_BIN(?)
        ) AS user_exists,

        EXISTS (
            SELECT 1 FROM Module WHERE module_id = UUID_TO_BIN(?)
        ) AS module_exists,

        EXISTS (
            SELECT 1 
            FROM Module
            JOIN Server ON Module.server_id = Server.server_id
            JOIN Agent ON Server.agent_id = Agent.agent_id
            JOIN UserTeam ON Agent.team_id = UserTeam.team_id
            WHERE Module.module_id = UUID_TO_BIN(?)
                AND UserTeam.user_id = UUID_TO_BIN(?)
                AND UserTeam.role IN (?)
        ) AS has_access`,
        [user_id, module_id, module_id, user_id, role],
    )
    return results[0][0]
}

export const check_access_by_agent_id = async (module_id, agent_id) => {
    const results = await pool.query(
        `SELECT
        EXISTS (
            SELECT 1 FROM Agent WHERE agent_id = UUID_TO_BIN(?)
        ) AS agent_exists,

        EXISTS (
            SELECT 1 FROM Module WHERE module_id = UUID_TO_BIN(?)
        ) AS module_exists,

        EXISTS (
            SELECT 1 
            FROM Module
            JOIN Server ON Module.server_id = Server.server_id
            WHERE Module.module_id = UUID_TO_BIN(?)
                AND Server.agent_id = UUID_TO_BIN(?)
        ) AS has_access`,
        [agent_id, module_id, module_id, agent_id],
    )
    return results[0][0]
}