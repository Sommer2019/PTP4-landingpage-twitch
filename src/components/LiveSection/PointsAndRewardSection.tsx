import './PointsAndRewardSection.css';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

interface Reward {
  id: string;
  name: string;
  cost: number;
  type: string;
  description: string;
  cooldown?: number; // Cooldown in Sekunden
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

  const selectedReward = rewards.find(r => r.id === selectedRewardId) ?? null;

  // Cooldown prüfen, wenn Reward ausgewählt wird
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    async function checkCooldown() {
      setCooldownActive(false);
      setCooldownRemaining(0);
      if (!selectedRewardId || !user) return;
      const twitchUserId = user.user_metadata?.provider_id || user.user_metadata?.sub || user.id;
      // Lade letzte Einlösung für diesen User und Reward
      const { data, error } = await supabase
        .from('redeemed_rewards')
        .select('created_at')
        .eq('twitch_user_id', twitchUserId)
        .eq('reward_id', selectedRewardId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return;
      const reward = rewards.find(r => r.id === selectedRewardId);
      if (!reward || !reward.cooldown) return;
      if (data && data.created_at) {
        const last = new Date(data.created_at).getTime();
        const now = Date.now();
        const cooldownMs = reward.cooldown * 1000;
        const remaining = last + cooldownMs - now;
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
            setStatus({ type: 'error', msg: t('Fehler beim Laden der Punkte') });
          } else {
            setPoints(data?.points ?? 0);
          }
        });
  }, [user, loading, t]);

  // Rewards laden
  useEffect(() => {
    supabase
        .from('rewards')
        .select('*')
        .then(({ data, error }) => {
          if (error) {
            setStatus({ type: 'error', msg: t('Fehler beim Laden der Rewards') });
          }
          setRewards(data || []);
        });
  }, [t]);

  const handleRedeem = async () => {
    if (!selectedRewardId) return;
    const reward = rewards.find(r => r.id === selectedRewardId);
    if (!reward || (reward.type === 'tts' && !ttsText) || !user) return;
    if (cooldownActive) return;
    setRedeemLoading(true);
    setStatus(null);
    const twitchUserId = user.user_metadata?.provider_id || user.user_metadata?.sub || user.id;
    const { error: insertError } = await supabase.from('redeemed_rewards').insert([
      {
        twitch_user_id: twitchUserId,
        reward_id: reward.id,
        description: reward.type === 'tts' ? ttsText : reward.description,
        cost: reward.cost,
      },
    ]);
    if (insertError) {
      setStatus({ type: 'error', msg: t('Fehler beim Einlösen: {{msg}}', { msg: insertError.message }) });
    } else {
      setStatus({ type: 'success', msg: t('Erfolgreich eingelöst!') });
      if (points !== null) setPoints(points - reward.cost);
      setTtsText('');
      setCooldownActive(true);
      setCooldownRemaining(reward.cooldown || 0);
      setTimeout(() => {
        setSelectedRewardId(null);
        setStatus(null);
      }, 2000);
    }
    setRedeemLoading(false);
  };

  if (loading || !user || !isLive) return null;

  return (
      <div className="points-reward-section">
        <div className="points-header">
          <span>{t('Deine Punkte')}</span>
          <div className="points-amount">{points?.toLocaleString() ?? '0'}</div>
        </div>

        {!selectedRewardId ? (
            /* GRID ANSICHT: 3 Spalten durch CSS */
            <div className="reward-grid">
              {rewards.map((r) => (
                  <button
                      key={r.id}
                      className="reward-card"
                      onClick={() => setSelectedRewardId(r.id)}
                  >
                    <div className="reward-card-title">{r.name}</div>
                    <div className="reward-card-cost">{t('{{cost}} Punkte', { cost: r.cost })}</div>
                  </button>
              ))}
            </div>
        ) : (
            /* DETAIL ANSICHT */
            <div className="reward-detail-view">
              <button
                  className="back-btn"
                  onClick={() => { setSelectedRewardId(null); setStatus(null); }}
              >
                ← {t('Zurück')}
              </button>

              <div className="selected-reward-info">
                <div className="reward-card-title" style={{ fontSize: '1.2rem' }}>
                  {selectedReward ? selectedReward.name : ''}
                </div>
                <div className="reward-card-cost">
                  {selectedReward ? t('{{cost}} Punkte', { cost: selectedReward.cost }) : ''}
                </div>
              </div>
              {selectedReward && selectedReward.type === 'tts' && (
                  <textarea
                      className="tts-input"
                      placeholder={t('Deine Nachricht...')}
                      value={ttsText}
                      onChange={e => setTtsText(e.target.value)}
                      rows={3}
                      maxLength={200}
                  />
              )}
              <button
                  className="btn btn-primary redeem-btn"
                  onClick={handleRedeem}
                  disabled={
                      redeemLoading ||
                      !selectedReward ||
                      (selectedReward.type === 'tts' && !ttsText) ||
                      (points !== null && selectedReward && points < selectedReward.cost ) ||
                      cooldownActive
                  }
              >
                {redeemLoading
                  ? t('Lädt...')
                  : cooldownActive
                    ? t('Cooldown: {{sec}}s', { sec: cooldownRemaining })
                    : t('Jetzt einlösen')}
              </button>
            </div>
        )}

        {status && (
            <div className={`${status.type}-msg`} style={{ marginTop: '12px' }}>
              {status.msg}
            </div>
        )}
      </div>
  );
}