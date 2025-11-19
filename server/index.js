const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const textToSpeech = require("@google-cloud/text-to-speech");

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

// Percorsi
const VOCI_FILE = path.join(__dirname, "vociDisponibili.json");
const CAMPIONARIO_DIR = path.join(__dirname, "vociCampionario");

// Assicurati che la cartella esista
if (!fs.existsSync(CAMPIONARIO_DIR)) {
    fs.mkdirSync(CAMPIONARIO_DIR, { recursive: true });
}

// Serve i file demo
app.use("/vociCampionario", express.static(CAMPIONARIO_DIR));

// Client Google TTS
const client = new textToSpeech.TextToSpeechClient({
    keyFilename: "./rosandros-text2speech-0aac92d18d64.json",
});

app.post("/listvoices", async (req, res) => {
    try {
        const [result] = await client.listVoices();

        // Filtra solo Chirp3 italiane
        const vociChirp3 = result.voices
            .filter(v => v.name.includes("Chirp3") && v.languageCodes.includes("it-IT"))
            .map(v => v.name.replace(/^it-IT-Chirp3-HD-/, ""));

        // Leggi JSON esistente
        let vociSalvate = [];
        if (fs.existsSync(VOCI_FILE)) {
            const content = fs.readFileSync(VOCI_FILE, "utf8");
            try {
                vociSalvate = JSON.parse(content);
            } catch (err) {
                console.error("Errore parsing JSON, ricreazione file:", err);
                vociSalvate = [];
            }
        }

        // Confronta e trova nuove voci
        const nuoveVoci = vociChirp3.filter(voceApi => !vociSalvate.includes(voceApi));
        console.log("Nuove voci trovate:", nuoveVoci);

        // Genera file demo solo per le nuove voci
        for (const voce of nuoveVoci) {
            const testoDemo = `Questo è un sample della voce, e puoi usarla come speaker per generare il tuo spot.`;
            const ttsRequest = {
                input: { text: testoDemo },
                voice: { languageCode: "it-IT", name: `it-IT-Chirp3-HD-${voce}` },
                audioConfig: { audioEncoding: "MP3" },
            };

            const [ttsResponse] = await client.synthesizeSpeech(ttsRequest);
            const filePath = path.join(CAMPIONARIO_DIR, `${voce}.mp3`);
            fs.writeFileSync(filePath, ttsResponse.audioContent, "binary");
            console.log(`Generato demo per voce: ${voce}`);
        }

        // Aggiorna JSON con tutte le voci correnti e ordina alfabeticamente
        const vociAggiornate = Array.from(new Set([...vociSalvate, ...vociChirp3])).sort((a, b) => a.localeCompare(b));
        fs.writeFileSync(VOCI_FILE, JSON.stringify(vociAggiornate, null, 2));

        res.json({ voci: vociAggiornate });
    } catch (err) {
        console.error("Errore nel recupero/generazione delle voci:", err);
        res.status(500).json({ error: "Errore nel recupero/generazione delle voci" });
    }
});



app.post("/synthesize", async (req, res) => {
    try {
        const request = req.body;
        if (!request?.input?.text) {
            return res.status(400).json({ error: "Campo 'input.text' mancante" });
        }

        const [response] = await client.synthesizeSpeech(request);
        res.json({
            success: true,
            audioContent: response.audioContent.toString("base64"),
        });
    } catch (err) {
        console.error("Errore TTS:", err);
        res.status(500).json({ error: "Errore durante la sintesi vocale" });
    }
});

const port = 3001;
app.listen(port, "0.0.0.0", () => {
    console.log(`Server in ascolto su porta ${port}`);
});
