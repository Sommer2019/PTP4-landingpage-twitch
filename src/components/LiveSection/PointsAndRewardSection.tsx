import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/useAuth';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

export default function PointsAndRewardSection({ isLive }: { isLive: boolean }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [points, setPoints] = useState<number | null>(null);
  const rewards = useMemo(() => [
    { id: 'reward3', name: 'TTS Nachricht', cost: 100, type: 'tts', description: 'Text to Speech' },
    { id: 'raid_leader', name: 'RAID-Anführer', cost: 500, type: 'tts', description: 'RAID-Anführer' },
    { id: 'reward2', name: 'YouTube Meme', cost: 200, type: 'video', description: 'YouTube Meme' },
  ], []);
  const [selectedReward, setSelectedReward] = useState<string>('');
  const [ttsText, setTtsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('points')
      .select('points')
      .eq('user', user.id)
      .single()
      .then(({ data }) => setPoints(data?.points ?? 0));
  }, [user]);

  const handleRedeem = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const reward = rewards.find(r => r.id === selectedReward);
    if (!reward) {
      setError('Kein Reward ausgewählt');
      setLoading(false);
      return;
    }
    if (points !== null && points < reward.cost) {
      setError('Nicht genug Punkte');
      setLoading(false);
      return;
    }
    if (!user) {
      setError('Nicht eingeloggt');
      setLoading(false);
      return;
    }
    // Insert in redeemed_rewards
    const { error: insertError } = await supabase.from('redeemed_rewards').insert([
      {
        user: user.id,
        reward_id: reward.id,
        description: reward.type === 'tts' ? ttsText : reward.description,
        ttsText: reward.type === 'tts' ? ttsText : null,
        cost: reward.cost,
      },
    ]);
    if (insertError) {
      setError('Fehler beim Einlösen: ' + insertError.message);
    } else {
      setSuccess('Reward eingelöst!');
      setPoints(points! - reward.cost);
      setTtsText('');
      setSelectedReward('');
    }
    setLoading(false);
  };

  if (!user || !isLive) return null;

  return (
    <div className="points-reward-section">
      <div className="points-display">
        <b>{t('Deine Punkte')}:</b> {points ?? '-'}
      </div>
      <div className="reward-redeem">
        <select
          value={selectedReward}
          onChange={e => setSelectedReward(e.target.value)}
        >
          <option value="">{t('Reward auswählen')}</option>
          {rewards.map(r => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.cost} Punkte)
            </option>
          ))}
        </select>
        {rewards.find(r => r.id === selectedReward)?.type === 'tts' && (
          <input
            type="text"
            placeholder={t('TTS Nachricht eingeben')}
            value={ttsText}
            onChange={e => setTtsText(e.target.value)}
            maxLength={200}
          />
        )}
        <button onClick={handleRedeem} disabled={loading || !selectedReward}>
          {t('Einlösen')}
        </button>
      </div>
      {success && <div className="success-msg">{success}</div>}
      {error && <div className="error-msg">{error}</div>}
    </div>
  );
}
