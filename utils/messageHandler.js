const { parseMessage } = require('./parser')

/**
 * receiveMessages - gestisce i messaggi in arrivo, li salva nel DB e imposta eventuali promemoria
 * @param ctx 
 * @param db 
 * @param saveDB 
 */
function receiveMessages(ctx, db, saveDB) {

  const parsed = parseMessage(ctx.message.text)

  const entry = {
    id: Date.now(),
    text: parsed.text,
    reminder_at: parsed.reminder_at,
    tags: parsed.tags,
    chat_id: ctx.chat.id,
    message_id: ctx.message.message_id,
    sent: false,
    created_at: new Date().toISOString()
  }

  db.push(entry)
  saveDB(db)

  if (entry.reminder_at) {
    ctx.reply(`ok, ti ricorderò di "${entry.text}" il ${new Date(entry.reminder_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`)
  } else {
    ctx.reply('memoria salvata.')
  }
}

exports.receiveMessages = receiveMessages