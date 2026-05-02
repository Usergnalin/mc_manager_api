import {redis_client_presence} from '../providers/redis.js'
import * as agent_model from '../models/agentModel.js'

export default async () => {
    await redis_client_presence.flushdb()
    await agent_model.update_all({agent_status: 'offline'}, ['agent_status'])
}
