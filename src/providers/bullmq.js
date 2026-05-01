import {Worker} from 'bullmq'
import fetch_loaders from '../services/fetchLoaders.js'
import {redis_client} from '../providers/redisConnection.js'

const _worker = new Worker(
    'fetch_loaders',
    async () => {
        await fetch_loaders()
    },
    {
        connection: redis_client,
    },
)
