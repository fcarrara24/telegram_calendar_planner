/**
 * HELP_MESSAGE - messaggio di aiuto rapido per l'utente,
 * spiegando come usare il bot e le sue funzionalità principali
 */
const HELP_MESSAGE = `
🧠 BRAIN BOT — MANUALE RAPIDO

📥 CREARE UN PROMEMORIA
Scrivi normalmente un messaggio:

- domani alle 10 chiama il medico
- tra 3 giorni controlla server
- 13/01/2027 rinnova contratto

📌 TAG
Usa #tag per categorizzare:
- #work
- #health
- #bills

Esempio:
domani alle 9 call HR #work

⏰ REGOLE DATA
Supportato:
- domani
- oggi
- tra X giorni
- alle HH:mm
- date tipo 13/01/2027

⚠️ NOTA
Se non c'è una data → il messaggio viene salvato ma NON crea un reminder

📅 CHECK GIORNALIERO
Ogni mattina ricevi:
- buongiorno
- lista task del giorno

🧠 COMPORTAMENTO
- tutto è salvato
- niente cartelle
- niente strutture complesse
- ricerca manuale = fallback

💀 SE NON ARRIVA IL MESSAGGIO MATTUTINO
Il sistema potrebbe essere offline. Usa la ricerca normale.`