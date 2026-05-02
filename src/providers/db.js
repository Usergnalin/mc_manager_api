import mysql from 'mysql2/promise'

const setting = {
    connectionLimit: 100,
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true,
    dateStrings: true,
}

const pool = mysql.createPool(setting)

export default pool
