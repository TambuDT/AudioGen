'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './voiceselector.css';
import { FaPause, FaPlay } from 'react-icons/fa';
import { client } from '../../appwrite/appwrite';
import { Databases, Query, ID } from 'appwrite';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone } from '@fortawesome/free-solid-svg-icons/faMicrophone';
import { faPause } from '@fortawesome/free-solid-svg-icons/faPause';
import { faAngleUp } from '@fortawesome/free-solid-svg-icons/faAngleUp';
import { faAngleDown } from '@fortawesome/free-solid-svg-icons/faAngleDown';
import { GEMINI_TTS_VOICES } from './geminiTtsVoices';

const SERVER_URL = process.env.NEXT_PUBLIC_APP_ENDPOINT;
const DEBOUNCE_SAVE_MS = 600;

export function VoiceSelector({
  onVoiceChange,
  voiceFromPreset,
  speakerMode = 'single',
  speakerVoices = {},
  onSpeakerVoiceChange,
}) {
  const [arrayVoci, setArrayVoci] = useState([]);
  const [voiceMetadata, setVoiceMetadata] = useState({});
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [open, setOpen] = useState(false)
  const [expandedSpeakerVoice, setExpandedSpeakerVoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const audioRefs = useRef({});
  const databases = useRef(new Databases(client));
  const saveTimers = useRef({});
  const loadAbortRef = useRef(null);
  const isMultiSpeaker = speakerMode === 'multi';
  const visibleVoices = isMultiSpeaker
    ? GEMINI_TTS_VOICES.map(voceOriginale => ({
      voceOriginale,
      vocePersonalizzata: voiceMetadata[voceOriginale]?.vocePersonalizzata || '',
      descrizione_voce: voiceMetadata[voceOriginale]?.descrizione_voce || '',
    }))
    : arrayVoci;
  const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase('it');
  const filteredVoices = normalizedSearchTerm
    ? visibleVoices.filter(voce =>
      [voce.voceOriginale, voce.vocePersonalizzata, voce.descrizione_voce]
        .some(value => value?.toLocaleLowerCase('it').includes(normalizedSearchTerm))
    )
    : visibleVoices;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    loadAbortRef.current = controller;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [resBackend, voiceDocuments] = await Promise.all([
          axios.post(`${SERVER_URL}/listvoices`, {}, { signal: controller.signal }),
          (async () => {
            const documents = [];
            let offset = 0;
            let page;

            do {
              page = await databases.current.listDocuments(
                process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
                process.env.NEXT_PUBLIC_VOCI_COLLECTION_ID,
                [Query.limit(100), Query.offset(offset)]
              );
              documents.push(...page.documents);
              offset += page.documents.length;
            } while (page.documents.length === 100);

            return documents;
          })(),
        ]);

        if (cancelled) return;

        const vociBackend = resBackend.data.voci;
        const customMap = {};
        voiceDocuments.forEach(doc => {
          customMap[doc.voceOriginale] = {
            vocePersonalizzata: doc.vocePersonalizzata || '',
            descrizione_voce: doc.descrizione_voce || '',
          };
        });

        setVoiceMetadata(customMap);
        const merged = vociBackend.map(nome => ({
          voceOriginale: nome,
          vocePersonalizzata: customMap[nome]?.vocePersonalizzata || '',
          descrizione_voce: customMap[nome]?.descrizione_voce || '',
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


  const saveToDB = useCallback(async (voceOriginale, vocePersonalizzata, descrizione_voce) => {
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
          { vocePersonalizzata, descrizione_voce }
        );
      } else {
        await databases.current.createDocument(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          process.env.NEXT_PUBLIC_VOCI_COLLECTION_ID,
          ID.unique(),
          { voceOriginale, vocePersonalizzata, descrizione_voce }
        );
      }
      setSaveError('');
    } catch (err) {
      console.error('Errore salvataggio DB:', err);
      setSaveError('Impossibile salvare le modifiche alla voce.');
    }
  }, []);

  const handleSelect = useCallback((voceOriginale) => {
    const nextVoice = selectedVoice === voceOriginale ? null : voceOriginale;
    setSelectedVoice(nextVoice);
    setOpen(Boolean(nextVoice));
    onVoiceChange?.(nextVoice);
  }, [onVoiceChange, selectedVoice]);

  const handleChange = useCallback((voceOriginale, field, newValue) => {
    const currentVoice = voiceMetadata[voceOriginale] ||
      arrayVoci.find(voice => voice.voceOriginale === voceOriginale) ||
      { vocePersonalizzata: '', descrizione_voce: '' };
    const updatedVoice = { ...currentVoice, [field]: newValue };

    setVoiceMetadata(prev => ({
      ...prev,
      [voceOriginale]: updatedVoice,
    }));
    setArrayVoci(prev =>
      prev.map(voice => {
        if (voice.voceOriginale !== voceOriginale) return voice;
        return updatedVoice;
      })
    );

    if (saveTimers.current[voceOriginale]) {
      clearTimeout(saveTimers.current[voceOriginale]);
    }
    saveTimers.current[voceOriginale] = setTimeout(() => {
      saveToDB(
        voceOriginale,
        updatedVoice.vocePersonalizzata,
        updatedVoice.descrizione_voce
      );
    }, DEBOUNCE_SAVE_MS);
  }, [arrayVoci, saveToDB, voiceMetadata]);

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

  if (loading && !isMultiSpeaker) {
    return (
      <div className='musicpicker-container'>
        <h1 className='music-section-title'>Selezione voci</h1>
        <p className='loading-message'>Caricamento voci in corso…</p>
      </div>
    );
  }

  if (error && !isMultiSpeaker) {
    return (
      <div className='musicpicker-container'>
        <h1 className='music-section-title'>Selezione voci</h1>
        <p className='error-message' role="alert">{error}</p>
      </div>
    );
  }


  function changeSetOpen(event, voceOriginale) {
    event.stopPropagation();
    if (selectedVoice !== voceOriginale) {
      handleSelect(voceOriginale);
      setOpen(true);
      return;
    }
    setOpen(prev => !prev);
  }


  return (
    <div className='musicpicker-container'>
      <h1 className='music-section-title'>{isMultiSpeaker ? 'Voci per speaker' : 'Selezione voci'}</h1>
      {isMultiSpeaker && (
        <p className="speaker-selector-hint">Assegna una voce a ciascuno speaker.</p>
      )}
      {saveError && <p className="error-message" role="alert">{saveError}</p>}

      <input
        type="search"
        className="voice-search-input"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Cerca per nome o descrizione..."
        aria-label="Cerca voci per nome o descrizione"
      />

      {filteredVoices.length > 0 ? (
        <div className='music-list-container' role={isMultiSpeaker ? 'list' : 'listbox'} aria-label={isMultiSpeaker ? 'Voci Gemini per speaker' : 'Elenco voci'}>
        {filteredVoices.map((voce) => {
          const assignedSpeaker = isMultiSpeaker
            ? Object.entries(speakerVoices).find(([, voiceName]) => voiceName === voce.voceOriginale)?.[0]
            : null;

          return (
          <div
            key={voce.voceOriginale}
            className={`music-item ${isMultiSpeaker ? (assignedSpeaker ? 'selected' : '') : (selectedVoice === voce.voceOriginale ? 'selected' : '')} ${isMultiSpeaker ? 'speaker-voice-item' : ''}`}
            onClick={isMultiSpeaker ? undefined : () => handleSelect(voce.voceOriginale)}
            role={isMultiSpeaker ? 'listitem' : 'option'}
            aria-selected={isMultiSpeaker ? undefined : selectedVoice === voce.voceOriginale}
            tabIndex={isMultiSpeaker ? undefined : 0}
            onKeyDown={isMultiSpeaker ? undefined : (e) => {
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
            <div className="voce-item-upper">


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
                {playingVoice === voce.voceOriginale ? <FontAwesomeIcon icon={faPause} /> : <FontAwesomeIcon icon={faMicrophone} />}
              </div>

              <div className='voice-item-middle-upper'>
                {isMultiSpeaker ? (
                  <>
                    <input
                      className="voice-name-input"
                      value={voce.vocePersonalizzata}
                      placeholder={voce.voceOriginale}
                      aria-label={`Nome personalizzato per ${voce.voceOriginale}`}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      onChange={(event) => handleChange(voce.voceOriginale, 'vocePersonalizzata', event.target.value)}
                    />
                    <label className='attributi-voce'>Voce Gemini · Italiano</label>
                  </>
                ) : (
                  <>
                    <input
                      className={selectedVoice === voce.voceOriginale ? 'voice-name-input-selected' : 'voice-name-input'}
                      value={voce.vocePersonalizzata}
                      placeholder={voce.voceOriginale}
                      aria-label={`Nome personalizzato per ${voce.voceOriginale}`}
                      onKeyDown={(e) => e.stopPropagation()}
                      onChange={(e) => handleChange(voce.voceOriginale, 'vocePersonalizzata', e.target.value)}
                    />
                    <label className='attributi-voce'>Voce campione · Italiano</label>
                  </>
                )}
              </div>


              <div className='voice-item-right-upper'>
                {!isMultiSpeaker && (
                  <div className={selectedVoice === voce.voceOriginale ? 'outer-selection-circle-selected' : 'outer-selection-circle'}>
                    <div className={selectedVoice === voce.voceOriginale ? 'inner-selection-circle-selected' : 'inner-selection-circle'} ></div>
                  </div>
                )}
                <button
                  type="button"
                  className='open-close-voice-info'
                  aria-label={
                    isMultiSpeaker
                      ? expandedSpeakerVoice === voce.voceOriginale ? 'Nascondi dettagli voce' : 'Mostra dettagli voce'
                      : selectedVoice === voce.voceOriginale && open ? 'Nascondi dettagli voce' : 'Mostra dettagli voce'
                  }
                  aria-expanded={
                    isMultiSpeaker
                      ? expandedSpeakerVoice === voce.voceOriginale
                      : selectedVoice === voce.voceOriginale && open
                  }
                  onClick={(event) => {
                    if (isMultiSpeaker) {
                      event.stopPropagation();
                      setExpandedSpeakerVoice((currentVoice) =>
                        currentVoice === voce.voceOriginale ? null : voce.voceOriginale
                      );
                    } else {
                      changeSetOpen(event, voce.voceOriginale);
                    }
                  }}
                >
                  {(isMultiSpeaker
                    ? expandedSpeakerVoice === voce.voceOriginale
                    : selectedVoice === voce.voceOriginale && open)
                    ? <FontAwesomeIcon icon={faAngleUp} />
                    : <FontAwesomeIcon icon={faAngleDown} />}
                </button>
              </div>


            </div>
            {isMultiSpeaker && (
              <>
                <div className="speaker-assignment-buttons" role="group" aria-label={`Assegna ${voce.voceOriginale}`}>
                  {["speaker_1", "speaker_2"].map((speakerId, index) => (
                    <button
                      type="button"
                      key={speakerId}
                      className={`speaker-assignment-button ${speakerVoices[speakerId] === voce.voceOriginale ? 'assigned' : ''}`}
                      disabled={
                        speakerVoices[speakerId === "speaker_1" ? "speaker_2" : "speaker_1"] === voce.voceOriginale &&
                        speakerVoices[speakerId] !== voce.voceOriginale
                      }
                      aria-pressed={speakerVoices[speakerId] === voce.voceOriginale}
                      onClick={() => onSpeakerVoiceChange?.(speakerId, voce.voceOriginale)}
                    >
                      Speaker {index + 1}
                    </button>
                  ))}
                </div>
                {expandedSpeakerVoice === voce.voceOriginale && (
                  <>
                    <hr className='voice-divider'></hr>
                    <div className="voice-description">
                      <span>Descrizione della voce</span>
                      <textarea
                        value={voce.descrizione_voce}
                        placeholder="Aggiungi una descrizione per questa voce..."
                        aria-label={`Descrizione della voce ${voce.voceOriginale}`}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        onChange={(event) => handleChange(
                          voce.voceOriginale,
                          'descrizione_voce',
                          event.target.value
                        )}
                      />
                    </div>
                  </>
                )}
              </>
            )}
            {!isMultiSpeaker && (
              selectedVoice === voce.voceOriginale && open == true ?
                <>
                  <hr className='voice-divider'></hr>
                  <div className="voice-description">
                    <span>Descrizione della voce</span>
                    <textarea
                      value={voce.descrizione_voce}
                      placeholder="Aggiungi una descrizione per questa voce..."
                      aria-label={`Descrizione della voce ${voce.voceOriginale}`}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      onChange={(event) => handleChange(
                        voce.voceOriginale,
                        'descrizione_voce',
                        event.target.value
                      )}
                    />
                  </div>
                  </>
                :
                null
            )}

          </div>
          );
        })}
        </div>
      ) : (
        <p className="voice-search-empty" role="status">Nessuna voce trovata.</p>
      )}
    </div>
  );
}