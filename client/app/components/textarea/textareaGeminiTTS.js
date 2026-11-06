import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Databases, ID, Query } from "appwrite";
import { client } from "@/app/appwrite/appwrite";
import "./textarea.css";
import AudioPlayer from "../audioplayer/AudioPlayer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faDownload, faPlus, faTrash, faX } from "@fortawesome/free-solid-svg-icons";
const SERVER_URL = `${process.env.NEXT_PUBLIC_APP_ENDPOINT}`;
const ESPRESSIONI_COLLECTION_ID = process.env.NEXT_PUBLIC_TAG_COLLECTION_ID;
const PROMPT_COLLECTION_ID = process.env.NEXT_PUBLIC_PROMPT_COLLECTION_ID;
const TEXT_INSERT_OPTIONS = [
  {
    title: "Etichette multi-speaker",
    options: [
      { token: "speaker_1:", description: "Battuta speaker 1", speaker: 1 },
      { token: "speaker_2:", description: "Battuta speaker 2", speaker: 2 },
    ],
  },
];

function parseMultiSpeakerText(value) {
  const turns = [];
  let currentTurn = null;
  const lines = value.split(/\r?\n/);

  for (const line of lines) {
    const speakerMatch = line.match(/^\s*speaker_(\d+)\s*:\s*(.*)$/i);
    if (speakerMatch) {
      const speakerNumber = Number(speakerMatch[1]);
      if (speakerNumber !== 1 && speakerNumber !== 2) {
        return { turns: [], error: "Sono supportati solo speaker_1 e speaker_2." };
      }

      currentTurn = {
        speaker: `speaker${speakerNumber}`,
        text: speakerMatch[2].trim(),
      };
      turns.push(currentTurn);
      continue;
    }

    if (!line.trim()) {
      if (currentTurn) currentTurn.text += "\n";
      continue;
    }

    if (!currentTurn) {
      return {
        turns: [],
        error: "Ogni battuta deve iniziare con speaker_1: oppure speaker_2:.",
      };
    }
    currentTurn.text = currentTurn.text
      ? `${currentTurn.text}\n${line.trim()}`
      : line.trim();
  }

  if (turns.some((turn) => !turn.text.trim())) {
    return { turns: [], error: "Ogni speaker deve avere una battuta non vuota." };
  }

  const usedSpeakers = new Set(turns.map((turn) => turn.speaker));
  if (!usedSpeakers.has("speaker1") || !usedSpeakers.has("speaker2")) {
    return {
      turns: [],
      error: "Inserisci almeno una battuta valida per speaker_1 e speaker_2.",
    };
  }

  return { turns, error: "" };
}

function applyCustomPronunciations(value, pronunciations) {
  let modifiedText = value;
  const matches = value.match(/\{(.*?)\}/g) || [];

  for (const match of matches) {
    const word = match.slice(1, -1);
    const pronunciation = pronunciations.find((item) => item.parola === word);
    if (pronunciation?.sostituzione) {
      modifiedText = modifiedText.split(match).join(pronunciation.sostituzione);
    }
  }

  return modifiedText;
}

