import { useState } from 'react'

interface ClipEmbedProps {
  twitchClipId: string
  thumbnailUrl?: string | null
}

/**
 * Twitch-Clip-Einbettung mit Klick-Fassade: Das iframe wird erst nach Nutzerinteraktion
 * geladen, damit ohne Zustimmung keine Twitch-Ressourcen angefragt werden.
 */
export default function ClipEmbed({ twitchClipId, thumbnailUrl }: ClipEmbedProps) {
  const [activated, setActivated] = useState(false)
  // Twitch verlangt im embed-Aufruf die einbettende Domain als parent-Parameter
  const parent =
    typeof window !== 'undefined' ? window.location.hostname : 'localhost'

  if (activated) {
    return (
      <div className="clip-embed">
        <iframe
          src={`https://clips.twitch.tv/embed?clip=${twitchClipId}&parent=${parent}&autoplay=true`}
          allowFullScreen
          title="Twitch Clip"
        />
      </div>
    )
  }

  return (
    <div
      className="clip-embed clip-embed--facade"
      onClick={() => setActivated(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setActivated(true)}
      aria-label="Clip abspielen"
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="clip-embed__thumbnail"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="clip-embed__placeholder" />
      )}
      <div className="clip-embed__play" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>
  )
}
