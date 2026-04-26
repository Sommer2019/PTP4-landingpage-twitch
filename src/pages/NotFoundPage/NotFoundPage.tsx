import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mascot } from '../../config/mascotConfig'
import './NotFoundPage.css'

// Minimal-Typdefinition für YT.Player (YouTube IFrame API)
type YTPlayerEvents = {
  onReady?: () => void
  onStateChange?: (event: { data: number }) => void
}
interface YTPlayer {
  unMute: () => void
  setVolume: (v: number) => void
  playVideo: () => void
}
interface YT {
  Player: new (id: string, opts: { events: YTPlayerEvents }) => YTPlayer
}
declare global {
  interface Window {
    YT: YT
    onYouTubeIframeAPIReady: () => void
  }
}

export default function NotFoundPage() {
  const { t } = useTranslation()
  const messages = t('notFound.confusedMessages', { returnObjects: true }) as string[]
  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * messages.length))
  const [spin, setSpin] = useState(false)

  // Rotate through messages on click
  const nextMessage = () => {
    setSpin(true)
    setMsgIndex((prev) => (prev + 1) % messages.length)
    setTimeout(() => setSpin(false), 600)
  }

  // YouTube-API: Unmute nach erstem User-Klick
  useEffect(() => {
    let player: YTPlayer | null = null
    let apiLoaded = false
    let clickHandler: (() => void) | null = null

    function loadYouTubeAPI() {
      if (apiLoaded) return
      apiLoaded = true
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(tag)
    }

    // Wird von YouTube-API aufgerufen
    window.onYouTubeIframeAPIReady = function () {
      player = new window.YT.Player('yt-audio-bg', {
        events: {
          'onReady': () => {
            // Unmute nach User-Interaktion
            clickHandler = () => {
              if (player) {
                player.unMute()
                player.setVolume(100)
              }
              // Nur einmal ausführen
              if (clickHandler) window.removeEventListener('click', clickHandler)
            }
            window.addEventListener('click', clickHandler)
          },
          'onStateChange': (event: { data: number }) => {
            // 0 = ended
            if (event.data === 0 && player) {
              player.playVideo()
            }
          }
        }
      })
    }

    loadYouTubeAPI()
    return () => {
      if (clickHandler) window.removeEventListener('click', clickHandler)
    }
  }, [])

  return (
    <main className="not-found">
      <div className="not-found-card">
        {/* Giant 404 with beard avatar */}
        <div className="not-found-hero">
          <span className="not-found-four">4</span>
          <div className={`not-found-avatar ${spin ? 'spin' : ''}`}>
            <Mascot onClick={nextMessage} className="beard-svg" />
          </div>
          <span className="not-found-four">4</span>
        </div>

        {/* Funny message */}
        <p className="not-found-message" onClick={nextMessage}>
          {messages[msgIndex]}
        </p>
        <p className="not-found-hint">
          {t('notFound.hint')}
        </p>

        {/* Back button */}
        <Link to="/" className="btn btn-primary not-found-btn">
          {t('back')}
        </Link>
      </div>
    </main>
  )
}
