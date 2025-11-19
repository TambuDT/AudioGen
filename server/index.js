const express = require("express");
const cors = require("cors");
const textToSpeech = require("@google-cloud/text-to-speech");

// App setup
const app = express();
app.use(express.json());

app.use(cors({
    origin: "*" 
}));

// Client per voci Chirp3 e Gemini
const client = new textToSpeech.TextToSpeechClient({
    keyFilename: "./rosandros-text2speech-0aac92d18d64.json",
});


app.post("/listvoices", async (req, res) => {
    try {
        const [result] = await client.listVoices({});
        res.json({ voices: result.voices });
    } catch (err) {
        console.error("Errore nel recupero delle voci:", err);
        res.status(500).json({ error: "Errore nel recupero delle voci" });
    }
});

// Endpoint TTS
app.post("/synthesize", async (req, res) => {
    try {
        const request = req.body;

        if (!request?.input?.text) {
            return res.status(400).json({ error: "Campo 'input.text' mancante" });
        }

        const [response] = await client.synthesizeSpeech(request);
        console.log("Audio generato correttamente");

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
