import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './CurrentGame.css'

interface GameInfo {
  gameId: string
  gameName: string
  boxArtUrl: string
  streamTitle: string
}

interface CurrentGameProps {
  isLive: boolean
}

interface StoreLink {
  id: string
  labelKey: string
  url: string
  className: string
}

function buildStoreLinks(gameName: string): StoreLink[] {
  const q = encodeURIComponent(gameName)
  return [
    {
      id: 'twitch',
      labelKey: 'currentGame.stores.twitch',
      url: `https://www.twitch.tv/directory/game/${q}`,
      className: 'store-badge store-badge--twitch',
    },
    {
      id: 'steam',
      labelKey: 'currentGame.stores.steam',
      url: `https://store.steampowered.com/search/?term=${q}`,
      className: 'store-badge store-badge--steam',
    },
    {
      id: 'epic',
      labelKey: 'currentGame.stores.epic',
      url: `https://store.epicgames.com/browse?q=${q}`,
      className: 'store-badge store-badge--epic',
    },
    {
      id: 'nintendo',
      labelKey: 'currentGame.stores.nintendo',
      url: `https://www.nintendo.com/de-de/Suche-/Suche-299117.html?q=${q}`,
      className: 'store-badge store-badge--nintendo',
    },
    {
      id: 'psstore',
      labelKey: 'currentGame.stores.psstore',
      url: `https://store.playstation.com/de-de/search/${q}`,
      className: 'store-badge store-badge--psstore',
    },
    {
      id: 'xbox',
      labelKey: 'currentGame.stores.xbox',
      url: `https://www.xbox.com/de-DE/Search/Results?q=${q}`,
      className: 'store-badge store-badge--xbox',
    },
  ]
}

const NO_RESULTS_RE = /Keine Ergebnisse gefunden|Leider war die Suche erfolglos\.|0 Ergebnisse|0 results|no results|keine ergebnisse|Hier scheint nichts vorhanden zu sein\./i

function checkStoreResult(store: StoreLink): Promise<boolean> {
  switch (store.id) {
    case 'steam':
    case 'epic':
    case 'nintendo':
    case 'psstore':
    case 'xbox':
      return fetch(store.url).then(res => {
        if (!res.ok) return false
        return res.text().then(html => !NO_RESULTS_RE.test(html))
      })
    case 'twitch':
      return Promise.resolve(true)
    default:
      return Promise.resolve(true)
  }
}

export default function CurrentGame({ isLive }: CurrentGameProps) {
  const { t } = useTranslation()
  const [game, setGame] = useState<GameInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [visibleStores, setVisibleStores] = useState<StoreLink[]>([])
  const [checkingStores, setCheckingStores] = useState(false)

  useEffect(() => {
    if (!isLive) {
      setGame(null)
      setVisibleStores([])
      return
    }

    let cancelled = false

    async function fetchGame() {
      setLoading(true)
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY // Ensure this is in your .env

        const headers = new Headers()
        headers.set('Content-Type', 'application/json')
        // Supabase requires the anon key for edge functions unless explicitly configured otherwise
        headers.set('apikey', supabaseAnonKey)
        headers.set('Authorization', `Bearer ${supabaseAnonKey}`)

        const res = await fetch(`${supabaseUrl}/functions/v1/twitch-game`, {
          method: 'POST',
          headers,
        })
        if (cancelled) return
        if (!res.ok) {
          setGame(null)
          console.log('[CurrentGame] Fehler oder nicht live:', res.status, await res.text())
          return
        }
        const data = await res.json()
        if (!data?.isLive) {
          setGame(null)
          console.log('[CurrentGame] Fehler oder nicht live:', data)
        } else {
          setGame({
            gameId: data.gameId,
            gameName: data.gameName,
            boxArtUrl: data.boxArtUrl,
            streamTitle: data.streamTitle,
          })
          console.log('[CurrentGame] Game gesetzt:', data)
        }
      } catch (err) {
        if (!cancelled) setGame(null)
        console.error('[CurrentGame] Fehler beim API-Call:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchGame()

    // Refresh game info every 5 minutes in case the streamer switches games
    const interval = setInterval(() => void fetchGame(), 5 * 60 * 1000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isLive])

  useEffect(() => {
    if (!game || !game.gameName) {
      setVisibleStores([])
      return
    }
    const storeLinks = buildStoreLinks(game.gameName)
    setCheckingStores(true)
    Promise.all(
      storeLinks.map(async (store) => {
        try {
          const hasResult = await checkStoreResult(store)
          return hasResult ? store : null
        } catch {
          // On network/CORS errors we cannot determine availability – show by default
          return store
        }
      })
    ).then(results => {
      setVisibleStores(results.filter(Boolean) as StoreLink[])
      setCheckingStores(false)
    })
  }, [game])

  // Debug-Ausgabe für Render-Entscheidung
  if (!isLive) console.log('[CurrentGame] Render: nicht live')
  if (loading) console.log('[CurrentGame] Render: loading')
  if (!game) console.log('[CurrentGame] Render: kein game')
  if (game && !game.gameName) console.log('[CurrentGame] Render: gameName fehlt')

  if (!isLive || loading || !game || !game.gameName || checkingStores) return null

  return (
    <div className="current-game" aria-label={t('currentGame.label')}>
      {game.boxArtUrl && (
        <img
          className="current-game__art"
          src={game.boxArtUrl}
          alt={game.gameName}
          width={69}
          height={95}
          loading="lazy"
        />
      )}
      <div className="current-game__info">
        <div className="current-game__label">{t('currentGame.nowPlaying')}</div>
        <div className="current-game__name">{game.gameName}</div>
        <div className="current-game__stores" aria-label={t('currentGame.storesLabel')}>
          {visibleStores.map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={s.className}
              aria-label={`${t(s.labelKey)} (${t('currentGame.opensInNewTab')})`}
            >
              {t(s.labelKey)}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
