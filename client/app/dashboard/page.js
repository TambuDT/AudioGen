"use client";
import { useState } from "react";
import PrivateRoute from "../hooks/PrivateRoute";

import './dashboard.css'
import Navbar from "../components/navbar/navbar";
import TextsectionGemini from "../components/textarea/textareaGeminiTTS";
import TextsectionChirp3 from "../components/textarea/textareaChirp3";
import { VoiceSelector } from "../components/voiceselector/voiceselector"
import Globalmenu from "../components/globalmenu/Globalmenu";
import RecentCreations from "../components/recentscreations/recentCreations";
import VoicePresetPanel from "../components/promptpresets/PromptPresets";

function Dashboard() {
  const [arrayCreazioni, setArrayCreazioni] = useState([]);
  const [voice, setVoice] = useState();
  const [model, setModel] = useState("GeminiTTS");
  const [promptStyle, setPromptStyle] = useState("");
  const [geminiMultiSpeaker, setGeminiMultiSpeaker] = useState(false);
  const [speakerVoices, setSpeakerVoices] = useState({
    speaker_1: "Kore",
    speaker_2: "Puck",
  });
  const [synthesisRequest, setSynthesisRequest] = useState(0);

  const addCreazione = (creazione) => {
    setArrayCreazioni(prev => [...prev, creazione]);
  };

  const requestSynthesis = () => {
    setSynthesisRequest(prev => prev + 1);
  };

  const handleModelChange = (nextModel) => {
    setModel(nextModel);
    if (nextModel !== "GeminiTTS") setGeminiMultiSpeaker(false);
  };

  const canSynthesize = model === "GeminiTTS" && geminiMultiSpeaker
    ? Boolean(
        speakerVoices.speaker_1 &&
        speakerVoices.speaker_2 &&
        speakerVoices.speaker_1 !== speakerVoices.speaker_2
      )
    : Boolean(voice);

  return (
    <PrivateRoute>
      <div className="dashboard-container">
        <Navbar page="Dashboard" onSynthesize={requestSynthesis} canSynthesize={canSynthesize} />
        <section className="section-one has-prompt-presets">
          <div className="voice-recents-container">
            <Globalmenu voiceModel={handleModelChange} currentModel={model}></Globalmenu>
            <VoiceSelector
              onVoiceChange={setVoice}
              voiceFromPreset={voice}
              speakerMode={model === "GeminiTTS" && geminiMultiSpeaker ? "multi" : "single"}
              speakerVoices={speakerVoices}
              onSpeakerVoiceChange={(speakerId, voiceName) =>
                setSpeakerVoices((previous) => ({ ...previous, [speakerId]: voiceName }))
              }
            />
            <RecentCreations creations={arrayCreazioni} />
          </div>
          {model === "GeminiTTS" ? (
            <TextsectionGemini
              voiceName={voice}
              onCreate={addCreazione}
              synthesisRequest={synthesisRequest}
              onSpeakerModeChange={setGeminiMultiSpeaker}
              speakerVoices={speakerVoices}
              promptValue={promptStyle}
              onPromptChange={setPromptStyle}
            />
          ) : (
            <TextsectionChirp3
              voiceName={voice}
              onCreate={addCreazione}
              synthesisRequest={synthesisRequest}
            />
          )}
          <VoicePresetPanel
            voiceName={voice}
            onLoadVoice={setVoice}
          />
        </section>
        <footer className="dashboard-footer">
          <p className="created-by">Created by <a className="created-by-name" href="https://github.com/TambuDT">TMB</a>, Powered by <a className="created-by-powered" href="https://nextjs.org/">Next.js</a></p>
        </footer>
      </div>
    </PrivateRoute>
  );
}

export default Dashboard;
