import React from "react";
import "./globalmenu.css";

function Globalmenu({ voiceModel, currentModel }) {
  return (
    <div className="globalmenu-container">
      <div className="globalmenu">
        <label
          className={currentModel === "Chirp3" ? "selected" : ""}
          onClick={() => voiceModel("Chirp3")}
        >
          Chirp3
        </label>
        <label
          className={currentModel === "GeminiTTS" ? "selected" : ""}
          onClick={() => voiceModel("GeminiTTS")}
        >
          Gemini TTS
        </label>
      </div>
    </div>
  );
}

export default Globalmenu;
