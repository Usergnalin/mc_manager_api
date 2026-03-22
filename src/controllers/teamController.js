import * as team_model from "../models/teamModel.js"
import { get_path, set_path } from "../utils.js"

export const create_team = ({
    team_data_path = "team_data",
    user_id_path = "user_id",
    output_team_data_path = "team_data",
} = {}) => {
    return (req, res, next) => {
        const { team_name } = get_path(res, team_data_path)
        const user_id = get_path(res, user_id_path)
        if (team_name === undefined || user_id === undefined) {
            console.error("No data found at path(s):", team_data_path, user_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        team_model.insert_single({ team_name, user_id }, (error, results) => {
            if (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({ message: "Team already exists" })
                } else {
                    console.error("Error team_model insert_single:", error)
                    return res.status(500).json({ message: "Internal server error" })
                }
            }
            set_path(res, output_team_data_path, {
                team_id: results.team_id,
                slug: results.slug,
            })
            next()
        })
    }
}

export const check_access_by_user_id_and_role = ({
    team_id_path = "team_id",
    user_id_path = "user_id",
    role = [],
} = {}) => {
    return (req, res, next) => {
        const team_id = get_path(res, team_id_path)
        const user_id = get_path(res, user_id_path)
        if (team_id === undefined || user_id === undefined) {
            console.error("No data found at path(s):", team_id_path, user_id_path)
            return res.status(500).json({ message: "Internal server error" })
        }
        team_model.check_access_by_user_id_and_role(
            { team_id, user_id, role },
            (error, results) => {
                if (error) {
                    console.error("Error team_model check_access_by_user_id_and_role:", error)
                    return res.status(500).json({ message: "Internal server error" })
                }
                if (results[0].has_access === 0) {
                    return res
                        .status(403)
                        .json({ message: "User does not have access to this team" })
                }
                next()
            },
        )
    }
}
