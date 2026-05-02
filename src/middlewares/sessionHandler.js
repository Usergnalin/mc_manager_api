import jwt from 'jsonwebtoken'
import {v7 as uuid} from 'uuid'
import ms from 'ms'
import crypto from 'node:crypto'
import {get_path, set_path} from '../utils.js'
import * as session_model from '../models/sessionModel.js'
import {redis_client} from '../providers/redis.js'
import {USER_REFRESH_TOKEN_DURATION, TOKEN_ALGORITHM, USER_TOKEN_DURATION} from '../configs/constants.js'

const token_secret = process.env.TOKEN_SECRET
const user_refresh_token_duration = ms(USER_REFRESH_TOKEN_DURATION) / 1000
const token_algorithm = TOKEN_ALGORITHM

const user_token_duration_ms = ms(USER_TOKEN_DURATION)
const user_token_duration_s = user_token_duration_ms / 1000

export const create_session = ({user_id_path = 'user_id', output_session_id_path = 'session_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const user_id = get_path(res, user_id_path)
            const session_id = uuid()
            const refresh_token = jwt.sign({session_id, user_id}, token_secret, {
                algorithm: token_algorithm,
            })
            const refresh_token_hash = crypto.createHash('sha256').update(refresh_token).digest('base64')
            const old_refresh_token = req.cookies.refresh_token
            let decoded
            try {
                decoded = jwt.verify(old_refresh_token, token_secret)
            } catch {
                decoded = null
            }
            const old_session_id = decoded?.session_id
            if (old_session_id) {
                await session_model.delete_by_session_id(old_session_id)
            }
            await session_model.insert_single(user_id, {session_id, refresh_token: refresh_token_hash, refresh_token_duration: user_refresh_token_duration})
            res.cookie('refresh_token', refresh_token, {
                domain: `.${process.env.DOMAIN}`,
                path: '/auth',
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
            })
            set_path(res, output_session_id_path, session_id)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const rotate_session = ({output_user_id_path = 'user_id', output_session_id_path = 'session_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const cookie_refresh_token = req.cookies.refresh_token
            if (cookie_refresh_token === undefined) {
                return res.status(401).json({message: 'No refresh token provided'})
            }
            let decoded
            try {
                decoded = jwt.verify(cookie_refresh_token, token_secret)
            } catch (error) {
                if (error.name === 'TokenExpiredError') {
                    return res.status(401).json({message: 'Session token expired'})
                }
                return res.status(401).json({message: 'Invalid refresh token'})
            }
            const session_id = decoded.session_id
            const user_id = decoded.user_id
            const old_refresh_token_hash = crypto.createHash('sha256').update(cookie_refresh_token).digest('base64')
            const new_refresh_token = jwt.sign({session_id, user_id}, token_secret, {
                algorithm: token_algorithm,
            })
            const new_refresh_token_hash = crypto.createHash('sha256').update(new_refresh_token).digest('base64')
            const results = await session_model.refresh_token({session_id, old_refresh_token_hash, new_refresh_token_hash, new_refresh_token})
            if (results.status === 'use_cached') {
                res.cookie('refresh_token', results.refresh_token, {
                    domain: `.${process.env.DOMAIN}`,
                    path: '/auth',
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                })
                set_path(res, output_user_id_path, results.user_id)
                set_path(res, output_session_id_path, session_id)
                next()
            } else if (results.status === 'breach_detected') {
                res.status(401).json({message: 'Invalid refresh token'})
            } else if (results.status === 'session_expired') {
                return res.status(401).json({message: 'Session expired'})
            } else if (results.status === 'success') {
                res.cookie('refresh_token', new_refresh_token, {
                    domain: `.${process.env.DOMAIN}`,
                    path: '/auth',
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                })
                set_path(res, output_user_id_path, results.user_id)
                set_path(res, output_session_id_path, session_id)
                next()
            } else {
                throw Error(`Unexpected session rotation status: ${results.status}`)
            }
        } catch (error) {
            next(error)
        }
    }
}

export const verify_session_token = ({output_user_id_path = 'user_id', output_session_id_path = 'session_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const session_token = req.cookies.session_token
            if (session_token === undefined) {
                return res.status(401).json({message: 'No session token provided'})
            }
            let decoded
            try {
                decoded = jwt.verify(session_token, token_secret)
            } catch (error) {
                if (error.name === 'TokenExpiredError') {
                    return res.status(401).json({message: 'Session token expired'})
                }
                return res.status(401).json({message: 'Invalid session token'})
            }
            const revoked = await redis_client.exists(`revoked_session:${decoded.session_id}`)
            if (revoked) {
                return res.status(401).json({message: 'Invalid session token'})
            }
            set_path(res, output_user_id_path, decoded.user_id)
            set_path(res, output_session_id_path, decoded.session_id)
            res.locals.session_expiry = decoded.exp * 1000
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const generate_session_token = ({user_id_path = 'user_id', session_id_path = 'session_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const user_id = get_path(res, user_id_path)
            const session_id = get_path(res, session_id_path)
            const payload = {
                user_id: user_id,
                session_id: session_id,
            }
            const options = {
                algorithm: token_algorithm,
                expiresIn: user_token_duration_s,
            }
            const session_token = jwt.sign(payload, token_secret, options)
            res.cookie('session_token', session_token, {
                domain: `.${process.env.DOMAIN}`,
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                maxAge: user_token_duration_ms,
            })
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const delete_session_by_session_id = ({session_id_path = 'session_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const session_id = get_path(res, session_id_path)
            await session_model.delete_by_session_id(session_id)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const delete_session_by_user_id = ({user_id_path = 'user_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const user_id = get_path(res, user_id_path)
            await session_model.delete_by_user_id(user_id)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const delete_token_cookies = () => {
    return async (req, res, next) => {
        res.clearCookie('session_token', {
            domain: `.${process.env.DOMAIN}`,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
        })
        res.clearCookie('refresh_token', {
            domain: `.${process.env.DOMAIN}`,
            path: '/auth',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
        })
        next()
    }
}
