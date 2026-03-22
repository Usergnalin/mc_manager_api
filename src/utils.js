import crypto from "node:crypto"
import ms from "ms"
import { MAX_INT_UNSIGNED, SLUG_LENGTH, SSE_HEARTBEAT_INTERVAL } from "./configs/constants.js"
import { predicates, objects } from "friendly-words"

const sse_heartbeat_interval = ms(SSE_HEARTBEAT_INTERVAL)

export const is_unsigned_int = (value) => {
    const parsed_value = Number(value)
    if (value === "" || value === null || value === undefined) {
        return false
    }
    return (
        Number.isInteger(parsed_value) &&
        Number.isSafeInteger(parsed_value) &&
        parsed_value >= 0 &&
        parsed_value <= MAX_INT_UNSIGNED
    )
}

export const generate_slug = () => {
    const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    let result = ""
    const random_bytes = crypto.randomBytes(SLUG_LENGTH)
    for (let i = 0; i < SLUG_LENGTH; i++) {
        result += alphabet.charAt(random_bytes[i] % alphabet.length)
    }
    return result
}

export const generate_phrase = () => {
    const p1 = predicates[crypto.randomInt(0, predicates.length)]
    const o1 = objects[crypto.randomInt(0, objects.length)]
    const p2 = predicates[crypto.randomInt(0, predicates.length)]
    const o2 = objects[crypto.randomInt(0, objects.length)]
    return `${p1}-${o1}-${p2}-${o2}`
}

export const get_path = (res, path) => {
    if (path === undefined || path === null || typeof path !== "string") return undefined

    return path.split(".").reduce((accumulator, property) => {
        if (accumulator && accumulator[property] !== undefined) {
            return accumulator[property]
        }
        return undefined
    }, res.locals)
}

export const set_path = (res, path, value) => {
    if (path === undefined || path === null || typeof path !== "string") return

    const properties = path.split(".")
    const last_property = properties.pop()

    const target_object = properties.reduce((accumulator, property) => {
        if (accumulator[property] === undefined) {
            accumulator[property] = {}
        }
        return accumulator[property]
    }, res.locals)

    target_object[last_property] = value
}

export const filter_object = (object, allowed_keys) => {
    return allowed_keys.reduce((obj, key) => {
        if (key in object) {
            obj[key] = object[key]
        }
        return obj
    }, {})
}

export const create_stream = (res, { on_heartbeat, on_close, session_expiry }) => {
    let is_stopped = false

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
    })

    const stop = () => {
        if (is_stopped) return
        is_stopped = true

        clearInterval(heartbeat_timer)
        if (typeof on_close === "function") on_close()
        if (!res.writableEnded) res.end()
    }

    const perform_heartbeat = () => {
        if (is_stopped) return
        if (session_expiry && Date.now() > session_expiry) {
            if (res.writable) res.write(`data: {"message": "Session expired"}\n\n`)
            return stop()
        }
        if (res.writable && res.write(": keep-alive\n\n")) {
            if (typeof on_heartbeat === "function") on_heartbeat(stop)
        } else {
            stop()
        }
    }

    perform_heartbeat()
    const heartbeat_timer = setInterval(perform_heartbeat, sse_heartbeat_interval)

    res.on("close", stop)

    return {
        send: (data) => {
            if (is_stopped || !res.writable) return false
            return res.write(`data: ${JSON.stringify(data)}\n\n`)
        },
        stop,
    }
}
