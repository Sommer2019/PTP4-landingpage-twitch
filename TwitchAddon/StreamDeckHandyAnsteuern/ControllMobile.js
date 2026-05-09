import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';

// 1. Konfiguration
// WICHTIG: Hier muss der SERVICE-ROLE-Key stehen (nicht anon), weil
// redeemed_rewards keine SELECT-Policy fuer anon hat und Realtime
// die gleiche RLS wie SELECT prueft. Bevorzugt via Env-Variable.
// Datei nicht committen, wenn der Key hier hardcoded ist.
const SUPABASE_URL = process.env.SUPABASE_URL
    || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    || '';

// Soft-Check: warnen, wenn ein anon-Key benutzt wird – Realtime liefert dann keine Events.
try {
    const payload = JSON.parse(Buffer.from(SUPABASE_KEY.split('.')[1], 'base64').toString('utf8'));
    if (payload.role !== 'service_role') {
        console.warn(`⚠️ SUPABASE_KEY hat role="${payload.role}" – fuer Realtime auf redeemed_rewards wird service_role benoetigt.`);
    }
} catch {
    console.warn('⚠️ SUPABASE_KEY konnte nicht dekodiert werden – ist der Key korrekt?');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Realtime explizit mit dem Key autorisieren – sonst nutzt der Channel
// in manchen supabase-js Versionen den Default-Anon-JWT und RLS blockt die Events.
supabase.realtime.setAuth(SUPABASE_KEY);

// 2. Deine 6 Tasten (X und Y hier anpassen!)
const buttonMapping = {
    "1": { x: 300, y: 1000 },
    "2": { x: 300, y: 1250 },
    "3": { x: 300, y: 1500 },
    "4": { x: 1700, y: 1000 },
    "5": { x: 1700, y: 1250 },
    "6": { x: 1700, y: 1500 }
};

// Description-Marker: Eintrag in redeemed_rewards mit description "STD_ID_<n>"
// löst die Taste mit der Nummer <n> aus.
const TRIGGER_PATTERN = /^STD_ID_(\d+)$/;

console.log("🚀 Bridge gestartet. Warte auf Supabase-Events...");

function triggerButton(buttonId, source) {
    const coords = buttonMapping[buttonId];
    if (!coords) {
        console.warn(`⚠️ Kein Mapping für Button ${buttonId} (Quelle: ${source})`);
        return;
    }
    console.log(`🎯 Trigger für Button ${buttonId} (Quelle: ${source}). Klicke auf ${coords.x}, ${coords.y}`);
    exec(`adb shell input tap ${coords.x} ${coords.y}`, (error) => {
        if (error) {
            console.error("❌ ADB Fehler:", error.message);
        }
    });
}

// 3. Realtime Subscription auf redeemed_rewards
supabase
    .channel('redeemed-rewards-triggers')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'redeemed_rewards' }, (payload) => {
        console.log(`📨 Event: ${payload.eventType} | description=${JSON.stringify(payload.new && payload.new.description)}`);
        if (payload.eventType !== 'INSERT') return;

        const description = payload.new && typeof payload.new.description === 'string'
            ? payload.new.description.trim()
            : '';
        if (!description) return;

        const match = description.match(TRIGGER_PATTERN);
        if (!match) {
            console.log(`   → Description matcht TRIGGER_PATTERN nicht (${TRIGGER_PATTERN}), ignoriert.`);
            return;
        }

        triggerButton(match[1], `redeemed_rewards.id=${payload.new.id}`);
    })
    .subscribe((status, err) => {
        console.log(`📡 Realtime-Status: ${status}`);
        if (err) console.error('❌ Realtime-Fehler:', err);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('   → Hinweis: redeemed_rewards muss in Supabase unter Database → Replication zur Publikation supabase_realtime hinzugefuegt sein.');
        }
    });

// Verhindert, dass sich das Node-Fenster sofort schließt
process.stdin.resume();
