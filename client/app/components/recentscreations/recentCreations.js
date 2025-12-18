import React from 'react'
import './recentCreations.css'
import AudioPlayer from '../audioplayer/AudioPlayer'
function RecentCreations({ creations }) {
    return (
        <div className='recentcreations-container'>
            <h1 className='music-section-title'>Creazioni Recenti</h1>
            <h4 className='music-section-subtitle'>Ascolta e scarica le creazioni recenti</h4>
            <div className='music-list-container'>
                {creations.map((c, i) => (
                    <AudioPlayer key={c.id} audioSrc={c.audioSrc} audioModel={c.model} />
                ))}
            </div>
        </div>
    )
}

export default RecentCreations