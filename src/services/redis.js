import redis from "redis"
import { redis_events } from "../services/events.js"

const redis_client = redis.createClient({
    url: `redis://${process.env.REDIS_HOST}:6379/0`,
})

const redis_client_presence = redis.createClient({
    url: `redis://${process.env.REDIS_HOST}:6379/1`,
})

const redis_expiration_listener = redis_client_presence.duplicate()

const initialise_redis = async () => {
    await redis_client.connect()
    await redis_client_presence.connect()
    await redis_expiration_listener.connect()

    await redis_client_presence.configSet("notify-keyspace-events", "Ex")

    await redis_expiration_listener.pSubscribe("__keyevent@1__:expired", async (key) => {
        if (key.startsWith("agent:presence:")) {
            const agent_id = key.split(":")[2]
            redis_events.emit("agent_expired", agent_id)
        }
    })
}

export { redis_client, redis_client_presence, initialise_redis }
