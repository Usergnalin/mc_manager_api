import pool from "../services/db.js"
import { v7 as uuid } from "uuid"
import { generate_slug } from "../utils.js"

export const insert_single = (data, callback) => {
    const statement = `
    START TRANSACTION;
    INSERT INTO User (user_id, username, password) VALUES (UUID_TO_BIN(?), ?, ?);
    INSERT INTO Team (team_id, team_name, slug) VALUES (UUID_TO_BIN(?), ?, ?);
    INSERT INTO UserTeam (user_id, team_id, role) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?);
    COMMIT;
    `
    const team_id = uuid()
    const user_id = uuid()
    const slug = generate_slug()
    const team_name = `${data.username}'s Team`
    const values = [
        user_id,
        data.username,
        data.password,
        team_id,
        team_name,
        slug,
        user_id,
        team_id,
        "admin",
    ]
    pool.query(statement, values, (error, results) => {
        if (results) {
            results.user_id = user_id
            results.team_id = team_id
            results.slug = slug
        }
        callback(error, results)
    })
}

export const select_by_id = (data, columns, callback) => {
    const formatted_columns = columns.map((column) => {
        if (column === "user_id") return "BIN_TO_UUID(user_id) AS user_id"
        return column
    })
    const statement = `
    SELECT ${formatted_columns.join(", ")}
    FROM User
    WHERE user_id = UUID_TO_BIN(?)
    `
    const values = [data.user_id]
    pool.query(statement, values, callback)
}

export const select_by_username = (data, columns, callback) => {
    const formatted_columns = columns.map((column) => {
        if (column === "user_id") return "BIN_TO_UUID(user_id) AS user_id"
        return column
    })
    const statement = `
    SELECT ${formatted_columns.join(", ")}
    FROM User
    WHERE username = ?
    `
    const values = [data.username]
    pool.query(statement, values, callback)
}

export const update_by_id = (data, columns, callback) => {
    const fields = []
    const values = []
    columns.forEach((column) => {
        if (data[column] !== undefined) {
            fields.push(`${column} = ?`)
            values.push(data[column])
        }
    })
    const statement = `
        UPDATE User
        SET ${fields.join(", ")}
        WHERE user_id = UUID_TO_BIN(?)
    `
    values.push(data.user_id)
    pool.query(statement, values, callback)
}
