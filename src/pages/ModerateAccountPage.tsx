import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/useAuth'
import { useConfirmModal } from '../context/useConfirmModal'
import { useToast } from '../context/useToast'
import { supabase } from '../lib/supabase'
import { useIsModerator } from '../hooks/useIsModerator'
import SubPage from '../components/SubPage/SubPage'
import { getErrorMessage } from '../lib/utils'
import siteConfig from '../config/siteConfig'

/**
 * Konstanten außerhalb der Komponente definieren, um stabile Referenzen
 * für Hooks (useCallback/useEffect) zu gewährleisten.
 */
const DEFAULT_REWARD: Reward = {
  name: '',
  cost: 0,
  mediaurl: '',
  showmedia: false,
  description: '',
  imageurl: '',
  text: '',
  duration: 0,
  onceperstream: false,
  cooldown: 0,
  istts: false,
  is_enabled: true,
}

interface Reward {
  id?: string
  name?: string
  cost?: number
  mediaurl?: string
  showmedia?: boolean
  description?: string
  imageurl?: string
  text?: string
  duration?: number
  onceperstream?: boolean
  cooldown?: number
  istts?: boolean
  is_enabled?: boolean
}

interface RecentRedemption {
  id: string
  twitch_user_id: string
  reward_id: string | null
  timestamp: string
  cost: number | null
  description: string | null
}

