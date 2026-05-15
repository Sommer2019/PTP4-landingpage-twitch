import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { supabase } from '../lib/supabase';

/** Prüft anhand der Twitch-ID des eingeloggten Users, ob dessen Account gesperrt ist. */
export function useIsBanned() {
  const { user, loading: authLoading } = useAuth();
  const [isBanned, setIsBanned] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    async function checkBan() {
      if (authLoading) return;
      if (!user) {
        setIsBanned(false);
        setLoading(false);
        return;
      }
      // Twitch-ID liegt je nach OAuth-Antwort unter provider_id oder sub
      const twitchId = user.user_metadata?.provider_id || user.user_metadata?.sub;
      if (!twitchId) {
        setIsBanned(false);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('banned_accounts')
        .select('twitch_user_id')
        .eq('twitch_user_id', twitchId)
        .maybeSingle();
      if (!cancelled) {
        setIsBanned(!!data);
        setLoading(false);
      }
    }
    checkBan();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { isBanned, loading };
}
