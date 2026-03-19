import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/useAuth'
import { useToast } from '../context/useToast'
import { supabase } from '../lib/supabase'
import { useIsModerator } from '../hooks/useIsModerator'
import SubPage from '../components/SubPage/SubPage'
import { getErrorMessage } from '../lib/utils'


interface Reward {
    id?: string;
    name?: string;
    cost?: number;
    type?: string;
    source?: string;
    mediaurl?: string;
    showyoutubevideo?: boolean;
    description?: string;
    customimageurl?: string;
    text?: string;
    duration?: number;
    onceperstream?: boolean;
    cooldown?: number;
    nameKey?: string;
    descKey?: string;
}


export default function ModerateAccountPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [banName, setBanName] = useState('')
  const [pointsName, setPointsName] = useState('')
  const [pointsAction, setPointsAction] = useState<'reset' | 'give'>('reset')
  const [pointsValue, setPointsValue] = useState<number>(0)
  const [banned, setBanned] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const { isBroadcaster } = useIsModerator()

  // Rewards-Logik
  const [rewards, setRewards] = useState<Reward[]>([])
  const [rewardEdit, setRewardEdit] = useState<Reward | null>(null)
  const [rewardForm, setRewardForm] = useState<Reward>({
    name: '',
    cost: 0,
    type: '',
    source: '',
    mediaurl: '',
    showyoutubevideo: false,
    description: '',
    customimageurl: '',
    text: '',
    duration: 0,
    onceperstream: false,
    cooldown: 0,
    nameKey: '',
    descKey: ''
  })
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [rewardBusy, setRewardBusy] = useState(false)

  // Bann-Liste laden
  async function fetchBanned() {
    const { data, error } = await supabase.from('banned_accounts').select('twitch_user_id')
    if (!error && data) setBanned(data.map((b: { twitch_user_id: string }) => b.twitch_user_id))
  }

  // Rewards laden
  const fetchRewards = useCallback(async () => {
    const { data, error } = await supabase.from('rewards').select('*')
    if (!error && data) setRewards(data)
    else showToast('Fehler beim Laden der Rewards')
  }, [showToast])
  useEffect(() => { fetchRewards() }, [fetchRewards])

  // Initial fetch
  React.useEffect(() => { fetchBanned() }, [])

  async function banAccount() {
    if (!isBroadcaster) return
    setBusy(true)
    try {
      // Annahme: banName ist Twitch-User-ID oder Username
      const twitch_user_id = banName.trim()
      const display_name = banName.trim()
      const banned_by = user?.user_metadata?.provider_id || user?.user_metadata?.sub || ''
      const { error } = await supabase.from('banned_accounts').insert([{ twitch_user_id, display_name, banned_by }])
      if (error) {
        showToast('Fehler beim Bannen: ' + getErrorMessage(error))
        return
      }
      showToast('Account gebannt!')
      setBanName('')
      fetchBanned()
    } catch (e: unknown) {
      showToast('Fehler beim Bannen: ' + getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function unbanAccount(twitch_user_id: string) {
    if (!isBroadcaster) return
    setBusy(true)
    try {
      const { error } = await supabase.from('banned_accounts').delete().eq('twitch_user_id', twitch_user_id)
      if (error) {
        showToast('Fehler beim Entbannen: ' + getErrorMessage(error))
        return
      }
      showToast('Account entbannt!')
      fetchBanned()
    } catch (e: unknown) {
      showToast('Fehler beim Entbannen: ' + getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function handlePoints() {
    if (!pointsName.trim()) return
    setBusy(true)
    try {
      let targetUser = pointsName.trim()
      // Twitch-ID holen, falls kein reiner Zahlenwert
      if (!/^\d+$/.test(targetUser)) {
        const res = await fetch(`https://decapi.me/twitch/id/${encodeURIComponent(targetUser)}`)
        if (!res.ok) throw new Error('Twitch-ID konnte nicht abgerufen werden')
        const id = (await res.text()).trim()
        if (!/^\d+$/.test(id)) throw new Error('Ungültige Twitch-ID erhalten')
        targetUser = id
      }
      if (pointsAction === 'reset') {
        const { error } = await supabase
          .from('points')
          .update({ points: 0, reason: 'reset by mod' })
          .eq('twitch_user_id', targetUser)
        if (error) {
          showToast('Fehler beim Punkte löschen: ' + getErrorMessage(error))
          return
        }
        showToast('Punkte gelöscht!')
      } else if (pointsAction === 'give') {
        if (!pointsValue || isNaN(pointsValue)) {
          showToast('Bitte gültigen Punktewert eingeben')
          return
        }
        const { data, error: fetchError } = await supabase
          .from('points')
          .select('points')
          .eq('twitch_user_id', targetUser)
          .maybeSingle()
        if (fetchError) {
          showToast('Fehler beim Punkte holen: ' + getErrorMessage(fetchError))
          return
        }
        let newPoints = pointsValue
        if (data && typeof data.points === 'number') {
          newPoints += data.points
        }
        const { error } = await supabase
          .from('points')
          .update({ points: newPoints, reason: 'added by mod' })
          .eq('twitch_user_id', targetUser)
        if (error) {
          showToast('Fehler beim Punkte vergeben: ' + getErrorMessage(error))
          return
        }
        showToast('Punkte vergeben!')
      }
      setPointsName('')
      setPointsValue(0)
    } catch (e) {
      showToast('Fehler bei Punkte-Aktion: ' + getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // Reward speichern (neu/ändern)
  async function saveReward() {
    setRewardBusy(true)
    try {
      const upsert = { ...rewardForm }
      if (rewardEdit && rewardEdit.id) upsert.id = rewardEdit.id
      const { error } = await supabase.from('rewards').upsert([upsert], { onConflict: 'id' })
      if (error) {
        showToast('Fehler beim Speichern: ' + getErrorMessage(error))
        return
      }
      showToast('Reward gespeichert!')
      setRewardEdit(null)
      setRewardForm({ nameKey: '', descKey: '', cost: 0, type: '', cooldown: 0 })
      fetchRewards()
    } catch (e) {
      showToast('Fehler beim Speichern: ' + getErrorMessage(e))
    } finally {
      setRewardBusy(false)
    }
  }

  // Reward löschen
  async function deleteReward(id: string) {
    if (!window.confirm('Wirklich löschen?')) return
    setRewardBusy(true)
    try {
      const { error } = await supabase.from('rewards').delete().eq('id', id)
      if (error) {
        showToast('Fehler beim Löschen: ' + getErrorMessage(error))
        return
      }
      showToast('Reward gelöscht!')
      fetchRewards()
    } catch (e) {
      showToast('Fehler beim Löschen: ' + getErrorMessage(e))
    } finally {
      setRewardBusy(false)
    }
  }

  return (
    <SubPage>
      <h1>👤 {t('moderate.accountManagement')}</h1>


      {/* Bann-Panel */}
      <h2>{t('moderate.banAccount')}</h2>
      <input
        type="text"
        value={banName}
        onChange={e => setBanName(e.target.value)}
        placeholder={t('moderate.banInputPlaceholder')}
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--box-border)', marginRight: 8 }}
      />
      <button className="btn btn-danger" disabled={!banName.trim() || !isBroadcaster || busy} onClick={banAccount}>
        🚫 {t('moderate.banBtn')}
      </button>
      <div style={{marginTop:12}}>
        <b>{t('moderate.bannedAccountsTitle')}</b>
        <ul style={{margin:'8px 0'}}>
          {banned.length === 0 && <li style={{color:'#888'}}>{t('moderate.noBannedAccounts')}</li>}
          {banned.map((id) => (
            <li key={id} style={{display:'flex',alignItems:'center',gap:8}}>
              <span>{id}</span>
              {isBroadcaster && (
                <button className="btn btn-sm btn-secondary" onClick={() => unbanAccount(id)} disabled={busy}>{t('moderate.unbanBtn')}</button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Kanalpunkte-Panel */}
      <h2 style={{ marginTop: 32 }}>{t('moderate.channelPoints')}</h2>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:8}}>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          <label htmlFor="pointsName" style={{fontWeight:'bold'}}>{t('moderate.pointsInputLabel')}</label>
          <input
            id="pointsName"
            type="text"
            value={pointsName}
            onChange={e => setPointsName(e.target.value)}
            placeholder={t('moderate.pointsInputPlaceholder')}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--box-border)', minWidth:180 }}
          />
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          <label htmlFor="pointsAction" style={{fontWeight:'bold'}}>{t('moderate.pointsActionLabel')}</label>
          <select id="pointsAction" value={pointsAction} onChange={e => setPointsAction(e.target.value as 'reset' | 'give')} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--box-border)', minWidth:120 }}>
            <option value="reset">{t('moderate.resetPoints')}</option>
            <option value="give">{t('moderate.givePoints')}</option>
          </select>
        </div>
        {pointsAction === 'give' && (
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label htmlFor="pointsValue" style={{fontWeight:'bold'}}>{t('moderate.pointsValueLabel')}</label>
            <input
              id="pointsValue"
              type="number"
              value={pointsValue}
              min={1}
              onChange={e => setPointsValue(Number(e.target.value))}
              placeholder={t('moderate.pointsValuePlaceholder')}
              style={{ width: 100, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--box-border)' }}
            />
          </div>
        )}
        <button className="btn btn-primary" style={{marginTop:22}} disabled={!pointsName.trim() || (pointsAction==='give' && (!pointsValue || pointsValue<=0)) || busy} onClick={handlePoints}>
          {pointsAction === 'reset' ? '🗑️' : '➕'} {pointsAction === 'reset' ? t('moderate.resetPoints') : t('moderate.givePoints')}
        </button>
      </div>

      {/* Belohnungen-Panel */}
      <h2 style={{ marginTop: 32 }}>{t('moderate.rewards')}</h2>
      <div style={{background:'var(--box-bg)',border:'1px solid var(--box-border)',borderRadius:8,padding:16,marginBottom:24}}>
        {/* Reward-Liste */}
        <b>{t('moderate.rewardsListTitle')}</b>
        <ul style={{margin:'8px 0',padding:0,listStyle:'none'}}>
          {rewards.length === 0 && <li style={{color:'#888'}}>{t('moderate.noRewards')}</li>}
          {rewards.map(r => (
            <li key={r.id}>
              <span>
                <b>{r.name || t(r.nameKey || '')}</b>
                <div>{r.description || t(r.descKey || '')}</div>
              </span>
              <button className="btn btn-sm btn-secondary" onClick={() => { setRewardEdit(r); setRewardForm(r); setRewardModalOpen(true); }}>{t('moderate.editRewardBtn')}</button>
              <button className="btn btn-sm btn-danger" onClick={() => r.id && deleteReward(r.id)} disabled={rewardBusy}>{t('moderate.deleteRewardBtn')}</button>
            </li>
          ))}
        </ul>
        {/* Reward-Formular als Modal */}
        {rewardModalOpen && (
          <div className="confirm-modal is-open">
            <div className="modal-backdrop" onClick={() => setRewardModalOpen(false)} />
            <div className="modal-card" style={{zIndex:10051}}>
              <b style={{fontSize:'1.2em'}}>{rewardEdit ? t('moderate.editRewardTitle') : t('moderate.newRewardTitle')}</b>
              <form style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:18,marginTop:16}} onSubmit={e => {e.preventDefault();saveReward();setRewardModalOpen(false);}}>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label htmlFor="rewardNameKey" style={{fontWeight:'bold'}}>{t('moderate.rewardNameKeyLabel')}</label>
                  <input id="rewardNameKey" type="text" className="modal-input" placeholder={t('moderate.rewardNameKeyPlaceholder')} value={rewardForm.nameKey} onChange={e => setRewardForm((f: Reward) => ({...f, nameKey: e.target.value}))} />
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label htmlFor="rewardDescKey" style={{fontWeight:'bold'}}>{t('moderate.rewardDescKeyLabel')}</label>
                  <input id="rewardDescKey" type="text" className="modal-input" placeholder={t('moderate.rewardDescKeyPlaceholder')} value={rewardForm.descKey} onChange={e => setRewardForm((f: Reward) => ({...f, descKey: e.target.value}))} />
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label htmlFor="rewardCost" style={{fontWeight:'bold'}}>{t('moderate.rewardCostLabel')}</label>
                  <input id="rewardCost" type="number" className="modal-input" placeholder={t('moderate.rewardCostPlaceholder')} value={rewardForm.cost} min={0} onChange={e => setRewardForm((f: Reward) => ({...f, cost: Number(e.target.value)}))} />
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label htmlFor="rewardType" style={{fontWeight:'bold'}}>{t('moderate.rewardTypeLabel')}</label>
                  <input id="rewardType" type="text" className="modal-input" placeholder={t('moderate.rewardTypePlaceholder')} value={rewardForm.type} onChange={e => setRewardForm((f: Reward) => ({...f, type: e.target.value}))} />
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label htmlFor="rewardCooldown" style={{fontWeight:'bold'}}>{t('moderate.rewardCooldownLabel')}</label>
                  <input id="rewardCooldown" type="number" className="modal-input" placeholder={t('moderate.rewardCooldownPlaceholder')} value={rewardForm.cooldown} min={0} onChange={e => setRewardForm((f: Reward) => ({...f, cooldown: Number(e.target.value)}))} />
                </div>
                <div style={{display:'flex',flexDirection:'row',gap:12,alignItems:'center',marginTop:18,gridColumn:'span 2'}}>
                  <button className="btn btn-primary" type="submit" disabled={rewardBusy || !rewardForm.nameKey || !rewardForm.type}>{t('moderate.saveRewardBtn')}</button>
                  <button className="btn btn-secondary" type="button" onClick={() => { setRewardEdit(null); setRewardForm({ name: '', cost: 0, type: '', source: '', mediaurl: '', showyoutubevideo: false, description: '', customimageurl: '', text: '', duration: 0, onceperstream: false, cooldown: 0, nameKey: '', descKey: '' }); setRewardModalOpen(false); }}>{t('moderate.cancelRewardBtn')}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Anleitung */}
      <div style={{background:'var(--box-bg)',border:'1px solid var(--box-border)',borderRadius:8,padding:16,marginBottom:32}}>
        <h2 style={{marginTop:0}}>{t('moderate.instructionsTitle')}</h2>
        <ul style={{marginBottom:8}}>
          <li><b>{t('moderate.instructionsBan')}</b> {t('moderate.instructionsBanDesc')}</li>
          <li><b>{t('moderate.instructionsPoints')}</b> {t('moderate.instructionsPointsDesc')}</li>
          <li><b>{t('moderate.instructionsRewards')}</b> {t('moderate.instructionsRewardsDesc')}</li>
        </ul>
        <b>{t('moderate.technicalHint')}</b>
        <ul>
          <li>{t('moderate.technicalHintPoints')}</li>
          <li>{t('moderate.technicalHintRewards')}</li>
          <li>{t('moderate.technicalHintBanned')}</li>
        </ul>
      </div>
    </SubPage>
  )
}
