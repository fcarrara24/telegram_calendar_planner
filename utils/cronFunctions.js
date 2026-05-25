/**
 * funzione che invia un messaggio di buongiorno ogni * mattina alle 8
 * @param {*} bot 
 * @returns 
 */
function heartbeat(bot) {
    const chatId = process.env.CHAT_ID || null; 
    if (!chatId) return

    bot.telegram.sendMessage(
    chatId,
    '☀️ buongiorno campione'
    )
}

/**
 * controlla se ci sono promemoria da inviare / scaduti, 
 * li invia e aggiorna lo stato del DB
 * @param {*} bot 
 * @param {*} db 
 * @param {*} saveDB 
 */
function checkReminders(bot, db, saveDB) {
    
    const now = new Date();

    const nowIT = now.toLocaleString('it-IT', {
        timeZone: 'Europe/Rome'
    });

    let changed = false

    db.forEach(entry => {
        
        if (!entry.reminder_at) return
        if (entry.sent) return
        
        // console.log(`⏰ checking reminder for entry ${entry.id} - reminder_at: ${entry.reminder_at} - now: ${nowIT}`)

        if (new Date(entry.reminder_at) <= now) {
            
            // console.log(`✅ reminder sent for entry ${entry.id}`)
            bot.telegram.sendMessage(
                entry.chat_id,
                `⏰ REMINDER:\n\n${entry.text}`
            )

            entry.sent = true
            changed = true
        }
    })
    
    if (changed) saveDB(db)
}

module.exports = { checkReminders, heartbeat }

