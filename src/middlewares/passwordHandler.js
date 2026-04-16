import bcrypt from 'bcrypt'
import zxcvbn from 'zxcvbn'
import {PASSWORD_MIN_SCORE} from '../configs/constants.js'
import {get_path, set_path} from '../utils.js'
import {SALT_ROUNDS} from '../configs/constants.js'

export const compare_password = ({input_password_path = 'login_data.password', stored_hash_path = 'user_data.password'} = {}) => {
    return async (req, res, next) => {
        try {
            const input_password = get_path(res, input_password_path)
            set_path(res, input_password_path, null)
            const stored_hash = get_path(res, stored_hash_path)
            const match = await bcrypt.compare(input_password, stored_hash)
            if (!match) {
                return res.status(401).json({message: 'Password incorrect'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const hash_password = ({password_path = 'user_data.password', hash_path = 'user_data.password'} = {}) => {
    return async (req, res, next) => {
        try {
            const password = get_path(res, password_path)
            set_path(res, password_path, null)
            if (zxcvbn(password).score < PASSWORD_MIN_SCORE) {
                return res.status(400).json({message: 'Password too weak'})
            }
            const hash = await bcrypt.hash(password, SALT_ROUNDS)
            set_path(res, hash_path, hash)
            next()
        } catch (error) {
            next(error)
        }
    }
}
