"use client";
import { useState } from "react";
import PrivateRoute from "../hooks/PrivateRoute";

import './dashboard.css'
import Navbar from "../components/navbar/navbar";
import TextsectionGemini from "../components/textarea/textareaGeminiTTS";
import TextsectionChirp3 from "../components/textarea/textareaChirp3";
import { VoiceSelector } from "../components/voiceselector/voiceselector"
import Globalmenu from "../components/globalmenu/Globalmenu";
import Daw from "../components/daw/daw";

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
            <TextsectionChirp3 voiceName={voice} onPresetLoad={setVoice}/>
          )}
          <VoiceSelector onVoiceChange={setVoice} voiceFromPreset={voice} />
        </section>
        <section className="section-two">
          <Daw/>
        </section>
        <footer className="dashboard-footer">
          <p className="created-by">Created by <a className="created-by-name" href="https://github.com/TambuDT">TMB</a>, Powered by <a className="created-by-powered"  href="https://nextjs.org/">Next.js</a></p>
        </footer>
      </div>
    </PrivateRoute>
  );
}

export default Dashboard;
