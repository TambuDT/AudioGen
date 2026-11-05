"use client";

import { useEffect, useRef, useState } from "react";
import { Databases, ID, Query } from "appwrite";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { client } from "@/app/appwrite/appwrite";
import "./promptPresets.css";

function VoicePresetPanel({ voiceName, onLoadVoice }) {
  const [presets, setPresets] = useState([]);
  const [voiceAliases, setVoiceAliases] = useState({});
  const [presetName, setPresetName] = useState("");
  const [activePreset, setActivePreset] = useState(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const databases = useRef(new Databases(client));
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const presetCollectionId = process.env.NEXT_PUBLIC_PRESET_COLLECTION_ID;

  const loadPresets = async () => {
    try {
      const result = await databases.current.listDocuments(
        databaseId,
        presetCollectionId,
        [Query.select(["presetName", "voice"])]
      );
      setPresets(result.documents);
      setMessage("");
    } catch (error) {
      console.error("Errore durante il caricamento dei preset:", error);
      setMessage("Impossibile caricare i preset.");
    }
  };

  useEffect(() => {
    loadPresets();

    const loadVoiceAliases = async () => {
      try {
        const result = await databases.current.listDocuments(
          databaseId,
          process.env.NEXT_PUBLIC_VOCI_COLLECTION_ID,
          [Query.select(["voceOriginale", "vocePersonalizzata"]), Query.limit(100)]
        );
        const aliases = Object.fromEntries(
          result.documents.map((voice) => [
            voice.voceOriginale,
            voice.vocePersonalizzata || voice.voceOriginale,
          ])
        );
        setVoiceAliases(aliases);
      } catch (error) {
        console.error("Errore durante il caricamento degli alias delle voci:", error);
      }
    };

    loadVoiceAliases();
  }, []);

  const getVoiceLabel = (originalName) =>
    voiceAliases[originalName] || originalName;

  const handleCreatePreset = async (event) => {
    event.preventDefault();
    const name = presetName.trim();
    if (!name || !voiceName) return;

    try {
      await databases.current.createDocument(
        databaseId,
        presetCollectionId,
        ID.unique(),
        { presetName: name, voice: voiceName }
      );
      setPresetName("");
      setIsCreateFormOpen(false);
      await loadPresets();
    } catch (error) {
      console.error("Errore durante il salvataggio del preset:", error);
      setMessage("Impossibile salvare il preset.");
    }
  };

  const handleRenamePreset = async (preset, nextName, input) => {
    const name = nextName.trim();
    if (!name) {
      input.value = preset.presetName;
      return;
    }
    if (name === preset.presetName) return;

    try {
      await databases.current.updateDocument(
        databaseId,
        presetCollectionId,
        preset.$id,
        { presetName: name }
      );
      setPresets((currentPresets) =>
        currentPresets.map((item) =>
          item.$id === preset.$id ? { ...item, presetName: name } : item
        )
      );
      setMessage("Nome del preset aggiornato.");
    } catch (error) {
      console.error("Errore durante la modifica del nome del preset:", error);
      input.value = preset.presetName;
      setMessage("Impossibile modificare il nome del preset.");
    }
  };

  const handleLoadPreset = (preset) => {
    setActivePreset(preset);
    onLoadVoice(preset.voice);
  };

  const handleUpdatePreset = async () => {
    if (!activePreset || !voiceName) return;

    try {
      await databases.current.updateDocument(
        databaseId,
        presetCollectionId,
        activePreset.$id,
        { voice: voiceName }
      );
      await loadPresets();
      setMessage("Preset aggiornato.");
    } catch (error) {
      console.error("Errore durante l'aggiornamento del preset:", error);
      setMessage("Impossibile aggiornare il preset.");
    }
  };

  const handleDeletePreset = async (preset) => {
    if (!window.confirm(`Eliminare il preset "${preset.presetName}"?`)) return;

    try {
      await databases.current.deleteDocument(
        databaseId,
        presetCollectionId,
        preset.$id
      );
      if (activePreset?.$id === preset.$id) setActivePreset(null);
      await loadPresets();
    } catch (error) {
      console.error("Errore durante l'eliminazione del preset:", error);
      setMessage("Impossibile eliminare il preset.");
    }
  };

  return (
    <aside className="prompt-presets-panel" aria-labelledby="voice-presets-title">
      <div className="prompt-presets-header">
        <div>
          <h2 id="voice-presets-title" className="text-section-title">Preset voci</h2>
        </div>
        <button
          type="button"
          className={`prompt-presets-add ${isCreateFormOpen ? "open" : ""}`}
          aria-label={isCreateFormOpen ? "Nascondi creazione preset" : "Crea un preset"}
          aria-expanded={isCreateFormOpen}
          aria-controls="voice-preset-create-form"
          onClick={() => setIsCreateFormOpen((isOpen) => !isOpen)}
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      </div>

      {isCreateFormOpen && (
        <article className="prompt-preset-card prompt-preset-create-card">
          <form
            id="voice-preset-create-form"
            className="prompt-presets-form"
            onSubmit={handleCreatePreset}
          >
            <label className="prompt-presets-field">
              <span>Nome Preset:</span>
              <input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="Es. Voce narrante"
                maxLength={100}
                required
              />
            </label>
            <div className="prompt-presets-voice">
              <span>Voce Preset:</span>
              <strong>{voiceName ? getVoiceLabel(voiceName) : "Nessuna voce selezionata"}</strong>
            </div>
            <button
              className="prompt-presets-save"
              type="submit"
              disabled={!voiceName || !presetName.trim()}
            >
              Crea preset
            </button>
          </form>
        </article>
      )}

      {message && <p className="prompt-presets-message" role="status">{message}</p>}

      <h3 className="prompt-presets-list-title">Preset Disponibili</h3>
      <div className="prompt-presets-list" aria-label="Preset salvati">
        {presets.length === 0 ? (
          <p className="prompt-presets-empty">Non hai ancora salvato preset.</p>
        ) : (
          presets.map((preset) => (
            <article
              className={`prompt-preset-card${activePreset?.$id === preset.$id ? " selected" : ""}`}
              key={preset.$id}
            >
              <div className="prompt-preset-card-copy">
                <label className="prompt-presets-field">
                  <span>Nome Preset:</span>
                  <input
                    key={`${preset.$id}-${preset.presetName}`}
                    defaultValue={preset.presetName}
                    maxLength={100}
                    aria-label={`Nome del preset ${preset.presetName}`}
                    onBlur={(event) => handleRenamePreset(
                      preset,
                      event.currentTarget.value,
                      event.currentTarget
                    )}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                </label>
                <p className="prompt-preset-voice">
                  <span>Voce Preset:</span> {getVoiceLabel(preset.voice)}
                </p>
              </div>
              <div className="prompt-preset-card-actions">
                <button type="button" onClick={() => handleLoadPreset(preset)}>Carica</button>
                <button type="button" onClick={() => handleDeletePreset(preset)}>
                  Elimina
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="prompt-presets-footer">
        <button
          className="prompt-presets-save"
          type="button"
          disabled={!activePreset || !voiceName}
          onClick={handleUpdatePreset}
        >
          Salva modifiche al preset
        </button>
        <button
          className="prompt-presets-clear"
          type="button"
          disabled={!activePreset}
          onClick={() => {
            setActivePreset(null);
            onLoadVoice(null);
          }}
        >
          Unload preset
        </button>
      </div>
    </aside>
  );
}

export default VoicePresetPanel;
