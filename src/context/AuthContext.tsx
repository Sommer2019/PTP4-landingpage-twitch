import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './authContextDef'

const REDIRECT_PATH_KEY = 'auth-redirect-path'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Listen for auth state changes (login, logout, token refresh)
  useEffect(() => {
    // Get initial session with retry for 503 errors
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

  // Navigiere zum gespeicherten Hash-Pfad nach erfolgreicher Anmeldung
  useEffect(() => {
    if (user && session) {
      const savedHash = sessionStorage.getItem(REDIRECT_PATH_KEY)
      if (savedHash && savedHash !== '#/' && savedHash !== '#') {
        sessionStorage.removeItem(REDIRECT_PATH_KEY)
        // Nur navigieren wenn wir nicht schon dort sind
        if (window.location.hash !== savedHash) {
          window.location.hash = savedHash.startsWith('#') ? savedHash.slice(1) : savedHash
        }
      } else {
        sessionStorage.removeItem(REDIRECT_PATH_KEY)
      }
    }
  }, [user, session])

  // Auto-create profile on login & transfer roles from twitch_permissions → user_roles
  useEffect(() => {
    if (user) {
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

      const initProfile = async () => {
        // Sequentiell ausführen um 503-Rate-Limit-Fehler zu vermeiden
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
    // Speichere den aktuellen Hash-Pfad vor der Anmeldung (HashRouter nutzt #/path)
    const hashPath = window.location.hash || '#/'
    sessionStorage.setItem(REDIRECT_PATH_KEY, hashPath)

    await supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        scopes: 'user:read:subscriptions', // Request access to check subscription status
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

