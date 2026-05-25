const fs = require('fs');
const DB_FILE = require('./DB_CONSTANTS').DB_FILE

/**
 * LOAD DB
 */
function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE));
  } catch (e) {
    return [];
  }
}
/**
 * SAVE DB
 */
function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}


exports.loadDB = loadDB;
exports.saveDB = saveDB;
