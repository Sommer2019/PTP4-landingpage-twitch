import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'

/**
 * Prüft ob der eingeloggte User Moderator oder Broadcaster ist.
 * Nutzt die Supabase-RPC-Funktionen `is_moderator()` und `is_broadcaster()` mit Fallback auf die `moderators`-Tabelle.
 */
export function useIsModerator() {
  const { user, loading: authLoading } = useAuth()
  const [isMod, setIsMod] = useState(false)
  const [isBroadcaster, setIsBroadcaster] = useState(false)
  const [isManual, setIsManual] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      // State-Updates in die nächste Microtask verschieben um React-Batching-Probleme zu vermeiden
      queueMicrotask(() => {
        setIsMod(false)
        setIsBroadcaster(false)
        setIsManual(false)
        setLoading(false)
      })
      return
    }

    let cancelled = false
    ;(async () => {
      // Beide Rollen parallel abfragen. Bei RLS-Fehlern oder nicht erreichbarer RPC
      // auf die `moderators`-Tabelle zurückfallen.
      const twitchId = user.user_metadata?.sub || user.user_metadata?.provider_id
      const modRpc = supabase.rpc('is_moderator')
      const broadcasterRpc = supabase.rpc('is_broadcaster')
      const manualQuery = twitchId
        ? supabase.from('moderators').select('is_manual, is_broadcaster').eq('twitch_user_id', twitchId).maybeSingle()
        : Promise.resolve({ data: null, error: null })

      const [modRes, broadcasterRes, manualRes] = await Promise.all([modRpc, broadcasterRpc, manualQuery])

      if (!cancelled) {
        const rpcSaysMod = !modRes.error && modRes.data === true
        const rpcSaysBroadcaster = !broadcasterRes.error && broadcasterRes.data === true
        const tableRow = manualRes.data ?? null

        // Falls die RPCs für anonyme Nutzer nicht erlaubt sind, zeigt sich das als Fehler.
        // Fallback: Zeile in der moderators-Tabelle als Berechtigungsnachweis werten.
        // Das is_broadcaster-Flag der Tabelle gilt dabei als maßgeblich.
        setIsMod(rpcSaysMod || !!tableRow)
        setIsBroadcaster(rpcSaysBroadcaster || tableRow?.is_broadcaster === true)
        setIsManual(tableRow?.is_manual === true)
        setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [user, authLoading])

  return { isMod, isBroadcaster, isManual, loading }
}
