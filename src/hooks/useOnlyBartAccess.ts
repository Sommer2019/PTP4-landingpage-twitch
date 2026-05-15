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

/** Ermittelt die Twitch-Rolle des Users (Broadcaster/Mod/VIP/Sub) und leitet daraus
 *  die Berechtigungen für den OnlyBart-Bereich ab. */
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

        // Rollen werden in Stufen ermittelt, von der verlässlichsten zur unsichersten Quelle:
        // Hook-Flags → synchronisierte twitch_permissions → user_roles → Twitch-API-Fallback.
        try {
            if (isBroadcasterFromHook) {
                detectedRole = 'broadcaster'
            }
            else if (isMod) {
                detectedRole = 'moderator'
                detectedIsModerator = true
            }
            else {
                // twitch_permissions ist die zuverlässigste Quelle für VIP/Sub
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

                if (detectedRole !== 'none') {
                    // Rolle bereits gefunden – weitere Quellen überspringen
                } else {
                    // user_roles als zweite Quelle (UUID-basiert statt Twitch-ID)
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

                    // Letzter Ausweg: direkt gegen die Twitch-API prüfen
                    if (detectedRole === 'none' && session.provider_token) {
                        try {
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
                                // user_id muss die Twitch-ID (provider_id) sein, nicht die Supabase-UUID
                                const subRes = await fetch(`https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=${cachedBroadcasterId}&user_id=${user.user_metadata.provider_id}`, {
                                    headers: {
                                        'Client-ID': import.meta.env.VITE_TWITCH_CLIENT_ID,
                                        'Authorization': `Bearer ${session.provider_token}`
                                    }
                                })

                                if (subRes.ok) {
                                    detectedRole = 'subscriber'
                                }
                                // VIP-Status lässt sich (noch) nicht über die Twitch-API abfragen
                            }
                        } catch (e) {
                            console.warn('Twitch API Check failed', e)
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err)
        }

        if (!cancelled) {
            setRole(detectedRole)
            setIsVip(detectedIsVip)
            setIsModerator(detectedIsModerator)
            // 'none' nicht cachen – sonst bliebe ein noch nicht synchronisierter User dauerhaft gesperrt
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
     canSuperlike: isVip || isModerator,
    canComment: isAllowed,
    canDeleteComment: isBroadcaster || role === 'moderator',
    loading,
    role
  }
}
