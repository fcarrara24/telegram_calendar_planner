/**
 * Estrae il contesto temporale da un testo, 
 * restituendo un oggetto con le informazioni trovate
 * @param {*} text 
 * @returns 
 */
function extractDateContext(text) {

  const lower = text.toLowerCase()

  const context = {
    relativeDays: 0,
    relativeHours: 0,
    relativeMinutes: 0,

    explicitDate: null,

    weekday: null,

    time: null
  }

  // =====================
  // OGGI / DOMANI
  // =====================

  if (lower.includes('domani')) {
    context.relativeDays = 1
  }

  if (lower.includes('oggi')) {
    context.relativeDays = 0
  }

  // =====================
  // TRA X GIORNI
  // =====================

  let match = lower.match(/tra (\d+) giorni?/)

  if (match) {
    context.relativeDays = parseInt(match[1])
  }

  // =====================
  // TRA X ORE
  // =====================

  match = lower.match(/tra (\d+) ore?/)

  if (match) {
    context.relativeHours = parseInt(match[1])
  }

  // =====================
  // TRA X MINUTI
  // =====================

  match = lower.match(/tra (\d+) minut[io]/)

  if (match) {
    context.relativeMinutes = parseInt(match[1])
  }

  // =====================
  // DATA ESPLICITA
  // 12/06/2026
  // 12/06
  // =====================

  match = lower.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/)

  if (match) {

    const day = parseInt(match[1])
    const month = parseInt(match[2]) - 1

    const year = match[3]
      ? parseInt(match[3])
      : new Date().getFullYear()

    context.explicitDate = {
      day,
      month,
      year
    }
  }

  // =====================
  // ORARIO
  // alle 18
  // alle 18:30
  // =====================

  match = lower.match(/alle (\d{1,2})(?::(\d{2}))?/)

  if (match) {

    context.time = {
      hours: parseInt(match[1]),
      minutes: match[2]
        ? parseInt(match[2])
        : 0
    }
  }

  // =====================
  // STASERA
  // =====================

  if (lower.includes('stasera')) {

    context.time = {
      hours: 21,
      minutes: 0
    }
  }

  return context
}

exports.extractDateContext = extractDateContext

/**
 * controlla se un contesto estratto contiene effettivamente informazioni temporali,
 * per evitare di creare promemoria con date non intenzionali
 * @param {*} context 
 * @returns 
 */
function hasDateInfo(context) {
  return (
    context.explicitDate ||
    context.relativeDays > 0 ||
    context.relativeHours > 0 ||
    context.relativeMinutes > 0 ||
    context.time
  )
}

/**
 * converte il contesto estratto in una data ISO, o null se non c'è alcuna data
 * @param {*} context 
 * @returns 
 */
function buildReminderDate(context) {

  if (!context || !hasDateInfo(context)) {
    return null
  }

  const now = new Date()

  let date = new Date(now)

  // =====================
  // DATA ESPLICITA
  // =====================

  if (context.explicitDate) {

    date = new Date(
      context.explicitDate.year,
      context.explicitDate.month,
      context.explicitDate.day
    )
  }

  // =====================
  // RELATIVE
  // =====================

  date.setDate(
    date.getDate() + context.relativeDays
  )

  date.setHours(
    date.getHours() + context.relativeHours
  )

  date.setMinutes(
    date.getMinutes() + context.relativeMinutes
  )

  // =====================
  // ORARIO ESPLICITO
  // =====================

  if (context.time) {

    date.setHours(
      context.time.hours,
      context.time.minutes,
      0,
      0
    )
  }

  // =====================
  // DEFAULTS
  // =====================

  else {

    const hasRelative =
      context.relativeDays ||
      context.relativeHours ||
      context.relativeMinutes

    // domani / tra giorni
    if (context.relativeDays > 0) {

      date.setHours(9, 0, 0, 0)
    }

    // solo oggi
    else if (!hasRelative) {

      // fallback:
      // +1 ora

      date.setHours(date.getHours() + 1)
    }
  }

  return date.toISOString();
}

function makeRomeDate(plan_date, timeStr) {
  const [y, m, d] = plan_date.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Crea una data approssimativa in UTC
  const tempDate = new Date(Date.UTC(y, m - 1, d, hours, minutes, 0));
  
  // Troviamo l'ora locale a Roma per questa data UTC
  const options = { timeZone: 'Europe/Rome', hour: 'numeric', hour12: false };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const romeHour = parseInt(formatter.format(tempDate), 10);
  
  // La differenza tra l'ora di Roma e l'ora UTC che abbiamo impostato
  let diff = romeHour - hours;
  if (diff > 12) diff -= 24;
  if (diff < -12) diff += 24;
  
  // Sottraiamo la differenza per ottenere l'ora UTC corretta
  return new Date(Date.UTC(y, m - 1, d, hours - diff, minutes, 0));
}

function formatTaskList(tasks, planDate) {
  if (!tasks || tasks.length === 0) {
    return "\n⚠️ *Nessuna attività con orario rilevata.*";
  }
  
  // Ordina i task per ora
  const sortedTasks = [...tasks].sort((a, b) => a.time.localeCompare(b.time));
  
  let text = `\n📋 *Attività rilevate per il ${planDate}:*\n`;
  sortedTasks.forEach(t => {
    // Calcoliamo anche l'orario del promemoria (5 minuti prima)
    const [hours, minutes] = t.time.split(':').map(Number);
    let remMinutes = minutes - 5;
    let remHours = hours;
    if (remMinutes < 0) {
      remMinutes += 60;
      remHours -= 1;
    }
    if (remHours < 0) {
      remHours += 24;
    }
    const remTimeStr = `${String(remHours).padStart(2, '0')}:${String(remMinutes).padStart(2, '0')}`;
    
    text += `- *${t.time}* (Reminder alle ${remTimeStr}): ${t.description}\n`;
  });
  return text;
}

exports.buildReminderDate = buildReminderDate
exports.makeRomeDate = makeRomeDate
exports.formatTaskList = formatTaskList