import {useEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import siteConfig from '../config/siteConfig'
import SubPage from '../components/SubPage/SubPage'
import {supabase} from '../lib/supabase'

interface DbTrigger {
    id: string
    trigger_id: string
    price: string
    amount_value: number | null
    description: string
    trigger_text: string | null
    audio_url: string | null
    is_enabled: boolean
    sort_order: number
}

interface DisplayTrigger {
    id: string
    price: string
    amountValue?: number | null
    description: string
    text?: string | null
    audioUrl?: string | null
}

/**
 * StreamElements-Spendenseite: listet die in der DB aktivierten Donation-Trigger
 * und oeffnet pro Trigger ein Modal mit Beschreibung und optionalem Audio.
 */
export default function StreamelementsPage() {
    const {t} = useTranslation()
    const {donationUrl} = siteConfig.streamelements
    const [activeTrigger, setActiveTrigger] = useState<DisplayTrigger | null>(null)
    const [triggers, setTriggers] = useState<DisplayTrigger[]>([])
    const audioRef = useRef<HTMLAudioElement>(null)

    useEffect(() => {
        const fetchTriggers = async () => {
            try {
                const {data} = await supabase
                    .from('donation_triggers')
                    .select('id, trigger_id, price, amount_value, description, trigger_text, audio_url, is_enabled, sort_order')
                    .eq('is_enabled', true)
                    .order('sort_order')
                const rows = (data ?? []) as DbTrigger[]
                if (rows.length > 0) {
                    setTriggers(
                        rows.map((r) => ({
                            id: r.trigger_id,
                            price: r.price,
                            amountValue: r.amount_value,
                            description: r.description,
                            text: r.trigger_text,
                            audioUrl: r.audio_url,
                        })),
                    )
                }
            } catch (err) {
                console.error('Failed to load donation triggers from DB', err)
                return;
            }
        }
        void fetchTriggers()
    }, [t])

    const openModal = (trigger: DisplayTrigger) => {
        setActiveTrigger(trigger)
    }

    const closeModal = () => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
        }
        setActiveTrigger(null)
    }

    return (
        <SubPage>
            <h1>{t('streamelementsPage.title')}</h1>
            <p>{t('streamelementsPage.intro')}</p>

            <ul className="triggers-list">
                {triggers.map((trigger) => (
                    <li key={trigger.id} className="trigger-item" onClick={() => openModal(trigger)}>
                        <span className="price-badge">{trigger.price}</span>
                        <span className="trigger-desc">{trigger.description}</span>
                    </li>
                ))}
            </ul>

            {/* Donate-Link */}
            <a
                className="se-donate-card"
                href={donationUrl}
                target="_blank"
                rel="noopener noreferrer"
            >
                <img src="/img/logos/StreamElements.webp" alt="StreamElements" className="se-donate-icon"/>
                <div>
                    <strong>StreamElements</strong><br/>
                    <span style={{fontSize: '13px', color: 'var(--muted)'}}>
            {t('streamelementsPage.donateButton')}
          </span>
                </div>
            </a>

            {/* Audio-Detail-Modal */}
            <div
                className={`donation-modal ${activeTrigger ? 'is-open' : ''}`}
                onClick={(e) => {
                    if (e.target === e.currentTarget) closeModal()
                }}
            >
                {activeTrigger && (
                    <div className="donation-modal-content">
                        <h2>{activeTrigger.description}</h2>
                        {activeTrigger.text && <p>{activeTrigger.text}</p>}
                        {activeTrigger.audioUrl && (
                            <audio ref={audioRef} controls preload="none" src={activeTrigger.audioUrl}/>
                        )}
                        <div className="donation-modal-buttons">
                            <button className="btn btn-primary" onClick={closeModal}>
                                {t('streamelementsPage.close')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </SubPage>
    )
}
