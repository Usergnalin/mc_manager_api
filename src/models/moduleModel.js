import pool from '../services/db.js'
import {format_columns_select} from '../utils.js'
import {MODULE_COLUMNS} from '../configs/constants.js'
import {db_events} from '../services/events.js'

const formatted_module_columns = format_columns_select(MODULE_COLUMNS, 'Module')

// export const insert = async (data, server_id, bulk) => {
//     let statement
//     let values

//     if (bulk && Array.isArray(data)) {
//         const row_placeholders = data.map(() => '(UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?, ?)').join(', ')
//         statement = `INSERT INTO Module (module_id, server_id, module_name, module_enabled, module_type, module_metadata) VALUES ${row_placeholders}`
//         values = data.flatMap((item) => [item.module_id, server_id, item.module_name, item.module_enabled, item.module_type, JSON.stringify(item.module_metadata)])
//     } else {
//         statement = `
//             INSERT INTO Module (module_id, server_id, module_name, module_enabled, module_type, module_metadata)
//             VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?, ?)
//         `
//         values = [data.module_id, server_id, data.module_name, data.module_enabled, data.module_type, JSON.stringify(data.module_metadata)]
//     }

//     await pool.query(statement, values)

//     if (bulk && Array.isArray(data)) {
//         data.forEach((item) => {
//             db_events.emit(`create:module:module:${item.module_id}`, item)
//             db_events.emit(`create:module:server:${server_id}`, item)
//         })
//     } else {
//         db_events.emit(`create:module:module:${data.module_id}`, data)
//         db_events.emit(`create:module:server:${server_id}`, data)
//     }

//     return
// }

// export const insert = async (data, server_id, bulk) => {
//     let statement
//     let values

//     if (bulk && Array.isArray(data)) {
//         const row_placeholders = data.map(() => '(UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?, ?)').join(', ')
//         statement = `INSERT INTO Module (module_id, server_id, module_name, module_enabled, module_type, module_metadata) VALUES ${row_placeholders}`
//         values = data.flatMap((item) => [item.module_id, server_id, item.module_name, item.module_enabled, item.module_type, JSON.stringify(item.module_metadata)])
//     } else {
//         statement = `
//             INSERT INTO Module (module_id, server_id, module_name, module_enabled, module_type, module_metadata)
//             VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?, ?)
//         `
//         values = [data.module_id, server_id, data.module_name, data.module_enabled, data.module_type, JSON.stringify(data.module_metadata)]
//     }
//     const [select_results] = await pool.execute(`
//         SELECT BIN_TO_UUID(Server.agent_id) as agent_id, BIN_TO_UUID(Agent.team_id) as team_id
//         FROM Server
//         INNER JOIN Agent ON Server.agent_id = Agent.agent_id
//         WHERE Server.server_id = UUID_TO_BIN(?)`,
//         [server_id]
//     )
//     const agent_id = select_results[0].agent_id
//     const team_id = select_results[0].team_id
//     await pool.query(statement, values)
//     if (bulk && Array.isArray(data)) {
//         data.forEach((item) => {
//             const payload = {...item, server_id, agent_id, team_id}
//             db_events.emit(`create:module:module:${item.module_id}`, payload)
//             db_events.emit(`create:module:server:${server_id}`, payload)
//             db_events.emit(`create:module:agent:${agent_id}`, payload)
//             db_events.emit(`create:module:team:${team_id}`, payload)
//         })
//     } else {
//         const payload = {...data, server_id, agent_id, team_id}
//         db_events.emit(`create:module:module:${data.module_id}`, payload)
//         db_events.emit(`create:module:server:${server_id}`, payload)
//         db_events.emit(`create:module:agent:${agent_id}`, payload)
//         db_events.emit(`create:module:team:${team_id}`, payload)
//     }
//     return
// }

