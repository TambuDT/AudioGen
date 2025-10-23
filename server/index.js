const express = require("express");
const cors = require("cors");

const textToSpeech = require("@google-cloud/text-to-speech");

// App setup
const app = express();
app.use(express.json());
app.use(
    cors({
        origin:[
            "http://localhost:3000",
            "http://192.168.1.60:3000"
        ]

    })
);

//Client per voci Chirp3 e Gemini
const client = new textToSpeech.TextToSpeechClient({
    keyFilename: "./rosandros-text2speech-0aac92d18d64.json",
});

//Endpoint per voci
app.post("/synthesize", async (req, res) => {
    try {
        const request = req.body;

        if (!request?.input?.text) {
            return res.status(400).json({ error: "Campo 'input.text' mancante" });
        }

        //Chiamata a Google Cloud TTS direttamente con la request inviata dal frontend
        const [response] = await client.synthesizeSpeech(request);

        console.log("Audio generato correttamente");

        //Invia base64 al frontend
        res.json({
            success: true,
            audioContent: response.audioContent.toString("base64"),
        });
    } catch (err) {
        console.error("Errore TTS:", err);
        res.status(500).json({ error: "Errore durante la sintesi vocale" });
    }
});

//Avvio serve
const port = 3001;
app.listen(port, () => {
    console.log(`Server TTS in ascolto su http://localhost:${port}`);
});
