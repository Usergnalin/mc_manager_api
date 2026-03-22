import { EventEmitter } from "node:events"
class EventService extends EventEmitter {}

export const db_events = new EventService()
db_events.setMaxListeners(0)

export const redis_events = new EventService()
redis_events.setMaxListeners(0)
