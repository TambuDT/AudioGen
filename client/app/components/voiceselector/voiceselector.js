import React, { useState, useRef, useEffect } from 'react';
import './voiceselector.css';
import { FaPause } from "react-icons/fa6";
import { FaPlay } from "react-icons/fa";
import { client } from '../../appwrite/appwrite';
import { Databases, Query, ID } from 'appwrite';
import axios from 'axios';

const SERVER_URL = `${process.env.NEXT_PUBLIC_APP_ENDPOINT}`;

export function VoiceSelector({ onVoiceChange }) {
  const [arrayVoci, setArrayVoci] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [playingVoice, setPlayingVoice] = useState(null);

  const audioRefs = useRef({});
  const databases = new Databases(client);


  useEffect(() => {
    const load = async () => {
      try {
        // BACKEND
        const resBackend = await axios.post(`${SERVER_URL}/listvoices`, {});
        const vociBackend = resBackend.data.voci;

        // APPWRITE
        const resDB = await databases.listDocuments(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          process.env.NEXT_PUBLIC_VOCI_COLLECTION_ID
        );

        const customMap = {};
        resDB.documents.forEach(doc => {
          customMap[doc.voceOriginale] = doc.vocePersonalizzata;
        });

        // MERGE
        const merged = vociBackend.map(nome => ({
          voceOriginale: nome,
          vocePersonalizzata: customMap[nome] || ""
        }));

        setArrayVoci(merged);

      } catch (err) {
        console.error("Errore load voci:", err);
      }
    };

    load();
  }, []);


  const handleSelect = (voce) => {
    setSelectedVoice(voce);
    onVoiceChange?.(voce);
  };


  const saveToDB = async (voceOriginale, vocePersonalizzata) => {
    try {
      const res = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        process.env.NEXT_PUBLIC_VOCI_COLLECTION_ID,
        [Query.equal("voceOriginale", voceOriginale)]
      );

      if (res.documents.length > 0) {
        await databases.updateDocument(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          process.env.NEXT_PUBLIC_VOCI_COLLECTION_ID,
          res.documents[0].$id,
          {
            vocePersonalizzata
          }
        );
      } else {
        await databases.createDocument(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          process.env.NEXT_PUBLIC_VOCI_COLLECTION_ID,
          ID.unique(),
          {
            voceOriginale,
            vocePersonalizzata
          }
        );
      }

    } catch (err) {
      console.error("Errore salvataggio DB:", err);
    }
  };


  const handleChange = (voceOriginale, newValue) => {
    setArrayVoci(prev =>
      prev.map(v =>
        v.voceOriginale === voceOriginale
          ? { ...v, vocePersonalizzata: newValue }
          : v
      )
    );

    saveToDB(voceOriginale, newValue);
  };


  const handlePlayPause = (voce) => {
    const audio = audioRefs.current[voce];
    if (!audio) return;

    if (playingVoice === voce) {
      audio.pause();
      setPlayingVoice(null);
    } else {
      Object.values(audioRefs.current).forEach(a => a?.pause());
      audio.play();
      setPlayingVoice(voce);
    }
  };

  return (
    <div className='musicpicker-container'>
      <h1 className='music-section-title'>Selezione voci</h1>

      <div className='music-list-container'>
        {arrayVoci.map((voce) => (
          <div
            key={voce.voceOriginale}
            className={`music-item ${
              selectedVoice === voce.voceOriginale ? 'selected' : ''
            }`}
            onClick={() => handleSelect(voce.voceOriginale)}
          >
            
            <input
              className={`${
              selectedVoice === voce.voceOriginale ? 'voice-name-input-selected' : 'voice-name-input'
            }`}
              value={voce.vocePersonalizzata}
              placeholder={voce.voceOriginale}
              onClick={(e) => {e.stopPropagation(); handleSelect(voce.voceOriginale);}}
              onChange={(e) =>
                handleChange(voce.voceOriginale, e.target.value)
              }
            />

       
            <audio
              ref={(el) =>
                (audioRefs.current[voce.voceOriginale] = el)
              }
              src={`${SERVER_URL}/vociCampionario/${voce.voceOriginale}.mp3`}
            />

          
            <div
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPause(voce.voceOriginale);
              }}
            >
              {playingVoice === voce.voceOriginale ? (
                <FaPause />
              ) : (
                <FaPlay />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}