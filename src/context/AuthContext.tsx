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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

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
      if (savedPath) {
        sessionStorage.removeItem(REDIRECT_PATH_KEY)
        window.location.href = savedPath
      }
    }
  }, [user, session])

  const signInWithTwitch = useCallback(async () => {
    // Speichere den aktuellen Pfad vor der Anmeldung
    sessionStorage.setItem(REDIRECT_PATH_KEY, window.location.pathname + window.location.search)
    
    await supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: {
        redirectTo: window.location.origin + '/',
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

