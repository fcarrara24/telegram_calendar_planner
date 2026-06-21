const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;

function getGeminiClient() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY non è impostata nel file .env. Per favore inseriscila.');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Generates or modifies a plan based on user prompt, memory list, chat history, and past confirmed plans.
 * @param {string} prompt - The user's input/feedback.
 * @param {string[]} memoryList - Array of user memory constraints.
 * @param {Array<{role: string, parts: Array<{text: string}>}>} history - Previous chat turns.
 * @param {Array<{date: string, prompt: string, plan: string}>} pastPlans - Last few confirmed plans for context.
 * @returns {Promise<{text: string, history: Array}>}
 */
async function generatePlanDraft(prompt, memoryList, history = [], pastPlans = []) {
  const client = getGeminiClient();
  
  let pastPlansContext = "";
  if (pastPlans && pastPlans.length > 0) {
    pastPlansContext = "\n\nEcco lo storico delle pianificazioni passate (che include anche i pensieri/diario dell'utente di quel giorno) per darti contesto sulla continuità e lo stato delle giornate precedenti:\n";
    pastPlans.forEach(p => {
      pastPlansContext += `--- GIORNATA DEL ${p.date} ---\n`;
      pastPlansContext += `Pensieri/Diario dell'utente: "${p.prompt}"\n`;
      pastPlansContext += `Piano confermato:\n${p.plan}\n\n`;
    });
  }
  
  const systemInstruction = `Sei un assistente personale di pianificazione quotidiana.
Il tuo compito è organizzare la giornata dell'utente sotto forma di un piano dettagliato in formato Markdown (MD) partendo dai suoi pensieri caotici, che fungono anche da diario personale.
Ecco le informazioni di memoria/preferenze memorizzate dell'utente:
${memoryList.length > 0 ? memoryList.map(m => `- ${m}`).join('\n') : 'Nessuna memoria ancora registrata.'}
${pastPlansContext}

Quando l'utente ti chiede di pianificare una giornata, o ti fornisce dei feedback:
1. Analizza i suoi pensieri (anche confusi, stanchezze fisiche, obiettivi) e proponi una struttura ordinata per il giorno successivo.
2. Integra le sue richieste con i vincoli e le abitudini presenti nella memoria di lavoro e nello storico dei giorni passati.
3. Sii preciso con gli orari. Ad esempio, se lavora dalle 8:00 alle 17:00 e ci mette 30 minuti per andare al lavoro, inserisci il viaggio alle 7:30 e il rientro alle 17:00.
4. Presenta il piano in un formato Markdown chiaro, leggibile e ben strutturato (usa grassetti, liste, intestazioni, emoji).
5. Sii flessibile: adatta la pianificazione in base ai feedback che l'utente ti darà.
6. Includi sempre le fasce orarie o gli orari espliciti per ciascuna attività pianificata.`;

  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction
  });

  const chat = model.startChat({
    history: history
  });

  const result = await chat.sendMessage(prompt);
  const responseText = result.response.text();
  const newHistory = await chat.getHistory();

  // Convert history objects to a plain structure that can be serialized in JSON
  const serializedHistory = newHistory.map(turn => ({
    role: turn.role,
    parts: turn.parts.map(p => ({ text: p.text }))
  }));

  return {
    text: responseText,
    history: serializedHistory
  };
}

/**
 * Extracts the plan date (YYYY-MM-DD) and a list of structured tasks with explicit HH:MM times from a markdown plan.
 * @param {string} planText - The final plan in markdown.
 * @param {string} referenceDateContext - Description of today's date (e.g. "2026-06-21 (Domenica)").
 * @returns {Promise<{plan_date: string, tasks: Array<{time: string, description: string}>}>}
 */
async function extractTasks(planText, referenceDateContext) {
  const client = getGeminiClient();
  
  const schema = {
    type: "object",
    properties: {
      plan_date: {
        type: "string",
        description: "Data del giorno pianificato in formato YYYY-MM-DD. Ad esempio, se oggi è il 2026-06-21 ed il piano è per domani, la plan_date sarà '2026-06-22'. Sii molto preciso."
      },
      tasks: {
        type: "array",
        description: "Elenco delle attività del piano con l'orario di inizio preciso nel formato HH:MM",
        items: {
          type: "object",
          properties: {
            time: {
              type: "string",
              description: "Ora dell'attività o evento in formato 24h HH:MM (es. 08:00, 14:30)"
            },
            description: {
              type: "string",
              description: "Breve titolo o descrizione dell'attività (es. Inizio lavoro, Palestra, Spesa)"
            }
          },
          required: ["time", "description"]
        }
      }
    },
    required: ["plan_date", "tasks"]
  };

  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const prompt = `La data odierna di riferimento (oggi) è: ${referenceDateContext}.
Analizza il piano quotidiano fornito qui sotto ed estrai:
1. La data esatta per cui il piano è programmato (plan_date in formato YYYY-MM-DD). Se l'utente pianifica 'domani', calcolala rispetto alla data odierna di riferimento.
2. Tutti gli eventi orari (tasks) specificati nel piano con i relativi orari precisi.

Piano fornito:
${planText}`;

  const result = await model.generateContent(prompt);
  const jsonText = result.response.text();
  const parsed = JSON.parse(jsonText);
  return {
    plan_date: parsed.plan_date,
    tasks: parsed.tasks || []
  };
}

/**
 * Updates memory list using natural language user input.
 * @param {string[]} currentMemories - Current memory rules.
 * @param {string} userInput - The edits to perform.
 * @returns {Promise<string[]>} - The updated memory rules.
 */
async function updateMemories(currentMemories, userInput) {
  const client = getGeminiClient();

  const schema = {
    type: "object",
    properties: {
      memories: {
        type: "array",
        description: "L'elenco completo e aggiornato dei vincoli e preferenze dell'utente",
        items: {
          type: "string"
        }
      }
    },
    required: ["memories"]
  };

  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const prompt = `Ecco l'elenco attuale dei vincoli/regole della memoria dell'utente:
${currentMemories.length > 0 ? JSON.stringify(currentMemories) : 'Nessuno.'}

L'utente desidera effettuare la seguente modifica/aggiornamento (può aggiungere elementi, rimuovere elementi esistenti o aggiornarli):
"${userInput}"

Elabora le modifiche e restituisci la lista finale dei vincoli come array JSON. Cerca di formulare regole concise, chiare ed espresse in italiano.`;

  const result = await model.generateContent(prompt);
  const jsonText = result.response.text();
  const parsed = JSON.parse(jsonText);
  return parsed.memories || [];
}

module.exports = {
  generatePlanDraft,
  extractTasks,
  updateMemories
};
