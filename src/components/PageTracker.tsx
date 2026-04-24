import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'cookie-consent'
const SESSION_KEY = 'pv-session-id'

/** UUID v4 fallback for browsers without native crypto.randomUUID support */
function generateUUID(): string {
  try {
    // Try native crypto.randomUUID
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID()
    }
  } catch {
    // Fallback on error
  }
  
  // Fallback: manual UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Generate or retrieve anonymous session ID for this browser tab */
function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = generateUUID()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

/**
 * Trackt Seitenaufrufe in der Supabase-Tabelle `page_views`,
 * aber NUR wenn der Nutzer Cookies im Banner akzeptiert hat.
 */
export default function PageTracker() {
  const location = useLocation()
  const prevPath = useRef<string | null>(null)

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY)
    if (consent !== 'accepted') return

    const path = location.pathname
    /** Prevent duplicate tracking of same path in succession */
    if (path === prevPath.current) return
    prevPath.current = path

    const sessionId = getSessionId()
    const redirectInfo: Record<string, string> = {}

    /** Capture referrer only on initial page load */
    if (document.referrer) {
      try {
        const ref = new URL(document.referrer)
        /** Only store external referrers */
        if (ref.origin !== window.location.origin) {
          redirectInfo.referrer = document.referrer
        }
      } catch { /* invalid URL – ignore */ }
    }

    /** Capture UTM parameters and query string */
    if (location.search) {
      redirectInfo.query = location.search
    }

    supabase
      .from('page_views')
      .insert({
        session_id: sessionId,
        page_path: path,
        viewed_at: new Date().toISOString(),
        redirect_info: Object.keys(redirectInfo).length > 0 ? redirectInfo : null,
      })
      .then(({ error }) => {
        if (error) console.warn('[PageTracker] insert failed:', error.message)
      })
  }, [location])

  return null
}