function ExpressionOption({ item, onInsert, onSave, onDelete }) {
  const [expression, setExpression] = useState(item.espressione);
  const [meaning, setMeaning] = useState(item.significato_espressione);

  useEffect(() => {
    setExpression(item.espressione);
    setMeaning(item.significato_espressione);
  }, [item.espressione, item.significato_espressione]);

  async function saveField(field, value, setValue) {
    const trimmedValue = value.trim();
    if (!trimmedValue || trimmedValue === item[field]) {
      setValue(item[field]);
      return;
    }

    const saved = await onSave(item, field, trimmedValue);
    if (saved) setValue(trimmedValue);
    else setValue(item[field]);
  }

  function saveOnEnter(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  return (
    <div
      className="text-insert-expression-option"
      title="Clicca fuori dai campi per inserire l'espressione nel copione"
      onClick={() => onInsert(expression)}
    >
      <FontAwesomeIcon
        className="text-insert-expression-add"
        icon={faPlus}
        aria-hidden="true"
      />
      <label>
        <span className="visually-hidden">Espressione</span>
        <input
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onBlur={() => saveField("espressione", expression, setExpression)}
          onKeyDown={saveOnEnter}
          aria-label={`Espressione: ${item.espressione}`}
          maxLength={100}
        />
      </label>
      <label>
        <span className="visually-hidden">Significato</span>
        <input
          value={meaning}
          onChange={(event) => setMeaning(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onBlur={() => saveField("significato_espressione", meaning, setMeaning)}
          onKeyDown={saveOnEnter}
          aria-label={`Significato: ${item.significato_espressione}`}
          maxLength={200}
        />
      </label>
      <button
        type="button"
        className="text-insert-expression-delete"
        aria-label={`Elimina espressione ${expression}`}
        title="Elimina espressione"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(item);
        }}
      >
        <FontAwesomeIcon icon={faTrash} />
      </button>
    </div>
  );
}

function TextsectionGemini({
  voiceName,
  onCreate,
  synthesisRequest,
  onSpeakerModeChange,
  speakerVoices,
  promptValue,
  onPromptChange,
}) {
  const [text, setText] = useState("");
  const [audioSrc, setAudioSrc] = useState(null);
  const [customPronunce, setCustomPronunce] = useState([]);
  const [speakerMode, setSpeakerMode] = useState("single");
  const [loading, setLoading] = useState(false);
  const [synthesisError, setSynthesisError] = useState("");
  const [expressions, setExpressions] = useState([]);
  const [isLoadingExpressions, setIsLoadingExpressions] = useState(true);
  const [expressionsError, setExpressionsError] = useState("");
  const [isExpressionFormOpen, setIsExpressionFormOpen] = useState(false);
  const [newExpression, setNewExpression] = useState("");
  const [newExpressionMeaning, setNewExpressionMeaning] = useState("");
  const [isSavingExpression, setIsSavingExpression] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const [promptsError, setPromptsError] = useState("");
  const [isPromptFormOpen, setIsPromptFormOpen] = useState(false);
  const [newPromptName, setNewPromptName] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const lastSynthesisRequest = useRef(synthesisRequest);
  const spotTextareaRef = useRef(null);
  const promptTextareaRef = useRef(null);
  const textInsertMenuRef = useRef(null);
  const databases = useRef(new Databases(client));

  const loadExpressions = useCallback(async () => {
    try {
      setIsLoadingExpressions(true);
      const allExpressions = [];
      let offset = 0;
      let page;

      do {
        page = await databases.current.listDocuments(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          ESPRESSIONI_COLLECTION_ID,
          [Query.limit(100), Query.offset(offset)]
        );
        allExpressions.push(...page.documents);
        offset += page.documents.length;
      } while (page.documents.length === 100);

      setExpressions(allExpressions);
      setExpressionsError("");
    } catch (error) {
      console.error("Errore durante il caricamento delle espressioni Gemini:", error);
      setExpressionsError("Impossibile caricare le espressioni salvate.");
    } finally {
      setIsLoadingExpressions(false);
    }
  }, []);

  useEffect(() => {
    loadExpressions();
  }, [loadExpressions]);

  const loadSavedPrompts = useCallback(async () => {
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    if (!databaseId || !PROMPT_COLLECTION_ID) {
      setPromptsError("La collection dei prompt non è configurata.");
      setIsLoadingPrompts(false);
      return;
    }

    try {
      setIsLoadingPrompts(true);
      const allPrompts = [];
      let offset = 0;
      let page;

      do {
        page = await databases.current.listDocuments(
          databaseId,
          PROMPT_COLLECTION_ID,
          [
            Query.select(["nome_prompt", "prompt"]),
            Query.limit(100),
            Query.offset(offset),
          ]
        );
        allPrompts.push(...page.documents);
        offset += page.documents.length;
      } while (page.documents.length === 100);

      setSavedPrompts(allPrompts);
      setPromptsError("");
    } catch (error) {
      console.error("Errore durante il caricamento dei prompt:", error);
      setPromptsError("Impossibile caricare i prompt salvati.");
    } finally {
      setIsLoadingPrompts(false);
    }
  }, []);

  useEffect(() => {
    loadSavedPrompts();
  }, [loadSavedPrompts]);

  async function handleSavePrompt(event) {
    event.preventDefault();
    const name = newPromptName.trim();
    const prompt = promptValue.trim();
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    if (!name || !prompt || !databaseId || !PROMPT_COLLECTION_ID || isSavingPrompt) {
      return;
    }

    try {
      setIsSavingPrompt(true);
      const savedPrompt = await databases.current.createDocument(
        databaseId,
        PROMPT_COLLECTION_ID,
        ID.unique(),
        { nome_prompt: name, prompt }
      );
      setSavedPrompts((currentPrompts) => [...currentPrompts, savedPrompt]);
      setNewPromptName("");
      setIsPromptFormOpen(false);
      setPromptsError("");
    } catch (error) {
      console.error("Errore durante il salvataggio del prompt:", error);
      setPromptsError(
        error?.message?.includes("No permissions provided for action 'create'")
          ? "Appwrite blocca il salvataggio: abilita il permesso Create per gli utenti autorizzati nella collection dei prompt."
          : "Impossibile salvare il prompt."
      );
    } finally {
      setIsSavingPrompt(false);
    }
  }

  const buildRequestBody = useCallback(() => {
    const modifiedText = applyCustomPronunciations(text, customPronunce);

    const request = {
      input: { prompt: promptValue },
      voice: {
        languageCode: "it-IT",
        modelName: "gemini-2.5-pro-tts",
      },
      audioConfig: {
        audioEncoding: "LINEAR16",
      },
    };
    if (speakerMode === "multi") {
      const { turns } = parseMultiSpeakerText(modifiedText);
      request.input.multiSpeakerMarkup = { turns };
      request.voice.multiSpeakerVoiceConfig = {
        speakerVoiceConfigs: [
          {
            speakerAlias: "speaker1",
            speakerId: speakerVoices.speaker_1,
          },
          {
            speakerAlias: "speaker2",
            speakerId: speakerVoices.speaker_2,
          },
        ],
      };
    } else {
      request.input.text = modifiedText;
      request.voice.name = voiceName;
    }

    return request;
  }, [customPronunce, promptValue, speakerMode, speakerVoices, text, voiceName]);

  const handleSynthesize = useCallback(async () => {
    if ((speakerMode === "single" && !voiceName) || loading) return;

    if (!text.trim()) {
      setSynthesisError("Inserisci il testo dello spot prima di generare l'audio.");
      return;
    }

    if (speakerMode === "multi") {
      const { error } = parseMultiSpeakerText(
        applyCustomPronunciations(text, customPronunce)
      );
      if (error) {
        setSynthesisError(error);
        return;
      }
      if (!speakerVoices.speaker_1 || !speakerVoices.speaker_2) {
        setSynthesisError("Seleziona una voce per speaker_1 e speaker_2.");
        return;
      }
      if (speakerVoices.speaker_1 === speakerVoices.speaker_2) {
        setSynthesisError("Assegna una voce diversa a ciascuno speaker.");
        return;
      }
    }

    try {
      setLoading(true);
      setSynthesisError("");
      const requestBody = buildRequestBody();

      const response = await axios.post(`${SERVER_URL}/synthesize`, requestBody);

      if (response.data?.audioContent) {
        const newAudioSrc = `data:audio/wav;base64,${response.data.audioContent}`;

        setAudioSrc(newAudioSrc);
        onCreate({
          id: Date.now(),
          audioSrc: newAudioSrc,
          model: "Gemini",
          audioName: "Untitled",
        });
      } else {
        setSynthesisError("Il servizio non ha restituito un audio.");
        console.error("Risposta senza audioContent:", response.data);
      }
    } catch (err) {
      console.error(
        "Errore richiesta:",
        err.response?.data?.error || err.message,
        err.response?.data
      );
      setSynthesisError(
        err.response?.data?.error || "Errore durante la sintesi. Riprova."
      );
    } finally {
      setLoading(false);
    }
  }, [buildRequestBody, customPronunce, loading, onCreate, speakerMode, speakerVoices, text, voiceName]);

  useEffect(() => {
    if (synthesisRequest === lastSynthesisRequest.current) return;
    lastSynthesisRequest.current = synthesisRequest;
    handleSynthesize();
  }, [handleSynthesize, synthesisRequest]);

  function addRow() {
    setCustomPronunce((prev) => [...prev, { parola: "", sostituzione: "" }]);
  }

  function updatePronunce(index, field, value) {
    setCustomPronunce((prev) => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
  }

  function removeRow(index) {
    setCustomPronunce((prev) => prev.filter((_, i) => i !== index));
  }

  function appendSpeakerTurn(speakerNumber) {
    const nextText = `${text}${text && !text.endsWith("\n") ? "\n" : ""}speaker_${speakerNumber}: `;
    setText(nextText);
    requestAnimationFrame(() => {
      spotTextareaRef.current?.focus();
      spotTextareaRef.current?.setSelectionRange(nextText.length, nextText.length);
    });
  }

  function insertTextToken(token, speakerNumber) {
    const textarea = spotTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const isSpeakerLabel = Boolean(speakerNumber);
    const insertionPrefix = isSpeakerLabel
      ? before && !before.endsWith("\n") ? "\n" : ""
      : before && !/\s$/.test(before) ? " " : "";
    const insertionSuffix = isSpeakerLabel
      ? after && !after.startsWith("\n") ? "\n" : ""
      : after && !/^\s/.test(after) ? " " : "";
    const insertedToken = isSpeakerLabel ? `speaker_${speakerNumber}: ` : token;
    const insertion = `${insertionPrefix}${insertedToken}${insertionSuffix}`;
    const nextText = `${before}${insertion}${after}`;
    const caretPosition = before.length + insertionPrefix.length + insertedToken.length;

    setText(nextText);
    textInsertMenuRef.current.open = false;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(caretPosition, caretPosition);
    });
  }

  function insertSavedPrompt(prompt) {
    const textarea = promptTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = promptValue.slice(0, start);
    const after = promptValue.slice(end);
    const insertionPrefix = before && !before.endsWith("\n") ? "\n\n" : "";
    const insertionSuffix = after && !after.startsWith("\n") ? "\n\n" : "";
    const insertedPrompt = prompt.trim();
    const nextPrompt = `${before}${insertionPrefix}${insertedPrompt}${insertionSuffix}${after}`;
    const caretPosition = before.length + insertionPrefix.length + insertedPrompt.length;

    onPromptChange(nextPrompt);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(caretPosition, caretPosition);
    });
  }

  async function handleCreateExpression(event) {
    event.preventDefault();
    const expression = newExpression.trim();
    const meaning = newExpressionMeaning.trim();
    if (!expression || !meaning || isSavingExpression) return;

    try {
      setIsSavingExpression(true);
      const createdExpression = await databases.current.createDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        ESPRESSIONI_COLLECTION_ID,
        ID.unique(),
        {
          espressione: expression,
          significato_espressione: meaning,
        }
      );
      setExpressions((current) => [...current, createdExpression]);
      setNewExpression("");
      setNewExpressionMeaning("");
      setExpressionsError("");
    } catch (error) {
      console.error("Errore durante il salvataggio dell'espressione Gemini:", error);
      const permissionError = error?.message?.includes(
        "No permissions provided for action 'create'"
      );
      setExpressionsError(
        permissionError
          ? "Appwrite blocca la creazione: nella console apri la collection dei tag e abilita il permesso Create per gli utenti autenticati."
          : "Impossibile salvare l'espressione. Controlla i dati e riprova."
      );
    } finally {
      setIsSavingExpression(false);
    }
  }

  async function handleUpdateExpression(item, field, value) {
    try {
      await databases.current.updateDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        ESPRESSIONI_COLLECTION_ID,
        item.$id,
        { [field]: value }
      );
      setExpressions((current) =>
        current.map((expression) =>
          expression.$id === item.$id
            ? { ...expression, [field]: value }
            : expression
        )
      );
      setExpressionsError("");
      return true;
    } catch (error) {
      console.error("Errore durante la modifica dell'espressione Gemini:", error);
      setExpressionsError(
        error?.message?.includes("No permissions provided for action 'update'")
          ? "Appwrite blocca la modifica: abilita il permesso Update per gli utenti autenticati nella collection dei tag."
          : "Impossibile modificare l'espressione. Controlla i dati e riprova."
      );
      return false;
    }
  }

  async function handleDeleteExpression(item) {
    if (!window.confirm(`Eliminare l'espressione "${item.espressione}"?`)) return;

    try {
      await databases.current.deleteDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        ESPRESSIONI_COLLECTION_ID,
        item.$id
      );
      setExpressions((current) =>
        current.filter((expression) => expression.$id !== item.$id)
      );
      setExpressionsError("");
    } catch (error) {
      console.error("Errore durante l'eliminazione dell'espressione Gemini:", error);
      setExpressionsError(
        error?.message?.includes("No permissions provided for action 'delete'")
          ? "Appwrite blocca l'eliminazione: abilita il permesso Delete per gli utenti autenticati nella collection dei tag."
          : "Impossibile eliminare l'espressione. Riprova."
      );
    }
  }

  function changeSpeakerMode(mode) {
    setSpeakerMode(mode);
    onSpeakerModeChange?.(mode === "multi");
  }

  return (
    <div className="textsection-container">
      <section className="tts-section">
        <h2 className="music-section-title">Modalità spot</h2>
        <div className="tts-panel speaker-mode-panel">
          <div className="speaker-mode-switch" role="group" aria-label="Modalità speaker">
            <button
              type="button"
              className={speakerMode === "single" ? "selected" : ""}
              aria-pressed={speakerMode === "single"}
              onClick={() => changeSpeakerMode("single")}
            >
              <span className="speaker-mode-indicator" aria-hidden="true" />
              <span>Speaker singolo</span>
            </button>
            <button
              type="button"
              className={speakerMode === "multi" ? "selected" : ""}
              aria-pressed={speakerMode === "multi"}
              onClick={() => changeSpeakerMode("multi")}
            >
              <span className="speaker-mode-indicator" aria-hidden="true" />
              <span>Multi-Speaker</span>
            </button>
          </div>
          {speakerMode === "multi" && (
            <p className="speaker-mode-description">
              Assegna due voci diverse dal selettore a sinistra. Scrivi ogni turno su una nuova riga iniziando con speaker_1: o speaker_2:.
            </p>
          )}
        </div>
      </section>

      <section className="tts-panel spot-input-panel">
        <div className="spot-input-heading">
          <h1 className="text-section-title">Inserimento dello spot</h1>
          <details className="text-insert-menu" ref={textInsertMenuRef}>
          <summary>
            <span>Inserisci tag o speaker</span>
            <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
          </summary>
          <div className="text-insert-menu-content">
            <p className="text-insert-menu-note">
              Seleziona un’espressione per inserirla nel copione.
            </p>
            <div className="text-insert-menu-group">
              <h3>Espressioni salvate</h3>
              {expressionsError && <p className="text-insert-menu-error" role="alert">{expressionsError}</p>}
              <div className="text-insert-menu-options">
                {expressions.map((item) => (
                  <ExpressionOption
                    key={item.$id}
                    item={item}
                    onInsert={insertTextToken}
                    onSave={handleUpdateExpression}
                    onDelete={handleDeleteExpression}
                  />
                ))}
                {isLoadingExpressions && (
                  <p className="text-insert-menu-empty">Caricamento espressioni...</p>
                )}
                {!isLoadingExpressions && expressions.length === 0 && !expressionsError && (
                  <p className="text-insert-menu-empty">Nessuna espressione salvata.</p>
                )}
              </div>
              <button
                type="button"
                className="text-insert-expression-toggle"
                aria-expanded={isExpressionFormOpen}
                onClick={() => setIsExpressionFormOpen((isOpen) => !isOpen)}
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>{isExpressionFormOpen ? "Annulla" : "Crea espressione"}</span>
              </button>
              {isExpressionFormOpen && (
                <form className="text-insert-expression-form" onSubmit={handleCreateExpression}>
                  <label>
                    <span>Espressione</span>
                    <input
                      value={newExpression}
                      onChange={(event) => setNewExpression(event.target.value)}
                      placeholder="[laughs]"
                      maxLength={100}
                      required
                    />
                  </label>
                  <label>
                    <span>Significato</span>
                    <input
                      value={newExpressionMeaning}
                      onChange={(event) => setNewExpressionMeaning(event.target.value)}
                      placeholder="Risata"
                      maxLength={200}
                      required
                    />
                  </label>
                  <button type="submit" disabled={!newExpression.trim() || !newExpressionMeaning.trim() || isSavingExpression}>
                    {isSavingExpression ? "Salvataggio..." : "Salva espressione"}
                  </button>
                </form>
              )}
            </div>
            {TEXT_INSERT_OPTIONS
              .filter((group) => group.title === "Etichette multi-speaker" && speakerMode === "multi")
              .map((group) => (
              <div className="text-insert-menu-group" key={group.title}>
                <h3>{group.title}</h3>
                <div className="text-insert-menu-options">
                  {group.options.map(({ token, description, speaker }) => (
                    <button
                      type="button"
                      key={token}
                      onClick={() => insertTextToken(token, speaker)}
                    >
                      <code>{token}</code>
                      <span>{description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          </details>
        </div>
        <textarea
          ref={spotTextareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="text-area"
          placeholder={speakerMode === "multi"
            ? "speaker_1: Ciao, benvenuti.\nspeaker_2: Grazie, è un piacere essere qui."
            : "Inserisci il testo da trasformare in uno spot..."}
          aria-label="Testo dello spot"
        />
        {speakerMode === "multi" && (
          <div className="speaker-format-tools">
            <p className="speaker-format-hint">
              Ogni speaker deve avere almeno una battuta. Usa le etichette <code>speaker_1:</code> e <code>speaker_2:</code>.
            </p>
            <div className="speaker-turn-buttons">
              {[1, 2].map((speakerNumber) => (
                <button
                  type="button"
                  className="speaker-turn-button"
                  key={speakerNumber}
                  onClick={() => appendSpeakerTurn(speakerNumber)}
                >
                  + Battuta speaker {speakerNumber}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="tts-section">
        <h2 className="music-section-title">Prompt per modificare la resa</h2>
        <div className="tts-panel">
          <textarea
            ref={promptTextareaRef}
            value={promptValue}
            onChange={(e) => onPromptChange(e.target.value)}
            className="text-area prompt-text-area"
            placeholder="Inserisci il prompt per modificare lo stile..."
            aria-label="Prompt per modificare la resa"
          />
          <div className="saved-prompt-selector">
            <label>Prompt salvati</label>
            <div className="saved-prompt-options">
              {savedPrompts.map((item) => (
                <button
                  type="button"
                  className="saved-prompt-option"
                  key={item.$id}
                  title={`Inserisci: ${item.nome_prompt}`}
                  onClick={() => insertSavedPrompt(item.prompt)}
                >
                  <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                  <span>{item.nome_prompt}</span>
                </button>
              ))}
              {isLoadingPrompts && (
                <p className="saved-prompt-help">Caricamento prompt...</p>
              )}
              {!isLoadingPrompts && savedPrompts.length === 0 && !promptsError && (
                <p className="saved-prompt-help">Nessun prompt salvato.</p>
              )}
            </div>
            {promptsError && (
              <p className="saved-prompt-error" role="alert">{promptsError}</p>
            )}
            <button
              type="button"
              className="saved-prompt-create-toggle"
              aria-expanded={isPromptFormOpen}
              onClick={() => {
                setIsPromptFormOpen((isOpen) => !isOpen);
                setPromptsError("");
              }}
            >
              <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
              <span>{isPromptFormOpen ? "Annulla" : "Salva prompt corrente"}</span>
            </button>
            {isPromptFormOpen && (
              <form className="saved-prompt-form" onSubmit={handleSavePrompt}>
                <label htmlFor="saved-prompt-name">Nome del prompt</label>
                <input
                  id="saved-prompt-name"
                  value={newPromptName}
                  onChange={(event) => setNewPromptName(event.target.value)}
                  placeholder="Es. Spot energico"
                  maxLength={100}
                  required
                />
                <p>Verrà salvato il testo attualmente presente nella textarea.</p>
                <button
                  type="submit"
                  disabled={!newPromptName.trim() || !promptValue.trim() || isSavingPrompt}
                >
                  {isSavingPrompt ? "Salvataggio..." : "Salva prompt"}
                </button>
              </form>
            )}
          </div>

          <details className="custom-pronunciations">
            <summary>
              <span>Pronunce personalizzate</span>
              <span className="custom-pronunciations-count">{customPronunce.length}</span>
            </summary>
            <div className="custom-pronunciations-content">
              <div className="add-pronuncia-custom-title-container">
                <p className="text-section-subtitle">Sostituisci parole con pronunce personalizzate</p>
                <button type="button" className="add-pronuncia-button" onClick={addRow} aria-label="Aggiungi pronuncia personalizzata">
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </div>
              <div className="parole-custom-container">
                {customPronunce.map((item, idx) => (
                  <div key={idx} className="custom-pronuncia-row">
                    <input
                      value={item.parola}
                      onChange={(e) => updatePronunce(idx, "parola", e.target.value)}
                      placeholder="Parola originale"
                      className="custom-pronuncia-input"
                    />
                    <input
                      value={item.sostituzione}
                      onChange={(e) =>
                        updatePronunce(idx, "sostituzione", e.target.value)
                      }
                      placeholder="Pronuncia"
                      className="custom-pronuncia-input"
                    />
                    <button type="button" className="remove-pronuncia-button" onClick={() => removeRow(idx)} aria-label={`Rimuovi pronuncia ${idx + 1}`}>
                      <FontAwesomeIcon icon={faX} />
                    </button>
                  </div>
                ))}
                {customPronunce.length === 0 && (
                  <p className="pronunciation-empty">Nessuna pronuncia personalizzata</p>
                )}
              </div>
            </div>
          </details>
        </div>
      </section>

      <section className="tts-section">
        <h2 className="music-section-title">Master audio pronto</h2>
        <div className="tts-panel output-panel">
          {loading ? (
            <p className="testo-generazione-in-corso">Generazione in corso...</p>
          ) : (
            <AudioPlayer audioSrc={audioSrc} showDownload={false}></AudioPlayer>
          )}
          {audioSrc && !loading ? (
            <a className="download-spot-button" href={audioSrc} download="spot-audiogen.wav">
              <FontAwesomeIcon icon={faDownload} />
              Download Spot
            </a>
          ) : (
            <button type="button" className="download-spot-button" disabled>
              <FontAwesomeIcon icon={faDownload} />
              Download Spot
            </button>
          )}
          {synthesisError && <p className="synthesis-error" role="alert">{synthesisError}</p>}
        </div>
      </section>
    </div>
  );
}

export default TextsectionGemini;
