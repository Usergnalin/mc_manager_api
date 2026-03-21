//////////////////////////////////////////////////////
// INCLUDES
//////////////////////////////////////////////////////
const app = require("./src/app")
const { initialise_redis } = require("./src/services/redis")
const agent_startup = require("./src/startup/agentStatus")

//////////////////////////////////////////////////////
// SETUP ENVIRONMENT
//////////////////////////////////////////////////////
const PORT = 3000

//////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////
const start_server = async () => {
    try {
        await initialise_redis()
        console.log("Redis Connected")

        agent_startup((error, results) => {
            if (error) {
                console.error("Cleanup failed", error)
                process.exit(1);
            }
            app.listen(PORT, () => console.log("Server Live"))
        })
    } catch (error) {
        console.error("Startup Error:", error)
        process.exit(1)
    }
}

start_server()
