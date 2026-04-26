import * as fs from 'fs'
import {createClient} from '@supabase/supabase-js'

// ── Umgebungsvariablen ──
// Müssen als GitHub Secrets gesetzt sein
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TWITCH_CLIENT_ID = process.env.VITE_TWITCH_CLIENT_ID
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET
const TWITCH_REFRESH_TOKEN = process.env.TWITCH_REFRESH_TOKEN
const CHANNEL_NAME = process.env.CHANNEL_NAME

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TWITCH_REFRESH_TOKEN || !CHANNEL_NAME) {
    console.error('Umgebungsvariablen fehlen. Bitte GitHub Secrets prüfen.')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ── Typen ──
interface TwitchUser {
    id: string;
    login: string;
    display_name: string
}

interface TwitchMod {
    user_id: string;
    user_name: string
}

// ── Hilfsfunktionen ──

async function getAccessToken() {
    console.log('Twitch-Token wird erneuert...')
    const params = new URLSearchParams()
    params.append('client_id', TWITCH_CLIENT_ID!)
    params.append('client_secret', TWITCH_CLIENT_SECRET!)
    params.append('grant_type', 'refresh_token')
    params.append('refresh_token', TWITCH_REFRESH_TOKEN!)

    const res = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        body: params,
    })

    if (!res.ok) {
        throw new Error(`Token-Erneuerung fehlgeschlagen: ${await res.text()}`)
    }

    const data = await res.json()

    // Logik-Update:
    // Falls Twitch einen neuen schickt, nimm den. Ansonsten nimm den alten aus den Env-Vars.
    const finalRefreshToken = data.refresh_token || TWITCH_REFRESH_TOKEN;

    if (process.env.GITHUB_OUTPUT) {
        // Wir schreiben den Token IMMER raus.
        // Wenn er gleich geblieben ist, überschreibt GitHub das Secret einfach mit demselben Wert.
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_refresh_token=${finalRefreshToken}\n`);
        console.log(data.refresh_token ? "Neuer Refresh-Token erhalten." : "Alten Refresh-Token beibehalten.");
    }

    return data.access_token as string
}


async function twitchGet<T>(endpoint: string, token: string): Promise<T> {
    const res = await fetch(`https://api.twitch.tv/helix/${endpoint}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Client-Id': TWITCH_CLIENT_ID!,
        },
    })
    if (!res.ok) {
        const text = await res.text()
        // Bei 401: Token abgelaufen – Script schlägt fehl, nächster Lauf erneuert automatisch
        throw new Error(`Twitch API Fehler ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
}

// ── Hauptlogik ──

async function main() {
    try {
        const accessToken = await getAccessToken()

        // 1. Broadcaster-ID ermitteln
        const users = await twitchGet<{ data: TwitchUser[] }>(`users?login=${CHANNEL_NAME}`, accessToken)
        const broadcaster = users.data[0]
        if (!broadcaster) throw new Error(`Broadcaster ${CHANNEL_NAME} nicht gefunden`)

        console.log(`Broadcaster: ${broadcaster.display_name} (${broadcaster.id})`)

        // ── MODS SYNCHRONISIEREN ──
        console.log('Moderatoren werden abgerufen...')
        const mods: TwitchMod[] = []
        let cursor = ''
        do {
            const p = new URLSearchParams({broadcaster_id: broadcaster.id, first: '100'})
            if (cursor) p.set('after', cursor)

            const page = await twitchGet<{ data: TwitchMod[]; pagination: { cursor?: string } }>(
                `moderation/moderators?${p}`, accessToken
            )
            mods.push(...page.data)
            cursor = page.pagination?.cursor || ''
        } while (cursor)

        console.log(`${mods.length} Moderatoren gefunden.`)

        // RPC `sync_moderators` synchronisiert auch entfernte Mods.
        // Erwartet `p_mods` als JSON-Array.
        const modsPayload = [
            {user_id: broadcaster.id, user_name: broadcaster.display_name}, // Broadcaster als Mod hinzufügen
            ...mods
        ]

        const {error: modError, data: modResult} = await supabase.rpc('sync_moderators', {
            p_mods: modsPayload,
            p_broadcaster_twitch_id: broadcaster.id
        })

        if (modError) {
            console.error('Supabase sync_moderators fehlgeschlagen:', modError)
        } else {
            console.log('Moderatoren synchronisiert:', modResult)
        }

        // ── VIPs & ABONNENTEN SYNCHRONISIEREN (OnlyBart) ──
        console.log('VIPs werden abgerufen...')
        const vips: string[] = []
        cursor = ''
        try {
            do {
                const p = new URLSearchParams({broadcaster_id: broadcaster.id, first: '100'})
                if (cursor) p.set('after', cursor)
                const page = await twitchGet<{ data: { user_id: string }[], pagination: { cursor?: string } }>(
                    `channels/vips?${p}`, accessToken
                )
                vips.push(...page.data.map(v => v.user_id))
                cursor = page.pagination?.cursor || ''
            } while (cursor)
        } catch (e) {
            console.warn('Fehler beim Abrufen der VIPs (fehlender Scope?):', e)
        }

        console.log(`${vips.length} VIPs gefunden.`)

        console.log('Abonnenten werden abgerufen...')
        const subs: string[] = []
        cursor = ''
        try {
            do {
                const p = new URLSearchParams({broadcaster_id: broadcaster.id, first: '100'})
                if (cursor) p.set('after', cursor)
                const page = await twitchGet<{ data: { user_id: string }[], pagination: { cursor?: string } }>(
                    `subscriptions?${p}`, accessToken
                )
                subs.push(...page.data.map(u => u.user_id))
                cursor = page.pagination?.cursor || ''
            } while (cursor)
        } catch (e) {
            console.warn('Fehler beim Abrufen der Abonnenten (fehlender Scope?):', e)
        }

        console.log(`${subs.length} Abonnenten gefunden.`)

        // VIPs und Abonnenten in `twitch_permissions` zusammenführen und speichern
        const uniqueIds = new Set([...vips, ...subs])
        const updates = Array.from(uniqueIds).map(id => ({
            twitch_id: id,
            is_vip: vips.includes(id),
            is_subscriber: subs.includes(id),
            last_updated: new Date().toISOString()
        }))

        console.log(`${updates.length} Berechtigungseinträge werden aktualisiert...`)

        // Batch-Upsert – Supabase verarbeitet große Batches gut, sicherheitshalber aufgeteilt
        const BATCH_SIZE = 1000
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
            const batch = updates.slice(i, i + BATCH_SIZE)
            const {error} = await supabase.from('twitch_permissions').upsert(batch, {onConflict: 'twitch_id'})
            if (error) {
                console.error('Fehler beim Batch-Upsert der Berechtigungen:', error)
                throw error // Action fehlschlagen lassen
            }
        }

        console.log('Synchronisierung erfolgreich abgeschlossen.')
        process.exit(0)
    } catch (err) {
        console.error('Script fehlgeschlagen:', err)
        process.exit(1)
    }
}

main()
