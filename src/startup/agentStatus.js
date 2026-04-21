import {redis_client_presence} from '../services/redis.js'
import * as agent_model from '../models/agentModel.js'

export default async () => {
    await redis_client_presence.flushDb()
    await agent_model.update_all({agent_status: 'offline'}, ['agent_status'])
}
