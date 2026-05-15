# Kanalpunkte – Twitch Extension Setup

Diese Anleitung beschreibt, wie du die **Kanalpunkte-Extension** als Twitch Panel
Extension in deinem Kanal einbindest.

> Der Bot läuft **lokal auf dem Streamer-PC** als selbst-gepackte EXE
> (~40–60 MB RAM). Die EXE öffnet beim Start automatisch einen ngrok-Tunnel mit
> einer **festen** Static-Domain — diese Domain trägst du einmalig in der
> Twitch-Extension-Allowlist ein, danach passt der Streamer nichts mehr an.

---

## Voraussetzungen

| Anforderung | Details |
|---|---|
| [ngrok](https://ngrok.com)-Konto | Free reicht — eine Static-Domain ist enthalten |
| Supabase-Projekt | Mit den nötigen Tabellen (`points`, `rewards`, `redeemed_rewards`, …) |
| Twitch Developer Account | Für die Extension-Registrierung |

Für die EXE-Nutzung selbst muss **nichts** installiert sein — alle Abhängigkeiten
inkl. `ngrok.exe` sind im Release-ZIP enthalten. Bun + ngrok-CLI brauchst du nur
für die lokale Dev-Variante (Schritt 5).

---

## 1. Einmaliges Dev-Setup

### 1a. ngrok-Static-Domain reservieren

1. Konto auf [ngrok.com](https://ngrok.com) anlegen.
2. Im Dashboard unter **Cloud Edge → Domains** eine Static-Domain reservieren
   (Free-Plan enthält eine, z.B. `dein-name.ngrok-free.app`).
3. Den **Authtoken** kopieren (Dashboard → "Your Authtoken").

### 1b. GitHub-Secrets setzen

In den Repository-Secrets eintragen:

| Secret | Wert |
|---|---|
| `NGROK_AUTHTOKEN` | dein ngrok Authtoken |
| `NGROK_DOMAIN` | `dein-name.ngrok-free.app` (ohne `https://`-Präfix) |

Bei jedem Push auf `master`/`main` baut die Pipeline `TwitchAddon-Release.zip`
mit `TwitchAddon.exe` + `ngrok.exe` + `.env` darin. Authtoken und Domain werden
beim Bauen als Konstanten in die EXE eingebacken.

---

## 2. Twitch Extension registrieren (einmalig)

1. Öffne das [Twitch Developer Dashboard](https://dev.twitch.tv/console/extensions)
2. **Create Extension** → **Extension Type**: `Panel` (optional zusätzlich „Mobile")
3. **Testing Base URI**: `https://<NGROK_DOMAIN>` (genau die in den Secrets hinterlegte Domain)
4. Pfade eintragen:

| Feld | Wert |
|---|---|
| Panel Viewer Path | `/extension/panel.html` |
| Config Path | `/extension/config.html` |
| Mobile Path | `/extension/mobile.html` |

5. **Capabilities → Allowlist for URLs Fetched by the Frontend**:
   `https://<NGROK_DOMAIN>` eintragen — sonst blockiert Twitch die fetch-Requests.
6. **Extension Client ID** kopieren → als GitHub-Secret `EXTENSION_CLIENT_ID`.
7. **Extension Secret** (Base64) kopieren → als GitHub-Secret `EXTENSION_SECRET`.

### Extension im Kanal aktivieren

1. [Creator Dashboard](https://dashboard.twitch.tv) → **Extensions → Meine Extensions**
2. Neu registrierte Extension finden → **Aktivieren** → **Als Panel aktivieren**

---

## 3. Streamer-Nutzung

1. `TwitchAddon-Release.zip` aus dem aktuellen GitHub-Release herunterladen.
2. In einen festen Ordner entpacken (z.B. `C:\TwitchAddon\`).
3. `TwitchAddon.exe` doppelklicken — fertig.

Die EXE startet den lokalen HTTP-Server auf Port 8081 und öffnet den ngrok-Tunnel
auf die feste Domain. Im Konsolenfenster steht eine Zeile wie
`[Tunnel] Öffentlich erreichbar unter https://...`.

Wenn die EXE nicht läuft oder der Stream offline ist, zeigt die Twitch-Extension
automatisch eine rote Offline-Meldung („🔴 Der Streamer ist gerade offline …").

---

## 4. API-Endpunkte (Referenz)

Die EXE stellt unter `http://localhost:8081` (= `https://<NGROK_DOMAIN>` extern)
folgende Endpunkte bereit:

| Endpunkt | Methode | Beschreibung |
|---|---|---|
| `/api/points?user_id=<twitch_user_id>` | GET | Punktestand eines Zuschauers |
| `/api/leaderboard?limit=10` | GET | Top-N-Rangliste |
| `/api/rewards` | GET / POST / PATCH / DELETE | Verfügbare Rewards (Schreiben nur Broadcaster-JWT) |
| `/api/redeem` | POST | Reward einlösen (mit Extension-JWT) |
| `/api/redeemed_rewards` | GET / DELETE | Eingelöste Rewards (Overlay) |
| `/api/stream_status` | GET | `{online: true/false}` — Basis der Offline-Anzeige in der Extension |
| `/extension/panel.html` etc. | GET | Twitch Extension Testing-Pfade |
| `/overlay.html` | GET | OBS-Browser-Source Overlay |

---

## 5. Lokal ohne EXE (Dev)

Für lokale Entwicklung direkt mit Bun:

```bash
cd TwitchAddon
cp .env.example .env
# .env mit deinen Werten befüllen (inkl. NGROK_AUTHTOKEN/NGROK_DOMAIN)
bun install
bun run index.ts
```

Ohne `NGROK_AUTHTOKEN`/`NGROK_DOMAIN` läuft der Server nur unter
`http://localhost:8081` — nützlich für interne Tests, aber die Twitch-Extension
erreicht ihn dann nicht.

---

## Troubleshooting

| Problem | Lösung |
|---|---|
| Extension zeigt „Streamer offline" obwohl du live bist | EXE läuft? Konsolenausgabe prüfen — bei `[Tunnel] ngrok beendet …` ist der Authtoken falsch oder die Static-Domain nicht reserviert |
| Extension lädt gar nichts (CORS / Fetch blockiert) | `NGROK_DOMAIN` muss in der Twitch-Extension unter **Capabilities → URLs Fetched by Frontend** eingetragen sein |
| EXE startet nicht | Defender / SmartScreen blockiert ggf. eine unsignierte EXE — einmalig „Trotzdem ausführen" |
| OAuth-Token abgelaufen | `TWITCH_REFRESH_TOKEN` setzen, EXE erneuert den Token automatisch bei 401 |
| JWT-Verifikation schlägt fehl | `EXTENSION_SECRET` muss dem Base64-kodierten Secret aus dem Twitch Developer Dashboard entsprechen |
| ngrok-Limit erreicht (zu viele Verbindungen) | Im Free-Plan ist die parallele Verbindungsanzahl begrenzt — bei großen Streams Paid-Plan oder eigenen Tunnel-Anbieter |
