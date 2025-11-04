"use client";
import React, { useState, useRef } from "react";

export default function DAW() {
  const [tracks, setTracks] = useState([]);
  const [playing, setPlaying] = useState(false);
  const audioCtxRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();

    if (!audioCtxRef.current)
      audioCtxRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();

    const buffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
    const newTrack = {
      id: Date.now(),
      name: file.name,
      buffer,
      volume: 1,
      offset: 0,
    };
    setTracks((prev) => [...prev, newTrack]);
  };

  const playAll = () => {
    if (playing) return;
    const ctx = audioCtxRef.current || new (window.AudioContext ||
      window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    const now = ctx.currentTime;

    tracks.forEach((t) => {
      const source = ctx.createBufferSource();
      source.buffer = t.buffer;
      const gain = ctx.createGain();
      gain.gain.value = t.volume;
      source.connect(gain).connect(ctx.destination);
      source.start(now + t.offset);
      t.source = source; // salva per stop
    });
    setPlaying(true);
  };

  const stopAll = () => {
    tracks.forEach((t) => {
      if (t.source) t.source.stop();
    });
    setPlaying(false);
  };

  const updateVolume = (id, value) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, volume: parseFloat(value) } : t))
    );
  };

  const moveTrack = (id, delta) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, offset: Math.max(0, t.offset + delta) } : t))
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-4">🎛️ Mini-DAW Prototype</h1>

      <div className="flex gap-2">
        <input type="file" accept="audio/*" onChange={handleFileUpload} />
        <button
          onClick={playing ? stopAll : playAll}
          className="px-3 py-2 bg-blue-600 rounded"
        >
          {playing ? "⏹ Stop" : "▶️ Play"}
        </button>
      </div>

      <div className="space-y-6 mt-6">
        {tracks.map((t) => (
          <div
            key={t.id}
            className="bg-gray-800 rounded-xl p-4 shadow-lg relative"
          >
            <div className="flex justify-between items-center">
              <span className="font-semibold">{t.name}</span>
              <button
                onClick={() =>
                  setTracks((prev) => prev.filter((x) => x.id !== t.id))
                }
                className="text-red-400"
              >
                ❌
              </button>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <label>🔊 Volume</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={t.volume}
                onChange={(e) => updateVolume(t.id, e.target.value)}
              />
              <span>{t.volume.toFixed(2)}</span>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <label>🕓 Offset</label>
              <button onClick={() => moveTrack(t.id, -0.5)} className="bg-gray-700 px-2 rounded">-</button>
              <button onClick={() => moveTrack(t.id, 0.5)} className="bg-gray-700 px-2 rounded">+</button>
              <span>{t.offset.toFixed(1)}s</span>
            </div>

            <div
              className="relative mt-3 h-6 bg-gray-700 rounded overflow-hidden"
              style={{ width: "100%" }}
            >
              <div
                className="absolute h-full bg-green-500"
                style={{ width: "10px", left: `${t.offset * 100}px` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
