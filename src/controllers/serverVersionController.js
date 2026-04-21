import * as server_version_model from '../models/serverVersionModel.js'
import {get_path, set_path} from '../utils.js'

export const get_loaders_by_mc_version = ({mc_version_path = 'mc_version', output_loaders_path = 'loaders'} = {}) => {
    return async (req, res, next) => {
        try {
            const mc_version = get_path(res, mc_version_path)
            const loaders = await server_version_model.get_loaders_by_mc_version(mc_version)
            if (!loaders) {
                return res.status(404).json({message: 'MC version not found'})
            }
            set_path(res, output_loaders_path, loaders)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const get_mc_versions = ({output_mc_versions_path = 'mc_versions'} = {}) => {
    return async (req, res, next) => {
        try {
            const mc_versions = await server_version_model.get_mc_versions()
            set_path(res, output_mc_versions_path, mc_versions)
            next()
        } catch (error) {
            next(error)
        }
    }
}