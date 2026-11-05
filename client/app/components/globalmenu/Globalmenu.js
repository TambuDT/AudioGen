import React from "react";
import "./globalmenu.css";

function Globalmenu({ voiceModel, currentModel }) {
  return (
    <div className="globalmenu-container">
      <div className="globalmenu-heading">
        <label className="modello-label">Modello AI</label>
      </div>
      <div className="globalmenu" role="group" aria-label="Seleziona modello AI">
        <button
          type="button"
          aria-pressed={currentModel === "GeminiTTS"}
          className={currentModel === "GeminiTTS" ? "selected" : ""}
          onClick={() => voiceModel("GeminiTTS")}
        >
          GeminiTTS
        </button>
        <button
          type="button"
          aria-pressed={currentModel === "Chirp3"}
          className={currentModel === "Chirp3" ? "selected" : ""}
          onClick={() => voiceModel("Chirp3")}
        >
          Chirp3
        </button>
      </div>
    </div>
  );
}

export default Globalmenu;
