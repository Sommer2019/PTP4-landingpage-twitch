# Kanalpunkte – Twitch Extension Setup

Diese Anleitung beschreibt, wie du die **Kanalpunkte-Extension** als Twitch Panel Extension in deinem Kanal einbindest.

> **Hinweis:** Der Bot läuft auf deinem lokalen Rechner (`localhost:8081`) als Bun-Prozess — ~40–60 MB RAM statt ~350 MB mit Java.  
> Da Twitch Extensions ausschließlich HTTPS-Verbindungen erlauben, wird der lokale Bot über einen **ngrok-Tunnel** nach außen erreichbar gemacht.

---

## Voraussetzungen

| Anforderung | Details |
|---|---|
| [Bun](https://bun.sh) ≥ 1.0 | Laufzeitumgebung (ersetzt Java + Maven) |
| [ngrok](https://ngrok.com) | Um den lokalen Bot per HTTPS erreichbar zu machen |
| Supabase-Projekt | Mit den nötigen Tabellen (`points`, `rewards`, `redeemed_rewards`, …) |
| Twitch Developer Account | Für die Extension-Registrierung |

---

## 1. Bot konfigurieren

Kopiere die Beispiel-Umgebungsdatei und fülle alle Werte aus:

```bash
cp TwitchAddon/.env.example TwitchAddon/.env
```

```dotenv
SUPABASE_URL=https://<dein-projekt>.supabase.co
SUPABASE_API_KEY=<dein-supabase-service-key>
TWITCH_OAUTH_TOKEN=oauth:<dein-twitch-oauth-token>
TWITCH_CLIENT_ID=<deine-twitch-client-id>
TWITCH_CLIENT_SECRET=<dein-twitch-client-secret>
TWITCH_REFRESH_TOKEN=<dein-twitch-refresh-token>
CHANNEL_NAME=<dein-kanalname>

# Twitch Extension
EXTENSION_CLIENT_ID=<extension-client-id-aus-dem-twitch-developer-dashboard>
EXTENSION_SECRET=<base64-extension-secret-aus-dem-twitch-developer-dashboard>
```

---

## 2. Bot lokal starten

```bash
cd TwitchAddon
bun run index.ts
```

Der Bot startet den HTTP-Server auf `http://localhost:8081` und läuft solange das Terminal offen ist.

---

## 3. ngrok-Tunnel einrichten

Da der Bot lokal läuft, muss er über einen HTTPS-Tunnel für Twitch erreichbar gemacht werden.  
Starte ngrok in einem **zweiten Terminal**:

```bash
ngrok http 8081
```

Notiere die generierte HTTPS-URL, z.B.:

```
https://abc123.ngrok-free.app
```

---

## 4. Twitch Extension registrieren

1. Öffne das [Twitch Developer Dashboard](https://dev.twitch.tv/console/extensions)
2. Klicke auf **„Create Extension"**
3. Wähle als **Extension Type**: `Panel`  
   *(optional: auch „Mobile" aktivieren)*
4. Setze die **Testing Base URI** auf deine HTTPS-URL (z.B. `https://abc123.ngrok-free.app`)
5. Trage die folgenden Pfade ein:

| Feld | Wert |
|---|---|
| Panel Viewer Path | `/extension/panel.html` |
| Config Path | `/extension/config.html` |
| Mobile Path | `/extension/mobile.html` |

6. Notiere die **Extension Client ID** und trage sie in deine `.env` ein (`EXTENSION_CLIENT_ID`)

---

## 5. Extension in deinem Kanal aktivieren

1. Öffne dein [Creator Dashboard](https://dashboard.twitch.tv)
2. Navigiere zu **Extensions → Meine Extensions**
3. Finde deine neu registrierte Extension und klicke auf **Aktivieren**
4. Wähle **„Als Panel aktivieren"**

---

## 6. API-Endpunkte (Referenz)

Der Java-Bot läuft lokal und stellt folgende Endpunkte unter `http://localhost:8081` bereit (über ngrok auch per HTTPS erreichbar):

| Endpunkt | Methode | Beschreibung |
|---|---|---|
| `/api/points?user_id=<twitch_user_id>` | GET | Punktestand eines Zuschauers |
| `/api/leaderboard?limit=10` | GET | Top-N-Rangliste |
| `/api/rewards` | GET | Alle verfügbaren Rewards |
| `/api/redeemed_rewards` | GET / DELETE | Eingelöste Rewards (Overlay) |
| `/extension/panel.html` | GET | Twitch Extension – Panel-Ansicht |
| `/extension/config.html` | GET | Twitch Extension – Broadcaster-Konfiguration |
| `/extension/mobile.html` | GET | Twitch Extension – Mobile-Ansicht |
| `/overlay.html` | GET | OBS-Browser-Source Overlay |

---

## 7. Produktionsbetrieb (optional – eigener Server)

Der Bot kann statt auf localhost auch dauerhaft auf einem Linux-Server laufen.  
In diesem Fall entfällt ngrok und du verwendest stattdessen einen Reverse Proxy:

### systemd Service

Erstelle `/etc/systemd/system/channelpointsbot.service`:

```ini
[Unit]
Description=PTP Kanalpunkte Bot
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/channelpointsbot
ExecStart=/usr/local/bin/bun run /opt/channelpointsbot/index.ts
Restart=always
EnvironmentFile=/opt/channelpointsbot/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now channelpointsbot
```

### nginx Reverse Proxy (HTTPS)

```nginx
server {
    listen 443 ssl;
    server_name dein-server.example.com;

    ssl_certificate     /etc/letsencrypt/live/dein-server.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dein-server.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Docker (optional)

```bash
docker-compose up -d
```

Die `docker-compose.yml` im Repository-Root startet Bot und Supabase gemeinsam.

---

## Troubleshooting

| Problem | Lösung |
|---|---|
| Extension zeigt „⚠️ Extension benötigt HTTPS" | ngrok muss laufen und die Testing Base URI muss die ngrok-HTTPS-URL sein |
| Bot nicht erreichbar | Prüfe ob `bun run index.ts` noch im Terminal läuft und Port `8081` frei ist |
| Punkte werden nicht angezeigt | Prüfe ob `SUPABASE_URL` und `SUPABASE_API_KEY` korrekt gesetzt sind |
| CORS-Fehler in der Browser-Konsole | Stelle sicher, dass die Extension über `*.twitch.tv` oder `*.ext-twitch.tv` geladen wird |
| Bot startet nicht | Bun installiert? `bun --version` prüfen |
| OAuth-Token abgelaufen | `TWITCH_REFRESH_TOKEN` setzen, Bot erneuert Token automatisch alle 2 Stunden |
| JWT-Verifikation schlägt fehl | `EXTENSION_SECRET` muss dem Base64-kodierten Secret aus dem Twitch Developer Dashboard entsprechen |
| ngrok-URL ändert sich | Nach jedem ngrok-Neustart die Testing Base URI im Twitch Developer Dashboard aktualisieren |
