import pool from '../services/db.js'
import {v7 as uuid} from 'uuid'
import {generate_slug} from '../utils.js'

// export const insert_single = (data, callback) => {
//     const statement = `
//     START TRANSACTION;
//     INSERT INTO Team (team_id, team_name, slug) VALUES (UUID_TO_BIN(?), ?, ?);
//     INSERT INTO UserTeam (user_id, team_id, role) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?);
//     COMMIT;
//     `
//     const team_id = uuid()
//     const slug = generate_slug()
//     const values = [team_id, data.team_name, slug, data.user_id, team_id, 'admin']
//     pool.query(statement, values, (error, results) => {
//         if (results) {
//             results.team_id = team_id
//             results.slug = slug
//         }
//         callback(error, results)
//     })
// }

export const insert_single = async (user_id, data) => {
    const connection = await pool.getConnection()
    try {
        const team_id = uuid()
        const slug = generate_slug()
        await connection.beginTransaction()
        await connection.query(`INSERT INTO Team (team_id, team_name, slug) VALUES (UUID_TO_BIN(?), ?, ?)`, [team_id, data.team_name, slug])
        await connection.query(`INSERT INTO UserTeam (user_id, team_id, role) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?)`, [user_id, team_id, 'admin'])
        await connection.commit()
        return {team_id, slug}
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

// module.exports.get_teams_by_user_id = (data, columns, callback) => {
//     const formatted_columns = columns.map(column => {
//         if (column === 'team_id') return 'BIN_TO_UUID(team_id) AS team_id'
//         return column
//     })
//     const statement = `
//     SELECT ${formatted_columns.join(', ')}
//     FROM Team
//     INNER JOIN UserTeam ON Team.team_id = UserTeam.team_id
//     WHERE UserTeam.user_id = UUID_TO_BIN(?)
//     `
//     const values = [data.user_id]
//     pool.query(statement, values, callback)
// }

export const check_access_by_user_id_and_role = async (user_id, team_id, role) => {
    const results = await pool.query(
        `
        SELECT
        EXISTS (
            SELECT 1 FROM User WHERE user_id = UUID_TO_BIN(?)
        ) AS user_exists,
        EXISTS (
            SELECT 1 FROM Team WHERE team_id = UUID_TO_BIN(?)
        ) AS team_exists,
        EXISTS (
            SELECT 1 
            FROM UserTeam
            WHERE user_id = UUID_TO_BIN(?)
              AND team_id = UUID_TO_BIN(?)
              AND role IN (?)
        ) AS has_access`,
        [user_id, team_id, user_id, team_id, role],
    )
    return results[0][0]
}
