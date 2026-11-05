import React from 'react'
import './recentCreations.css'
import AudioPlayerRecents from '../audioplayer/AudioPlayerRecents'
function RecentCreations({ creations }) {
    return (
        <div className='recentcreations-container'>
            <h1 className='music-section-title'>Creazioni Recenti</h1>
            <div className='recents-creations-container'>
                {creations.length > 0 ? (
                    [...creations].reverse().map(c => (
                        <AudioPlayerRecents
                            key={c.id}
                            audioSrc={c.audioSrc}
                            audioModel={c.model}
                            audioName={c.audioName}
                        />
                    ))
                ) : (
                    <p className='recent-creations-empty'>Le tue creazioni appariranno qui.</p>
                )}
            </div>
        </div>
    )
}

export default RecentCreations