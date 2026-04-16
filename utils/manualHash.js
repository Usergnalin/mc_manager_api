const bcrypt = require('bcrypt')

const SALT_ROUNDS = 10
const password = '123'

bcrypt.hash(password, SALT_ROUNDS, (err, hash) => {
    if (err) {
        console.error('Error bcrypt:', err)
    } else {
        console.log('Hashed password:', hash)
    }
})
