'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './voiceselector.css';
import { FaPause, FaPlay } from 'react-icons/fa';
import { client } from '../../appwrite/appwrite';
import { Databases, Query, ID } from 'appwrite';
import axios from 'axios';

const SERVER_URL = process.env.NEXT_PUBLIC_APP_ENDPOINT;
const DEBOUNCE_SAVE_MS = 600;

export function VoiceSelector({ onVoiceChange, voiceFromPreset }) {
  const [arrayVoci, setArrayVoci] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const audioRefs = useRef({});
  const databases = useRef(new Databases(client));
  const saveTimers = useRef({});
  const loadAbortRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    loadAbortRef.current = controller;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [resBackend, resDB] = await Promise.all([
          axios.post(`${SERVER_URL}/listvoices`, {}, { signal: controller.signal }),
          databases.current.listDocuments(
            process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
            process.env.NEXT_PUBLIC_VOCI_COLLECTION_ID
          )
        ]);

        if (cancelled) return;

        const vociBackend = resBackend.data.voci;
        const customMap = {};
        resDB.documents.forEach(doc => {
          customMap[doc.voceOriginale] = doc.vocePersonalizzata;
        });

        const merged = vociBackend.map(nome => ({
          voceOriginale: nome,
          vocePersonalizzata: customMap[nome] || ''
        }));

        setArrayVoci(merged);
      } catch (err) {
        if (cancelled || axios.isCancel(err)) return;
        console.error('Errore caricamento voci:', err);
        setError('Impossibile caricare le voci. Riprova più tardi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
      Object.values(saveTimers.current).forEach(clearTimeout);
    };
  }, []);


  useEffect(() => {
    if (!voiceFromPreset) {
      setSelectedVoice(null);
      return;
    }
    if (voiceFromPreset !== selectedVoice) {
      setSelectedVoice(voiceFromPreset);
    }
  }, [voiceFromPreset, selectedVoice]);


  const saveToDB = useCallback(async (voceOriginale, vocePersonalizzata) => {
    try {
      const res = await databases.current.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        process.env.NEXT_PUBLIC_VOCI_COLLECTION_ID,
        [Query.equal('voceOriginale', voceOriginale)]
      );

      if (res.documents.length > 0) {
        await databases.current.updateDocument(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          process.env.NEXT_PUBLIC_VOCI_COLLECTION_ID,
          res.documents[0].$id,
          { vocePersonalizzata }
        );
      } else {
        await databases.current.createDocument(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          process.env.NEXT_PUBLIC_VOCI_COLLECTION_ID,
          ID.unique(),
          { voceOriginale, vocePersonalizzata }
        );
      }
    } catch (err) {
      console.error('Errore salvataggio DB:', err);
    }
  }, []);

  const handleSelect = useCallback((voceOriginale) => {
    setSelectedVoice(voceOriginale);
    onVoiceChange?.(voceOriginale);
  }, [onVoiceChange]);

  const handleChange = useCallback((voceOriginale, newValue) => {
    setArrayVoci(prev =>
      prev.map(v =>
        v.voceOriginale === voceOriginale
          ? { ...v, vocePersonalizzata: newValue }
          : v
      )
    );

    if (saveTimers.current[voceOriginale]) {
      clearTimeout(saveTimers.current[voceOriginale]);
    }
    saveTimers.current[voceOriginale] = setTimeout(() => {
      saveToDB(voceOriginale, newValue);
    }, DEBOUNCE_SAVE_MS);
  }, [saveToDB]);

  const handlePlayPause = useCallback((voceOriginale) => {
    const audio = audioRefs.current[voceOriginale];
    if (!audio) return;

    if (playingVoice === voceOriginale) {
      audio.pause();
      setPlayingVoice(null);
    } else {
      Object.values(audioRefs.current).forEach(a => {
        if (a) a.pause();
      });
      audio.currentTime = 0;
      audio.play().catch(() => { });
      setPlayingVoice(voceOriginale);
    }
  }, [playingVoice]);

  const handleAudioEnded = useCallback((voceOriginale) => {
    setPlayingVoice(prev => prev === voceOriginale ? null : prev);
  }, []);

  if (loading) {
    return (
      <div className='musicpicker-container'>
        <h1 className='music-section-title'>Selezione voci</h1>
        <p className='loading-message'>Caricamento voci in corso…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='musicpicker-container'>
        <h1 className='music-section-title'>Selezione voci</h1>
        <p className='error-message' role="alert">{error}</p>
      </div>
    );
  }

  return (
    <div className='musicpicker-container'>
      <h1 className='music-section-title'>Selezione voci</h1>

      <div className='music-list-container' role="listbox" aria-label="Elenco voci">
        {arrayVoci.map((voce) => (
          <div
            key={voce.voceOriginale}
            className={`music-item ${selectedVoice === voce.voceOriginale ? 'selected' : ''}`}
            onClick={() => handleSelect(voce.voceOriginale)}
            role="option"
            aria-selected={selectedVoice === voce.voceOriginale}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                // Evita di attivare la selezione se il focus è sull'input o sul pulsante play
                if (e.target.tagName === 'INPUT' || e.target.getAttribute('role') === 'button') {
                  return;
                }
                e.preventDefault();
                handleSelect(voce.voceOriginale);
              }
            }}
          >
            <input
              className={selectedVoice === voce.voceOriginale ? 'voice-name-input-selected' : 'voice-name-input'}
              value={voce.vocePersonalizzata}
              placeholder={voce.voceOriginale}
              aria-label={`Nome personalizzato per ${voce.voceOriginale}`}
              onKeyDown={(e) => {
                // Lascia passare lo spazio senza propagazione
                if (e.key === ' ') {
                  e.stopPropagation();
                }
              }}
              onChange={(e) => handleChange(voce.voceOriginale, e.target.value)}
            />

            <audio
              ref={(el) => (audioRefs.current[voce.voceOriginale] = el)}
              src={`${SERVER_URL}/vociCampionario/${voce.voceOriginale}.mp3`}
              onEnded={() => handleAudioEnded(voce.voceOriginale)}
              preload="none"
            />

            <div
              role="button"
              tabIndex={0}
              aria-label={playingVoice === voce.voceOriginale ? 'Pausa anteprima' : 'Riproduci anteprima'}
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPause(voce.voceOriginale);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePlayPause(voce.voceOriginale);
                }
              }}
              className="play-button"
            >
              {playingVoice === voce.voceOriginale ? <FaPause /> : <FaPlay />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}