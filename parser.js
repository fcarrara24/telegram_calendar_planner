const { extractDateContext, buildReminderDate } = require( './timeUtils.js')


/**
 * PARSER
 * - estrae data naturale
 * - estrae tag #tag
*/
function parseMessage(text) {

  const tags = text.match(/#\w+/g) || []

  const cleanText = text
    .replace(/#\w+/g, '')
    .trim()

  const context = extractDateContext(cleanText)

  const reminder = buildReminderDate(context)

  return {
    text: cleanText,
    reminder_at: reminder,
    tags
  }
}

exports.parseMessage = parseMessage

// function parseMessage(text) {

//   const tags = text.match(/#\w+/g) || []
//   let cleanText = text.replace(/#\w+/g, '').trim()

//   const lower = cleanText.toLowerCase()

//   let reminder = null

//   // === REGOLA 1: domani ===
//   if (lower.includes(' domani')) {
//     reminder = setTimeRelative(1, extractTime(cleanText))
//   }

//   // === REGOLA 2: oggi ===
//   else if (lower.includes(' oggi')) {
//     reminder = setTimeRelative(0, extractTime(cleanText))
//   }

//   // === REGOLA 3: tra X giorni ===
//   else if (lower.includes(' tra') && lower.includes(' giorni')) {
//     const days = extractNumberAfterTra(lower)
//     reminder = setTimeRelative(days || 0, extractTime(cleanText))
//   }

//   // === REGOLA 4: data esplicita ===
//   else if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(lower)) {
//     reminder = parseExplicitDate(lower)
//   }

//   return {
//     text: cleanText,
//     reminder_at: reminder,
//     tags
//   }
// }