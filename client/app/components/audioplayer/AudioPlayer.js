"use client";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faDownload } from '@fortawesome/free-solid-svg-icons';
import React, { useRef, useState, useEffect } from "react";
import './audioPlayer.css';

function AudioPlayer({ audioSrc, showDownload = true }) {
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

    const formatTime = (time) => {
        if (!Number.isFinite(time)) return "00:00";
        const minutes = Math.floor(time / 60).toString().padStart(2, "0");
        const seconds = Math.floor(time % 60).toString().padStart(2, "0");
        return `${minutes}:${seconds}`;
    };

    if (!audioSrc) {
        return (
            <div className="custom-audio-player-placeholder" role="status">
                <span className="audio-placeholder-play" aria-hidden="true">
                    <FontAwesomeIcon icon={faPlay} />
                </span>
                <span className="audio-placeholder-waveform" aria-hidden="true">
                    {[12, 20, 28, 16, 24, 32, 18, 26, 14, 22, 30, 16, 24, 12, 20, 28, 16, 24, 12].map((height, index) => (
                        <span key={index} style={{ height }} />
                    ))}
                </span>
                <span className="audio-placeholder-label">L’audio generato apparirà qui</span>
            </div>
        );
    }

    return (
        <div className="custom-audio-player-container">
            <div className="custom-audio-player-controls">
            <audio ref={audioRef} src={audioSrc} preload="metadata" />
            <button className="custom-audio-player-play-pause" onClick={handlePlayPause}>
                {isPlaying ? <FontAwesomeIcon icon={faPause} /> : <FontAwesomeIcon icon={faPlay} />}
            </button>
            <span className="custom-audio-player-time">{formatTime(currentTime)}</span>
            <input
                className='custom-audio-player-seek'
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
            />
            <span className="custom-audio-player-time">{formatTime(duration)}</span>
            {showDownload && (
                <a className='custom-audio-player-download' href={audioSrc} download aria-label="Scarica audio">
                   <FontAwesomeIcon icon={faDownload} />
                </a>
            )}
            </div>
        </div>
    );
}

export default AudioPlayer;
