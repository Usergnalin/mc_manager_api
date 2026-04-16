import {redis_client} from '../services/redis.js'
import {NONCE_MAX_DURATION} from '../configs/constants.js'
import ms from 'ms'

const nonce_duration_ms = ms(NONCE_MAX_DURATION)

export const verify_nonce = () => {
    return async (req, res, next) => {
        try {
            const nonce = req.headers['x-agent-nonce']
            const timestamp = req.headers['x-agent-timestamp']
            if (!nonce || !timestamp) {
                return res.status(422).json({message: 'Missing security headers'})
            }
            const drift = Math.abs(Date.now() - (parseInt(timestamp) || 0))
            if (drift > nonce_duration_ms) {
                return res.status(401).json({message: 'Request expired'})
            }
            const redis_key = `nonce:${nonce}`
            const expiry = Math.ceil(nonce_duration_ms / 1000) + 1
            const result = await redis_client.set(redis_key, '1', {NX: true, EX: expiry})
            if (result !== 'OK') {
                return res.status(401).json({message: 'Duplicate request'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}
