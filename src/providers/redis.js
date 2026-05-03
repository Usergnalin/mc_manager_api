import Redis from 'ioredis'
import {redis_events} from '../providers/events.js'

const redis_client = new Redis({
    host: process.env.REDIS_HOST,
    port: 6379,
    db: 0,
    maxRetriesPerRequest: null,
})

const redis_client_presence = new Redis({
    host: process.env.REDIS_HOST,
    port: 6379,
    db: 1,
})

const redis_expiration_listener = new Redis({
    host: process.env.REDIS_HOST,
    port: 6379,
    db: 1,
})

const initialise_redis = async () => {
    await redis_client_presence.config('SET', 'notify-keyspace-events', 'Ex')
    await redis_expiration_listener.psubscribe('__keyevent@1__:expired')

    redis_expiration_listener.on('pmessage', async (pattern, channel, key) => {
        if (key.startsWith('agent:presence:')) {
            const agent_id = key.split(':')[2]
            redis_events.emit('agent_expired', agent_id)
        }   
    })
}

export { redis_client, redis_client_presence, initialise_redis }