"use client";
import { useState } from "react";
import PrivateRoute from "../hooks/PrivateRoute";

import './dashboard.css'
import Navbar from "../components/navbar/navbar";
import TextsectionGemini from "../components/textarea/textareaGeminiTTS";
import TextsectionChirp3 from "../components/textarea/textareaChirp3";
import { VoiceSelector } from "../components/voiceselector/voiceselector"
import AudioMixer from "../components/daw/daw";
import Globalmenu from "../components/globalmenu/Globalmenu";

function Dashboard() {
  const [voice, setVoice] = useState();
  const [model, setModel] = useState("Chirp3");
  return (
    <PrivateRoute>
      <div className="dashboard-container">
        <Navbar page="Dashboard" />
        <Globalmenu voiceModel={setModel} currentModel={model}></Globalmenu>
        <section className="section-one">
          {model === "GeminiTTS" ? (
            <TextsectionGemini voiceName={voice} />
          ) : (
            <TextsectionChirp3 voiceName={voice} />
          )}
          <VoiceSelector onVoiceChange={setVoice} />
        </section>
        <section className="section-one">
          <AudioMixer />
        </section>
      </div>
    </PrivateRoute>
  );
}

export default Dashboard;