export default function ModerateAccountPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { isBroadcaster, isMod } = useIsModerator()
  const { showConfirm } = useConfirmModal()

  const [banName, setBanName] = useState('')
  const [pointsName, setPointsName] = useState('')
  const [pointsAction, setPointsAction] = useState<'reset' | 'give'>('reset')
  const [pointsValue, setPointsValue] = useState<number>(0)
  const [banned, setBanned] = useState<{ twitch_user_id: string; display_name?: string }[]>([])
  const [busy, setBusy] = useState(false)

  const [rewards, setRewards] = useState<Reward[]>([])
  const [rewardEdit, setRewardEdit] = useState<Reward | null>(null)

  const [rewardForm, setRewardForm] = useState<Reward>(DEFAULT_REWARD)
  const [rewardModalOpen, setRewardModalOpen] = useState(false)
  const [rewardBusy, setRewardBusy] = useState(false)
  const [isWide, setIsWide] = useState<boolean>(
      () => typeof window !== 'undefined' && window.innerWidth >= 1024
  )

  const [recentRedemptions, setRecentRedemptions] = useState<RecentRedemption[]>([])
  const [redemptionsLoading, setRedemptionsLoading] = useState(true)
  const [redemptionsError, setRedemptionsError] = useState(false)

  /**
   * Hilfsfunktion zum Mergen von DB-Daten mit Standardwerten.
   * Benutzt DEFAULT_REWARD von außerhalb.
   */
  const mergeRewardWithDefaults = useCallback((r?: Reward) => {
    if (!r) return { ...DEFAULT_REWARD }
    const merged: Reward = { ...DEFAULT_REWARD }
    const keys = Object.keys(DEFAULT_REWARD) as (keyof Reward)[]

    for (const key of keys) {
      const val = r[key]
      if (val === undefined || val === null) continue

      switch (key) {
        case 'name':
        case 'mediaurl':
        case 'description':
        case 'imageurl':
        case 'text':
          merged[key] = val as string
          break
        case 'cost':
        case 'duration':
        case 'cooldown':
          merged[key] = Number(val)
          break
        case 'showmedia':
        case 'onceperstream':
        case 'istts':
          merged[key] = Boolean(val)
          break
      }
    }
    if (r.id) merged.id = r.id
    return merged
  }, [])

  /**
   * Daten-Abruffunktionen.
   * Fehler werden hier nicht erneut geworfen ("throw"), sondern direkt verarbeitet
   * oder an den Aufrufer zur Anzeige weitergegeben.
   */
  const fetchBanned = useCallback(async () => {
    const { data, error } = await supabase.from('banned_accounts').select('twitch_user_id, display_name')
    if (error) return []
    return (data ?? []).map((b) => ({
      twitch_user_id: b.twitch_user_id,
      display_name: b.display_name ?? undefined,
    }))
  }, [])

  const fetchRecentRedemptions = useCallback(async () => {
    const { data, error } = await supabase
        .from('redeemed_rewards')
        .select('id, twitch_user_id, reward_id, timestamp, cost, description')
        .order('timestamp', { ascending: false })
        .limit(10)
    if (error) return null
    return (data ?? []) as RecentRedemption[]
  }, [])

  const fetchRewards = useCallback(async () => {
    const { data, error } = await supabase.from('rewards').select('*')
    if (error) return null
    return (data ?? []) as Reward[]
  }, [])

  /**
   * Effekt-Hooks
   */
  useEffect(() => {
    let isMounted = true
    const load = async () => {
      setRedemptionsLoading(true)
      setRedemptionsError(false)
      const rows = await fetchRecentRedemptions()
      if (!isMounted) return
      if (rows === null) {
        setRedemptionsError(true)
      } else {
        setRecentRedemptions(rows)
      }
      setRedemptionsLoading(false)
    }
    void load()
    return () => { isMounted = false }
  }, [fetchRecentRedemptions])

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      const rows = await fetchRewards()
      if (!isMounted) return
      if (rows === null) {
        showToast(t('moderate.errorLoadRewards'))
      } else {
        setRewards(rows)
      }
    }
    void load()
    return () => { isMounted = false }
  }, [fetchRewards, showToast, t])

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      const rows = await fetchBanned()
      if (isMounted) setBanned(rows)
    }
    void load()
    return () => { isMounted = false }
  }, [fetchBanned])

  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /**
   * Action Handler
   */
  async function banAccount() {
    if (!isBroadcaster && !isMod) {
      showToast(t('moderate.noPermission'))
      return
    }
    setBusy(true)
    try {
      let twitch_user_id = banName.trim()
      if (!/^\d+$/.test(twitch_user_id)) {
        const res = await fetch(`${siteConfig.twitch.idLookupUrl}${encodeURIComponent(twitch_user_id)}`)
        if (!res.ok) {
          showToast(t('moderate.couldNotFetchTwitchId'))
          setBusy(false)
          return
        }
        twitch_user_id = (await res.text()).trim()
      }

      const myTwitchId = user?.user_metadata?.provider_id || user?.user_metadata?.sub || ''
      if (isBroadcaster && twitch_user_id === myTwitchId) {
        showToast(t('moderate.cannotBanYourself'))
        setBusy(false)
        return
      }

      const { error: rpcError } = await supabase.rpc('admin_ban_account', {
        p_twitch_user_id: twitch_user_id,
        p_display_name: banName.trim(),
        p_banned_by: myTwitchId,
      })

      if (rpcError) {
        await supabase.from('banned_accounts').insert([
          { twitch_user_id, display_name: banName.trim(), banned_by: myTwitchId },
        ])
      }

      showToast(t('moderate.accountBanned'))
      setBanName('')
      const updatedList = await fetchBanned()
      setBanned(updatedList)
    } catch (e) {
      showToast(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function unbanAccount(twitch_user_id: string) {
    if (!isBroadcaster && !isMod) return
    setBusy(true)
    try {
      const { error: rpcErr } = await supabase.rpc('admin_unban_account', {
        p_twitch_user_id: twitch_user_id,
      })
      if (rpcErr) {
        await supabase.from('banned_accounts').delete().eq('twitch_user_id', twitch_user_id)
      }
      showToast(t('moderate.accountUnbanned'))
      const updatedList = await fetchBanned()
      setBanned(updatedList)
    } catch (e) {
      showToast(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function handlePoints() {
    if (!pointsName.trim()) return
    setBusy(true)
    try {
      let targetUser = pointsName.trim()
      if (!/^\d+$/.test(targetUser)) {
        const res = await fetch(`${siteConfig.twitch.idLookupUrl}${encodeURIComponent(targetUser)}`)
        if (res.ok) {
          targetUser = (await res.text()).trim()
        }
      }

      if (pointsAction === 'reset') {
        const { error } = await supabase
            .from('points')
            .update({ points: 0, reason: 'reset by mod' })
            .eq('twitch_user_id', targetUser)
        if (error) {
          await supabase.from('points').insert([{ twitch_user_id: targetUser, points: 0, reason: 'reset by mod' }])
        }
        showToast(t('moderate.pointsReset'))
      } else {
        const { data } = await supabase.from('points').select('points').eq('twitch_user_id', targetUser).maybeSingle()
        const currentPoints = data?.points ?? 0
        await supabase.from('points').upsert([{ twitch_user_id: targetUser, points: currentPoints + pointsValue, reason: 'added by mod' }])
        showToast(t('moderate.pointsGiven'))
      }
      setPointsName('')
      setPointsValue(0)
    } catch (e) {
      showToast(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveReward() {
    setRewardBusy(true)
    try {
      const upsertData = { ...rewardForm }
      if (rewardEdit?.id) upsertData.id = rewardEdit.id

      const { error } = await supabase.from('rewards').upsert([upsertData])
      if (error) throw new Error(getErrorMessage(error))

      showToast(t('moderate.rewardSaved'))
      setRewardEdit(null)
      setRewardForm(DEFAULT_REWARD)
      setRewardModalOpen(false)

      const updatedRewards = await fetchRewards()
      if (updatedRewards) setRewards(updatedRewards)
    } catch (e) {
      showToast(getErrorMessage(e))
    } finally {
      setRewardBusy(false)
    }
  }

  async function deleteReward(id: string) {
    const confirmed = await showConfirm({
      title: t('moderate.deleteRewardConfirmTitle'),
      message: t('moderate.deleteRewardConfirmMessage'),
      confirmLabel: t('moderate.deleteRewardConfirmConfirmLabel'),
      cancelLabel: t('moderate.deleteRewardConfirmCancelLabel'),
    })
    if (!confirmed) return

    setRewardBusy(true)
    try {
      const { error } = await supabase.rpc('admin_delete_reward', { p_id: id })
      if (error) {
        await supabase.from('rewards').delete().eq('id', id)
      }
      showToast(t('moderate.rewardDeleted'))
      const updatedRewards = await fetchRewards()
      if (updatedRewards) setRewards(updatedRewards)
    } catch (e) {
      showToast(getErrorMessage(e))
    } finally {
      setRewardBusy(false)
    }
  }

  async function triggerTestAlert(reward: Reward) {
    if (!reward.id) return
    if (!isBroadcaster && !isMod) {
      showToast(t('moderate.noPermission'))
      return
    }
    setRewardBusy(true)
    try {
      const { data, error } = await supabase.rpc('mod_test_redeem_reward', { p_reward_id: reward.id })
      if (error) throw new Error(getErrorMessage(error))
      if (data && typeof data === 'object' && 'error' in data) {
        showToast(t('moderate.errorTestAlert', { msg: String((data as { error: string }).error) }))
        return
      }
      showToast(t('moderate.testAlertSent'))
    } catch (e) {
      showToast(t('moderate.errorTestAlert', { msg: getErrorMessage(e) }))
    } finally {
      setRewardBusy(false)
    }
  }

  async function toggleRewardEnabled(reward: Reward) {
    if (!reward.id) return
    setRewardBusy(true)
    try {
      const { error } = await supabase
          .from('rewards')
          .update({ is_enabled: !reward.is_enabled })
          .eq('id', reward.id)
      if (error) throw new Error(getErrorMessage(error))

      showToast(reward.is_enabled ? t('moderate.rewardDisabled') : t('moderate.rewardEnabled'))
      const updatedRewards = await fetchRewards()
      if (updatedRewards) setRewards(updatedRewards)
    } catch (e) {
      showToast(getErrorMessage(e))
    } finally {
      setRewardBusy(false)
    }
  }

  return (
      <SubPage>
        <h1>👤 {t('moderate.accountManagement')}</h1>

        {/* Bann-Panel */}
        <h2>{t('moderate.banAccount')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
              type="text"
              value={banName}
              onChange={(e) => setBanName(e.target.value)}
              placeholder={t('moderate.banInputPlaceholder')}
              className="modal-input"
              style={{ minWidth: 220 }}
          />
          <button
              className="btn btn-danger"
              disabled={!banName.trim() || busy}
              onClick={() => { void banAccount() }}
          >
            🚫 {t('moderate.banBtn')}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <b>{t('moderate.bannedAccountsTitle')}</b>
          <ul style={{ margin: '8px 0' }}>
            {banned.length === 0 && (
                <li style={{ color: '#888' }}>{t('moderate.noBannedAccounts')}</li>
            )}
            {banned.map((b) => (
                <li key={b.twitch_user_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{b.display_name || b.twitch_user_id}</span>
                  {(isBroadcaster || isMod) && (
                      <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => { void unbanAccount(b.twitch_user_id) }}
                          disabled={busy}
                      >
                        {t('moderate.unbanBtn')}
                      </button>
                  )}
                </li>
            ))}
          </ul>
        </div>

        {/* Kanalpunkte-Panel */}
        <h2 style={{ marginTop: 32 }}>{t('moderate.channelPoints')}</h2>
        <div
            style={{
              display: 'flex',
              flexDirection: isWide ? 'row' : 'column',
              alignItems: isWide ? 'center' : 'stretch',
              gap: 12,
              marginBottom: 8,
            }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: isWide ? 'auto' : '100%' }}>
            <label htmlFor="pointsName" style={{ fontWeight: 'bold' }}>{t('moderate.pointsInputLabel')}</label>
            <input
                id="pointsName"
                type="text"
                value={pointsName}
                onChange={(e) => setPointsName(e.target.value)}
                placeholder={t('moderate.pointsInputPlaceholder')}
                className="modal-input"
                style={{ width: isWide ? 220 : '100%' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: isWide ? 160 : '100%' }}>
            <label htmlFor="pointsAction" style={{ fontWeight: 'bold' }}>{t('moderate.pointsActionLabel')}</label>
            <select
                id="pointsAction"
                className="modal-input"
                value={pointsAction}
                onChange={(e) => setPointsAction(e.target.value as 'reset' | 'give')}
                style={{ width: '100%' }}
            >
              <option value="reset">{t('moderate.resetPoints')}</option>
              <option value="give">{t('moderate.givePoints')}</option>
            </select>
          </div>

          {pointsAction === 'give' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: isWide ? 120 : '100%' }}>
                <label htmlFor="pointsValue" style={{ fontWeight: 'bold' }}>{t('moderate.pointsValueLabel')}</label>
                <input
                    id="pointsValue"
                    type="number"
                    value={pointsValue}
                    min={1}
                    onChange={(e) => setPointsValue(Number(e.target.value))}
                    placeholder={t('moderate.pointsValuePlaceholder')}
                    className="modal-input"
                    style={{ width: '100%' }}
                />
              </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: isWide ? 120 : '100%' }}>
            <label htmlFor="pointsButton" style={{ fontWeight: 'bold', visibility: 'hidden' }} aria-hidden />
            <button
                className="btn btn-primary"
                style={{ marginTop: isWide ? 0 : 8, width: isWide ? 'auto' : '100%' }}
                disabled={!pointsName.trim() || (pointsAction === 'give' && (!pointsValue || pointsValue <= 0)) || busy}
                onClick={() => { void handlePoints() }}
            >
              {pointsAction === 'reset' ? '🗑️' : '➕'} {pointsAction === 'reset' ? t('moderate.resetPoints') : t('moderate.givePoints')}
            </button>
          </div>
        </div>

        {/* Belohnungen-Panel */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 32 }}>
          <h2 style={{ margin: 0 }}>{t('moderate.rewards')}</h2>
        </div>
        <div style={{ background: 'var(--box-bg)', border: '1px solid var(--box-border)', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <b>{t('moderate.rewardsListTitle')}</b>
            <button
                className="btn btn-primary"
                onClick={() => { setRewardEdit(null); setRewardForm(DEFAULT_REWARD); setRewardModalOpen(true); }}
            >
              {t('moderate.addRewardBtn')}
            </button>
          </div>

          <ul style={{ margin: '8px 0', padding: 0, listStyle: 'none' }}>
            {rewards.length === 0 && <li style={{ color: '#888' }}>{t('moderate.noRewards')}</li>}
            {rewards.map((r) => (
                <li key={r.id} style={{ display: 'flex', flexDirection: isWide ? 'row' : 'column', justifyContent: 'space-between', alignItems: isWide ? 'center' : 'stretch', padding: '6px 0', opacity: r.is_enabled === false ? 0.45 : 1 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b style={{ display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{r.name || ''}</b>
                    <div style={{ fontSize: 12, color: 'var(--muted-color, #666)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {r.description || ''}
                      {r.is_enabled === false && <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--muted)' }}>({t('moderate.rewardInactive')})</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: isWide ? 12 : 0, marginTop: isWide ? 0 : 8 }}>
                    <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => { setRewardEdit(r); setRewardForm(mergeRewardWithDefaults(r)); setRewardModalOpen(true); }}
                    >
                      {t('moderate.editRewardBtn')}
                    </button>
                    <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => { void triggerTestAlert(r) }}
                        disabled={rewardBusy}
                        title={t('moderate.testAlertBtn')}
                    >
                      🔔
                    </button>
                    <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => { void toggleRewardEnabled(r) }}
                        disabled={rewardBusy}
                        title={r.is_enabled === false ? t('moderate.enableRewardBtn') : t('moderate.disableRewardBtn')}
                    >
                      {r.is_enabled === false ? '▶️' : '⏸️'}
                    </button>
                    <button
                        className="btn btn-sm btn-danger"
                        onClick={() => { if (r.id) void deleteReward(r.id) }}
                        disabled={rewardBusy}
                    >
                      {t('moderate.deleteRewardBtn')}
                    </button>
                  </div>
                </li>
            ))}
          </ul>

          {/* Modal */}
          {rewardModalOpen && (
              <div className="confirm-modal is-open">
                <div className="modal-backdrop" onClick={() => setRewardModalOpen(false)} />
                <div className="modal-card" style={{ zIndex: 10051, maxHeight: '80vh', overflow: 'auto', width: isWide ? 980 : 680 }}>
                  <b style={{ fontSize: '1.2em' }}>{rewardEdit ? t('moderate.editRewardTitle') : t('moderate.newRewardTitle')}</b>
                  <form
                      style={{ display: 'grid', gridTemplateColumns: isWide ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap: 18, marginTop: 16 }}
                      onSubmit={(e) => { e.preventDefault(); void saveReward(); }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label htmlFor="rewardName" style={{ fontWeight: 'bold' }}>{t('moderate.rewardNameLabel')}</label>
                      <input
                          id="rewardName"
                          type="text"
                          className="modal-input"
                          value={rewardForm.name}
                          onChange={(e) => setRewardForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: isWide ? 'span 3' : 'span 2' }}>
                      <label htmlFor="rewardDescription" style={{ fontWeight: 'bold' }}>{t('moderate.rewardDescriptionLabel')}</label>
                      <textarea
                          id="rewardDescription"
                          className="modal-input"
                          value={rewardForm.description}
                          onChange={(e) => setRewardForm((f) => ({ ...f, description: e.target.value }))}
                          style={{ minHeight: 80 }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label htmlFor="rewardCost" style={{ fontWeight: 'bold' }}>{t('moderate.rewardCostLabel')}</label>
                      <input id="rewardCost" type="number" className="modal-input" value={rewardForm.cost} min={0} onChange={(e) => setRewardForm((f) => ({ ...f, cost: Number(e.target.value) }))} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label htmlFor="rewardMediaurl" style={{ fontWeight: 'bold' }}>{t('moderate.rewardMediaurlLabel')}</label>
                      <input id="rewardMediaurl" type="text" className="modal-input" value={rewardForm.mediaurl} onChange={(e) => setRewardForm((f) => ({ ...f, mediaurl: e.target.value }))} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: isWide ? 'span 1' : 'span 2' }}>
                      <label style={{ fontWeight: 'bold' }}>{t('moderate.rewardShowMediaLabel')}</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={!!rewardForm.showmedia} onChange={(e) => setRewardForm((f) => ({ ...f, showmedia: e.target.checked }))} />
                        <span style={{ fontSize: 12, color: 'var(--muted-color,#666)' }}>{t('moderate.rewardShowMediaHint')}</span>
                      </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label htmlFor="rewardImage" style={{ fontWeight: 'bold' }}>{t('moderate.rewardImageLabel')}</label>
                      <input id="rewardImage" type="text" className="modal-input" value={rewardForm.imageurl} onChange={(e) => setRewardForm((f) => ({ ...f, imageurl: e.target.value }))} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label htmlFor="rewardText" style={{ fontWeight: 'bold' }}>{t('moderate.rewardTextLabel')}</label>
                      <input id="rewardText" type="text" className="modal-input" value={rewardForm.text} onChange={(e) => setRewardForm((f) => ({ ...f, text: e.target.value }))} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontWeight: 'bold' }}>{t('moderate.rewardIsTtsLabel')}</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={!!rewardForm.istts} onChange={(e) => setRewardForm((f) => ({ ...f, istts: e.target.checked }))} />
                        <span style={{ fontSize: 12, color: 'var(--muted-color,#666)' }}>{t('moderate.rewardIsTtsHint')}</span>
                      </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'row', gap: 18, gridColumn: isWide ? 'span 1' : 'span 2' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                        <label htmlFor="rewardDuration" style={{ fontWeight: 'bold' }}>{t('moderate.rewardDurationLabel')}</label>
                        <input id="rewardDuration" type="number" className="modal-input" value={rewardForm.duration} min={0} onChange={(e) => setRewardForm((f) => ({ ...f, duration: Number(e.target.value) }))} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                        <label htmlFor="rewardCooldown" style={{ fontWeight: 'bold' }}>{t('moderate.rewardCooldownLabel')}</label>
                        <input id="rewardCooldown" type="number" className="modal-input" value={rewardForm.cooldown} min={0} onChange={(e) => setRewardForm((f) => ({ ...f, cooldown: Number(e.target.value) }))} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: isWide ? 'span 1' : 'span 2' }}>
                      <label style={{ fontWeight: 'bold' }}>{t('moderate.rewardOncePerStreamLabel')}</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={!!rewardForm.onceperstream} onChange={(e) => setRewardForm((f) => ({ ...f, onceperstream: e.target.checked }))} />
                        <span style={{ fontSize: 12, color: 'var(--muted-color,#666)' }}>{t('moderate.rewardOncePerStreamHint')}</span>
                      </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 18, gridColumn: isWide ? 'span 3' : 'span 2' }}>
                      <button className="btn btn-primary" type="submit" disabled={rewardBusy || !rewardForm.name}>{t('moderate.saveRewardBtn')}</button>
                      <button className="btn btn-secondary" type="button" onClick={() => { setRewardModalOpen(false) }}>{t('moderate.cancelRewardBtn')}</button>
                    </div>
                  </form>
                </div>
              </div>
          )}
        </div>

        {/* Letzte Einlösungen */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 32 }}>
          <h2 style={{ margin: 0 }}>{t('moderate.recentRedemptionsTitle')}</h2>
          <button
              className="btn btn-secondary"
              onClick={() => { void fetchRecentRedemptions().then(rows => rows && setRecentRedemptions(rows)) }}
              disabled={redemptionsLoading}
          >
            🔄 {t('moderate.recentRedemptionsRefresh')}
          </button>
        </div>
        <div style={{ background: 'var(--box-bg)', border: '1px solid var(--box-border)', borderRadius: 8, padding: 16, marginTop: 8, marginBottom: 24 }}>
          {redemptionsLoading && <p style={{ color: 'var(--muted-color,#666)' }}>{t('moderate.recentRedemptionsLoading')}</p>}
          {redemptionsError && <p style={{ color: 'var(--error-color,#c00)' }}>{t('moderate.recentRedemptionsError')}</p>}
          {!redemptionsLoading && !redemptionsError && recentRedemptions.length === 0 && <p style={{ color: 'var(--muted-color,#666)' }}>{t('moderate.recentRedemptionsNone')}</p>}
          {!redemptionsLoading && !redemptionsError && recentRedemptions.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--box-border)' }}>
                  <th style={{ padding: '4px 8px' }}>{t('moderate.recentRedemptionsTime')}</th>
                  <th style={{ padding: '4px 8px' }}>{t('moderate.recentRedemptionsUser')}</th>
                  <th style={{ padding: '4px 8px' }}>{t('moderate.recentRedemptionsReward')}</th>
                  <th style={{ padding: '4px 8px' }}>{t('moderate.recentRedemptionsCost')}</th>
                </tr>
                </thead>
                <tbody>
                {recentRedemptions.map((r) => {
                  const reward = rewards.find((rw) => rw.id === r.reward_id)
                  return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--box-border,#eee)' }}>
                        <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>{new Date(r.timestamp).toLocaleString()}</td>
                        <td style={{ padding: '4px 8px', wordBreak: 'break-word' }}>{r.twitch_user_id}</td>
                        <td style={{ padding: '4px 8px', wordBreak: 'break-word' }}>
                          {reward?.name || r.reward_id || '–'}
                          {r.description ? <span style={{ color: 'var(--muted-color,#666)', fontSize: '0.85em', marginLeft: 6 }}>{r.description}</span> : null}
                        </td>
                        <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>{r.cost ?? '–'}</td>
                      </tr>
                  )
                })}
                </tbody>
              </table>
          )}
        </div>
      </SubPage>
  )
}

