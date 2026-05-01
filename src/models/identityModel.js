import pool from '../providers/db.js'
import {format_columns_select} from '../utils.js'

export const select_by_provider_user_id_and_provider = async (provider, provider_user_id, columns) => {
    const [rows] = await pool.query(`
        SELECT ${format_columns_select(columns)}
        FROM Identity
        WHERE provider_user_id = ? AND provider = ?`,
        [provider_user_id, provider],
    )
    return rows[0]
}