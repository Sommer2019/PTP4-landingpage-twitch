import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/useToast'
import { useConfirmModal } from '../context/useConfirmModal'
import SubPage from '../components/SubPage/SubPage'

interface DonationTriggerRow {
  id: string
  trigger_id: string
  price: string
  amount_value: number | null
  description: string
  trigger_text: string | null
  audio_url: string | null
  is_enabled: boolean
  sort_order: number
  created_at: string
}

const defaultForm: Omit<DonationTriggerRow, 'id' | 'created_at'> = {
  trigger_id: '',
  price: '',
  amount_value: null,
  description: '',
  trigger_text: null,
  audio_url: null,
  is_enabled: true,
  sort_order: 0,
}

export default function ModerateDonationTriggersPage() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showConfirm } = useConfirmModal()

  const [triggers, setTriggers] = useState<DonationTriggerRow[]>([])
  const [busy, setBusy] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<DonationTriggerRow, 'id' | 'created_at'>>(defaultForm)

  const loadTriggers = useCallback(async () => {
    const { data, error } = await supabase
      .from('donation_triggers')
      .select('*')
      .order('sort_order')
    if (error) {
      showToast(`❌ ${error.message}`)
    } else {
      setTriggers((data ?? []) as DonationTriggerRow[])
    }
  }, [showToast])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadTriggers()
    }, 0)

    return () => clearTimeout(timeout)
  }, [loadTriggers])

  function openAdd() {
    setEditId(null)
    setForm({ ...defaultForm, sort_order: triggers.length > 0 ? (Math.max(...triggers.map((t) => t.sort_order)) + 10) : 0 })
    setModalOpen(true)
  }

  function openEdit(trigger: DonationTriggerRow) {
    setEditId(trigger.id)
    setForm({
      trigger_id: trigger.trigger_id,
      price: trigger.price,
      amount_value: trigger.amount_value,
      description: trigger.description,
      trigger_text: trigger.trigger_text,
      audio_url: trigger.audio_url,
      is_enabled: trigger.is_enabled,
      sort_order: trigger.sort_order,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditId(null)
    setForm({ ...defaultForm })
  }

  async function saveTrigger() {
    if (!form.trigger_id.trim() || !form.price.trim() || !form.description.trim()) {
      showToast(`❌ ${t('moderate.donationTriggersRequiredFields')}`)
      return
    }
    setBusy(true)
    try {
      if (editId) {
        const { error } = await supabase
          .from('donation_triggers')
          .update({
            price: form.price.trim(),
            amount_value: form.amount_value,
            description: form.description.trim(),
            trigger_text: form.trigger_text?.trim() || null,
            audio_url: form.audio_url?.trim() || null,
            is_enabled: form.is_enabled,
            sort_order: form.sort_order,
          })
          .eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('donation_triggers').insert({
          trigger_id: form.trigger_id.trim(),
          price: form.price.trim(),
          amount_value: form.amount_value,
          description: form.description.trim(),
          trigger_text: form.trigger_text?.trim() || null,
          audio_url: form.audio_url?.trim() || null,
          is_enabled: form.is_enabled,
          sort_order: form.sort_order,
        })
        if (error) throw error
      }
      showToast(`✅ ${t('moderate.donationTriggersSaved')}`)
      closeModal()
      await loadTriggers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`❌ ${t('moderate.donationTriggersErrorSaving', { msg })}`)
    }
    setBusy(false)
  }

  async function toggleEnabled(trigger: DonationTriggerRow) {
    setBusy(true)
    const { error } = await supabase
      .from('donation_triggers')
      .update({ is_enabled: !trigger.is_enabled })
      .eq('id', trigger.id)
    if (error) {
      showToast(`❌ ${error.message}`)
    } else {
      showToast(
        !trigger.is_enabled
          ? `✅ ${t('moderate.donationTriggersEnabled')}`
          : `✅ ${t('moderate.donationTriggersDisabled')}`,
      )
      await loadTriggers()
    }
    setBusy(false)
  }

  async function deleteTrigger(trigger: DonationTriggerRow) {
    const confirmed = await showConfirm({
      title: t('moderate.donationTriggersDeleteConfirmTitle'),
      message: t('moderate.donationTriggersDeleteConfirmMsg', { desc: trigger.description }),
      confirmLabel: t('moderate.donationTriggersDeleteConfirmLabel'),
    })
    if (!confirmed) return
    setBusy(true)
    const { error } = await supabase.from('donation_triggers').delete().eq('id', trigger.id)
    if (error) {
      showToast(`❌ ${t('moderate.donationTriggersErrorDeleting', { msg: error.message })}`)
    } else {
      showToast(`✅ ${t('moderate.donationTriggersDeleted')}`)
      await loadTriggers()
    }
    setBusy(false)
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--box-border)',
    background: 'var(--color-btn-bg)',
    color: 'var(--color-text)',
    fontSize: '0.9rem',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <SubPage>
      <h1>💸 {t('moderate.donationTriggersTitle')}</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '0 0 16px' }}>
        {t('moderate.donationTriggersIntro')}
      </p>

      <button className="btn btn-primary" disabled={busy} onClick={openAdd} style={{ marginBottom: 20 }}>
        ➕ {t('moderate.donationTriggersAdd')}
      </button>

      {triggers.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>{t('moderate.donationTriggersNone')}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--box-border)', textAlign: 'left' }}>
                <th style={{ padding: '8px 6px' }}>{t('moderate.donationTriggersPrice')}</th>
                <th style={{ padding: '8px 6px' }}>{t('moderate.donationTriggersDescription')}</th>
                <th style={{ padding: '8px 6px', width: 80 }}>{t('moderate.donationTriggersSortOrder')}</th>
                <th style={{ padding: '8px 6px', width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((trigger) => (
                <tr
                  key={trigger.id}
                  style={{
                    borderBottom: '1px solid var(--box-border)',
                    opacity: trigger.is_enabled ? 1 : 0.45,
                  }}
                >
                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>{trigger.price}</td>
                  <td style={{ padding: '8px 6px' }}>
                    {trigger.description}
                    {!trigger.is_enabled && (
                      <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--muted)' }}>
                        ({t('moderate.donationTriggersInactive')})
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 6px', opacity: 0.6 }}>{trigger.sort_order}</td>
                  <td style={{ padding: '8px 6px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary"
                        disabled={busy}
                        style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                        onClick={() => openEdit(trigger)}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={busy}
                        style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                        onClick={() => toggleEnabled(trigger)}
                        title={trigger.is_enabled ? t('moderate.donationTriggersDisableBtn') : t('moderate.donationTriggersEnableBtn')}
                      >
                        {trigger.is_enabled ? '⏸️' : '▶️'}
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={busy}
                        style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                        onClick={() => deleteTrigger(trigger)}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ── */}
      <div
        className={`donation-modal ${modalOpen ? 'is-open' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
      >
        {modalOpen && (
          <div className="donation-modal-content" style={{ maxWidth: 500, textAlign: 'left' }}>
            <h2 style={{ marginTop: 0 }}>
              {editId ? t('moderate.donationTriggersEditTitle') : t('moderate.donationTriggersAddTitle')}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 4 }}>
                  {t('moderate.donationTriggersIdLabel')} *
                </div>
                <input
                  style={inputStyle}
                  value={form.trigger_id}
                  disabled={!!editId}
                  placeholder="z.B. knock"
                  onChange={(e) => setForm((f) => ({ ...f, trigger_id: e.target.value }))}
                />
              </label>

              <label>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 4 }}>
                  {t('moderate.donationTriggersPrice')} *
                </div>
                <input
                  style={inputStyle}
                  value={form.price}
                  placeholder="z.B. 4,20€"
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </label>

              <label>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 4 }}>
                  {t('moderate.donationTriggersAmountValue')}
                </div>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount_value ?? ''}
                  placeholder="z.B. 4.20"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount_value: e.target.value === '' ? null : parseFloat(e.target.value) }))
                  }
                />
              </label>

              <label>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 4 }}>
                  {t('moderate.donationTriggersDescription')} *
                </div>
                <input
                  style={inputStyle}
                  value={form.description}
                  placeholder={t('moderate.donationTriggersDescriptionPlaceholder')}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>

              <label>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 4 }}>
                  {t('moderate.donationTriggersText')}
                </div>
                <input
                  style={inputStyle}
                  value={form.trigger_text ?? ''}
                  placeholder={t('moderate.donationTriggersTextPlaceholder')}
                  onChange={(e) => setForm((f) => ({ ...f, trigger_text: e.target.value || null }))}
                />
              </label>

              <label>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 4 }}>
                  {t('moderate.donationTriggersAudioUrl')}
                </div>
                <input
                  style={inputStyle}
                  value={form.audio_url ?? ''}
                  placeholder="/audio/knock.mp3"
                  onChange={(e) => setForm((f) => ({ ...f, audio_url: e.target.value || null }))}
                />
              </label>

              <label>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 4 }}>
                  {t('moderate.donationTriggersSortOrder')}
                </div>
                <input
                  style={inputStyle}
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.is_enabled}
                  onChange={(e) => setForm((f) => ({ ...f, is_enabled: e.target.checked }))}
                />
                {t('moderate.donationTriggersEnabledLabel')}
              </label>
            </div>

            <div className="donation-modal-buttons" style={{ marginTop: 20 }}>
              <button className="btn btn-primary" disabled={busy} onClick={saveTrigger}>
                💾 {t('moderate.donationTriggersSaveBtn')}
              </button>
              <button className="btn btn-secondary" onClick={closeModal}>
                {t('moderate.donationTriggersCancelBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </SubPage>
  )
}
