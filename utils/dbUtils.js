const fs = require('fs');
const DB_FILE = require('./DB_CONSTANTS').DB_FILE

/**
 * LOAD DB
 */
function loadDB() {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE));
    if (Array.isArray(data)) {
      // Migrazione database da array piatto a oggetto
      const migrated = {
        reminders: data,
        memory: [],
        planHistory: [],
        activePlanSession: null
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(migrated, null, 2));
      return migrated;
    }
    
    // Inizializza i campi se mancanti
    if (!data.reminders) data.reminders = [];
    if (!data.memory) data.memory = [];
    if (!data.planHistory) data.planHistory = [];
    if (data.activePlanSession === undefined) data.activePlanSession = null;
    
    return data;
  } catch (e) {
    return {
      reminders: [],
      memory: [],
      planHistory: [],
      activePlanSession: null
    };
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
