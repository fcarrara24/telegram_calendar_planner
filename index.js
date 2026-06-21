const dotenv = require('dotenv').config()
const chrono = require('chrono-node')
const cron = require('node-cron')
const express = require('express')

const { Telegraf } = require('telegraf')
const { extractNumberAfterTra, extractTime, parseExplicitDate, setTimeRelative, makeRomeDate } = 
  require('./utils/timeUtils')
const {  checkReminders, heartbeat } = require('./utils/cronFunctions')
const { receiveMessages } = require('./utils/messageHandler')
const { loadDB, saveDB } = require('./utils/dbUtils')
const { parseMessage } = require('./utils/parser')
const { HELP_MESSAGE } = require('./utils/HELP_MESSAGE')
const { generatePlanDraft, extractTasks, updateMemories } = require('./utils/geminiClient')

const bot = new Telegraf(process.env.BOT_TOKEN)

const db = loadDB()

/**
 * EXPRESS (railway port verification)
 */
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.get('/', (req, res) => {
  res.send('Bot online')
})

app.listen(PORT, () => {
  console.log(`🌍 Server listening on port ${PORT}`)
})

/**
 * COMANDO HELP
 */
bot.help((ctx) => {
  ctx.reply(HELP_MESSAGE)
})

/**
 * COMANDI DI MEMORIA E PIANIFICAZIONE (GEMINI)
 */

// /memory <fatto>
bot.command('memory', async (ctx) => {
  const text = ctx.message.text.substring(7).trim(); // "/memory" length is 7
  if (!text) {
    return ctx.reply("ℹ️ Uso: `/memory <fatto da ricordare>`\nEsempio: `/memory lavoro dalle 8 alle 17`", { parse_mode: 'Markdown' });
  }
  
  if (!db.memory) db.memory = [];
  db.memory.push(text);
  saveDB(db);
  
  ctx.reply(`🧠 Ricordo aggiunto alla memoria di lavoro:\n- *${text}*`, { parse_mode: 'Markdown' });
});

// /show-memory [index]
bot.command('show-memory', (ctx) => {
  if (!db.memory || db.memory.length === 0) {
    return ctx.reply("🧠 La tua memoria di lavoro è vuota.\nUsa `/memory <fatto>` per aggiungere informazioni.", { parse_mode: 'Markdown' });
  }
  
  const arg = ctx.message.text.substring(12).trim(); // "/show-memory" length is 12
  if (arg) {
    const index = parseInt(arg, 10);
    if (isNaN(index) || index < 1 || index > db.memory.length) {
      return ctx.reply(`⚠️ Indice non valido. Specifica un numero da 1 a ${db.memory.length}.`);
    }
    return ctx.reply(`🧠 *Regola #${index} in memoria:*\n\n"${db.memory[index - 1]}"`, { parse_mode: 'Markdown' });
  }
  
  const formatted = db.memory.map((m, i) => `${i + 1}. ${m}`).join('\n');
  ctx.reply(`🧠 *La tua memoria di lavoro:*\n\n${formatted}`, { parse_mode: 'Markdown' });
});

