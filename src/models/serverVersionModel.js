import {redis_client} from '../services/redis.js'
import {compare_versions} from '../utils.js'

export const update_versions = async (data) => {
    const serialized_data = {}
    for (const [version, loaders] of Object.entries(data)) {
        serialized_data[version] = JSON.stringify(loaders)
    }
    await redis_client.hSet('mc_versions', serialized_data)
}

export const get_loaders_by_mc_version = async (mc_version) => {
    const loaders = await redis_client.hGet('mc_versions', mc_version)
    if (!loaders) return null
    return JSON.parse(loaders)
}

export const get_mc_versions = async () => {
    const mc_versions = await redis_client.hKeys('mc_versions')
    mc_versions.sort(compare_versions).reverse()
    return mc_versions
}