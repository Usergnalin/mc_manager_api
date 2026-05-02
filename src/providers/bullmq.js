import {Worker} from 'bullmq'
import fetch_loaders from '../services/fetchLoaders.js'
import {redis_client} from '../providers/redis.js'

const _worker = new Worker(
    'fetch_loaders',
    async () => {
        await fetch_loaders()
    },
    {
        connection: redis_client,
        lockDuration: 600000,
        stalledInterval: 600000,
    }
)
