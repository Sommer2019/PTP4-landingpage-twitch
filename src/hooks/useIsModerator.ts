import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'

/**
 * Checks whether the currently logged-in user is in the `moderators` table.
 * Uses the Supabase RPC function `is_moderator()`.
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
      // Use a microtask to avoid synchronous setState in effect
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
      // Fetch both roles in parallel. If the RPCs are unavailable due to RLS
      // or other permission issues, fall back to checking the `moderators` table
      // for a row matching the current Twitch ID.
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

        // If RPCs are not allowed for the anon/public role, the RPC call may
        // return an error. In that case fall back to presence of a row in the
        // moderators table (manualRes) to determine moderator status. Also
        // treat the table's is_broadcaster flag as authoritative for the
        // broadcaster role when present.
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
