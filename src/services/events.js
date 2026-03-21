const EventEmitter = require('events')
class EventService extends EventEmitter {}

const db_events = new EventService()
db_events.setMaxListeners(0)

const redis_events = new EventService()
redis_events.setMaxListeners(0)

module.exports.db_events = db_events
module.exports.redis_events = redis_events