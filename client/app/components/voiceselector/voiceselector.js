'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './voiceselector.css';
import { account, client } from '../../appwrite/appwrite';
import { Databases, Query, ID, Storage, Permission, Role } from 'appwrite';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera } from '@fortawesome/free-solid-svg-icons/faCamera';
import { faPause } from '@fortawesome/free-solid-svg-icons/faPause';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faAngleUp } from '@fortawesome/free-solid-svg-icons/faAngleUp';
import { faAngleDown } from '@fortawesome/free-solid-svg-icons/faAngleDown';
import { GEMINI_TTS_VOICES } from './geminiTtsVoices';

const SERVER_URL = process.env.NEXT_PUBLIC_APP_ENDPOINT;
const DEBOUNCE_SAVE_MS = 600;
const PROFILE_IMAGE_BUCKET_ID = 'immagini_profilo';

function isProfileImageForVoice(file, voiceName) {
  return file.mimeType?.startsWith('image/') &&
    (file.name === voiceName || file.name.startsWith(`${voiceName}.`));
}

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
  const [profileImageError, setProfileImageError] = useState('');
  const [profileImageFiles, setProfileImageFiles] = useState([]);
  const [failedProfileImageIds, setFailedProfileImageIds] = useState({});
  const [profileImagesLoading, setProfileImagesLoading] = useState(true);
  const [uploadingVoice, setUploadingVoice] = useState(null);
  const [open, setOpen] = useState(false)
  const [expandedSpeakerVoice, setExpandedSpeakerVoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const audioRefs = useRef({});
  const databases = useRef(new Databases(client));
  const storage = useRef(new Storage(client));
  const profileImageInputRefs = useRef({});
  const saveTimers = useRef({});
  const pendingSaves = useRef({});
  const saveQueues = useRef({});
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
    let cancelled = false;

    const loadProfileImages = async () => {
      try {
        const files = [];
        let offset = 0;
        let page;

        do {
          page = await storage.current.listFiles({
            bucketId: PROFILE_IMAGE_BUCKET_ID,
            queries: [Query.limit(100), Query.offset(offset)],
          });
          files.push(...page.files);
          offset += page.files.length;
        } while (page.files.length === 100);

        if (!cancelled) setProfileImageFiles(files);
      } catch (err) {
        if (cancelled) return;
        console.error('Errore caricamento immagini profilo:', err);
        setProfileImageError('Impossibile caricare le immagini profilo.');
      } finally {
        if (!cancelled) setProfileImagesLoading(false);
      }
    };

    loadProfileImages();

    return () => {
      cancelled = true;
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
    if (typeof voceOriginale !== 'string' || !voceOriginale.trim()) {
      console.error('Impossibile salvare la voce: nome originale mancante.', voceOriginale);
      setSaveError('Impossibile salvare le modifiche: nome della voce non valido.');
      return;
    }

    try {
      const res = await databases.current.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        process.env.NEXT_PUBLIC_VOCI_COLLECTION_ID,
        [Query.equal('voceOriginale', [voceOriginale])]
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

  const queueSave = useCallback((voceOriginale, voice) => {
    const previousSave = saveQueues.current[voceOriginale] || Promise.resolve();
    const nextSave = previousSave.then(() =>
      saveToDB(voceOriginale, voice.vocePersonalizzata, voice.descrizione_voce)
    );
    saveQueues.current[voceOriginale] = nextSave;
  }, [saveToDB]);

  const flushVoiceSave = useCallback((voceOriginale) => {
    if (saveTimers.current[voceOriginale]) {
      clearTimeout(saveTimers.current[voceOriginale]);
      delete saveTimers.current[voceOriginale];
    }

    const pendingVoice = pendingSaves.current[voceOriginale];
    if (!pendingVoice) return;

    delete pendingSaves.current[voceOriginale];
    queueSave(voceOriginale, pendingVoice);
  }, [queueSave]);

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(clearTimeout);
      Object.entries(pendingSaves.current).forEach(([voceOriginale, voice]) => {
        queueSave(voceOriginale, voice);
      });
      pendingSaves.current = {};
    };
  }, [queueSave]);

  const handleSelect = useCallback((voceOriginale) => {
    const nextVoice = selectedVoice === voceOriginale ? null : voceOriginale;
    setSelectedVoice(nextVoice);
    setOpen(Boolean(nextVoice));
    onVoiceChange?.(nextVoice);
  }, [onVoiceChange, selectedVoice]);

  const handleChange = useCallback((voceOriginale, field, newValue) => {
    const currentVoice = pendingSaves.current[voceOriginale] ||
      voiceMetadata[voceOriginale] ||
      arrayVoci.find(voice => voice.voceOriginale === voceOriginale) ||
      { vocePersonalizzata: '', descrizione_voce: '' };
    const updatedVoice = { ...currentVoice, voceOriginale, [field]: newValue };

    pendingSaves.current[voceOriginale] = updatedVoice;
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
    saveTimers.current[voceOriginale] = setTimeout(
      () => flushVoiceSave(voceOriginale),
      DEBOUNCE_SAVE_MS
    );
  }, [arrayVoci, flushVoiceSave, voiceMetadata]);

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

  const handleProfileImageUpload = useCallback(async (voceOriginale, event) => {
    const input = event.currentTarget;
    const imageFile = input.files?.[0];
    input.value = '';
    if (!imageFile) return;

    if (!imageFile.type.startsWith('image/')) {
      setProfileImageError('Seleziona un file immagine valido.');
      return;
    }

    setProfileImageError('');
    setUploadingVoice(voceOriginale);

    try {
      const currentUser = await account.get();
      const extension = imageFile.name.includes('.')
        ? imageFile.name.slice(imageFile.name.lastIndexOf('.'))
        : '';
      const namedImageFile = new File(
        [imageFile],
        `${voceOriginale}${extension}`,
        { type: imageFile.type, lastModified: imageFile.lastModified }
      );
      const uploadedFile = await storage.current.createFile({
        bucketId: PROFILE_IMAGE_BUCKET_ID,
        fileId: ID.unique(),
        file: namedImageFile,
        permissions: [
          Permission.read(Role.users()),
          Permission.update(Role.user(currentUser.$id)),
          Permission.delete(Role.user(currentUser.$id)),
        ],
      });
      const newProfileImage = {
        ...uploadedFile,
        imageUrl: storage.current.getFileView({
          bucketId: PROFILE_IMAGE_BUCKET_ID,
          fileId: uploadedFile.$id,
        }),
      };

      const previousImages = profileImageFiles.filter(file =>
        isProfileImageForVoice(file, voceOriginale)
      );
      const failedDeletes = [];
      for (const previousImage of previousImages) {
        try {
          await storage.current.deleteFile(PROFILE_IMAGE_BUCKET_ID, previousImage.$id);
        } catch (err) {
          console.error('Errore rimozione immagine profilo precedente:', err);
          failedDeletes.push(previousImage.$id);
        }
      }

      setProfileImageFiles(currentFiles => [
        newProfileImage,
        ...currentFiles.filter(file =>
          !isProfileImageForVoice(file, voceOriginale) || failedDeletes.includes(file.$id)
        ),
      ]);
      if (failedDeletes.length > 0) {
        setProfileImageError('Immagine caricata, ma non è stato possibile rimuovere quella precedente.');
      }
    } catch (err) {
      console.error('Errore caricamento immagine profilo:', err);
      setProfileImageError('Impossibile caricare l’immagine profilo.');
    } finally {
      setUploadingVoice(null);
    }
  }, [profileImageFiles]);

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
      {profileImageError && <p className="error-message" role="alert">{profileImageError}</p>}

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
          const profileImage = profileImageFiles.find(file =>
            isProfileImageForVoice(file, voce.voceOriginale)
          );
          const profileImageUrl = profileImage
            ? profileImage.imageUrl || storage.current.getFileView({
              bucketId: PROFILE_IMAGE_BUCKET_ID,
              fileId: profileImage.$id,
            })
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
                if (
                  e.target.tagName === 'INPUT' ||
                  e.target.tagName === 'BUTTON' ||
                  e.target.getAttribute('role') === 'button'
                ) {
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

              <div className="voice-avatar-control">
                <button
                  type="button"
                  aria-label={playingVoice === voce.voceOriginale ? 'Pausa anteprima' : `Riproduci anteprima di ${voce.voceOriginale}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayPause(voce.voceOriginale);
                  }}
                  className={`play-button voice-avatar-button ${playingVoice === voce.voceOriginale ? 'playing' : ''}`}
                >
                  {profileImageUrl && !failedProfileImageIds[profileImage.$id] ? (
                    <img
                      src={profileImageUrl}
                      alt=""
                      onError={() => {
                        setFailedProfileImageIds(current => ({
                          ...current,
                          [profileImage.$id]: true,
                        }));
                        setProfileImageError(`Impossibile visualizzare l’immagine per ${voce.voceOriginale}.`);
                      }}
                    />
                  ) : (
                    <span className="voice-avatar-placeholder" aria-hidden="true">
                      {voce.voceOriginale.slice(0, 1).toLocaleUpperCase('it')}
                    </span>
                  )}
                  <span className="voice-avatar-play-indicator" aria-hidden="true">
                    {playingVoice === voce.voceOriginale
                      ? <FontAwesomeIcon icon={faPause} />
                      : <FontAwesomeIcon icon={faPlay} />}
                  </span>
                </button>
                <button
                  type="button"
                  className="voice-image-upload"
                  aria-label={`Carica immagine profilo per ${voce.voceOriginale}`}
                  title={uploadingVoice === voce.voceOriginale ? 'Caricamento immagine...' : 'Carica immagine profilo'}
                  disabled={profileImagesLoading || uploadingVoice !== null}
                  onClick={(event) => {
                    event.stopPropagation();
                    profileImageInputRefs.current[voce.voceOriginale]?.click();
                  }}
                >
                  <FontAwesomeIcon icon={faCamera} />
                </button>
                <input
                  ref={element => {
                    profileImageInputRefs.current[voce.voceOriginale] = element;
                  }}
                  className="voice-image-input"
                  type="file"
                  accept="image/*"
                  aria-label={`Seleziona immagine profilo per ${voce.voceOriginale}`}
                  onClick={event => event.stopPropagation()}
                  onChange={event => handleProfileImageUpload(voce.voceOriginale, event)}
                />
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
                      onBlur={() => flushVoiceSave(voce.voceOriginale)}
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
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      onBlur={() => flushVoiceSave(voce.voceOriginale)}
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
                        onBlur={() => flushVoiceSave(voce.voceOriginale)}
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
                      onBlur={() => flushVoiceSave(voce.voceOriginale)}
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