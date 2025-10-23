import React, { useState } from 'react';
import './textarea.css';
import axios from 'axios';
import { MdCancel } from "react-icons/md";

function Textsection({ voiceName }) {
  const [text, setText] = useState('');
  const [audioSrc, setAudioSrc] = useState(null);
  const [customPronunce, setCustomPronunce] = useState([]);

  function buildRequestBody() {
    let modifiedText = text;

    // Trova tutte le parole tra {} nel testo e sostituisci con la pronuncia custom
    const matches = text.match(/\{(.*?)\}/g);
    if (matches) {
      matches.forEach(match => {
        const parolaOriginale = match.slice(1, -1); // rimuovo le parentesi {}
        const pronunciaCustom = customPronunce.find(item => item.parola === parolaOriginale);

        if (pronunciaCustom && pronunciaCustom.sostituzione) {
          const regex = new RegExp(`\\{${parolaOriginale}\\}`, "g");
          modifiedText = modifiedText.replace(regex, pronunciaCustom.sostituzione);
        }
      });
    }

    return {
      audio_config: { audio_encoding: "LINEAR16" },
      input: { text: modifiedText },
      voice: { language_code: "it-IT", name: `it-it-Chirp3-HD-${voiceName}` },
    };
  }

  async function handleSynthesize() {
    try {
      const requestBody = buildRequestBody();
      console.log("Richiesta TTS:", requestBody);

      const response = await axios.post('http://localhost:3001/synthesize', requestBody);

      if (response.data && response.data.audioContent) {
        setAudioSrc(`data:audio/mp3;base64,${response.data.audioContent}`);
      } else {
        console.error("Risposta senza audioContent:", response.data);
      }
    } catch (err) {
      console.error("Errore richiesta:", err);
    }
  }

  function addRow() {
    setCustomPronunce(prev => [...prev, { parola: "", sostituzione: "" }]);
  }

  function updatePronunce(index, field, value) {
    setCustomPronunce(prev => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
  }

  function removeRow(index) {
    setCustomPronunce(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <div className='textsection-container'>
      <h1 className='text-section-title'>Text to Speech</h1>
      <h4 className='text-section-subtitle'>Inserisci il testo da convertire in audio</h4>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        className='text-area'
        placeholder='Inserisci il testo qui...'
      />

      <div className='add-pronuncia-custom-title-container'>
        <h4 className='text-section-subtitle'>
          Aggiungi parole da sostituire con pronunce personalizzate
        </h4>
        <div className='add-pronuncia-button' onClick={addRow}><p>+</p></div>
      </div>

      <div className='parole-custom-container'>
        {customPronunce.map((item, idx) => (
          <div key={idx} className='custom-pronuncia-row'>
            <input
              value={item.parola}
              onChange={e => updatePronunce(idx, 'parola', e.target.value)}
              placeholder='Parola originale'
              className='custom-pronuncia-input'
            />
            <input
              value={item.sostituzione}
              onChange={e => updatePronunce(idx, 'sostituzione', e.target.value)}
              placeholder='Pronuncia'
              className='custom-pronuncia-input'
            />
            <div className='remove-pronuncia-button' onClick={() => removeRow(idx)}>
              <MdCancel />
            </div>
          </div>
        ))}
      </div>

      <button
        className={voiceName ? "genera-button" : "genera-button-non-disponibile"}
        onClick={handleSynthesize}
      >
        {voiceName ? "Genera con voce " + voiceName : "Seleziona Una Voce"}
      </button>

      <audio className='player-audio-generato' controls src={audioSrc} />
    </div>
  );
}

export default Textsection;
