import async_pool_ from '../providers/db.js'
import ms from 'ms'
import {redis_client} from '../providers/redis.js'
import {USER_REFRESH_TOKEN_GRACE_PERIOD, USER_TOKEN_DURATION} from '../configs/constants.js'

const user_refresh_token_grace_period = ms(USER_REFRESH_TOKEN_GRACE_PERIOD) / 1000
const user_token_duration = ms(USER_TOKEN_DURATION) / 1000

export const insert_single = async (user_id, data) => {
    await async_pool_.query(
        `INSERT INTO Session (session_id, user_id, refresh_token, expires_at)
        VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
        [data.session_id, user_id, data.refresh_token, data.refresh_token_duration],
    )
    return
}

export const delete_by_session_id = async (session_id) => {
    await async_pool_.query(`DELETE FROM Session WHERE session_id = UUID_TO_BIN(?)`, [session_id])
    await redis_client.set(`revoked_session:${session_id}`, 1, "NX", "EX", user_token_duration)
    return
}

export const delete_by_user_id = async (user_id) => {
    const connection = await async_pool_.getConnection()
    let sessions
    try {
        await connection.beginTransaction()
        const [select_result] = await connection.execute('SELECT BIN_TO_UUID(session_id) as session_id FROM Session WHERE user_id = UUID_TO_BIN(?) FOR UPDATE', [user_id])
        sessions = select_result
        await connection.execute('DELETE FROM Session WHERE user_id = UUID_TO_BIN(?)', [user_id])
        await connection.commit()
    } catch (error) {
        connection.rollback()
        throw error
    } finally {
        connection.release()
    }
    const pipeline = redis_client.multi()
    sessions.forEach((session) => {
        pipeline.set(`revoked_session:${session.session_id}`, 1, "NX", "EX", user_token_duration)
    })
    await pipeline.exec()
    return
}

export const refresh_token = async (data) => {
    const connection = await async_pool_.getConnection()
    try {
        await connection.beginTransaction()

        const [rows] = await connection.execute('SELECT BIN_TO_UUID(session_id) AS session_id, BIN_TO_UUID(user_id) AS user_id, expires_at FROM Session WHERE refresh_token = ? FOR UPDATE', [
            data.old_refresh_token_hash,
        ])

        if (rows.length === 0) {
            const cached_data = await redis_client.get(`refresh:${data.old_refresh_token_hash}`)
            if (cached_data) {
                const parsed_cached_data = JSON.parse(cached_data)
                await connection.commit()
                return {
                    status: 'use_cached',
                    refresh_token: parsed_cached_data.refresh_token,
                    user_id: parsed_cached_data.user_id,
                }
            } else {
                await connection.execute('DELETE FROM Session WHERE session_id = UUID_TO_BIN(?)', [data.session_id])
                await redis_client.set(`revoked_session:${data.session_id}`, 1, "NX", "EX", user_token_duration)
                await connection.commit()
                return {status: 'breach_detected'}
            }
        }

        const session = rows[0]

        if (new Date() > new Date(session.expires_at)) {
            await connection.execute('DELETE FROM Session WHERE session_id = UUID_TO_BIN(?)', [data.session_id])
            await connection.commit()
            return {status: 'session_expired'}
        }

        await connection.execute('UPDATE Session SET refresh_token = ?, revision = revision + 1 WHERE refresh_token = ?', [data.new_refresh_token_hash, data.old_refresh_token_hash])

        const cached_data_string = JSON.stringify({
            user_id: session.user_id,
            refresh_token: data.new_refresh_token,
        })

        await redis_client.set(`refresh:${data.old_refresh_token_hash}`, cached_data_string, "NX", "EX", user_refresh_token_grace_period)

        await connection.commit()
        return {status: 'success', user_id: session.user_id}
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}
