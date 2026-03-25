import pool from "../services/db.js"
import ms from "ms"
import {redis_client} from "../services/redis.js"

const user_refresh_token_grace_period = ms(process.env.USER_REFRESH_TOKEN_GRACE_PERIOD) / 1000
const user_token_duration = ms(process.env.USER_TOKEN_DURATION) / 1000

export const insert_single = (data, callback) => {
    const statement = `
    INSERT INTO Session (session_id, user_id, refresh_token, expires_at)
    VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
    `
    const values = [
        data.session_id,
        data.user_id,
        data.refresh_token,
        data.refresh_token_duration,
    ]
    pool.query(statement, values, callback)
}

export const select_by_refresh_token = (data, callback) => {
  const statement = `
    SELECT BIN_TO_UUID(session_id) AS session_id,
           BIN_TO_UUID(user_id) AS user_id,
           refresh_token,
           expires_at
    FROM Session
    WHERE refresh_token = ? AND expires_at > NOW()
  `;
  pool.query(statement, [data.refresh_token], callback);
};

export const delete_by_token = (data, callback) => {
    const statement = `
        DELETE FROM Session WHERE refresh_token = ?
    `;
    pool.query(statement, [data.refresh_token], callback);
};

export const delete_by_session_id = (data, callback) => {
    const statement = `
    DELETE FROM Session WHERE session_id = UUID_TO_BIN(?)
    `
    pool.query(statement, [data.session_id], (error, results) => {
        if (error) return callback(error, null)
        redis_client.set(`revoked_session:${data.session_id}`, 1, {EX: user_token_duration, NX: true})
        .then(() => {
            callback(null, results)
        })
        .catch((redis_error) => {
            console.error("Redis Error:", redis_error)
            callback(null, results)
        })
    })
}

export const delete_by_user_id = (data, callback) => {
    const statement = `
    SELECT BIN_TO_UUID(session_id) as session_id FROM Session 
    WHERE user_id = UUID_TO_BIN(?) 
    FOR UPDATE;

    DELETE FROM Session WHERE user_id = UUID_TO_BIN(?);
    `
    pool.query(statement, [data.user_id, data.user_id], (error, results) => {
        if (error) return callback(error, null)
        const pipeline = redis_client.multi()
        results[0].forEach(session => {
            pipeline.set(`revoked_session:${session.session_id}`, 1, {EX: user_token_duration, NX: true})
        })
        pipeline.exec()
        .then(() => {
            callback(null, results)
        })
        .catch((redis_error) => {
            console.error("Redis Error:", redis_error)
            callback(null, results)
        })
    })
}

// export const rotate_token = (data, callback) => {
//     const session_id = uuid()
//     const select_statement = `
//         SELECT user_id FROM Session
//         WHERE refresh_token = ? AND expires_at > NOW()
//     `
//     const delete_statement = `
//         DELETE FROM Session WHERE refresh_token = ?
//     `
//     const insert_statement = `
//         INSERT INTO Session (session_id, user_id, refresh_token, expires_at)
//         VALUES (UUID_TO_BIN(?), ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
//     `
//     pool.getConnection((error, connection) => {
//         if (error) return callback(error, null)
//         connection.beginTransaction(error => {
//             if (error) return callback(error, null)
//             connection.query(select_statement, [data.old_token], (error, results) => {
//                 if (error) return connection.rollback(() => callback(error, null))
//                 if (!results.length) {
//                     return connection.rollback(() => callback(null, null))
//                 }
//                 const user_id = results[0].user_id
//                 connection.query(delete_statement, [data.old_token], (error) => {
//                     if (error) return connection.rollback(() => callback(error, null))
//                     connection.query(
//                         insert_statement,
//                         [session_id, user_id, data.new_token, user_refresh_token_duration],
//                         (error, results) => {
//                             if (error) return connection.rollback(() => callback(error, null))
//                             connection.commit(error => {
//                                 if (error) return connection.rollback(() => callback(error, null))
//                                 connection.release()
//                                 callback(null, results)
//                             })
//                         }
//                     )
//                 })
//             })
//         })
//     })
// }

async function refresh_token_async (data) {
    const promise_pool = pool.promise()
    const connection = await promise_pool.getConnection()
    try {
        await connection.beginTransaction()

        const [rows] = await connection.execute(
            'SELECT BIN_TO_UUID(session_id) AS session_id, BIN_TO_UUID(user_id) AS user_id, expires_at FROM Session WHERE refresh_token = ? FOR UPDATE', 
            [data.old_refresh_token_hash]
        )

        if (rows.length === 0) {
            const cached_data = await redis_client.get(`refresh:${data.old_refresh_token_hash}`)
            if (cached_data) {
                const parsed_cached_data = JSON.parse(cached_data)
                await connection.commit()
                return { status: 'use_cached', refresh_token: parsed_cached_data.refresh_token, user_id: parsed_cached_data.user_id }
            } else {
                await connection.execute(
                    'DELETE FROM Session WHERE session_id = UUID_TO_BIN(?)',
                    [data.session_id]
                )
                await redis_client.set(`revoked_session:${data.session_id}`, 1, {
                    EX: user_token_duration,
                    NX: true
                })
                await connection.commit()
                return { status: 'breach_detected' }
            }
        }

        const session = rows[0]

        if (new Date() > new Date(session.expires_at)) {
            await connection.execute(
                'DELETE FROM Session WHERE session_id = UUID_TO_BIN(?)',
                [data.session_id]
            )
            await connection.commit()
            return { status: 'session_expired' }
        }

        await connection.execute(
            'UPDATE Session SET refresh_token = ? WHERE refresh_token = ?',
            [data.new_refresh_token_hash, data.old_refresh_token_hash]
        )

        const cached_data_string = JSON.stringify({
            user_id: session.user_id,
            refresh_token: data.new_refresh_token
        })

        await redis_client.set(`refresh:${data.old_refresh_token_hash}`, cached_data_string, {
            EX: user_refresh_token_grace_period,
            NX: true
        })

        await connection.commit()
        return { status: 'success', user_id: session.user_id }

    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

export const refresh_token = (data, callback) => {
    refresh_token_async(data)
    .then(result => {
        callback(null, result)
    })
    .catch(error => {
        callback(error, null)
    })
}