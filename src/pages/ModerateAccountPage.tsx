import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/useAuth'
import { useToast } from '../context/useToast'
import { supabase } from '../lib/supabase'
import { useIsModerator } from '../hooks/useIsModerator'
import SubPage from '../components/SubPage/SubPage'
import { getErrorMessage } from '../lib/utils'


interface Reward {
  id?: string;
  name: string;
  cost: number;
  type: string;
  description: string;
  cooldown?: number;
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
  const [rewardForm, setRewardForm] = useState<Reward>({ name: '', cost: 0, type: '', description: '', cooldown: 0 })
  const [rewardBusy, setRewardBusy] = useState(false)

  // Bann-Liste laden
  async function fetchBanned() {
    const { data, error } = await supabase.from('banned_accounts').select('twitch_user_id')
    if (!error && data) setBanned(data.map((b: { twitch_user_id: string }) => b.twitch_user_id))
  }

  // Rewards laden
  async function fetchRewards() {
    const { data, error } = await supabase.from('rewards').select('*')
    if (!error && data) setRewards(data)
    else showToast('Fehler beim Laden der Rewards')
  }
  useEffect(() => { fetchRewards() }, [/* intentionally empty: fetchRewards is stable */])

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
      const targetUser = pointsName.trim()
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
      setRewardForm({ name: '', cost: 0, type: '', description: '', cooldown: 0 })
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
      <h1>👤 {t('moderate.accountManagement', 'Account-Management')}</h1>


