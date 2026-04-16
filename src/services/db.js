import mysql from 'mysql2/promise'

const setting = {
    connectionLimit: 100,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    multipleStatements: true,
    dateStrings: true,
}

const pool = mysql.createPool(setting)

export default pool
