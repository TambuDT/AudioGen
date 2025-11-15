import React, { useEffect, useState } from 'react';
import './saveloadpreset.css';
import { client } from '@/app/appwrite/appwrite';
import { Databases, Query, ID } from 'appwrite';

function Saveloadpreset({ currentPage, voiceName, customPronunce, setVoice, setPronunceCustom }) {
  const [searchInput, setSearchInput] = useState('');
  const [presetsList, setPresetsList] = useState([]);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [currentPreset, setCurrentPreset] = useState(null);

  const databases = new Databases(client);
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const collectionId = process.env.NEXT_PUBLIC_PRESET_COLLECTION_ID;

  //carica i preset
  const handleLoadPreset = async () => {
    try {
      const doc = await databases.listDocuments(databaseId, collectionId, [
        Query.select(['presetName', 'voice', 'substitutions']),
      ]);

      // Appwrite restituisce array di stringhe correttamente
      const parsedPresets = doc.documents.map(preset => ({
        ...preset,
        substitutions: Array.isArray(preset.substitutions)
          ? preset.substitutions
          : [],
      }));

      setPresetsList(parsedPresets);
    } catch (error) {
      console.error('Errore durante il caricamento dei preset:', error);
    }
  };

  // elimina preset
  const openDeleteDialog = (preset) => {
    setDeleteDialog(preset);
    setConfirmInput('');
  };

  const handleConfirmDelete = async () => {
    if (confirmInput !== deleteDialog.presetName) return;

    try {
      await databases.deleteDocument(databaseId, collectionId, deleteDialog.$id);
      setDeleteDialog(null);
      await handleLoadPreset();
    } catch (error) {
      console.error("Errore durante l'eliminazione del preset:", error);
    }
  };


  //carica il preset selezionato
  const handleLoadSelectedPreset = (preset) => {

    setCurrentPreset(preset);

    // Aggiorna la voce
    setVoice(preset.voice);

    // Trasforma array piatto [originale1, sostituta1, originale2, sostituta2, ...]
    const customPronunceFromPreset = [];
    for (let i = 0; i < preset.substitutions.length; i += 2) {
      customPronunceFromPreset.push({
        parola: preset.substitutions[i],
        sostituzione: preset.substitutions[i + 1] || "",
      });
    }

    // Aggiorna customPronunce
    setPronunceCustom(customPronunceFromPreset);
  };


  const handleUpdatePreset = async () => {
    if (!currentPreset) {
      alert('Nessun preset caricato da aggiornare.');
      return;
    }

    const flatSubstitutions = customPronunce.flatMap(item => [item.parola, item.sostituzione]);

    try {
      await databases.updateDocument(
        databaseId,
        collectionId,
        currentPreset.$id,
        {
          voice: voiceName,
          substitutions: flatSubstitutions
        }
      );

      alert('Modifiche salvate con successo.');
    } catch (error) {
      console.error("Errore durante l'aggiornamento del preset:", error);
    }
  };



  //salva preset
  const handleSavePreset = async () => {

    //controllo sulla voce selezionata, deve esseer selezionata per forza prima di salvare
    if (!voiceName) {
      alert('Seleziona una voce prima di salvare il preset.');
      return;
    }

    //controllo sulle pronunce custom
    if (customPronunce.length === 0) {
      if (confirm('Stai creando un preset senza sostituzioni personalizzate, premi OK per continuare o Annulla per tornare indietro.')) {
        // continua con il salvataggio
      } else {
        return;
      }
    }

    //chiedi nome preset e salva
    const name = prompt('Inserisci il nome del preset:');
    if (!name) return;

    // Trasforma l'array di oggetti in array piatto [originale1, sostituta1, originale2, sostituta2, ...]
    const flatSubstitutions = customPronunce.flatMap(item => [item.parola, item.sostituzione]);

    // Controllo lunghezza di ogni parola
    if (flatSubstitutions.some(str => str.length > 100)) {
      alert('Ogni parola deve essere lunga al massimo 100 caratteri');
      return;
    }

    try {
      await databases.createDocument(databaseId, collectionId, ID.unique(), {
        presetName: name,
        voice: voiceName,
        substitutions: flatSubstitutions, // <-- salva array piatto
      });
      await handleLoadPreset();
    } catch (error) {
      console.error('Errore durante il salvataggio del preset:', error);
    }
  };

  // resetta la voce e le pronunce custom
  const handleClearPreset = () => {
    setVoice(null);            // deseleziona voice nel selettore
    setPronunceCustom([]);   // svuota sostituzioni
    setCurrentPreset(null);  // rimuove il preset attivo
  };

  const CopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(`Nome del preset copiato: "${text}"`);
  };

  useEffect(() => {
    handleLoadPreset();
  }, []);

  const filteredPresets = presetsList.filter((preset) =>
    preset.presetName?.toLowerCase().includes(searchInput.toLowerCase())
  );

  return (
    <div className='saveloadpreset-container'>
      <h1 className='text-section-title'>Preset per {currentPage}</h1>
      <h4 className='text-section-subtitle'>Carica un preset</h4>
      <div className='saveloadpreset-main'>
        <div className='saveloadpreset-search'>
          <input
            type='text'
            placeholder='Cerca preset...'
            className='saveloadpreset-search-input'
            onChange={(e) => setSearchInput(e.target.value)}
            value={searchInput}
          />
        </div>

        <div className='saveloadpreset-main-left'>
          {filteredPresets.map((preset) => (
            <div key={preset.$id} className='preset-item'>
              <h3>{preset.presetName}</h3>
              <div className='preset-item-buttons'>
                <button className='saveloadpreset-carica-button' onClick={() => handleLoadSelectedPreset(preset)}>Carica</button>
                <button className='saveloadpreset-elimina-button' onClick={() => openDeleteDialog(preset)}>
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className='saveloadpreset-main-right'>
          <h4 className='text-section-subtitle'>Azioni sui preset / progetto</h4>
          <button
            className='saveloadpreset-actions-button'
            onClick={() => handleSavePreset()}
          >
            Crea Preset
          </button>

          <button
            className='saveloadpreset-actions-button'
            onClick={() => handleUpdatePreset()}
          >
            Salva Modifiche
          </button>

          <button
            className='saveloadpreset-actions-button'
            onClick={() => handleClearPreset()}
          >
            Pulisci progetto
          </button>


        </div>
      </div>

      {deleteDialog && (
        <div className='dialog-overlay'>
          <div className='dialog-box'>
            <h3 onClick={() => CopyToClipboard(deleteDialog.presetName)}>
              Stai per eliminare il preset "{deleteDialog.presetName}"?
            </h3>
            <p>
              Questa azione è <strong>irreversibile</strong>.<br />
              Per confermare, digita il nome del preset o copialo cliccandoci sopra.:
            </p>
            <input
              type='text'
              className='dialog-input'
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder='Scrivi il nome esatto del preset'
            />
            <div className='dialog-buttons'>
              <button
                onClick={() => setDeleteDialog(null)}
                className='dialog-cancel'
              >
                Annulla
              </button>
              <button
                className='dialog-delete'
                disabled={confirmInput !== deleteDialog.presetName}
                onClick={handleConfirmDelete}
              >
                Elimina definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Saveloadpreset;
