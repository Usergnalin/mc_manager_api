import logger from './src/services/logger.js'
import {initialise_redis} from './src/services/redis.js'
import agent_startup from './src/startup/agentStatus.js'

const app_port = process.env.APP_PORT

const start_server = async () => {
    try {
        await initialise_redis()
        await agent_startup()
        const { default: app } = await import('./src/app.js')
        app.listen(app_port, () => logger.info({port: app_port}, 'Server successfully started'))
    } catch (error) {
        logger.fatal({err: error}, 'Failed to start server')
        process.exit(1)
    }
}

start_server()
