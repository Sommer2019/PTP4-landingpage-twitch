import { useEffect, useState } from 'react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import siteConfig from '../../config/siteConfig'
import SubPage from '../../components/SubPage/SubPage'
import ICAL from 'ical.js'
import { format, isSameDay, startOfDay, addDays } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { FiInfo, FiCheck, FiCopy } from 'react-icons/fi'
import './StreamplanPage.css'

interface CalendarEvent {
  id: string
  title: string
  description?: string
  startDate: Date
  endDate: Date
  location?: string
  categoryId: number
  color: string
}

/**
 * Streamplan-Seite: laedt die Kategorie-Kalender (ICS) ueber den lokalen Proxy,
 * gruppiert kommende Termine nach Tag und erlaubt Filtern nach Kategorie.
 */
export default function StreamplanPage() {
  const { t, i18n } = useTranslation()
  const { categories, icsUrl } = siteConfig.streamplan

  const [showIcalHint, setShowIcalHint] = useState(false)
  const [copied, setCopied] = useState(false)
  const icsInputRef = useRef<HTMLInputElement>(null)

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilters, setActiveFilters] = useState<number[]>([]) // leer = Alle
  const [expanded, setExpanded] = useState(false)

  // Schweizerdeutsch (gsw) nutzt ebenfalls das deutsche Datumsformat.
  const dateLocale = i18n.language?.startsWith('de') || i18n.language?.startsWith('gsw') ? de : enUS

  useEffect(() => {
    async function fetchCalendars() {
      setLoading(true)
      const allEvents: CalendarEvent[] = []

      // Alle Kategorie-ICS-Dateien parallel laden
      const promises = categories.map(async (cat) => {
        try {
          // Lokalen Proxy-Pfad aus vite.config.ts verwenden (CORS vermeiden)
          // Das Vite-Plugin leitet diese auf externe URLs um oder liefert kompilierte Assets.
          const localUrl = `/api/calendar-${cat.id}.ics`
          
          const response = await fetch(localUrl)
          if (!response.ok) {
            console.error(`Fehler beim Laden der ICS-Datei für Kategorie ${cat.id}: Netzwerkantwort nicht ok`)
            return
          }
          const icsData = await response.text()

          const jcalData = ICAL.parse(icsData)
          const comp = new ICAL.Component(jcalData)
          const vevents = comp.getAllSubcomponents('vevent')

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          vevents.forEach((vevent: any) => {
            const event = new ICAL.Event(vevent)
            
            // Datumsverarbeitung: event.startDate ist ein ICAL.Time-Objekt
            const startDate = event.startDate.toJSDate()
            const endDate = event.endDate.toJSDate()

            allEvents.push({
              id: `${event.uid}-${cat.id}`,
              title: event.summary,
              description: event.description,
              startDate,
              endDate,
              location: event.location,
              categoryId: cat.id,
              color: cat.color,
            })
          })
        } catch (error) {
          console.error(`Fehler beim Laden/Parsen der ICS-Datei für Kategorie ${cat.id}:`, error)
        }
      })

      await Promise.all(promises)

      // Nach Startdatum sortieren
      allEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      
      // Vergangene Events herausfiltern (älter als heute)
      const todayStart = startOfDay(new Date())
      const upcomingEvents = allEvents.filter(e => e.endDate >= todayStart)

      setEvents(upcomingEvents)
      setLoading(false)
    }

    fetchCalendars()
  }, [categories]) // Kategorien aus der Config sind konstant

  const toggleFilter = (catId: number, event: React.MouseEvent<HTMLButtonElement>) => {
    // Wenn Shift gedrückt ist und aktuell "Alle" (leeres Array) aktiv sind:
    // Wähle ALLE Kategorien aus, außer der angeklickten.
    if (event.shiftKey && activeFilters.length === 0) {
      const allIds = categories.map((c) => c.id)
      setActiveFilters(allIds.filter((id) => id !== catId))
      return
    }

    setActiveFilters((prev) => {
      let nextFilters: number[]
      if (prev.includes(catId)) {
        nextFilters = prev.filter(id => id !== catId)
      } else {
        nextFilters = [...prev, catId]
      }

      // Wenn alle Kategorien ausgewählt wären, reset auf "Alle" (leeres Array)
      if (nextFilters.length === categories.length) {
        return []
      }

      return nextFilters
    })
  }

  // Events anhand aktiver Filter einschränken
  const filteredEvents = activeFilters.length === 0
    ? events
    : events.filter(e => activeFilters.includes(e.categoryId))

  // Auf 14 Tage begrenzen, wenn nicht ausgeklappt
  const today = new Date()
  const limitDate = addDays(today, 14)
  
  const eventsIn14Days = filteredEvents.filter(e => e.startDate <= limitDate)
  const showExpandButton = filteredEvents.length > eventsIn14Days.length

  const displayedEvents = expanded ? filteredEvents : eventsIn14Days

  // Events nach Tag gruppieren
  const groupedEvents: { date: Date; events: CalendarEvent[] }[] = []
  
  displayedEvents.forEach(event => {
    const lastGroup = groupedEvents[groupedEvents.length - 1]
    if (lastGroup && isSameDay(lastGroup.date, event.startDate)) {
      lastGroup.events.push(event)
    } else {
      groupedEvents.push({ date: event.startDate, events: [event] })
    }
  })


  return (
    <SubPage>
      <div style={{ position: 'relative' }}>
        <h1>{t('streamplanPage.title')}</h1>
        {/* ICS-Link Hinweis oben rechts */}
        <div className="streamplan-ical-hint">
          <button
            aria-label={t('streamplanPage.icalHint.title')}
            className="ical-hint-btn"
            onClick={() => setShowIcalHint(true)}
            title={t('streamplanPage.icalHint.title')}
          >
            <FiInfo size={22} style={{ filter: 'drop-shadow(0 0 2px #0002)' }} />
          </button>
        </div>
        {/* Modal/Popup */}
        {showIcalHint && (
          <div
            className="streamplan-ical-modal"
            onClick={() => setShowIcalHint(false)}
            tabIndex={-1}
            aria-modal="true"
            role="dialog"
          >
            <div
              className="ical-modal-content"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setShowIcalHint(false)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }} aria-label={t('common.close')}>×</button>
              <h2 style={{ marginTop: 0 }}>{t('streamplanPage.icalHint.title')}</h2>
              <p>{t('streamplanPage.icalHint.desc')}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input
                  ref={icsInputRef}
                  type="text"
                  value={icsUrl}
                  readOnly
                  style={{ flex: 1, padding: 6, borderRadius: 4, fontSize: 14 }}
                  onFocus={e => e.target.select()}
                />
                <button
                  className="ical-copy-btn"
                  onClick={() => {
                    if (icsInputRef.current) {
                      icsInputRef.current.select()
                      document.execCommand('copy')
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1200)
                    }
                  }}
                  aria-label={t('streamplanPage.icalHint.copy')}
                >
                  {copied ? <FiCheck color="#2ecc40" /> : <FiCopy />}
                </button>
              </div>
              <div style={{ fontSize: 13, color: 'inherit', marginBottom: 8 }}>
                <div style={{ marginBottom: 4 }}><b>Google:</b> {t('streamplanPage.icalHint.google')}</div>
                <div><b>Apple:</b> {t('streamplanPage.icalHint.apple')}</div>
              </div>
            </div>
          </div>
        )}
      </div>
      <p>{t('streamplanPage.intro')}</p>

      {/* Filter UI */}
      <div className="streamplan-filters">
        <div className="filter-label">{t('streamplanPage.filter')}:</div>
        <button
          className={`filter-btn ${activeFilters.length === 0 ? 'active' : ''}`}
          onClick={() => setActiveFilters([])}
        >
          {t('streamplanPage.all')}
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`filter-btn ${activeFilters.includes(cat.id) ? 'active' : ''}`}
            style={{ 
              borderColor: cat.color,
              backgroundColor: activeFilters.includes(cat.id) ? cat.color : 'transparent',
              color: activeFilters.includes(cat.id) ? '#fff' : 'inherit'
            }}
            onClick={(e) => toggleFilter(cat.id, e)}
          >
            {t(cat.labelKey)}
          </button>
        ))}
      </div>

      {loading && <div className="loading-spinner">{t('auth.loading')}</div>}

      <div className="streamplan-list">
        {groupedEvents.map((group, index) => (
          <div key={index} className="day-group">
            <h3 className="day-header">
              {format(group.date, 'EEEE, d. MMMM', { locale: dateLocale })}
            </h3>
            <div className="events-grid">
              {group.events.map(event => (
                <div 
                  key={event.id} 
                  className="event-card"
                  style={{ borderLeftColor: event.color }}
                >
                  <div className="event-time">
                    {format(event.startDate, 'HH:mm')} – {format(event.endDate, 'HH:mm')}
                  </div>
                  <div className="event-details">
                    <div className="event-title">{event.title}</div>
                    {event.description && <div className="event-desc">{event.description}</div>}
                    <div className="event-category-badge" style={{ backgroundColor: event.color }}>
                      {t(categories.find(c => c.id === event.categoryId)?.labelKey || '')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {!loading && groupedEvents.length === 0 && (
          <div className="no-events">{t('streamplanPage.noEvents')}</div>
        )}

        {showExpandButton && (
          <div className="streamplan-expand-container" style={{ marginTop: '20px', textAlign: 'center' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? t('streamplanPage.showLess') : t('streamplanPage.showMore', { count: filteredEvents.length - eventsIn14Days.length })}
            </button>
          </div>
        )}
      </div>
    </SubPage>
  )
}
