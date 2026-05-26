const dotenv = require('dotenv').config()
const chrono = require('chrono-node')
const cron = require('node-cron')
const express = require('express')

const { Telegraf } = require('telegraf')
const { extractNumberAfterTra, extractTime, parseExplicitDate, setTimeRelative } = 
  require('./utils/timeUtils')
const {  checkReminders, heartbeat } = require('./utils/cronFunctions')
const { receiveMessages } = require('./utils/messageHandler')
const { loadDB, saveDB } = require('./utils/dbUtils')
const { parseMessage } = require('./utils/parser')
const { HELP_MESSAGE } = require('./utils/HELP_MESSAGE')
const bot = new Telegraf(process.env.BOT_TOKEN)

const db = loadDB()

/**
 * EXPRESS (railway port verification)
 */
const app = express()
const PORT = process.env.PORT || 3000

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
bot.launch()

// console.log({db})

console.log('🤖 bot online')

