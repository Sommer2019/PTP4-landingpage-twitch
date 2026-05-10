import { createClient } from '@supabase/supabase-js';
import { exec, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// 1. Konfiguration
// Werte werden in der CI-Pipeline beim `bun --compile`-Build als String-Konstanten
// in die EXE eingebaut (siehe .github/workflows/pipeline.yml, Step "Build EXEs").
// Lokales Dev: per Env-Var setzen, dann `node ControllMobile.js`.
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ── File-Logging (EXE läuft windowless, console.* hat sonst keine Senke) ──
const exeDir = path.dirname(process.execPath);
const logPath = path.join(exeDir, 'controll-mobile.log');
try {
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const ts = () => new Date().toISOString();
    const origLog = console.log.bind(console);
    const origErr = console.error.bind(console);
    const origWarn = console.warn.bind(console);
    const fmt = (args) => args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    console.log  = (...a) => { logStream.write(`${ts()}      ${fmt(a)}\n`); origLog(...a); };
    console.warn = (...a) => { logStream.write(`${ts()} WARN ${fmt(a)}\n`); origWarn(...a); };
    console.error = (...a) => { logStream.write(`${ts()} ERR  ${fmt(a)}\n`); origErr(...a); };
} catch { /* Log-Setup fail darf das Skript nicht stoppen */ }

// ── Autostart-Verwaltung ─────────────────────────────────────────────────
// Lege bei jedem Start einen .lnk im Windows-Startup-Ordner an, falls nicht
// vorhanden. Mit `--uninstall` wird der Eintrag wieder entfernt.
const startupDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const shortcutPath = path.join(startupDir, 'ControllMobile.lnk');

function runPowerShell(script) {
    // -NoProfile + Base64-encoded Command vermeidet Quoting-Probleme bei Pfaden mit Leerzeichen.
    const b64 = Buffer.from(script, 'utf16le').toString('base64');
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', b64], { stdio: 'pipe' });
}

function ensureAutostartShortcut() {
    if (process.platform !== 'win32') return;
    try {
        if (fs.existsSync(shortcutPath)) return;
        if (!fs.existsSync(startupDir)) fs.mkdirSync(startupDir, { recursive: true });
        const target = process.execPath;
        const workDir = path.dirname(target);
        runPowerShell(
            `$ws = New-Object -ComObject WScript.Shell;` +
            `$sc = $ws.CreateShortcut('${shortcutPath.replace(/'/g, "''")}');` +
            `$sc.TargetPath = '${target.replace(/'/g, "''")}';` +
            `$sc.WorkingDirectory = '${workDir.replace(/'/g, "''")}';` +
            `$sc.WindowStyle = 7;` +
            `$sc.Description = 'ControllMobile Bridge';` +
            `$sc.Save();`
        );
        console.log('Autostart-Eintrag angelegt:', shortcutPath);
    } catch (e) {
        console.error('Konnte Autostart nicht einrichten:', e.message || e);
    }
}

function removeAutostartShortcut() {
    if (process.platform !== 'win32') return false;
    try {
        if (fs.existsSync(shortcutPath)) {
            fs.unlinkSync(shortcutPath);
            console.log('Autostart-Eintrag entfernt:', shortcutPath);
            return true;
        }
        console.log('Kein Autostart-Eintrag vorhanden:', shortcutPath);
        return false;
    } catch (e) {
        console.error('Konnte Autostart nicht entfernen:', e.message || e);
        return false;
    }
}

if (process.argv.includes('--uninstall')) {
    removeAutostartShortcut();
    process.exit(0);
}

ensureAutostartShortcut();

// ── Soft-Check: warnen, wenn ein anon-Key benutzt wird ─────────────────────
try {
    const payload = JSON.parse(Buffer.from(SUPABASE_KEY.split('.')[1], 'base64').toString('utf8'));
    if (payload.role !== 'service_role') {
        console.warn(`SUPABASE_KEY hat role="${payload.role}" – fuer Realtime auf redeemed_rewards wird service_role benoetigt.`);
    }
} catch {
    console.warn('SUPABASE_KEY konnte nicht dekodiert werden – ist der Key korrekt?');
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

console.log("Bridge gestartet. Warte auf Supabase-Events...");

function triggerButton(buttonId, source) {
    const coords = buttonMapping[buttonId];
    if (!coords) {
        console.warn(`Kein Mapping für Button ${buttonId} (Quelle: ${source})`);
        return;
    }
    console.log(`Trigger für Button ${buttonId} (Quelle: ${source}). Klicke auf ${coords.x}, ${coords.y}`);
    exec(`adb shell input tap ${coords.x} ${coords.y}`, (error) => {
        if (error) {
            console.error("ADB Fehler:", error.message);
        }
    });
}

// 3. Realtime Subscription auf redeemed_rewards
supabase
    .channel('redeemed-rewards-triggers')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'redeemed_rewards' }, (payload) => {
        console.log(`Event: ${payload.eventType} | description=${JSON.stringify(payload.new && payload.new.description)}`);
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
        console.log(`Realtime-Status: ${status}`);
        if (err) console.error('Realtime-Fehler:', err);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('   → Hinweis: redeemed_rewards muss in Supabase unter Database → Replication zur Publikation supabase_realtime hinzugefuegt sein.');
        }
    });

// Verhindert, dass sich der Prozess sofort beendet
process.stdin.resume();
