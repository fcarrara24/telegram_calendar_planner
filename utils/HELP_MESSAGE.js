/**
 * HELP_MESSAGE - messaggio di aiuto rapido per l'utente,
 * spiegando come usare il bot e le sue funzionalità principali
 */
const HELP_MESSAGE = `
🧠 BRAIN BOT — MANUALE RAPIDO

📥 CREARE UN PROMEMORIA STANDARD

Scrivi normalmente:
- domani alle 10 chiama il medico
- tra 3 giorni controlla server
- alle 18 palestra #health

📅 PIANIFICAZIONE GIORNALIERA CON GEMINI

1. Avvia una sessione con:
   /plan <diario/pensieri/programmi per domani>
   Esempio: \`/plan stasera ho le gambe stanche ma domani ho lavoro dalle 8 alle 17, devo ricordarmi la spesa e studiare dopo cena\`
2. Il bot integrerà le informazioni presenti nella memoria di lavoro e i piani delle ultime 2 giornate (per continuità) proponendo una bozza in Markdown.
3. Se non ti piace la bozza, rispondi scrivendo le modifiche da apportare.
4. Gestione della pianificazione:
   - /ok : Conferma il piano. Il bot estrarrà i task e imposterà un promemoria 5 minuti prima di ogni evento!
   - /cancel : Annulla la pianificazione corrente.
   - /show-plan : Mostra la pianificazione confermata per la giornata odierna (o l'ultimo piano registrato).

🧠 MEMORIA DI LAVORO (preferenze e vincoli ricorrenti)

- /memory <fatto> : Aggiunge un vincolo (es. \`/memory lavoro dalle 8 alle 17\`).
- /show-memory [indice] : Mostra tutta la memoria o un fatto specifico tramite il suo numero.
- /edit-memory <modifica> : Chiede a Gemini di aggiornare la memoria (es. \`/edit-memory rimuovi il fatto 3\`).
- /edit-memory <indice> <nuovo testo> : Modifica manualmente il fatto a quell'indice.
- /edit-memory <indice> delete : Rimuove manualmente il fatto a quell'indice.

📦 ESPORTAZIONE STORICO PIANI

- /export [days] : Genera e invia un file di testo (.txt) contenente tutti i prompt e i piani confermati degli ultimi N giorni (di default 7 giorni).
`

module.exports = { HELP_MESSAGE }