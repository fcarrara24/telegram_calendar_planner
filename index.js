const dotenv = require('dotenv').config()
const chrono = require('chrono-node')
const cron = require('node-cron')
const express = require('express')

const { Telegraf } = require('telegraf')
const { extractNumberAfterTra, extractTime, parseExplicitDate, setTimeRelative, makeRomeDate, formatTaskList } = 
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
  const text = ctx.message.text.split(/\s+/).slice(1).join(' ').trim();
  if (text.toLowerCase() === 'help') {
    return ctx.reply(`🧠 *Guida all'uso del comando /memory:*

Aggiunge un fatto o un vincolo stabile alla tua memoria di lavoro. Gemini utilizzerà questi fatti ogni volta che genererà una nuova proposta di pianificazione con \`/plan\`.

*Uso:*
- \`/memory <fatto da ricordare>\`
  *Esempio:* \`/memory il venerdì esco prima dall'ufficio alle 16:00\`
  *Esempio:* \`/memory a pranzo mangio sempre leggero\`

*Comandi correlati:*
- \`/showMemory\` o \`/show-memory\` : Mostra l'elenco della memoria di lavoro.
- \`/editMemory\` o \`/edit-memory\` : Modifica o rimuove elementi della memoria.`, { parse_mode: 'Markdown' });
  }

  if (!text) {
    return ctx.reply("ℹ️ Uso: `/memory <fatto da ricordare>`\nEsempio: `/memory lavoro dalle 8 alle 17`", { parse_mode: 'Markdown' });
  }
  
  if (!db.memory) db.memory = [];
  db.memory.push(text);
  saveDB(db);
  
  ctx.reply(`🧠 Ricordo aggiunto alla memoria di lavoro:\n- *${text}*`, { parse_mode: 'Markdown' });
});