export const insert = async (data, server_id) => {
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const row_placeholders = data.map(() => '(UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?, ?)').join(', ')
        const values = data.flatMap((item) => [
            item.module_id, 
            server_id, 
            item.module_name, 
            item.module_enabled, 
            item.module_type, 
            JSON.stringify(item.module_metadata)
        ])
        await connection.query(`
            INSERT INTO Module (module_id, server_id, module_name, module_enabled, module_type, module_metadata) 
            VALUES ${row_placeholders}`,
            values
        )
        const module_ids = data.map(module => module.module_id)
        const select_placeholders = module_ids.map(() => 'UUID_TO_BIN(?)').join(', ')
        const [select_results] = await connection.query(`
            SELECT BIN_TO_UUID(Server.agent_id) as agent_id, BIN_TO_UUID(Agent.team_id) as team_id, ${formatted_module_columns}
            FROM Module
            INNER JOIN Server ON Module.server_id = Server.server_id
            INNER JOIN Agent ON Server.agent_id = Agent.agent_id
            WHERE Module.module_id IN (${select_placeholders})`,
            module_ids
        )
        await connection.commit()
        select_results.forEach((module) => {
            db_events.emit(`create:module:module:${module.module_id}`, module)
            db_events.emit(`create:module:server:${module.server_id}`, module)
            db_events.emit(`create:module:agent:${module.agent_id}`, module)
            db_events.emit(`create:module:team:${module.team_id}`, module)
        })
        return select_results
    } catch (error) {
        await connection.rollback()
        throw error;
    } finally {
        connection.release()
    }
}

export const delete_by_module_id = async (module_id) => {
    const [select_results] = await pool.execute(`
        SELECT BIN_TO_UUID(Module.server_id) as server_id, BIN_TO_UUID(Server.agent_id) as agent_id, BIN_TO_UUID(Agent.team_id) as team_id
        FROM Module
        INNER JOIN Server ON Module.server_id = Server.server_id
        INNER JOIN Agent ON Server.agent_id = Agent.agent_id
        WHERE Module.module_id = UUID_TO_BIN(?)`,
        [module_id]
    )
    if (select_results.length === 0) return { affectedRows: 0 }
    const { server_id, agent_id, team_id } = select_results[0]
    const [delete_results] = await pool.execute('DELETE FROM Module WHERE module_id = UUID_TO_BIN(?)', [module_id])
    const payload = { team_id, agent_id, server_id, module_id }
    db_events.emit(`delete:module:module:${module_id}`, payload)
    db_events.emit(`delete:module:server:${server_id}`, payload)
    db_events.emit(`delete:module:agent:${agent_id}`, payload)
    db_events.emit(`delete:module:team:${team_id}`, payload)
    return delete_results
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

export const update_by_module_id = async (module_id, data, columns) => {
    const fields = []
    const values = []
    columns.forEach((column) => {
        if (data[column] !== undefined) {
            let value = data[column]
            if (column === 'module_metadata') value = JSON.stringify(value)
            fields.push(`${column} = ?`)
            values.push(value)
        }
    })
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const [update_results] = await connection.execute(`
            UPDATE Module SET ${fields.join(', ')}, revision = revision + 1
            WHERE module_id = UUID_TO_BIN(?)`,
            [...values, module_id]
        )
        if (update_results.affectedRows === 0) {
            await connection.rollback()
            return update_results
        }
        const [select_results] = await connection.execute(`
            SELECT BIN_TO_UUID(Server.agent_id) as agent_id, BIN_TO_UUID(Agent.team_id) as team_id, ${formatted_module_columns}
            FROM Module
            INNER JOIN Server ON Module.server_id = Server.server_id
            INNER JOIN Agent ON Server.agent_id = Agent.agent_id
            WHERE Module.module_id = UUID_TO_BIN(?)`,
            [module_id]
        )
        await connection.commit()
        const payload = select_results[0]
        db_events.emit(`update:module:module:${payload.module_id}`, payload)
        db_events.emit(`update:module:server:${payload.server_id}`, payload)
        db_events.emit(`update:module:agent:${payload.agent_id}`, payload)
        db_events.emit(`update:module:team:${payload.team_id}`, payload)
        return update_results
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

export const check_access_by_user_id_and_role = async (module_id, user_id, role) => {
    const results = await pool.execute(
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
    const results = await pool.execute(
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