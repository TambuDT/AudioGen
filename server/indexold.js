require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(
    cors({
        origin: "http://localhost:3000",
    })
);

app.post("/synthesize", async (req, res) => {
    try {
        
        const apiKey = process.env.VERTEX_API_KEY;

        const endpoint = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`;
        
        const payload = req.body;

        const response = await axios.post(endpoint, payload);

        res.json(response.data);
    } catch (err) {
        console.error("Errore TTS:", err.response?.data || err.message);
        res.status(500).json({ error: "Errore durante la sintesi vocale" });
    }
});

const port = 3001;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
