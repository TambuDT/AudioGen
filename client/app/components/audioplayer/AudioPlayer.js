"use client";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faDownload } from '@fortawesome/free-solid-svg-icons';
import React, { useRef, useState, useEffect } from "react";
import './audioPlayer.css';

function AudioPlayer({ audioSrc }) {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const handlePlayPause = () => {
        if (!audioRef.current) return;

        if (audioRef.current.paused) {
            audioRef.current.play();
            setIsPlaying(true);
        } else {
            audioRef.current.pause();
            setIsPlaying(false);
        }
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => {
            setCurrentTime(audio.currentTime);
            setDuration(audio.duration || 0);
        };

        const handleEnded = () => {
            setIsPlaying(false); // Quando finisce l'audio, torna a play
            setCurrentTime(0);    // opzionale: resetta il tempo a 0
        };

        audio.addEventListener("timeupdate", updateTime);
        audio.addEventListener("loadedmetadata", updateTime);
        audio.addEventListener("ended", handleEnded); // aggiunto

        return () => {
            audio.removeEventListener("timeupdate", updateTime);
            audio.removeEventListener("loadedmetadata", updateTime);
            audio.removeEventListener("ended", handleEnded);
        };
    }, []);

    const handleSeek = (e) => {
        const newTime = Number(e.target.value);
        if (audioRef.current) audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    return (
        <div className="custom-audio-player-container">
            <audio ref={audioRef} src={audioSrc} preload="metadata" />
            <button className="custom-audio-player-play-pause" onClick={handlePlayPause}>
                {isPlaying ? <FontAwesomeIcon icon={faPause} /> : <FontAwesomeIcon icon={faPlay} />}
            </button>
            <input
                className='custom-audio-player-seek'
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
            />
            <a className='custom-audio-player-download' href={audioSrc} download>
               <FontAwesomeIcon icon={faDownload} />
            </a>
        </div>
    );
}

export default AudioPlayer;
