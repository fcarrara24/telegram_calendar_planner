# 🧠 TELEGRAM BOT 
Servizio di backend nodejs con database annesso 
per schedulare attività e attivare i reminder, 
collegato a telegram bot per attività

## PROBLEMA
Telegram è una piattaforma perfetta per fare uno storico di ciò he è stato fatto nel corso della giornata, il problema è che non calendarizza bene le attività 

## SOLUZIONE 
Un architettura **nodejs** con backend json, il servizio gira su **RAILWAY** senza alcun costo di hosting (si spera, altrimenti ho buttato del tempo)


## MANUALE RAPIDO
dopo essersi pentiti delle scelte di vita installare le dipendenze 

```bash
npm install
```

e lanciare il progetto 

```bash
npm start
```

### 📥 CREARE UN PROMEMORIA

Scrivi normalmente:

domani alle 10 chiama il medico
tra 3 giorni controlla server
tra 2 ore spegni il forno
tra 45 minuti esci
alle 18 palestra
oggi alle 21 film
stasera rilassati
13/01/2027 rinnova contratto
12/06 alle 8 dentist

### 📌 TAG

Usa #tag per organizzare:

#work
#health
#bills
#ideas

Esempio:
domani alle 9 call HR #work

##### ⏰ REGOLE DATA SUPPORTATE

✅ Relative:
oggi
domani
tra X giorni
tra X ore
tra X minuti

✅ Orari:
alle 18
alle 18:30
stasera

✅ Date:
13/01/2027
12/06
12/06 alle 8

##### ⚙️ COMPORTAMENTO AUTOMATICO

"oggi" senza orario → reminder tra 1 ora
"domani" senza orario → 09:00
solo "alle 18" → oggi alle 18

##### ⚠️ NOTA

Se non viene trovata una data:
il messaggio viene salvato
NON viene creato un reminder

##### 📅 CHECK GIORNALIERO

Ogni mattina ricevi:
buongiorno
task del giorno
reminder imminenti

##### 💀 SE NON ARRIVA NULLA

Probabilmente il server è morto.
Come ogni cosa bella costruita dagli esseri umani.

### 🧠 FILOSOFIA DEL BOT

input naturale
zero menu
zero strutture complicate
scrivi e basta
il parser prova a capire

#### Possibili sviluppi futuri
Potrei condividere il bot con un mio amico, tenere traccia del chat_id di ciascun gruppo e assegnare a ciascun utente il concetto di iscrizione, con un comando speciale /subscribe
potrei fare in modo che ciascuno degli utenti si iscriva al calendario

- il sistema potrebbe agganciarsi a una visualizzazione esterna a calendario, comunicare tramite HASH lo stato ed aggiornare eventualmente la cache presente sul nuovo dispositivo