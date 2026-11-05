import React, { useCallback, useEffect, useRef, useState } from 'react';
import './textarea.css';
import axios from 'axios';
import AudioPlayer from '../audioplayer/AudioPlayer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faX } from '@fortawesome/free-solid-svg-icons';
const SERVER_URL = `${process.env.NEXT_PUBLIC_APP_ENDPOINT}`;

function TextsectionChirp3({ voiceName, onCreate, synthesisRequest }) {
  const [text, setText] = useState('');
  const [audioSrc, setAudioSrc] = useState(null);
  const [customPronunce, setCustomPronunce] = useState([]);
  const [loading, setLoading] = useState(false);
  const lastSynthesisRequest = useRef(synthesisRequest);

  const buildRequestBody = useCallback(() => {
    let modifiedText = text;
    const matches = text.match(/\{(.*?)\}/g);
    if (matches) {
      matches.forEach(match => {
        const parolaOriginale = match.slice(1, -1);
        const pronunciaCustom = customPronunce.find(item => item.parola === parolaOriginale);
        if (pronunciaCustom && pronunciaCustom.sostituzione) {
          const regex = new RegExp(`\\{${parolaOriginale}\\}`, "g");
          modifiedText = modifiedText.replace(regex, pronunciaCustom.sostituzione);
        }
      });
    }

    return {
      audioConfig: {
        audioEncoding: "LINEAR16",
        sampleRateHertz: 48000
      },
      input: { text: modifiedText },
      voice: { languageCode: "it-IT", name: `it-it-Chirp3-HD-${voiceName}` },
    };
  }, [customPronunce, text, voiceName]);


  const handleSynthesize = useCallback(async () => {
    if (!voiceName || loading) return;

    try {
      setLoading(true);
      const requestBody = buildRequestBody();

      const response = await axios.post(`${SERVER_URL}/synthesize`, requestBody);

      if (response.data?.audioContent) {
        const newAudioSrc =`data:audio/wav;base64,${response.data.audioContent}`;

        setAudioSrc(newAudioSrc);
        onCreate({
          id: Date.now(),
          audioSrc: newAudioSrc,
          model: "Chirp3",
          audioName: "Untitled",
        });
      } else {
        console.error("Risposta senza audioContent:", response.data);
      }
    } catch (err) {
      console.error("Errore richiesta:", err);
    } finally {
      setLoading(false);
    }
  }, [buildRequestBody, loading, onCreate, voiceName]);

  useEffect(() => {
    if (synthesisRequest === lastSynthesisRequest.current) return;
    lastSynthesisRequest.current = synthesisRequest;
    handleSynthesize();
  }, [handleSynthesize, synthesisRequest]);


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
      <section className="tts-panel">
        <h1 className="text-section-title">Inserimento del testo</h1>
        <h4 className="text-section-subtitle">Inserisci il testo da convertire in audio</h4>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          className="text-area"
          placeholder="Inserisci il testo qui..."
        />
      </section>

      <section className="tts-panel pronunciation-panel">
        <div className="add-pronuncia-custom-title-container">
          <h2 className="text-section-title">Pronunce personalizzate</h2>
          <button type="button" className="add-pronuncia-button" onClick={addRow} aria-label="Aggiungi pronuncia personalizzata">
            <span aria-hidden="true">+</span>
          </button>
        </div>
        <h4 className="text-section-subtitle">
          Aggiungi parole da sostituire con pronunce personalizzate
        </h4>
        <div className="parole-custom-container">
          {customPronunce.map((item, idx) => (
            <div key={idx} className="custom-pronuncia-row">
              <input
                value={item.parola}
                onChange={e => updatePronunce(idx, 'parola', e.target.value)}
                placeholder="Parola originale"
                className="custom-pronuncia-input"
              />
              <input
                value={item.sostituzione}
                onChange={e => updatePronunce(idx, 'sostituzione', e.target.value)}
                placeholder="Pronuncia"
                className="custom-pronuncia-input"
              />
              <button type="button" className="remove-pronuncia-button" onClick={() => removeRow(idx)} aria-label={`Rimuovi pronuncia ${idx + 1}`}>
                <FontAwesomeIcon icon={faX} />
              </button>
            </div>
          ))}
          {customPronunce.length === 0 && (
            <p className="pronunciation-empty">Nessuna pronuncia personalizzata</p>
          )}
        </div>
      </section>

      <section className="tts-panel output-panel">
        <h2 className="text-section-title">Audio generato</h2>
        {loading ? (
          <p className="testo-generazione-in-corso">Generazione in corso...</p>
        ) : (
          <AudioPlayer audioSrc={audioSrc}></AudioPlayer>
        )}
      </section>

    </div>
  );
}

export default TextsectionChirp3;
