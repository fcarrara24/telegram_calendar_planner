# 🧠 Brain Bot - Telegram AI Planner & Reminder

Un servizio di backend Node.js (con database JSON locale) collegato a un bot Telegram, potenziato con **Google Gemini AI**, progettato per aiutarti a pianificare le tue giornate, gestire i promemoria in linguaggio naturale e mantenere una memoria storica delle tue attività e vincoli quotidiani.

Il servizio è ottimizzato per essere eseguito su piattaforme cloud come **Render** o **Railway**.

---

## 🚀 Funzionalità Principali

### 1. 📅 Pianificazione Giornaliera Assistita (Google Gemini)
*   **Generazione del Piano**: Usando il comando `/plan <descrizione>`, descrivi la tua giornata o i tuoi impegni a ruota libera. Il bot integrerà le preferenze della tua **Memoria di Lavoro** e la cronologia degli ultimi 2 giorni per proporti una bozza strutturata in Markdown.
*   **Rifinitura Interattiva**: Se la bozza non ti convince, rispondi semplicemente al messaggio descrivendo le modifiche desiderate (es. *"sposta la palestra alle 19"*). Gemini aggiornerà la bozza dinamicamente mantenendo il contesto della conversazione.
*   **Schedulazione Automatica**: Inviando `/ok`, il piano viene salvato e il bot estrae automaticamente tutti i task orari (formato `HH:MM`), programmando in automatico un promemoria **5 minuti prima** di ciascun evento.
*   **Controllo e Gestione**:
    *   `/show-plan` o `/showPlan`: Visualizza il piano confermato per la giornata corrente (o l'ultimo registrato).
    *   `/cancel`: Annulla la sessione di pianificazione corrente.

### 2. 🧠 Memoria di Lavoro (Preferenze & Vincoli Ricorrenti)
Permette di salvare abitudini, impegni fissi o vincoli generali che Gemini userà per generare ed ottimizzare i tuoi piani giornalieri.
*   `/memory <fatto>`: Aggiunge una regola (es. `/memory lavoro da lunedì a venerdì dalle 9 alle 18`).
*   `/show-memory [indice]` o `/showMemory [indice]`: Mostra l'intera memoria di lavoro o un elemento specifico.
*   `/edit-memory <modifica>` o `/editMemory <modifica>`: Modifica o rimuove elementi della memoria usando il linguaggio naturale (es. `/edit-memory rimuovi il fatto sul medico`).
*   `/edit-memory <indice> <nuovo testo>` o `/editMemory <indice> <nuovo testo>`: Modifica manualmente l'elemento all'indice specificato.
*   `/edit-memory <indice> delete` o `/editMemory <indice> delete`: Rimuove manualmente l'elemento all'indice specificato.

### 3. 📥 Promemoria Rapidi in Linguaggio Naturale (NLP locale)
Scrivendo messaggi normali in chat, il parser locale riconoscerà automaticamente date, ore e intervalli temporali per impostare reminder.

**Esempi:**
*   *domani alle 10 chiama il medico*
*   *tra 3 giorni controlla server*
*   *tra 2 ore spegni il forno*
*   *alle 18 palestra #health*
*   *13/01/2027 rinnova contratto*

**Tag supportati**: Puoi usare `#work`, `#health`, `#bills`, ecc., per categorizzare i promemoria.
**Comportamento automatico**:
*   *"oggi"* senza orario → reminder dopo 1 ora.
*   *"domani"* senza orario → reminder alle 09:00.
*   *Solo orario (es. "alle 18")* → oggi alle 18:00.

### 4. 📦 Esportazione Dati
*   `/export [days]`: Genera e invia un file `.txt` contenente i prompt originali e i piani definitivi degli ultimi *N* giorni (di default 7 giorni) per permetterti di tenere traccia del tuo storico.

### 5. ⏰ Notifica di Buongiorno (Daily Heartbeat)
*   Ogni mattina alle 08:00, il bot invia un riepilogo automatico con il buongiorno, le attività pianificate per la giornata e i reminder imminenti.

---

## 🛠️ Configurazione Ambientale (`.env`)

Crea un file `.env` nella directory principale (usando `.env.example` come riferimento) e configura le seguenti chiavi:

```env
BOT_TOKEN=il_tuo_telegram_bot_token
CHAT_ID=il_tuo_chat_id_telegram
GEMINI_API_KEY=la_tua_google_gemini_api_key
WEBHOOK_URL=https://tuo-servizio.onrender.com # Opzionale (se vuoto, usa Long Polling)
PORT=3000 # Opzionale (default: 3000)
```

---

## 📦 Installazione e Avvio Rapido

1.  **Installa le dipendenze**:
    ```bash
    npm install
    ```
2.  **Avvia il server**:
    ```bash
    npm start
    ```

---

## 🌐 Hosting & Keep-Alive (Deploy su Render / Railway)

### 1. Configura i Webhook
Per un funzionamento ottimale e reattivo sulle piattaforme Cloud, compila la variabile d'ambiente `WEBHOOK_URL` indicando l'URL pubblico della tua istanza (es. `https://nome-app.onrender.com`). Il bot passerà automaticamente dalla modalità Long Polling a Webhook.

### 2. Evita lo Standby (Keep-Alive su Render Free Tier)
Se utilizzi il piano gratuito di Render, il server entra in standby dopo 15 minuti di inattività, bloccando l'invio dei promemoria. Per mantenere il bot attivo 24/7:
1.  Crea un account gratuito su un servizio di monitoraggio esterno come [cron-job.org](https://cron-job.org/) o [UptimeRobot](https://uptimerobot.com/).
2.  Crea un job di tipo HTTP (GET) puntando all'URL del tuo server (es. `https://nome-app.onrender.com/`).
3.  Imposta la frequenza di ping a **5 o 10 minuti**.
    Questo manterrà il container sempre attivo, garantendo la precisione al minuto per tutti i tuoi reminder.