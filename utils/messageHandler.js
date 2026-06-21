const { parseMessage } = require('./parser')
const { generatePlanDraft } = require('./geminiClient')

/**
 * receiveMessages - gestisce i messaggi in arrivo, li salva nel DB e imposta eventuali promemoria.
 * Se c'è una sessione di pianificazione attiva, instrada il messaggio come feedback per Gemini.
 * @param ctx 
 * @param db 
 * @param saveDB 
 */
async function receiveMessages(ctx, db, saveDB) {
  // Controlla se c'è una sessione di pianificazione attiva per questa chat
  if (db.activePlanSession && db.activePlanSession.chat_id === ctx.chat.id) {
    const feedback = ctx.message.text;
    
    // Mostra l'indicatore di digitazione
    await ctx.sendChatAction('typing');
    
    try {
      const memoryList = db.memory || [];
      const session = db.activePlanSession;
      
      // Estrae gli ultimi 2 piani confermati come contesto di continuità
      const pastPlans = db.planHistory ? db.planHistory.slice(-2) : [];
      
      // Invia il feedback a Gemini con lo storico corrente e i piani passati
      const response = await generatePlanDraft(feedback, memoryList, session.history, pastPlans);
      
      // Aggiorna lo stato della sessione
      session.history = response.history;
      session.currentProposal = response.text;
      
      saveDB(db);
      
      await ctx.reply(response.text, { parse_mode: 'Markdown' });
      await ctx.reply("✍️ Se vuoi cambiare qualcosa, rispondi scrivendo le modifiche.\nSe ti va bene, scrivi /ok per confermare.\nAltrimenti scrivi /cancel per annullare.");
    } catch (error) {
      console.error("Errore durante l'elaborazione del feedback del piano:", error);
      await ctx.reply(`❌ Errore durante l'elaborazione del piano: ${error.message}`);
    }
    return;
  }

  // Altrimenti, procedi con la creazione di un normale reminder
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

  if (!db.reminders) db.reminders = [];
  db.reminders.push(entry)
  saveDB(db)

  if (entry.reminder_at) {
    ctx.reply(`ok, ti ricorderò di "${entry.text}" il ${new Date(entry.reminder_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`)
  } else {
    ctx.reply('memoria salvata.')
  }
}

exports.receiveMessages = receiveMessages