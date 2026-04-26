import { useState, useEffect } from 'react'
import { useAuth } from '../context/useAuth'
import { useIsModerator } from './useIsModerator'
import { supabase } from '../lib/supabase'
import siteConfig from "../config/siteConfig.ts";

export type OnlyBartRole = 'broadcaster' | 'moderator' | 'vip' | 'subscriber' | 'none'

export interface OnlyBartAccess {
  canView: boolean
  canPost: boolean
  canLike: boolean
  canSuperlike: boolean
  canComment: boolean
  canDeleteComment: boolean
  loading: boolean
  role: OnlyBartRole
}

// Globaler Cache – verhindert erneute Anfragen bei Re-Mounts
const roleCache: Record<string, { role: OnlyBartRole, timestamp: number }> = {}
const CACHE_DURATION = 5 * 60 * 1000 // 5 Minuten

// Gecachte Broadcaster-ID
let cachedBroadcasterId: string | null = null

export function useOnlyBartAccess(): OnlyBartAccess {
  const { user, session, loading: authLoading } = useAuth()
  const { isMod, isBroadcaster: isBroadcasterFromHook, loading: modLoading } = useIsModerator()
  
  const [role, setRole] = useState<OnlyBartRole>('none')
  const [isVip, setIsVip] = useState(false)
  const [isModerator, setIsModerator] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
        if (authLoading || modLoading) return
        
        if (!user || !session) {
            if (!cancelled) {
                setRole('none')
                setLoading(false)
            }
            return
        }

        // Cache prüfen
        const cached = roleCache[user.id]
        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
            if (!cancelled) {
                setRole(cached.role)
                setLoading(false)
            }
            return
        }

        let detectedRole: OnlyBartRole = 'none'
        let detectedIsVip = false
        let detectedIsModerator = false

        try {
            // 1. Broadcaster
            if (isBroadcasterFromHook) {
                detectedRole = 'broadcaster'
            }
            // 2. Moderator
            else if (isMod) {
                detectedRole = 'moderator'
                detectedIsModerator = true
            }
            else {
                // 2a. twitch_permissions prüfen (synchronisierte Tabelle) – zuverlässigste Quelle für VIP/Sub
                const twitchId = user.user_metadata.provider_id || user.user_metadata.sub
                if (twitchId) {
                    const { data: permData } = await supabase
                        .from('twitch_permissions')
                        .select('is_vip, is_subscriber')
                        .eq('twitch_id', twitchId)
                        .maybeSingle()
                    
                    if (permData) {
                        if (permData.is_vip) {
                            detectedRole = 'vip'
                            detectedIsVip = true
                        } else if (permData.is_subscriber) {
                            detectedRole = 'subscriber'
                        }
                    }
                }

                // Falls über synchronisierte Tabelle gefunden, fertig.
                if (detectedRole !== 'none') {
                    // Nächste Schritte überspringen
                } else {
                    // 3. Datenbankabfrage (user_roles – UUID-basiert)
                    const { data: roleData } = await supabase
                        .from('user_roles')
                        .select('is_vip, is_subscriber, is_moderator, is_broadcaster')
                        .eq('user_id', user.id)
                        .maybeSingle()

                    if (roleData) {
                        if (roleData.is_broadcaster) detectedRole = 'broadcaster'
                        else if (roleData.is_moderator) {
                            detectedRole = 'moderator'
                            detectedIsModerator = true
                        }
                        else if (roleData.is_vip) {
                            detectedRole = 'vip'
                            detectedIsVip = true
                        }
                        else if (roleData.is_subscriber) detectedRole = 'subscriber'
                    }

                    // 4. Client-seitiger Fallback
                    if (detectedRole === 'none' && session.provider_token) {
                        try {
                            // Broadcaster-ID laden, falls noch nicht gecacht
                            if (!cachedBroadcasterId) {
                                const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${siteConfig.twitch.channel}`, {
                                    headers: {
                                        'Client-ID': import.meta.env.VITE_TWITCH_CLIENT_ID,
                                        'Authorization': `Bearer ${session.provider_token}`
                                    }
                                })
                                const userData = await userRes.json()
                                if (userData.data?.[0]?.id) {
                                    cachedBroadcasterId = userData.data[0].id
                                }
                            }

                            if (cachedBroadcasterId) {
                                const subRes = await fetch(`https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=${cachedBroadcasterId}&user_id=${user.user_metadata.provider_id}`, { // provider_id (Twitch-ID) verwenden
                                    headers: {
                                        'Client-ID': import.meta.env.VITE_TWITCH_CLIENT_ID,
                                        'Authorization': `Bearer ${session.provider_token}`
                                    }
                                })

                                if (subRes.ok) {
                                    detectedRole = 'subscriber'
                                } else {
                                    // TODO: VIP-Prüfung derzeit nicht per Twitch-API möglich – implementieren, sobald Twitch dieses Feature hinzufügt
                                }
                            }
                        } catch (e) {
                            console.warn('Twitch API Check failed', e)
                        }
                    }
                }
            } // Close the outer else block
        } catch (err) {
            console.error(err)
        }

        if (!cancelled) {
            setRole(detectedRole)
            setIsVip(detectedIsVip)
            setIsModerator(detectedIsModerator)
            if (detectedRole !== 'none') {
                roleCache[user.id] = { role: detectedRole, timestamp: Date.now() }
            }
            setLoading(false)
        }
    }

    checkAccess()

    return () => { cancelled = true }
  }, [user, session, isMod, isBroadcasterFromHook, authLoading, modLoading])

  const isAllowed = role !== 'none'
  const isBroadcaster = role === 'broadcaster'
  
  return {
    canView: isAllowed,
    canPost: isBroadcaster,
    canLike: isAllowed && !isBroadcaster,
     canSuperlike: isVip || isModerator, // VIPs und Moderatoren können superliken
    canComment: isAllowed,
    canDeleteComment: isBroadcaster || role === 'moderator',
    loading,
    role
  }
}
