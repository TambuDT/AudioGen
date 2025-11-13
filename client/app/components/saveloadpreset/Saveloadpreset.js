import React, { useEffect, useState } from 'react';
import './saveloadpreset.css';
import { client } from '@/app/appwrite/appwrite';
import { TablesDB, Query } from 'appwrite';

function Saveloadpreset({ currentPage }) {
  const [searchInput, setSearchInput] = useState('');
  const [presetsList, setPresetsList] = useState([]);
  const [deleteDialog, setDeleteDialog] = useState(null); // {id, name} oppure null
  const [confirmInput, setConfirmInput] = useState('');

  const tablesdb = new TablesDB(client);

  const handleLoadPreset = async () => {
    try {
      const doc = await tablesdb.listRows({
        databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        tableId: 'presetchirp3',
        queries: [Query.select(['*'])]
      });
      setPresetsList(doc.rows);
    } catch (error) {
      console.error('Errore durante il caricamento dei preset:', error);
    }
  };

  const openDeleteDialog = (preset) => {
    setDeleteDialog(preset);
    setConfirmInput('');
  };

  const handleConfirmDelete = async () => {
    if (confirmInput !== deleteDialog.presetName) return;

    try {
      await tablesdb.deleteRow(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        'presetchirp3',
        deleteDialog.$id
      );
      setDeleteDialog(null);
      await handleLoadPreset();
    } catch (error) {
      console.error("Errore durante l'eliminazione del preset:", error);
    }
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
                <button className='saveloadpreset-carica-button'>Carica</button>
                <button
                  className='saveloadpreset-elimina-button'
                  onClick={() => openDeleteDialog(preset)}
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className='saveloadpreset-main-right'>
          <h4 className='text-section-subtitle'>Salva il preset attuale</h4>
          <button className='saveloadpreset-salva-button'>Salva Preset</button>
        </div>
      </div>

      {deleteDialog && (
        <div className='dialog-overlay'>
          <div className='dialog-box'>
            <h3 onClick={() => CopyToClipboard(deleteDialog.presetName)}>Stai per eliminare il preset "{deleteDialog.presetName}"?</h3>
            <p>
              Questa azione è <strong>irreversibile</strong>.<br />
              Per confermare, digita il nome del preset:
            </p>
            <input
              type='text'
              className='dialog-input'
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder='Scrivi il nome esatto del preset'
            />
            <div className='dialog-buttons'>
              <button onClick={() => setDeleteDialog(null)} className='dialog-cancel'>
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