// /edit-memory [index / CRUD / modifiche]
bot.command('edit-memory', async (ctx) => {
  const text = ctx.message.text.substring(12).trim(); // "/edit-memory" length is 12
  if (!text) {
    return ctx.reply("ℹ️ Uso:\n- `/edit-memory <descrivi le modifiche>` (usa Gemini)\n- `/edit-memory <indice> <nuovo testo>` (modifica tecnica)\n- `/edit-memory delete <indice>` o `/edit-memory <indice> delete` (elimina elemento)", { parse_mode: 'Markdown' });
  }
  
  const tokens = text.split(/\s+/);
  let index = null;
  let action = null;
  let content = null;
  
  // Caso 1: Primo token è un numero (es. "3", "3 delete", "3 nuovo testo")
  if (/^\d+$/.test(tokens[0])) {
    index = parseInt(tokens[0], 10);
    if (tokens[1] === 'delete' || tokens[1] === 'remove') {
      action = 'delete';
    } else if (tokens.length > 1) {
      action = 'edit';
      content = tokens.slice(1).join(' ');
    } else {
      action = 'show_instruction';
    }
  }
  // Caso 2: Primo token è "delete" o "remove" e secondo token è un numero (es. "delete 3")
  else if ((tokens[0] === 'delete' || tokens[0] === 'remove') && /^\d+$/.test(tokens[1])) {
    index = parseInt(tokens[1], 10);
    action = 'delete';
  }
  
  // Se abbiamo rilevato un comando ad indice
  if (index !== null) {
    if (!db.memory || db.memory.length === 0) {
      return ctx.reply("🧠 La memoria di lavoro è vuota.");
    }
    if (index < 1 || index > db.memory.length) {
      return ctx.reply(`⚠️ Indice non valido. Specifica un numero da 1 a ${db.memory.length}.`);
    }
    
    if (action === 'delete') {
      const removed = db.memory.splice(index - 1, 1);
      saveDB(db);
      return ctx.reply(`🗑️ Rimossa regola #${index}: "${removed[0]}"`);
    } else if (action === 'edit') {
      const oldRule = db.memory[index - 1];
      db.memory[index - 1] = content;
      saveDB(db);
      return ctx.reply(`📝 Aggiornata regola #${index} con successo:\n\n*Prima:* "${oldRule}"\n*Dopo:* "${content}"`, { parse_mode: 'Markdown' });
    } else {
      return ctx.reply(`ℹ️ Per modificare la regola #${index}, scrivi:\n\`/edit-memory ${index} <nuovo testo>\`\nPer eliminarla:\n\`/edit-memory ${index} delete\``, { parse_mode: 'Markdown' });
    }
  }
  
  // Fallback a Gemini
  await ctx.sendChatAction('typing');
  try {
    if (!db.memory) db.memory = [];
    const updated = await updateMemories(db.memory, text);
    db.memory = updated;
    saveDB(db);
    
    if (db.memory.length === 0) {
      ctx.reply("🧠 La memoria di lavoro è stata svuotata.");
    } else {
      const formatted = db.memory.map((m, i) => `${i + 1}. ${m}`).join('\n');
      ctx.reply(`🧠 *Memoria di lavoro aggiornata con Gemini:*\n\n${formatted}`, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error("Errore /edit-memory:", error);
    ctx.reply(`❌ Errore durante l'aggiornamento della memoria: ${error.message}`);
  }
});

// /plan <prompt>
bot.command('plan', async (ctx) => {
  const prompt = ctx.message.text.substring(5).trim(); // "/plan" length is 5
  if (!prompt) {
    return ctx.reply("ℹ️ Uso: `/plan <diario/pensieri/programmi per domani>`\nEsempio: `/plan stasera sono stanco morto, domani ho lavoro dalle 8 alle 17, devo ricordarmi la spesa e studiare dopo cena.`", { parse_mode: 'Markdown' });
  }
  
  await ctx.sendChatAction('typing');
  try {
    const memoryList = db.memory || [];
    
    // Recupera gli ultimi 2 piani confermati come contesto di continuità
    const pastPlans = db.planHistory ? db.planHistory.slice(-2) : [];
    
    // Genera la bozza iniziale
    const response = await generatePlanDraft(prompt, memoryList, [], pastPlans);
    
    // Salva lo stato della sessione attiva
    db.activePlanSession = {
      chat_id: ctx.chat.id,
      date: new Date().toISOString(),
      history: response.history,
      currentProposal: response.text,
      originalPrompt: prompt
    };
    saveDB(db);
    
    await ctx.reply(response.text, { parse_mode: 'Markdown' });
    await ctx.reply("✍️ Se vuoi cambiare qualcosa, rispondi scrivendo le modifiche.\nSe ti va bene, scrivi /ok per confermare.\nAltrimenti scrivi /cancel per annullare.");
  } catch (error) {
    console.error("Errore /plan:", error);
    ctx.reply(`❌ Errore durante la generazione del piano: ${error.message}`);
  }
});

// /show-plan
bot.command('show-plan', (ctx) => {
  // Trova il piano confermato per oggi (formato YYYY-MM-DD nel fuso orario di Roma)
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  
  if (!db.planHistory || db.planHistory.length === 0) {
    return ctx.reply("📅 Non ci sono piani salvati nello storico.");
  }
  
  const plan = db.planHistory.find(p => p.date === todayStr);
  if (plan) {
    return ctx.reply(`📅 *Pianificazione di Oggi (${todayStr}):*\n\n${plan.plan}`, { parse_mode: 'Markdown' });
  }
  
  const lastPlan = db.planHistory[db.planHistory.length - 1];
  ctx.reply(`📅 Nessun piano trovato per oggi (${todayStr}).\n\n*Ultimo piano confermato (${lastPlan.date}):*\n\n${lastPlan.plan}`, { parse_mode: 'Markdown' });
});

// /cancel
bot.command('cancel', (ctx) => {
  if (!db.activePlanSession || db.activePlanSession.chat_id !== ctx.chat.id) {
    return ctx.reply("Non c'è nessuna sessione di pianificazione attiva da annullare.");
  }
  
  db.activePlanSession = null;
  saveDB(db);
  ctx.reply("Sessione di pianificazione annullata. 🛑");
});

// /ok
bot.command('ok', async (ctx) => {
  const session = db.activePlanSession;
  if (!session || session.chat_id !== ctx.chat.id) {
    return ctx.reply("Non c'è nessuna sessione di pianificazione attiva da confermare. Avviane una con `/plan`.", { parse_mode: 'Markdown' });
  }
  
  await ctx.sendChatAction('typing');
  try {
    // Calcola il contesto della data odierna (in Europe/Rome) per calcolare la data esatta dei reminder
    const today = new Date();
    const todayContext = today.toLocaleDateString('it-IT', {
      timeZone: 'Europe/Rome',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) + ` (${today.toISOString().split('T')[0]})`;
    
    // Estrae i task orari strutturati e la data target del piano
    const { plan_date, tasks } = await extractTasks(session.currentProposal, todayContext);
    
    // Salva il piano nello storico
    if (!db.planHistory) db.planHistory = [];
    db.planHistory.push({
      date: plan_date,
      prompt: session.originalPrompt,
      plan: session.currentProposal,
      created_at: new Date().toISOString()
    });
    
    // Crea i reminder 5 minuti prima
    let remindersCreated = 0;
    if (tasks && tasks.length > 0) {
      if (!db.reminders) db.reminders = [];
      
      tasks.forEach(task => {
        // time è in formato HH:MM (es. 08:30)
        // plan_date è in formato YYYY-MM-DD (es. 2026-06-22)
        
        // Calcola la data del reminder (5 minuti prima dell'evento)
        const eventDate = makeRomeDate(plan_date, task.time);
        const reminderDate = new Date(eventDate.getTime() - 5 * 60 * 1000);
        
        const entry = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          text: `Tra 5 minuti inizia: ${task.description} (ore ${task.time})`,
          reminder_at: reminderDate.toISOString(),
          tags: ['plan-reminder'],
          chat_id: ctx.chat.id,
          sent: false,
          created_at: new Date().toISOString()
        };
        
        db.reminders.push(entry);
        remindersCreated++;
      });
    }
    
    // Pulisce la sessione attiva
    db.activePlanSession = null;
    saveDB(db);
    
    let replyMsg = `✅ *Piano confermato e salvato con successo per il giorno ${plan_date}!*\n\n`;
    if (remindersCreated > 0) {
      replyMsg += `⏰ Ho programmato *${remindersCreated} promemoria* (5 minuti prima di ogni attività).`;
    } else {
      replyMsg += `⚠️ Non ho trovato attività con orari espliciti nel piano. Nessun promemoria programmato.`;
    }
    ctx.reply(replyMsg, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error("Errore /ok:", error);
    ctx.reply(`❌ Errore durante la conferma del piano: ${error.message}`);
  }
});

// /export [days]
bot.command('export', async (ctx) => {
  const arg = ctx.message.text.substring(7).trim();
  const days = parseInt(arg, 10) || 7;
  
  if (!db.planHistory || db.planHistory.length === 0) {
    return ctx.reply("Non ci sono piani salvati nello storico da esportare.");
  }
  
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  const filtered = db.planHistory.filter(entry => {
    const entryDate = new Date(entry.created_at || entry.date);
    return entryDate >= cutoffDate;
  });
  
  if (filtered.length === 0) {
    return ctx.reply(`Non ho trovato piani registrati negli ultimi ${days} giorni.`);
  }
  
  let exportText = `ESPORTAZIONE PIANI DELLE ULTIME ${days} GIORNATE\n`;
  exportText += `Generato il: ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}\n`;
  exportText += `==================================================\n\n`;
  
  filtered.forEach((entry, index) => {
    exportText += `### GIORNATA: ${entry.date}\n`;
    exportText += `Prompt: ${entry.prompt}\n`;
    exportText += `Data Creazione: ${entry.created_at || 'Non specificata'}\n`;
    exportText += `Piano Generato:\n${entry.plan}\n`;
    exportText += `\n==================================================\n\n`;
  });
  
  try {
    const buffer = Buffer.from(exportText, 'utf-8');
    await ctx.replyWithDocument({ source: buffer, filename: `export_piani_${days}_giorni.txt` }, { caption: `Ecco i piani degli ultimi ${days} giorni.` });
  } catch (error) {
    console.error("Errore /export:", error);
    ctx.reply(`❌ Errore durante l'esportazione: ${error.message}`);
  }
});

/**
 * RICEZIONE MESSAGGI
 */
bot.on('text', (ctx) => receiveMessages(ctx, db, saveDB))


/**
 * HEARTBEAT MATTUTINO
 */
// cron.schedule('0 8 * * *', hearbeat)
cron.schedule('0 8 * * *', () => heartbeat(bot))

/**
 * CHECK REMINDER OGNI MINUTO
 */
cron.schedule('* * * * *', () => checkReminders(bot, db, saveDB))

/**
 * START BOT
 */
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? null
if (WEBHOOK_URL) {
  const secretPath = `/webhook/${process.env.BOT_TOKEN ? process.env.BOT_TOKEN.replace(/:/g, '_') : 'default'}`
  app.use(bot.webhookCallback(secretPath))
  bot.telegram.setWebhook(`${WEBHOOK_URL}${secretPath}`)
    .then(() => console.log(`🤖 Bot connesso via Webhook su: ${WEBHOOK_URL}${secretPath}`))
    .catch(err => console.error('❌ Errore impostazione webhook:', err))
} else {
  bot.launch()
    .then(() => console.log('🤖 Bot connesso (Long Polling)'))
    .catch(err => console.error('❌ Errore bot:', err))
}

// console.log({db})

console.log('🤖 bot online')

