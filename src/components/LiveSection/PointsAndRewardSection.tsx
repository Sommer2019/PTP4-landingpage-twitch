import './PointsAndRewardSection.css';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

interface Reward {
  id: string;
  name: string;
  cost: number;
  mediaurl?: string;
  showmedia?: boolean;
  description?: string;
  imageurl?: string;
  text?: string;
  duration?: number;
  onceperstream?: boolean;
  cooldown?: number; // Cooldown in Sekunden
  istts?: boolean;
  is_enabled?: boolean;
}

interface RedeemRewardParams {
  p_twitch_user_id: string;
  p_reward_id: string;
  p_description?: string | null;
  p_cost?: number | null;
  p_ttstext?: string | null;
  p_stream_id?: string | null;
}

export default function PointsAndRewardSection({ isLive }: { isLive: boolean }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  const [points, setPoints] = useState<number | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  // Änderung: Erlaubt null, damit wir zwischen Liste und Detail unterscheiden können
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [ttsText, setTtsText] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [status, setStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  // Neuer State für globalen Lock
  const [globalLockActive, setGlobalLockActive] = useState(false);

  const selectedReward = rewards.find(r => r.id === selectedRewardId) ?? null;

  // Cooldown prüfen, wenn Reward ausgewählt wird
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    async function checkCooldown() {
      setCooldownActive(false);
      setCooldownRemaining(0);
      setGlobalLockActive(false);
      if (!selectedRewardId || !user) return;
      const twitchUserId = user.user_metadata?.provider_id || user.user_metadata?.sub || user.id;
      // Lade letzte Einlösung für diesen User und Reward
      const { data, error } = await supabase
        .from('redeemed_rewards')
        .select('timestamp')
        .eq('twitch_user_id', twitchUserId)
        .eq('reward_id', selectedRewardId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return;
      const reward = rewards.find(r => r.id === selectedRewardId);
      // Prüfe, ob überhaupt ein Eintrag in redeemed_global für dieses Reward existiert
      try {
        const { data: globalData } = await supabase
          .from('redeemed_global')
          .select('id, redeemed_at, expires_at, is_active, stream_id')
          .eq('reward_id', selectedRewardId)
          .eq('is_active', true)
          .limit(1);
        if (globalData && globalData.length > 0) {
          const g = globalData[0] as { id?: string; redeemed_at?: string | null; expires_at?: string | null; is_active?: boolean; stream_id?: string | null };
          const expires = g.expires_at;
          const now = new Date().getTime(); // GMT
          
          // Wenn expires_at gesetzt ist, prüfe ob es in der Zukunft liegt
          if (expires) {
            const expiresTime = new Date(expires).getTime(); // GMT
            if (expiresTime > now) {
              setGlobalLockActive(true);
              setCooldownActive(true);
              setCooldownRemaining(Math.ceil((expiresTime - now) / 1000));
              return;
            }
          } else {
            // Kein Ablaufdatum = once-per-stream: blockiert bis Stream-Ende
            setGlobalLockActive(true);
            setCooldownActive(true);
            setCooldownRemaining(9999); // Große Zahl für unbekannte Dauer
            return;
          }
        }
      } catch {
        // ignore
      }
      if (!reward || !reward.cooldown) return;
      if (data && data.timestamp) {
        const last = new Date(data.timestamp).getTime();
        const now = Date.now();
        const cooldownMs = reward.cooldown * 1000;
        const remaining = last + cooldownMs - now;
        // Debug-Logging für Cooldown-Check
        console.log('[Cooldown-Check]', {
          rewardId: selectedRewardId,
          timestamp: data.timestamp,
          last,
          now,
          cooldown: reward.cooldown,
          cooldownMs,
          remaining,
          diffSec: Math.ceil(remaining / 1000)
        });
        if (remaining > 0) {
          setCooldownActive(true);
          setCooldownRemaining(Math.ceil(remaining / 1000));
          // Starte Intervall für Restzeit
          interval = setInterval(() => {
            const newRemaining = last + cooldownMs - Date.now();
            if (newRemaining > 0) {
              setCooldownRemaining(Math.ceil(newRemaining / 1000));
            } else {
              setCooldownActive(false);
              setCooldownRemaining(0);
              clearInterval(interval);
            }
          }, 1000);
        }
      }
    }
    checkCooldown();
    return () => { if (interval) clearInterval(interval); };
  }, [selectedRewardId, user, rewards]);

  // Punkte laden
  useEffect(() => {
    if (loading || !user) return;

    const twitchUserId = user.user_metadata?.provider_id || user.user_metadata?.sub;
    if (!twitchUserId) return;

    supabase
        .from('points')
        .select('points')
        .eq('twitch_user_id', twitchUserId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            setPoints(0);
            setStatus({ type: 'error', msg: t('pointsAndRewardSection.fehlerBeimLadenDerPunkte') });
          } else {
            setPoints(data?.points ?? 0);
          }
        });
  }, [user, loading, t]);

  // Rewards laden und nach Kosten aufsteigend sortieren
  useEffect(() => {
    supabase
        .from('rewards')
        .select('*')
        .eq('is_enabled', true)
        .order('cost', { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            setStatus({ type: 'error', msg: t('pointsAndRewardSection.fehlerBeimLadenDerRewards') });
          }
          setRewards(data || []);
        });
  }, [t]);

  const handleRedeem = async () => {
    if (!selectedRewardId) return;
    const reward = rewards.find(r => r.id === selectedRewardId);
    if (!reward || !user) return;
    // TTS-Text nur erforderlich, wenn istts true und KEIN vordefinierter Text
    if (reward.istts && !reward.text && !ttsText) return;
    if (cooldownActive) return;
    setRedeemLoading(true);
    setStatus(null);

    const twitchUserId = user.user_metadata?.provider_id || user.user_metadata?.sub || user.id;
    const username = user.user_metadata?.user_login || user.user_metadata?.preferred_username || user.user_metadata?.full_name || user.email || twitchUserId;
    function replaceNamePlaceholders(s?: string) {
      if (!s) return s || '';
      return s.replace(/%name%/g, username);
    }

    // Beschreibung bestimmen
    let descriptionToInsert: string | undefined = undefined;
    let ttsToSend: string | null = null;
    if (reward.istts) {
      if (reward.text) {
        // Wenn vordefinierter Text, diesen verwenden
        descriptionToInsert = replaceNamePlaceholders(reward.text);
        ttsToSend = null;
      } else {
        // Nutzertext verwenden
        const prefix = reward.text || reward.description || '';
        const combined = prefix && ttsText ? `${prefix} ${ttsText}` : (prefix || ttsText);
        descriptionToInsert = replaceNamePlaceholders(combined);
        ttsToSend = ttsText || null;
      }
    } else {
      descriptionToInsert = replaceNamePlaceholders(reward.description);
      ttsToSend = null;
    }

    try {
      let streamId: string | null = null;
      try {
        const { data: sessions } = await supabase
          .from('stream_sessions')
          .select('id')
          .eq('is_active', true)
          .order('started_at', { ascending: false })
          .limit(1);
        if (sessions && Array.isArray(sessions) && sessions.length > 0) {
          streamId = sessions[0].id || null;
        }
      } catch {
        // ignore errors
      }

      const rpcParams: RedeemRewardParams = {
        p_twitch_user_id: twitchUserId,
        p_reward_id: reward.id,
        p_description: descriptionToInsert,
        p_cost: reward.cost,
        p_ttstext: ttsToSend,
        p_stream_id: streamId
      };
      const { data, error: rpcError } = await supabase.rpc('redeem_reward', rpcParams as object);
      if (rpcError) {
        setStatus({ type: 'error', msg: t('pointsAndRewardSection.fehlerBeimEinloesen', { msg: rpcError.message }) });
      } else if (data && typeof data === 'object') {
        if (data.error) {
          if (data.error === 'cooldown_active') {
            const rem = data.remaining || 0;
            setStatus({ type: 'error', msg: t('pointsAndRewardSection.cooldownAktiv', { sec: rem }) });
          } else if (data.error === 'once_per_stream_active') {
            setStatus({ type: 'error', msg: t('pointsAndRewardSection.einmalProStream') });
          } else if (data.error === 'reward_disabled') {
            setStatus({ type: 'error', msg: t('pointsAndRewardSection.rewardDeaktiviert') });
          } else {
            setStatus({ type: 'error', msg: t('pointsAndRewardSection.unbekannterFehler', { err: data.error }) });
          }
        } else if (data.success) {
          setStatus({ type: 'success', msg: t('pointsAndRewardSection.erfolgreichEingeloest') });
          if (points !== null) setPoints(points - reward.cost);
          setTtsText('');
          setCooldownActive(true);
          setCooldownRemaining(reward.cooldown || 0);
          setTimeout(() => {
            setSelectedRewardId(null);
            setStatus(null);
          }, 2000);
        } else {
          setStatus({ type: 'error', msg: t('pointsAndRewardSection.unbekannteResponse') });
        }
      } else {
        setStatus({ type: 'error', msg: t('pointsAndRewardSection.ungueltigeResponse') });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({ type: 'error', msg: t('pointsAndRewardSection.fehlerBeimEinloesen', { msg }) });
    }
    setRedeemLoading(false);
  };

  if (loading || !user || !isLive) return null;

  return (
      <div className="points-reward-section" role="region" aria-label={t('pointsAndRewardSection.pointsRegionLabel')}>
        <div className="points-header">
          <span>{t('pointsAndRewardSection.deinePunkte')}</span>
          <div
            className="points-amount"
            aria-label={t('pointsAndRewardSection.pointsDisplay', { points: points?.toLocaleString() ?? '0' })}
          >
            {points?.toLocaleString() ?? '0'}
          </div>
        </div>

        {!selectedRewardId ? (
            /* GRID ANSICHT: 3 Spalten durch CSS */
            <div className="reward-grid" role="list" aria-label={t('pointsAndRewardSection.rewardGridLabel')}>
              {rewards.map((r) => (
                  <button
                      key={r.id}
                      className="reward-card"
                      onClick={() => setSelectedRewardId(r.id)}
                      aria-label={t('pointsAndRewardSection.redeemButton', { name: r.name })}
                  >
                    <div className="reward-card-title">{r.name}</div>
                    <div className="reward-card-cost">{t('pointsAndRewardSection.costPoints', { cost: r.cost })}</div>
                  </button>
              ))}
            </div>
        ) : (
            /* DETAIL ANSICHT */
            <div className="reward-detail-view">
              <button
                  className="back-btn"
                  onClick={() => { setSelectedRewardId(null); setStatus(null); }}
                  aria-label={t('pointsAndRewardSection.backToRewards')}
              >
                ← {t('pointsAndRewardSection.zurueck')}
              </button>

              <div className="selected-reward-info">
                <div className="reward-card-title" style={{ fontSize: '1.2rem' }}>
                  {selectedReward ? selectedReward.name : ''}
                </div>
                <div className="reward-card-cost">
                  {selectedReward ? t('pointsAndRewardSection.costPoints', { cost: selectedReward.cost }) : ''}
                </div>
              </div>
              {/* TTS-Inputfeld nur anzeigen, wenn istts true und KEIN vordefinierter Text */}
              {selectedReward && selectedReward.istts && !selectedReward.text && (
                <textarea
                  className="tts-input"
                  placeholder={t('pointsAndRewardSection.deineNachricht')}
                  value={ttsText}
                  onChange={e => setTtsText(e.target.value)}
                  rows={3}
                  maxLength={200}
                  aria-label={t('pointsAndRewardSection.ttsInputLabel')}
                />
              )}
              <button
                  className="btn btn-primary redeem-btn"
                  onClick={handleRedeem}
                  disabled={
                    redeemLoading ||
                    !selectedReward ||
                    // TTS-Text nur erforderlich, wenn kein vordefinierter Text
                    (selectedReward.istts && !selectedReward.text && !ttsText) ||
                    (points !== null && selectedReward && points < selectedReward.cost ) ||
                    cooldownActive ||
                    globalLockActive
                  }
              >
                {redeemLoading
                  ? t('pointsAndRewardSection.laedt')
                  : globalLockActive
                    ? t('pointsAndRewardSection.globalGesperrt')
                    : cooldownActive
                      ? t('pointsAndRewardSection.cooldown', { sec: cooldownRemaining })
                      : t('pointsAndRewardSection.jetztEinloesen')}
              </button>
            </div>
        )}

        {status && (
            <div className={`${status.type}-msg`} style={{ marginTop: '12px' }} role="alert">
              {status.msg}
            </div>
        )}
      </div>
  );
}