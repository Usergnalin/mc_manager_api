import {redis_client_presence} from '../services/redis.js'
import * as agent_model from '../models/agentModel.js'

// export default (callback) => {
//     redis_client_presence
//         .flushDb()
//         .then(() => {
//             agent_model.update_all({agent_status: 'offline'}, ['agent_status'], (error, results) => {
//                 if (error) {
//                     console.error('Error agent_model update_all:', error)
//                 }
//                 callback(error, results)
//             })
//         })
//         .catch((redis_error) => {
//             console.error('Redis Error:', redis_error)
//             callback(redis_error, null)
//         })
// }

export default async () => {
    await redis_client_presence.flushDb()
    await agent_model.update_all({agent_status: 'offline'}, ['agent_status'])
}
