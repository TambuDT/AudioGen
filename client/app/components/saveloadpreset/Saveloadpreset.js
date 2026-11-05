import React, { useEffect, useState } from 'react';
import './saveloadpreset.css';
import { client } from '@/app/appwrite/appwrite';
import { Databases, Query, ID } from 'appwrite';

function Saveloadpreset({ currentPage, voiceName, setVoice }) {
  const [searchInput, setSearchInput] = useState('');
  const [presetsList, setPresetsList] = useState([]);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [currentPreset, setCurrentPreset] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const databases = new Databases(client);
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const collectionId = process.env.NEXT_PUBLIC_PRESET_COLLECTION_ID;

  //carica i preset
  const handleLoadPreset = async () => {
    try {
      const doc = await databases.listDocuments(databaseId, collectionId, [
        Query.select(['presetName', 'voice']),
      ]);

      setPresetsList(doc.documents);
      setErrorMessage('');
    } catch (error) {
      console.error('Errore durante il caricamento dei preset:', error);
      setErrorMessage('Impossibile caricare i preset.');
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
      setErrorMessage('Impossibile eliminare il preset.');
    }
  };


  //carica il preset selezionato
  const handleLoadSelectedPreset = (preset) => {

    setCurrentPreset(preset);

    // Aggiorna la voce
    setVoice(preset.voice);
  };


  const handleUpdatePreset = async () => {
    if (!currentPreset) {
      alert('Nessun preset caricato da aggiornare.');
      return;
    }

    try {
      await databases.updateDocument(
        databaseId,
        collectionId,
        currentPreset.$id,
        {
          voice: voiceName,
        }
      );

      alert('Modifiche salvate con successo.');
      setErrorMessage('');
    } catch (error) {
      console.error("Errore durante l'aggiornamento del preset:", error);
      setErrorMessage('Impossibile aggiornare il preset.');
    }
  };



  //salva preset
  const handleSavePreset = async () => {

    //controllo sulla voce selezionata, deve esseer selezionata per forza prima di salvare
    if (!voiceName) {
      alert('Seleziona una voce prima di salvare il preset.');
      return;
    }

    //chiedi nome preset e salva
    const name = prompt('Inserisci il nome del preset:')?.trim();
    if (!name) return;

    try {
      await databases.createDocument(databaseId, collectionId, ID.unique(), {
        presetName: name,
        voice: voiceName,
      });
      await handleLoadPreset();
    } catch (error) {
      console.error('Errore durante il salvataggio del preset:', error);
      setErrorMessage('Impossibile salvare il preset.');
    }
  };

  // resetta la voce e le pronunce custom
  const handleClearPreset = () => {
    setVoice(null);            // deseleziona voice nel selettore
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
      <h4 className='text-section-subtitle'>Carica o Elimina un Preset</h4>
      {errorMessage && <p className='preset-error' role='alert'>{errorMessage}</p>}
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
                <button className='loaddelete-actions-button' onClick={() => handleLoadSelectedPreset(preset)}>Carica</button>
                <button className='loaddelete-actions-button' onClick={() => openDeleteDialog(preset)}>
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className='saveloadpreset-main-right'>
          <h4 className='text-section-subtitle'>Azioni sul Preset / Progetto</h4>
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
            Pulisci Progetto
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
