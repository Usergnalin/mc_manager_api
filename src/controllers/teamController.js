import * as team_model from '../models/teamModel.js'
import {set_path, get_path} from '../utils.js'

export const create_team = ({team_data_path = 'team_data', user_id_path = 'user_id', output_team_data_path = 'team_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const {team_name} = get_path(res, team_data_path)
            const user_id = get_path(res, user_id_path)
            const results = await team_model.insert_single(user_id, {team_name})
            set_path(res, output_team_data_path, {
                team_id: results.team_id,
                slug: results.slug,
            })
            next()
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({message: 'Team already exists'})
            }
            next(error)
        }
    }
}

export const check_access_by_user_id_and_role = ({team_id_path = 'team_id', user_id_path = 'user_id', role = []} = {}) => {
    return async (req, res, next) => {
        try {
            const team_id = get_path(res, team_id_path)
            const user_id = get_path(res, user_id_path)
            const results = await team_model.check_access_by_user_id_and_role(user_id, team_id, role)
            if (!results.user_exists) {
                return res.status(404).json({message: 'User not found'})
            }
            if (!results.team_exists) {
                return res.status(404).json({message: 'Team not found'})
            }
            if (!results.has_access) {
                return res.status(403).json({message: 'User does not have access to this team'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}
