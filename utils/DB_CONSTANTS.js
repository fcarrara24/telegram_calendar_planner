const path = require('path')
const os = require('os')

const DB_FILE = path.join(__dirname, '..', 'db.json')
// console.log(`DB_FILE: ${DB_FILE}`)

module.exports = { DB_FILE }