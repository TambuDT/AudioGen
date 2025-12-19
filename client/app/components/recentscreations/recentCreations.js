import React from 'react'
import './recentCreations.css'
import AudioPlayerRecents from '../audioplayer/AudioPlayerRecents'
function RecentCreations({ creations }) {
    return (
        <div className='recentcreations-container'>
            <h1 className='music-section-title'>Creazioni Recenti</h1>
            <h4 className='music-section-subtitle'>Ascolta e scarica le creazioni recenti</h4>
            <div className='recents-creations-container'>
                {[...creations].reverse().map(c => (
                    <AudioPlayerRecents
                        key={c.id}
                        audioSrc={c.audioSrc}
                        audioModel={c.model}
                        audioName={c.audioName}
                    />
                ))}

            </div>
        </div>
    )
}

export default RecentCreations