// /show-memory [index]
bot.command(['show-memory', 'showMemory'], (ctx) => {
  const arg = ctx.message.text.split(/\s+/).slice(1).join(' ').trim();
  if (arg.toLowerCase() === 'help') {
    return ctx.reply(`🧠 *Guida all'uso del comando /show-memory (/showMemory):*

Mostra la lista completa dei fatti e preferenze salvati nella memoria di lavoro.

*Uso:*
- \`/show-memory\` : Mostra l'intera lista numerata.
- \`/show-memory <indice>\` : Mostra solo l'elemento specifico a quell'indice.
  *Esempio:* \`/show-memory 2\``, { parse_mode: 'Markdown' });
  }

  if (!db.memory || db.memory.length === 0) {
    return ctx.reply("🧠 La tua memoria di lavoro è vuota.\nUsa `/memory <fatto>` per aggiungere informazioni.", { parse_mode: 'Markdown' });
  }
  
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
bot.command(['edit-memory', 'editMemory'], async (ctx) => {
  const text = ctx.message.text.split(/\s+/).slice(1).join(' ').trim();
  if (text.toLowerCase() === 'help') {
    return ctx.reply(`📝 *Guida all'uso del comando /edit-memory (/editMemory):*

Consente di modificare o eliminare fatti salvati nella memoria di lavoro. Può essere usato sia in linguaggio naturale (con Gemini) sia manualmente tramite indicizzazione.

*Uso con IA (Gemini):*
- \`/edit-memory <modifiche richieste>\`
  *Esempio:* \`/edit-memory cancella il fatto del medico e aggiungi che vado in palestra alle 19\`

*Uso Manuale:*
- \`/edit-memory <indice> <nuovo testo>\` : Aggiorna manualmente l'elemento all'indice indicato.
  *Esempio:* \`/edit-memory 2 lavoro dalle 9 alle 18\`
- \`/edit-memory <indice> delete\` : Rimuove l'elemento all'indice indicato.
  *Esempio:* \`/edit-memory 3 delete\``, { parse_mode: 'Markdown' });
  }

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
  const prompt = ctx.message.text.split(/\s+/).slice(1).join(' ').trim();
  if (prompt.toLowerCase() === 'help') {
    return ctx.reply(`📖 *Guida all'uso del comando /plan:*

Il comando \`/plan\` avvia la pianificazione giornaliera assistita da intelligenza artificiale (Gemini).

*Uso:*
- \`/plan <i tuoi pensieri o programmi del giorno>\`
  *Esempio:* \`/plan domani mi sveglio alle 8, lavoro fino alle 17, poi vado a correre e ceno con la mia famiglia alle 20.30.\`

*Flusso di lavoro:*
1. Mandi la descrizione della giornata.
2. Il bot risponde con una bozza oraria ordinata in Markdown e mostra la lista delle attività rilevate.
3. Se vuoi modificare qualcosa, rispondi semplicemente al messaggio specificando le modifiche (es. *"sposta la corsa alle 18"*).
4. Quando il piano è corretto, invia il comando:
   - \`/ok\` : Conferma il piano, lo salva nello storico e programma i relativi promemoria automatici 5 minuti prima di ogni attività.
   - \`/cancel\` : Annulla la sessione e cancella la bozza corrente.

*Comandi correlati:*
- \`/showPlan\` o \`/show-plan\` : Mostra il piano confermato per oggi (con i relativi promemoria).
- \`/cancel\` : Annulla la sessione attiva.
- \`/ok\` : Conferma la bozza attiva.`, { parse_mode: 'Markdown' });
  }

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
    
    // Calcola il contesto della data odierna per estrarre i task
    const today = new Date();
    const todayContext = today.toLocaleDateString('it-IT', {
      timeZone: 'Europe/Rome',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) + ` (${today.toISOString().split('T')[0]})`;
    
    // Estrae e formatta la lista delle attività
    const { plan_date, tasks } = await extractTasks(response.text, todayContext);
    const tasksText = formatTaskList(tasks, plan_date);
    
    // Salva lo stato della sessione attiva
    db.activePlanSession = {
      chat_id: ctx.chat.id,
      date: new Date().toISOString(),
      history: response.history,
      currentProposal: response.text,
      originalPrompt: prompt
    };
    saveDB(db);
    
    await ctx.reply(`${response.text}\n\n${tasksText}`, { parse_mode: 'Markdown' });
    await ctx.reply("✍️ Se vuoi cambiare qualcosa, rispondi scrivendo le modifiche.\nSe ti va bene, scrivi /ok per confermare.\nAltrimenti scrivi /cancel per annullare.");
  } catch (error) {
    console.error("Errore /plan:", error);
    ctx.reply(`❌ Errore durante la generazione del piano: ${error.message}`);
  }
});

function getPlanRemindersText(planDate) {
  if (!db.reminders || db.reminders.length === 0) {
    return "⏰ *Nessun promemoria in coda nel sistema.*";
  }
  
  const planReminders = db.reminders.filter(r => {
    if (!r.reminder_at) return false;
    const rDateStr = new Date(r.reminder_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    return rDateStr === planDate && r.tags && r.tags.includes('plan-reminder');
  });
  
  if (planReminders.length === 0) {
    return "⏰ *Nessun promemoria attivo trovato per questo piano.*";
  }
  
  planReminders.sort((a, b) => new Date(a.reminder_at) - new Date(b.reminder_at));
  
  let text = "⏰ *Orari di chiamata al servizio notifiche (reminder 5 min prima):*\n";
  planReminders.forEach(r => {
    const timeStr = new Date(r.reminder_at).toLocaleTimeString('it-IT', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const status = r.sent ? "✅ Inviato" : "⏳ Programmato";
    text += `- *${timeStr}* (${status}): ${r.text}\n`;
  });
  
  return text;
}

// /show-plan
bot.command(['show-plan', 'showPlan'], (ctx) => {
  const arg = ctx.message.text.split(/\s+/).slice(1).join(' ').trim();
  if (arg.toLowerCase() === 'help') {
    return ctx.reply(`📅 *Guida all'uso del comando /show-plan (/showPlan):*

Mostra la pianificazione giornaliera confermata e i promemoria/notifiche programmati per quella giornata.

*Uso:*
- \`/show-plan\` (o \`/showPlan\`): Mostra il piano per la giornata odierna. Se non è presente, mostra l'ultimo piano registrato nello storico.`, { parse_mode: 'Markdown' });
  }

  // Trova il piano confermato per oggi (formato YYYY-MM-DD nel fuso orario di Roma)
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  
  if (!db.planHistory || db.planHistory.length === 0) {
    return ctx.reply("📅 Non ci sono piani salvati nello storico.");
  }
  
  const plan = db.planHistory.find(p => p.date === todayStr);
  if (plan) {
    const remindersText = getPlanRemindersText(todayStr);
    return ctx.reply(`📅 *Pianificazione di Oggi (${todayStr}):*\n\n${plan.plan}\n\n${remindersText}`, { parse_mode: 'Markdown' });
  }
  
  const lastPlan = db.planHistory[db.planHistory.length - 1];
  const remindersText = getPlanRemindersText(lastPlan.date);
  ctx.reply(`📅 Nessun piano trovato per oggi (${todayStr}).\n\n*Ultimo piano confermato (${lastPlan.date}):*\n\n${lastPlan.plan}\n\n${remindersText}`, { parse_mode: 'Markdown' });
});

// /cancel
bot.command('cancel', (ctx) => {
  const arg = ctx.message.text.split(/\s+/).slice(1).join(' ').trim();
  if (arg.toLowerCase() === 'help') {
    return ctx.reply(`🛑 *Guida all'uso del comando /cancel:*

Annulla la sessione di pianificazione corrente con Gemini e cancella la bozza temporanea senza salvare nulla.`, { parse_mode: 'Markdown' });
  }

  if (!db.activePlanSession || db.activePlanSession.chat_id !== ctx.chat.id) {
    return ctx.reply("Non c'è nessuna sessione di pianificazione attiva da annullare.");
  }
  
  db.activePlanSession = null;
  saveDB(db);
  ctx.reply("Sessione di pianificazione annullata. 🛑");
});

// /ok
bot.command('ok', async (ctx) => {
  const arg = ctx.message.text.split(/\s+/).slice(1).join(' ').trim();
  if (arg.toLowerCase() === 'help') {
    return ctx.reply(`✅ *Guida all'uso del comando /ok:*

Conferma la bozza di pianificazione generata con Gemini.

*Cosa fa:*
1. Salva la pianificazione definitiva nello storico.
2. Estrae tutti i compiti orari presenti.
3. Programma in automatico i relativi promemoria (eseguiti 5 minuti prima di ogni inizio attività).
4. Chiude la sessione di pianificazione attiva.`, { parse_mode: 'Markdown' });
  }

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
  const arg = ctx.message.text.split(/\s+/).slice(1).join(' ').trim();
  if (arg.toLowerCase() === 'help') {
    return ctx.reply(`📦 *Guida all'uso del comando /export:*

Esporta lo storico dei piani giornalieri confermati in un file di testo (.txt) scaricabile.

*Uso:*
- \`/export\` : Esporta i piani degli ultimi 7 giorni.
- \`/export <numero giorni>\` : Specifica quanti giorni esportare.
  *Esempio:* \`/export 30\` (esporta l'ultimo mese)`, { parse_mode: 'Markdown' });
  }

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
 * UTILITY AGGIUNTIVE DI QUOTIDIANITÀ
 */

// /todo o /todos
bot.command(['todo', 'todos'], (ctx) => {
  const arg = ctx.message.text.split(/\s+/).slice(1).join(' ').trim();
  
  if (arg.toLowerCase() === 'help') {
    return ctx.reply(`📋 *Guida all'uso dei To-Do:*

Gestisci una lista di cose da fare rapida, non legata a orari specifici.

*Uso:*
- \`/todo\` : Mostra la tua lista di To-Do.
- \`/todo <attività>\` : Aggiunge una nuova attività alla lista.
  *Esempio:* \`/todo comprare il latte\`
- \`/todo done <indice>\` : Segna come completata (ed elimina) l'attività all'indice specificato.
  *Esempio:* \`/todo done 2\`
- \`/todo clear\` : Rimuove tutte le attività dalla lista.`, { parse_mode: 'Markdown' });
  }
  
  if (!db.todos) db.todos = [];
  
  if (arg.toLowerCase() === 'clear') {
    db.todos = [];
    saveDB(db);
    return ctx.reply("🧹 Lista To-Do svuotata con successo!");
  }
  
  if (arg.toLowerCase().startsWith('done ')) {
    const idxStr = arg.substring(5).trim();
    const index = parseInt(idxStr, 10);
    if (isNaN(index) || index < 1 || index > db.todos.length) {
      return ctx.reply(`⚠️ Indice non valido. Specifica un numero da 1 a ${db.todos.length}.`);
    }
    const removed = db.todos.splice(index - 1, 1);
    saveDB(db);
    return ctx.reply(`✅ Completato ed eliminato: "${removed[0]}"`);
  }
  
  if (arg) {
    db.todos.push(arg);
    saveDB(db);
    return ctx.reply(`📋 Aggiunto alla lista To-Do:\n- *${arg}*`, { parse_mode: 'Markdown' });
  }
  
  // Visualizza la lista
  if (db.todos.length === 0) {
    return ctx.reply("📋 La tua lista To-Do è vuota!\nAggiungi qualcosa scrivendo: `/todo <attività>`", { parse_mode: 'Markdown' });
  }
  
  const formatted = db.todos.map((t, i) => `${i + 1}. ◽ ${t}`).join('\n');
  ctx.reply(`📋 *La tua lista To-Do:*\n\n${formatted}`, { parse_mode: 'Markdown' });
});

// /weather o /meteo
bot.command(['weather', 'meteo'], async (ctx) => {
  const arg = ctx.message.text.split(/\s+/).slice(1).join(' ').trim();
  
  if (arg.toLowerCase() === 'help') {
    return ctx.reply(`🌤️ *Guida all'uso del comando /weather (/meteo):*

Mostra le condizioni meteo attuali per una determinata città tramite wttr.in.

*Uso:*
- \`/weather <città>\` : Mostra il meteo per la città specificata e la imposta come predefinita.
  *Esempio:* \`/weather Roma\`
- \`/weather\` : Mostra il meteo per la città predefinita (default: Roma).`, { parse_mode: 'Markdown' });
  }
  
  let city = arg;
  if (!city) {
    city = db.weatherCity || "Roma";
  } else {
    db.weatherCity = city;
    saveDB(db);
  }
  
  await ctx.sendChatAction('typing');
  try {
    const encodedCity = encodeURIComponent(city);
    const res = await fetch(`https://wttr.in/${encodedCity}?format=3`);
    if (!res.ok) {
      throw new Error(`Servizio meteo non disponibile (HTTP ${res.status})`);
    }
    const text = await res.text();
    ctx.reply(`🌤️ *Meteo Attuale:*\n${text.trim()}`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error("Errore meteo:", error);
    ctx.reply(`❌ Impossibile recuperare il meteo per "${city}": ${error.message}`);
  }
});

// /note o /notes
bot.command(['note', 'notes'], (ctx) => {
  const arg = ctx.message.text.split(/\s+/).slice(1).join(' ').trim();
  
  if (arg.toLowerCase() === 'help') {
    return ctx.reply(`📝 *Guida all'uso delle Note:*

Salva appunti rapidi, idee, link o note generali non temporizzate.

*Uso:*
- \`/note\` : Mostra tutti i tuoi appunti.
- \`/note <testo>\` : Aggiunge una nuova nota.
  *Esempio:* \`/note ricordarsi di pagare la bolletta entro fine mese\`
- \`/note delete <indice>\` : Elimina l'appunto all'indice specificato.
  *Esempio:* \`/note delete 1\`
- \`/note clear\` : Cancella tutti gli appunti.`, { parse_mode: 'Markdown' });
  }
  
  if (!db.notes) db.notes = [];
  
  if (arg.toLowerCase() === 'clear') {
    db.notes = [];
    saveDB(db);
    return ctx.reply("🧹 Tutti gli appunti sono stati cancellati.");
  }
  
  if (arg.toLowerCase().startsWith('delete ')) {
    const idxStr = arg.substring(7).trim();
    const index = parseInt(idxStr, 10);
    if (isNaN(index) || index < 1 || index > db.notes.length) {
      return ctx.reply(`⚠️ Indice non valido. Specifica un numero da 1 a ${db.notes.length}.`);
    }
    const removed = db.notes.splice(index - 1, 1);
    saveDB(db);
    return ctx.reply(`🗑️ Nota rimossa: "${removed[0]}"`);
  }
  
  if (arg) {
    db.notes.push(arg);
    saveDB(db);
    return ctx.reply(`📝 Nota salvata con successo:\n- *${arg}*`, { parse_mode: 'Markdown' });
  }
  
  if (db.notes.length === 0) {
    return ctx.reply("📝 Non hai appunti salvati.\nAggiungi una nota con: `/note <testo>`", { parse_mode: 'Markdown' });
  }
  
  const formatted = db.notes.map((n, i) => `${i + 1}. 📌 ${n}`).join('\n');
  ctx.reply(`📝 *I tuoi appunti:*\n\n${formatted}`, { parse_mode: 'Markdown' });
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

