import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import {redis_client} from './redis.js'
import ms from 'ms'
import {RATE_LIMIT} from '../configs/constants.js'

export const slow = rateLimit({
    windowMs: ms(RATE_LIMIT.slow.window),
    max: RATE_LIMIT.slow.limit,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redis_client.call(...args),
        prefix: 'ratelimit:slow:',
    }),
})

export const normal = rateLimit({
    windowMs: ms(RATE_LIMIT.normal.window),
    max: RATE_LIMIT.normal.limit,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redis_client.call(...args),
        prefix: 'ratelimit:normal:',
    }),
})

export const fast = rateLimit({
    windowMs: ms(RATE_LIMIT.fast.window),
    max: RATE_LIMIT.fast.limit,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redis_client.call(...args),
        prefix: 'ratelimit:fast:',
    }),
})
