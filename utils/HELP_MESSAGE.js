/**
 * HELP_MESSAGE - messaggio di aiuto rapido per l'utente,
 * spiegando come usare il bot e le sue funzionalità principali
 */
const HELP_MESSAGE = `
🧠 BRAIN BOT — MANUALE RAPIDO

💡 *INFO:* Ciascun comando base supporta l'argomento *help* per vedere la sua guida d'uso dettagliata ed esempi! (Es: \`/plan help\`, \`/memory help\`, \`/todo help\`).

📅 PIANIFICAZIONE GIORNALIERA CON GEMINI

1. Avvia una sessione con:
   /plan <diario/pensieri/programmi per domani>
   Esempio: \`/plan stasera ho le gambe stanche ma domani ho lavoro dalle 8 alle 17, devo ricordarmi la spesa\`
2. Modifica la proposta rispondendo al bot con i cambiamenti richiesti.
3. Comandi di controllo:
    - /ok : Conferma il piano ed imposta promemoria 5 minuti prima di ogni evento!
    - /cancel : Annulla la pianificazione corrente.
    - /show-plan o /showPlan : Mostra la pianificazione confermata di oggi ed i relativi promemoria.

🧠 MEMORIA DI LAVORO (preferenze e vincoli stabili per l'IA)

- /memory <fatto> : Aggiunge un vincolo (es. \`/memory lavoro dalle 8 alle 17\`).
- /show-memory [indice] o /showMemory [indice] : Mostra tutta la memoria o un fatto specifico.
- /edit-memory [modifiche] o /editMemory [modifiche] : Modifica o rimuove elementi (IA o manuale).

📋 TO-DO LIST (attività senza orario fisso)

- /todo <attività> : Aggiunge un elemento alla lista.
- /todo : Visualizza la lista delle cose da fare.
- /todo done <indice> : Segna come completata (ed elimina) l'attività.
- /todo clear : Svuota l'intera lista.

🌤️ METEO

- /weather <città> o /meteo <città> : Mostra le condizioni meteo attuali tramite wttr.in.

📝 APPUNTI E NOTE

- /note <testo> : Aggiunge un appunto rapido.
- /note : Visualizza tutte le note registrate.
- /note delete <indice> : Rimuove la nota all'indice specificato.

📦 ESPORTAZIONE

- /export [days] : Esporta i piani degli ultimi N giorni in formato .txt.
`

module.exports = { HELP_MESSAGE }