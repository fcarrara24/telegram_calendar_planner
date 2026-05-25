/**
 * HELP_MESSAGE - messaggio di aiuto rapido per l'utente,
 * spiegando come usare il bot e le sue funzionalità principali
 */
const HELP_MESSAGE = `
🧠 BRAIN BOT — MANUALE RAPIDO

📥 CREARE UN PROMEMORIA

Scrivi normalmente:

- domani alle 10 chiama il medico
- tra 3 giorni controlla server
- tra 2 ore spegni il forno
- tra 45 minuti esci
- alle 18 palestra
- oggi alle 21 film
- stasera rilassati
- 13/01/2027 rinnova contratto
- 12/06 alle 8 dentist

📌 TAG

Usa #tag per organizzare:

- #work
- #health
- #bills
- #ideas

Esempio:
domani alle 9 call HR #work

⏰ REGOLE DATA SUPPORTATE

✅ Relative:
- oggi
- domani
- tra X giorni
- tra X ore
- tra X minuti

✅ Orari:
- alle 18
- alle 18:30
- stasera

✅ Date:
- 13/01/2027
- 12/06
- 12/06 alle 8

⚙️ COMPORTAMENTO AUTOMATICO

- "oggi" senza orario → reminder tra 1 ora
- "domani" senza orario → 09:00
- solo "alle 18" → oggi alle 18

⚠️ NOTA

Se non viene trovata una data:
- il messaggio viene salvato
- NON viene creato un reminder

📅 CHECK GIORNALIERO

Ogni mattina ricevi:
- buongiorno
- task del giorno
- reminder imminenti

🧠 FILOSOFIA DEL BOT

- input naturale
- zero menu
- zero strutture complicate
- scrivi e basta
- il parser prova a capire

💀 SE NON ARRIVA NULLA

Probabilmente il server è morto.
Come ogni cosa bella costruita dagli esseri umani.
`