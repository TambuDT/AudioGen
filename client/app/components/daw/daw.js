"use client";
import React, { useState, useRef, useEffect } from "react";
import "./daw.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileCirclePlus, faPlay, faPause, faDownload, faTrash } from "@fortawesome/free-solid-svg-icons";

function Daw() {
    const [files, setFiles] = useState([]);
    const [dragging, setDragging] = useState(false);
    const [pixelsPerSecond] = useState(50);
    const fileInputRef = useRef(null);
    const trackAreaRef = useRef(null);

    const audioRefs = useRef([]);
    const timeouts = useRef([]);

    const isDragging = useRef(false);
    const dragIndex = useRef(null);
    const startX = useRef(0);

    // Drag delle clip
    const startDrag = (e, index) => {
        if (!files[index]) return;
        isDragging.current = true;
        dragIndex.current = index;
        startX.current = e.clientX - files[index].offset * pixelsPerSecond;
        document.addEventListener("mousemove", onDrag);
        document.addEventListener("mouseup", stopDrag);
    };

    const onDrag = (e) => {
        if (!isDragging.current || dragIndex.current === null) return;
        const deltaPixels = e.clientX - startX.current;
        const deltaSeconds = deltaPixels / pixelsPerSecond;

        setFiles((prev) => {
            const updated = [...prev];
            if (!updated[dragIndex.current]) return updated;
            updated[dragIndex.current] = {
                ...updated[dragIndex.current],
                offset: Math.max(0, deltaSeconds),
            };
            console.log("Dragging", updated[dragIndex.current].offset);
            return updated;
        });
    };

    const stopDrag = () => {
        isDragging.current = false;
        dragIndex.current = null;
        document.removeEventListener("mousemove", onDrag);
        document.removeEventListener("mouseup", stopDrag);
    };

    // Carica file
    const handleFiles = async (fileList) => {
        const validFiles = [...fileList].filter((f) => f.type.startsWith("audio/"));
        if (!validFiles.length) return;

        const processed = await Promise.all(
            validFiles.map(async (file) => {
                const duration = await getAudioDuration(file);
                const waveform = await generateWaveform(file);
                return { name: file.name, file, duration, offset: 0, waveform, volume: 1 };
            })
        );

        setFiles((prev) => [...prev, ...processed]);
    };

    const getAudioDuration = (file) =>
        new Promise((resolve) => {
            const audio = document.createElement("audio");
            audio.src = URL.createObjectURL(file);
            audio.addEventListener("loadedmetadata", () => resolve(audio.duration));
        });

    // Genera waveform su canvas
    const generateWaveform = (file) =>
        new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsArrayBuffer(file);
            reader.onload = async () => {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const buffer = await audioCtx.decodeAudioData(reader.result);
                const rawData = buffer.getChannelData(0);
                const samples = 200; // numero di campioni per waveform
                const blockSize = Math.floor(rawData.length / samples);
                const waveform = [];

                for (let i = 0; i < samples; i++) {
                    let sum = 0;
                    for (let j = 0; j < blockSize; j++) {
                        sum += Math.abs(rawData[i * blockSize + j]);
                    }
                    waveform.push(sum / blockSize);
                }
                resolve(waveform);
            };
        });

    // Play / Stop
    const playAll = () => {
        stopAll();
        audioRefs.current = files.map((f) => {
            const audio = new Audio(URL.createObjectURL(f.file));
            audio.volume = f.volume; // applica il volume
            return audio;
        });

        files.forEach((f, i) => {
            const timeout = setTimeout(() => {
                audioRefs.current[i].play();
            }, f.offset * 1000);
            timeouts.current.push(timeout);
        });
    };


    const stopAll = () => {
        timeouts.current.forEach((t) => clearTimeout(t));
        audioRefs.current.forEach((a) => a.pause());
        audioRefs.current.forEach((a) => { a.currentTime = 0; });
        timeouts.current = [];
        audioRefs.current = [];
    };

    // Drag & Drop
    const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
    const handleDragLeave = () => setDragging(false);
    const handleDrop = (e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); };
    const handleClick = () => fileInputRef.current.click();
    const handleFileChange = (e) => handleFiles(e.target.files);

    // Timeline ticks
    const getTimelineTicks = () => {
        const totalSeconds =
            files.length > 0
                ? Math.ceil(Math.max(...files.map((f) => f.offset + f.duration), 10))
                : 10;

        const ticks = [];
        for (let s = 0; s <= totalSeconds; s++) {
            ticks.push({ type: "second", value: s, position: s * pixelsPerSecond });
            for (let d = 1; d < 10; d++) {
                ticks.push({
                    type: "tenth",
                    value: s + d / 10,
                    position: s * pixelsPerSecond + (pixelsPerSecond / 10) * d,
                });
            }
        }
        return ticks;
    };


    const changeVolume = (index, value) => {
        setFiles(prev => {
            const updated = [...prev];
            updated[index].volume = value;
            return updated;
        });

        // Se l'audio è già creato, aggiorna il volume live
        if (audioRefs.current[index]) {
            audioRefs.current[index].volume = value;
        }
    };

    const exportAll = async () => {
        if (!files.length) {
            alert("Non ci sono tracce da esportare!");
            return;
        }

        // Calcola durata totale della timeline
        const totalDuration = Math.max(...files.map(f => f.offset + f.duration));

        // Creiamo un OfflineAudioContext (2 canali stereo, sampleRate standard 44100)
        const sampleRate = 44100;
        const offlineCtx = new OfflineAudioContext(2, totalDuration * sampleRate, sampleRate);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const arrayBuffer = await file.file.arrayBuffer();
            const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

            // Creiamo un buffer source per la traccia
            const source = offlineCtx.createBufferSource();
            source.buffer = audioBuffer;

            // GainNode per il volume
            const gainNode = offlineCtx.createGain();
            gainNode.gain.value = file.volume;

            // Connettiamo: source → gain → destinazione
            source.connect(gainNode).connect(offlineCtx.destination);

            // Avvio al giusto offset
            source.start(file.offset);
        }

        // Render offline
        const renderedBuffer = await offlineCtx.startRendering();

        // Convertiamo in WAV
        const wav = audioBufferToWav(renderedBuffer);
        const blob = new Blob([wav], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);

        // Scarica il file
        const a = document.createElement("a");
        a.href = url;
        a.download = "mix.wav";
        a.click();
        URL.revokeObjectURL(url);
    };

    function audioBufferToWav(buffer) {
        const numOfChan = buffer.numberOfChannels,
            length = buffer.length * numOfChan * 2 + 44,
            bufferArray = new ArrayBuffer(length),
            view = new DataView(bufferArray),
            channels = [],
            sampleRate = buffer.sampleRate;

        let pos = 0; // <-- usa let

        // Scrive header WAV
        function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
        function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8);
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt "
        setUint32(16);
        setUint16(1); // PCM
        setUint16(numOfChan);
        setUint32(sampleRate);
        setUint32(sampleRate * 2 * numOfChan);
        setUint16(numOfChan * 2);
        setUint16(16);
        setUint32(0x61746164); // "data"
        setUint32(length - pos - 4);

        for (let i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));

        for (let i = 0; i < buffer.length; i++)
            for (let ch = 0; ch < numOfChan; ch++) {
                let sample = Math.max(-1, Math.min(1, channels[ch][i]));
                view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
                pos += 2;
            }

        return bufferArray;
    }



    return (
        <div>
            <div
                className={`daw-container ${dragging ? "dragging" : ""}`}
                onClick={files.length === 0 ? handleClick : undefined}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragLeave={handleDragLeave}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept="audio/*"
                    multiple
                    onChange={handleFileChange}
                />

                {files.length > 0 ? (
                    <div className="daw-main-container">
                        <div className="daw-main-container-controls">
                            <h1>Mixer</h1>
                            <button className="add-file-btn" onClick={() => fileInputRef.current.click()}>
                                <FontAwesomeIcon icon={faFileCirclePlus} />
                            </button>
                            <button className="add-file-btn" onClick={playAll}><FontAwesomeIcon icon={faPlay} /></button>
                            <button className="add-file-btn" onClick={stopAll}><FontAwesomeIcon icon={faPause} /></button>
                            <button className="add-file-btn" onClick={exportAll}> <FontAwesomeIcon icon={faDownload} /></button>
                        </div>

                        <div className="daw-main-tracks-clip-container">
                            <div className="daw-main-left">
                                <div className="daw-main-audio-loaded">
                                    <div className="daw-tracks-list">
                                        {files.map((f, index) => (
                                            <div className="daw-main-track-loaded" key={index}>
                                                <button className="add-file-btn" onClick={() => {
                                                    setFiles((prev) => prev.filter((_, i) => i !== index));
                                                }}><FontAwesomeIcon icon={faTrash} /></button>
                                                <p>
                                                    <strong>
                                                        {f.name.length > 20 ? f.name.slice(0, 20) + "..." : f.name}
                                                    </strong>{" "}
                                                    {f.duration.toFixed(2)}s
                                                </p>
                                                <input className="slider-volume"
                                                    type="range"
                                                    min={0}
                                                    max={1}
                                                    step={0.01}
                                                    value={f.volume}
                                                    onChange={(e) => changeVolume(index, parseFloat(e.target.value))}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="drop-hint">Trascina altri file per aggiungerli</div>
                                </div>
                            </div>

                            <div className="daw-main-tracks-area" ref={trackAreaRef}>
                                {/* Timeline */}
                                <div className="timeline-container">
                                    <div className="timeline-seconds">
                                        {getTimelineTicks()
                                            .filter((t) => t.type === "second")
                                            .map((tick, i) => (
                                                <div key={i} className="timeline-tick-second" style={{ left: tick.position }}>
                                                    <span className="timeline-number">{tick.value}s</span>
                                                </div>
                                            ))}
                                    </div>
                                    <div className="timeline-decimals">
                                        {getTimelineTicks()
                                            .filter((t) => t.type === "tenth")
                                            .map((tick, i) => (
                                                <div key={i} className="timeline-tick-small" style={{ left: tick.position }} />
                                            ))}
                                    </div>
                                </div>

                                {/* Track rows */}
                                <div className="track-rows-scroll">
                                    {files.map((f, index) => (
                                        <div className="track-row" key={index}>
                                            <div
                                                className="track-clip"
                                                style={{
                                                    left: `${f.offset * pixelsPerSecond}px`,
                                                    width: `${f.duration * pixelsPerSecond}px`,
                                                    position: "absolute",
                                                    height: "100%",
                                                    cursor: "grab"
                                                }}
                                                onMouseDown={(e) => startDrag(e, index)}
                                            >
                                                <canvas
                                                    className="track-clip-waveform"
                                                    style={{ width: "100%", height: "100%", display: "block" }}
                                                    ref={(c) => {
                                                        if (!c || !f.waveform) return;
                                                        const ctx = c.getContext("2d");
                                                        const h = c.height;
                                                        c.width = f.duration * pixelsPerSecond;
                                                        ctx.clearRect(0, 0, c.width, h);
                                                        const step = f.waveform.length / c.width;
                                                        ctx.fillStyle = "#B8B8B8";
                                                        for (let i = 0; i < c.width; i++) {
                                                            const val = f.waveform[Math.floor(i * step)] * h;
                                                            ctx.fillRect(i, (h - val) / 2, 1, val);
                                                        }
                                                    }}
                                                    height={60}
                                                />
                                                <span
                                                    style={{
                                                        position: "absolute",
                                                        left: 5,
                                                        top: 0,
                                                        color: "white",
                                                        fontSize: "12px"
                                                    }}
                                                >
                                                    {f.name}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="daw-start">
                        <p>
                            <FontAwesomeIcon icon={faFileCirclePlus} /> Clicca o trascina uno o più file audio nel Mixer per iniziare.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Daw;
