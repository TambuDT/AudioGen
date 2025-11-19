import React, { useState, useRef, useEffect } from 'react';
import './voiceselector.css';
import { FaPause } from "react-icons/fa6";
import { FaPlay } from "react-icons/fa";
import axios from 'axios';

const SERVER_URL = `${process.env.NEXT_PUBLIC_APP_ENDPOINT}:3001`;

export function VoiceSelector({ onVoiceChange, voiceFromPreset }) {
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [arrayVoci, setArrayVoci] = useState([]);
  const audioRefs = useRef({});

  // Carica le voci dal backend
  useEffect(() => {
    const loadArrayVoci = async () => {
      try {
        const response = await axios.post(`${SERVER_URL}/listvoices`, {});
        const voci = response.data.voci; // l'array deve arrivare così dal backend
        if (Array.isArray(voci)) {
          setArrayVoci(voci);
          console.log('Voci Chirp3 italiane:', voci);
        } else {
          console.error('Formato delle voci non corretto:', voci);
        }
      } catch (error) {
        console.error('Errore nel caricamento delle voci:', error);
      }
    };
    loadArrayVoci();
  }, []);

  const handleSelect = (voce) => {
    setSelectedVoice(voce);
    onVoiceChange?.(voce);
  };

  useEffect(() => {
    if (!voiceFromPreset) {
      setSelectedVoice(null);
      return;
    }
    if (voiceFromPreset !== selectedVoice) {
      setSelectedVoice(voiceFromPreset);
    }
  }, [voiceFromPreset, selectedVoice]);

  const handlePlayPause = (voce) => {
    const audio = audioRefs.current[voce];
    if (!audio) return;

    Object.keys(audioRefs.current).forEach((v) => {
      if (v !== voce && audioRefs.current[v]) {
        audioRefs.current[v].pause();
      }
    });

    if (playingVoice === voce) {
      audio.pause();
      setPlayingVoice(null);
    } else {
      audio.play();
      setPlayingVoice(voce);
    }
  };

  const handleEnded = (voce) => {
    if (playingVoice === voce) setPlayingVoice(null);
  };

  return (
    <div className='musicpicker-container'>
      <h1 className='music-section-title'>Selezione voci</h1>
      <h4 className='music-section-subtitle'>Clicca su una voce per selezionarla</h4>
      <div className='music-list-container'>
        {arrayVoci.map((voce) => (
          <div
            key={voce}
            className={`music-item ${selectedVoice === voce ? 'selected' : ''}`}
            onClick={() => handleSelect(voce)}
          >
            <p className='music-name'>{voce}</p>

            <audio
              ref={(el) => (audioRefs.current[voce] = el)}
              src={`${SERVER_URL}/vociCampionario/${voce}.mp3`}
              onEnded={() => handleEnded(voce)}
            />

            <div
              className='play-pause-btn'
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPause(voce);
              }}
            >
              {playingVoice === voce ? <FaPause /> : <FaPlay />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