      {/* Bann-Panel */}
      <h2>{t('moderate.banAccount', 'Account bannen')}</h2>
      <input
        type="text"
        value={banName}
        onChange={e => setBanName(e.target.value)}
        placeholder="Twitch-Username oder ID"
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--box-border)', marginRight: 8 }}
      />
      <button className="btn btn-danger" disabled={!banName.trim() || !isBroadcaster || busy} onClick={banAccount}>
        🚫 {t('moderate.banBtn', 'Bannen')}
      </button>
      <div style={{marginTop:12}}>
        <b>Gebannte Accounts:</b>
        <ul style={{margin:'8px 0'}}>
          {banned.length === 0 && <li style={{color:'#888'}}>Keine gebannten Accounts</li>}
          {banned.map((id) => (
            <li key={id} style={{display:'flex',alignItems:'center',gap:8}}>
              <span>{id}</span>
              {isBroadcaster && (
                <button className="btn btn-sm btn-secondary" onClick={() => unbanAccount(id)} disabled={busy}>Entbannen</button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Kanalpunkte-Panel */}
      <h2 style={{ marginTop: 32 }}>{t('moderate.channelPoints', 'Kanalpunkte verwalten')}</h2>
      <input
        type="text"
        value={pointsName}
        onChange={e => setPointsName(e.target.value)}
        placeholder="Twitch-Username oder ID"
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--box-border)', marginRight: 8 }}
      />
      <select value={pointsAction} onChange={e => setPointsAction(e.target.value as 'reset' | 'give')} style={{ marginRight: 8 }}>
        <option value="reset">{t('moderate.resetPoints', 'Punkte löschen')}</option>
        <option value="give">{t('moderate.givePoints', 'Punkte geben')}</option>
      </select>
      {pointsAction === 'give' && (
        <input
          type="number"
          value={pointsValue}
          min={1}
          onChange={e => setPointsValue(Number(e.target.value))}
          placeholder="Punktewert"
          style={{ width: 100, marginRight: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--box-border)' }}
        />
      )}
      <button className="btn btn-primary" disabled={!pointsName.trim() || (pointsAction==='give' && (!pointsValue || pointsValue<=0)) || busy} onClick={handlePoints}>
        {pointsAction === 'reset' ? '🗑️' : '➕'} {pointsAction === 'reset' ? t('moderate.resetPoints', 'Punkte löschen') : t('moderate.givePoints', 'Punkte geben')}
      </button>

      {/* Belohnungen-Panel */}
      <h2 style={{ marginTop: 32 }}>{t('moderate.rewards', 'Belohnungen verwalten')}</h2>
      <div style={{background:'#f4f4f4',border:'1px solid #ccc',borderRadius:8,padding:16,marginBottom:24}}>
        {/* Reward-Liste */}
        <b>Rewards:</b>
        <ul style={{margin:'8px 0',padding:0,listStyle:'none'}}>
          {rewards.length === 0 && <li style={{color:'#888'}}>Keine Rewards</li>}
          {rewards.map(r => (
            <li key={r.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <span style={{flex:1}}><b>{r.name}</b> ({r.cost} Punkte) – {r.type} {r.cooldown ? `/ CD: ${r.cooldown}s` : ''}</span>
              <button className="btn btn-sm btn-secondary" onClick={() => { setRewardEdit(r); setRewardForm(r); }}>Bearbeiten</button>
              <button className="btn btn-sm btn-danger" onClick={() => r.id && deleteReward(r.id)} disabled={rewardBusy}>Löschen</button>
            </li>
          ))}
        </ul>
        {/* Reward-Formular */}
        <div style={{marginTop:16}}>
          <b>{rewardEdit ? 'Reward bearbeiten' : 'Neuen Reward anlegen'}</b>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
            <input type="text" placeholder="Name" value={rewardForm.name} onChange={e => setRewardForm((f: Reward) => ({...f, name: e.target.value}))} style={{flex:1}} />
            <input type="number" placeholder="Kosten" value={rewardForm.cost} min={0} onChange={e => setRewardForm((f: Reward) => ({...f, cost: Number(e.target.value)}))} style={{width:100}} />
            <input type="text" placeholder="Typ" value={rewardForm.type} onChange={e => setRewardForm((f: Reward) => ({...f, type: e.target.value}))} style={{width:100}} />
            <input type="text" placeholder="Beschreibung" value={rewardForm.description} onChange={e => setRewardForm((f: Reward) => ({...f, description: e.target.value}))} style={{flex:2}} />
            <input type="number" placeholder="Cooldown (s)" value={rewardForm.cooldown} min={0} onChange={e => setRewardForm((f: Reward) => ({...f, cooldown: Number(e.target.value)}))} style={{width:120}} />
            <button className="btn btn-primary" onClick={saveReward} disabled={rewardBusy || !rewardForm.name || !rewardForm.type}>Speichern</button>
            {rewardEdit && <button className="btn btn-secondary" onClick={() => { setRewardEdit(null); setRewardForm({ name: '', cost: 0, type: '', description: '', cooldown: 0 }) }}>Abbrechen</button>}
          </div>
        </div>
      </div>

      {/* Anleitung */}
      <div style={{background:'#f8f8f8',border:'1px solid #ddd',borderRadius:8,padding:16,marginBottom:32}}>
        <h2 style={{marginTop:0}}>Anleitung & Hinweise</h2>
        <ul style={{marginBottom:8}}>
          <li><b>Accounts bannen:</b> Gebannte User können keine Kanalpunkte mehr sammeln oder einlösen. Nur der Broadcaster kann bannen/entbannen.</li>
          <li><b>Kanalpunkte löschen/geben:</b> Mods können nur Punkte von Usern löschen. Der Broadcaster kann Punkte bei allen löschen, sich selbst Punkte geben und anderen Punkte geben.</li>
          <li><b>Belohnungen verwalten:</b> Hier kannst du Rewards hinzufügen, bearbeiten oder löschen. Änderungen wirken sich sofort aus.</li>
        </ul>
        <b>Technischer Hinweis:</b>
        <ul>
          <li>Punkte werden in der Tabelle <code>points</code> gespeichert.</li>
          <li>Rewards werden in <code>rewards</code> gepflegt. Einlösen wird in <code>redeemed_rewards</code> protokolliert.</li>
          <li>Bann-Liste: Tabelle <code>banned_accounts</code> (wird automatisch angelegt).</li>
        </ul>
      </div>
    </SubPage>
  )
}
