import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './authContextDef'

const REDIRECT_PATH_KEY = 'auth-redirect-path'

/** Stellt Supabase-Auth-Status (User, Session) sowie Twitch-Login/Logout bereit
 *  und legt beim Login das Profil an. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Auth-Status-Änderungen beobachten (Login, Logout, Token-Refresh)
  useEffect(() => {
    // Initiale Session mit Retry-Logik holen — Supabase kann bei 503 kurz überfordert sein
    const getSessionWithRetry = async (retries = 2, delay = 1000) => {
      for (let i = 0; i <= retries; i++) {
        try {
          const { data: { session: s } } = await supabase.auth.getSession()
          setSession(s)
          setUser(s?.user ?? null)
          setLoading(false)
          return
        } catch (err) {
          if (i === retries) {
            console.error('Failed to get session after retries:', err)
            setLoading(false)
            return
          }
          await new Promise(r => setTimeout(r, delay * (i + 1)))
        }
      }
    }

    getSessionWithRetry()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s)
        setUser(s?.user ?? null)
        setLoading(false)
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  // Navigiere zum gespeicherten Pfad nach erfolgreicher Anmeldung
  useEffect(() => {
    if (user && session) {
      const savedPath = sessionStorage.getItem(REDIRECT_PATH_KEY)
      if (savedPath && savedPath !== '/' && savedPath !== '') {
        sessionStorage.removeItem(REDIRECT_PATH_KEY)
        // Redirect nur, wenn wir nicht schon auf dem Ziel sind
        if (window.location.pathname !== savedPath) {
          window.location.replace(savedPath)
        }
      } else {
        sessionStorage.removeItem(REDIRECT_PATH_KEY)
      }
    }
  }, [user, session])

  // Profil anlegen und Rollen aus twitch_permissions → user_roles übertragen
  useEffect(() => {
    if (user) {
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

      const initProfile = async () => {
        // Upsert und RPC sequentiell mit Retry, da parallele Calls direkt nach dem
        // Login bei Supabase 503-Rate-Limit-Fehler auslösen
        const username = user.user_metadata?.user_login || user.user_metadata?.full_name || user.email
        if (username) {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const { error } = await supabase
                .from('profiles')
                .upsert({
                  id: user.id,
                  username: username,
                  updated_at: new Date().toISOString(),
                }, {
                  onConflict: 'id'
                })
              if (!error) break
              if (attempt < 2) await delay(1000 * (attempt + 1))
              else console.error('Failed to create profile:', error)
            } catch (err) {
              if (attempt < 2) await delay(1000 * (attempt + 1))
              else console.error('Failed to create profile:', err)
            }
          }
        }

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const { data, error } = await supabase.rpc('transfer_permissions_to_roles')
            if (error) {
              if (attempt < 2) { await delay(1000 * (attempt + 1)); continue }
              console.error('Failed to transfer permissions to roles:', error)
            } else if (data?.error) {
              console.warn('Role transfer skipped:', data.error)
            }
            break
          } catch (err) {
            if (attempt < 2) await delay(1000 * (attempt + 1))
            else console.error('Failed to transfer permissions to roles:', err)
          }
        }
      }

      initProfile()
    }
  }, [user])

  const signInWithTwitch = useCallback(async () => {
    // Aktuellen Pfad speichern, damit nach dem Login dorthin zurückgeleitet werden kann
    const path = window.location.pathname || '/'
    sessionStorage.setItem(REDIRECT_PATH_KEY, path)

    await supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        scopes: 'user:read:subscriptions', // Zugriff auf Abo-Status des Nutzers anfragen
      },
    })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithTwitch, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
