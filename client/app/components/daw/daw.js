import React from 'react'
import './daw.css'
function Daw() {
    return (
        <div className='daw-section-container'>
            <div className='daw-title-container'>
                <h1 className='text-section-title'>Daw</h1>
                <h4 className='text-section-subtitle'>inserisci le tracce per mixare audio e musica</h4>
            </div>

            <div className='daw-container'>
                <div className='tracks-container'>
                    <div className='tracks-buttons-container'>
                         <button>Add</button>
                        <button>Play</button>
                         <button>Pause</button>
                    </div>
                    <div className='tracks-basic-container'>
                        
                    </div>
                </div>
                <div className='tracks-handler-container'></div>
            </div>

        </div>
    )
}

export default Daw