# 🛠️ Setup-Anleitung – Twitch Streamer Landing Page

Dieses Repo ist ein vollständiger Baukasten für eine Twitch-Streamer-Landingpage.  
Alles Streamer-spezifische ist in **einer** Config-Datei (`src/config/siteConfig.ts`) und den **Sprachdateien** (`src/i18n/locales/de.json` etc.) konzentriert.

---

## Was du bekommst

| Modul | Enthalten | Anforderung |
|---|---|---|
| Landingpage (React, GitHub Pages) | ✅ | GitHub-Account |
| Streamplan (ICS-Kalender) | ✅ | kalender.digital-Account |
| Clip-Voting (Monat/Jahr) | ✅ | Supabase |
| OnlyBart (Premium-Bereich) | ✅ | Supabase + Twitch OAuth |
| Bartclicker-Spiel | ✅ | Supabase |
| Moderatoren-Dashboard | ✅ | Supabase + Twitch OAuth |
| Kanalpunkte-Bot + Extension | ✅ (TwitchAddon) | Railway **oder** lokale EXE |
| Discord-Benachrichtigungen | ✅ (DiscordBot) | Render **oder** lokal (optional) |

---

## Schnellstart-Checkliste

Ohne Supabase läuft die Seite bereits als statische Linkpage auf GitHub Pages.  
Mit Supabase kommen Login, Voting, OnlyBart und das Bartclicker-Spiel dazu.

```
[ ] 1. Repo forken & klonen
[ ] 2. Setup-Assistent ausführen (node setup.mjs)
[ ] 3. Links, Partner und Weiterleitungen in siteConfig.ts anpassen
[ ] 4. Bilder ersetzen (Profil, Logos)
[ ] 5. Twitch App erstellen → client_id + client_secret besorgen
[ ] 6. Supabase-Projekt erstellen → SQL-Migration ausführen
[ ] 7. GitHub Secrets eintragen
[ ] 8. GitHub Pages aktivieren
[ ] --
[ ] 9. (Optional) TwitchAddon konfigurieren
[ ] 10. (Optional) Discord Bot einrichten
```

---

## Schritt 1 – Repository forken & klonen

1. Klicke oben rechts auf **Fork**.
2. Klone dein Fork lokal:
   ```bash
   git clone https://github.com/DEIN-USERNAME/REPO-NAME.git
   cd REPO-NAME
   npm install
   ```

---

## Schritt 2 – Setup-Assistent (empfohlen)

Der Assistent befüllt die häufigsten Felder automatisch.

**Option A – Standalone EXE (kein Node/Bun nötig)**  
Nach dem ersten Push baut die CI automatisch `setup.exe` → lade sie aus  
**GitHub → Releases → setup.exe** herunter, lege sie ins Repo-Root und doppelklicke.

Lokal selbst bauen (Bun erforderlich):
```bash
npm run setup:build   # → erzeugt setup.exe
.\setup.exe
```

**Option B – direkt mit tsx**
```bash
npx tsx setup.ts
```

Er fragt nach Kanalname, Anzeigename, Tagline, Akzentfarbe, Impressum-Daten und  
StreamElements-URL und schreibt die Änderungen direkt in `siteConfig.ts` und die Sprachdateien.

---

## Schritt 3 – `src/config/siteConfig.ts` vollständig anpassen

`siteConfig.ts` ist die **einzige Stelle** für alle Website-Daten.  
Öffne die Datei und passe alle markierten Bereiche an:

### 3a – Profil

```ts
profile: {
  name: 'DEIN_ANZEIGENAME',       // ← Name auf der Startseite
  subtitleKey: 'hero.subtitle',   // bleibt so (Text in de.json ändern)
  image: '/img/logos/HDProfile.webp', // ← dein Profilbild (Datei ersetzen)
},
```

### 3b – Twitch

```ts
twitch: {
  channel: (import.meta.env.VITE_CHANNEL_NAME as string), // ← via .env / GitHub Secret
  chatFallbackUrl: `https://www.twitch.tv/${...}/chat`,   // automatisch
  icsUrl: '/api/calendar.ics',    // bleibt so
  idLookupUrl: 'https://decapi.me/twitch/id/', // bleibt so
},
```

> Den Kanalname setzt du über die Umgebungsvariable `VITE_CHANNEL_NAME` (`.env` lokal, GitHub Secret in CI).

### 3c – Impressum (Pflichtangaben laut TMG)

```ts
impressum: {
  name: 'Dein Vollständiger Name',
  company: 'Deine Firma',         // leer lassen wenn kein Unternehmen
  street: 'Musterstraße 1',
  city: '12345 Musterstadt',
  email: 'kontakt@deinkanal.de',
},
```

### 3d – Streamplan

```ts
streamplan: {
  icsUrl: 'https://export.kalender.digital/ics/0/DEIN_TOKEN/deinkanal.ics',
  categories: [
    { id: 1, labelKey: 'streamplan.categories.gog',  url: '...ics-url...', color: '#d4af37' },
    // weitere Kategorien – IDs müssen 1, 2, 3, … sein (keine Lücken)
  ],
},
```

> Die ICS-URLs bekommst du von [kalender.digital](https://kalender.digital) nach dem Einloggen  
> unter **Kalender exportieren → ICS-Link**.

### 3e – Donations (StreamElements)

```ts
streamelements: {
  donationUrl: 'https://streamelements.com/DEIN_KANAL/tip',
},
```

> Die URL findest du in deinem [StreamElements-Dashboard](https://streamelements.com) unter **Tip Page**.

### 3f – Hauptlinks

```ts
links: [
  {
    titleKey: 'links.streamplan.title',
    descKey:  'links.streamplan.desc',
    url: '/streamplan',
    icon: '/img/logos/StreamPlan.webp',
    target: '_self',
  },
  // weitere Links …
],
```

Jeder Link kann folgende Felder haben:

| Feld | Bedeutung |
|---|---|
| `titleKey` | i18n-Schlüssel für den Titel (in `de.json` definieren) |
| `descKey` | i18n-Schlüssel für die Beschreibung (optional) |
| `url` | Ziel-URL oder interner Pfad (`/seite`) |
| `icon` | Pfad zu einem Bild in `public/` |
| `target` | `'_self'` (intern/gleicher Tab) oder `'_blank'` (extern) |
| `discountCode` | Wird angezeigt und beim Klick in die Zwischenablage kopiert |
| `downloadFile` | URL für Datei-Download (löst Download-Bestätigungsdialog aus) |
| `downloadName` | Dateiname für den Download |

Dasselbe Schema gilt für `games[]`, `clips[]` und `partners[]`.

### 3g – Partner mit Rabattcodes

```ts
partners: [
  {
    titleKey: 'partners.beispiel.title',
    descKey:  'partners.beispiel.desc',
    url: 'https://beispiel.shop/?ref=deinkanal',
    icon: '/img/logos/Beispiel.webp',
    target: '_blank',
    discountCode: 'DEINCODE',   // ← wird beim Klick kopiert
  },
],
```

### 3h – Kurz-URLs (Weiterleitungen)

```ts
redirects: {
  '/discord':   'https://discord.gg/DEIN_INVITE',
  '/instagram': 'https://www.instagram.com/DEIN_KANAL/',
  '/yt':        'https://youtube.com/@DEIN_KANAL',
  // …
},
```

### 3i – Design & Branding

```ts
accentColor: '#7C4DFF',        // ← deine Markenfarbe (Hex)
copyrightHolder: 'Deine Firma',
onlyBart: {
  title: 'OnlyBart',           // ← Name deines Premium-Bereichs
  logoUrl: '/img/logos/OB.webp',
},
```

---

## Schritt 4 – Sprachdateien anpassen

Streamer-spezifische Texte in `src/i18n/locales/de.json` (gleiches für `en.json`, `gsw.json`):

| Schlüssel | Bedeutung | Beispielwert |
|---|---|---|
| `hero.subtitle` | Tagline unter deinem Namen | `"Gaming, Streams & Clips"` |
| `links.onlybart.title` | Name des Premium-Bereichs | `"OnlyBart"` |
| `links.onlybart.desc` | Kurzbeschreibung | `"Exklusive Inhalte"` |
| `streamplan.categories.*` | Kategorie-Labels | `"Just Chatting"` |
| `notFound.confusedMessages` | 404-Humor-Texte | beliebig |
| `onlybart.accessDenied.message` | Text wenn kein Zugang | eigene Formulierung |
| `partners.*.title/desc` | Partner-Texte | `"10% Rabatt mit Code …"` |
| `bartclickerPage.description` | Spielbeschreibung | eigene Formulierung |

> **Hinweis:** Die Schlüssel müssen mit den `titleKey`/`descKey`-Werten in `siteConfig.ts` übereinstimmen.

---

## Schritt 5 – Bilder ersetzen

Ersetze die folgenden Dateien in `public/img/logos/` durch deine eigenen (Format beibehalten):

| Datei | Verwendung |
|---|---|
| `HDProfile.webp` | Profilbild auf der Startseite |
| `OB.webp` | Premium-Bereich Logo |
| `StreamPlan.webp` | Streamplan-Link-Karte |
| `StreamElements.webp` | StreamElements-Link-Karte |
| `cdm.webp` | Clip-des-Monats-Link-Karte |
| `NClip.webp`, `Frugends.webp`, `Evolve.webp` | Partner-Logos (ersetzen oder entfernen) |
| `../logo128.png` | App-Icon / Favicon |

SVG-Dateien (`discord.svg`, `youtube.svg`, etc.) können so bleiben oder durch eigene ersetzt werden.

---

## Schritt 6 – Twitch App & Credentials

### 6a – Twitch Developer App erstellen

1. Gehe zu [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)
2. Klicke auf **„Register Your Application"**
3. Fülle aus:
   - **Name:** beliebig (z.B. „MeinKanal Landing Page")
   - **OAuth Redirect URLs:** `https://DEIN-SUPABASE-PROJEKT.supabase.co/auth/v1/callback`  
     (die URL bekommst du nach Schritt 7 aus Supabase)
   - **Category:** Website Integration
4. Klicke **Create**
5. Notiere **Client ID** und generiere einen **Client Secret**

### 6b – OAuth Refresh Token generieren

Der Bot und die GitHub Actions brauchen einen Refresh Token mit bestimmten Scopes.  
Am einfachsten mit der [Twitch CLI](https://dev.twitch.tv/docs/cli/):

```bash
# Twitch CLI installieren (Windows: winget install Twitch.TwitchCLI)
twitch token -u -s "channel:read:subscriptions moderation:read channel:manage:moderators channel:read:redemptions chat:read chat:edit"
```

Alternativ: [twitchtokengenerator.com](https://twitchtokengenerator.com) – dort die gleichen Scopes auswählen.

> Das Tool gibt `access_token` und `refresh_token` aus.  
> Du brauchst den **refresh_token** (der access_token läuft schnell ab, der Bot erneuert ihn automatisch).

---

## Schritt 7 – Supabase einrichten

### 7a – Projekt erstellen

1. Gehe zu [supabase.com](https://supabase.com) und erstelle ein kostenloses Projekt
2. Notiere nach der Erstellung:
   - **Project URL** (`https://xxx.supabase.co`)
   - **anon / public Key** (Settings → API → Project API keys → `anon`)
   - **service_role Key** (Settings → API → Project API keys → `service_role`) ⚠️ geheim halten

### 7b – Datenbankschema einrichten

Führe die Migrations-Dateien in Supabase aus:

1. Öffne das **SQL Editor**-Tab in deinem Supabase-Projekt
2. Öffne `supabase/migrations/20260424134835_remote_schema.sql` und führe den Inhalt aus
3. Öffne `supabase/migrations/20260425000000_security_fixes.sql` und führe den Inhalt aus

> Diese Dateien erstellen alle nötigen Tabellen (`votes`, `bartclicker_scores`, `points`, `rewards`,  
> `onlybart_posts`, `page_views`, etc.) und setzen Row Level Security (RLS) Policies.

### 7c – Twitch OAuth aktivieren

1. Gehe in Supabase zu **Authentication → Providers → Twitch**
2. Aktiviere Twitch und trage ein:
   - **Client ID** → deine Twitch App Client ID
   - **Client Secret** → dein Twitch App Secret
3. Kopiere die **Redirect URL** (z.B. `https://xxx.supabase.co/auth/v1/callback`)
4. Trage diese URL in deiner Twitch App unter **OAuth Redirect URLs** ein

### 7d – Edge Function deployen

Die Edge Function `twitch-game` liefert das aktuell gespielte Spiel während des Streams.

```bash
# Supabase CLI installieren: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref DEIN_PROJEKT_REF
supabase functions deploy twitch-game
```

> Die Funktion liegt in `supabase/functions/twitch-game/` (falls vorhanden).  
> Alternativ kann dieser Schritt übersprungen werden – dann wird im Stream keine Spielinfo angezeigt.

---

## Schritt 8 – GitHub Secrets & Pages

### 8a – Secrets eintragen

Gehe zu: **Repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Woher | Pflicht |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon key | ✅ |
| `VITE_TWITCH_CLIENT_ID` | Twitch Developer Console → App → Client ID | ✅ |
| `CHANNEL_NAME` | Dein Twitch-Kanalname (Kleinbuchstaben) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key | ✅ |
| `TWITCH_CLIENT_SECRET` | Twitch Developer Console → App → Client Secret | ✅ |
| `TWITCH_REFRESH_TOKEN` | Aus Schritt 6b (Token-Generator) | ✅ |
| `GH_TOKEN` | GitHub → Settings → Developer settings → Personal access tokens (Scopes: `secrets:write`) | ✅ (für Token-Refresh) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key | ✅ |
| `EBS_BASE_URL` | URL deines TwitchAddon-Servers (z.B. Railway-URL) | nur mit TwitchAddon |
| `EXTENSION_CLIENT_ID` | Twitch Extension Client ID | nur mit Extension |
| `EXTENSION_SECRET` | Twitch Extension Secret (Base64) | nur mit Extension |

### 8b – GitHub Pages aktivieren

1. Gehe zu: **Repo → Settings → Pages**
2. Wähle bei **Source**: **„GitHub Actions"**
3. Beim nächsten Push auf `master`/`main` wird die Seite automatisch gebaut und deployt.

### 8c – Base-URL in `vite.config.ts` prüfen

**Mit Custom Domain** (z.B. `meinkanal.de`): Keine Änderung nötig, `base: '/'` ist korrekt.

**Ohne Custom Domain** (GitHub Pages URL: `https://USERNAME.github.io/REPO-NAME/`):

```ts
// vite.config.ts, Zeile ~165
base: '/REPO-NAME/',   // ← Repo-Namen eintragen
```

Custom Domain in GitHub Pages setzen: **Settings → Pages → Custom domain**.

---

## Schritt 9 – Workflows aktivieren

Die GitHub Actions unter `.github/workflows/` laufen automatisch, sobald die Secrets gesetzt sind:

| Workflow | Was er tut | Trigger |
|---|---|---|
| `deploy.yml` | Baut und deployt die Landingpage | Push auf master/main |
| `twitch-sync.yml` | Synchronisiert Twitch-Daten, erneuert den Refresh Token | Alle 2 Stunden |
| `fetch-clips.yml` | Holt Top-Clips von Twitch, startet Voting-Runde 1 | 22. des Monats, 00:23 UTC |
| `manage-rounds.yml` | Verwaltet Voting-Runden-Status automatisch | Täglich 06:00 UTC |
| `build.yml` | Baut TwitchAddon als EXE und ZIP | Push auf master/main |
| `docker.yml` | Baut Docker-Images und pusht nach ghcr.io | Push auf master/main |

> `fetch-clips.yml` und `manage-rounds.yml` können auch manuell ausgelöst werden  
> (Actions → Workflow → **Run workflow**).

---

## Anhang A – TwitchAddon (Kanalpunkte-Bot + Extension)

Der TwitchAddon ist der Kanalpunkte-Bot und stellt die Twitch Panel Extension bereit.  
Er läuft als kleiner Bun-Prozess (~40–60 MB RAM).

### Option 1: Railway (empfohlen für 24/7-Betrieb)

1. Erstelle ein Konto auf [railway.app](https://railway.app)
2. Verbinde dein GitHub-Repo
3. Railway deployed den `TwitchAddon/`-Ordner automatisch (Dockerfile vorhanden)
4. Trage die generierten Env-Variablen ein (aus `TwitchAddon/.env.example`):

| Variable | Bedeutung |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_API_KEY` | Supabase service_role key |
| `TWITCH_CLIENT_ID` | Twitch App Client ID |
| `TWITCH_CLIENT_SECRET` | Twitch App Secret |
| `TWITCH_REFRESH_TOKEN` | Aus Schritt 6b |
| `TWITCH_OAUTH_TOKEN` | Aktueller Access Token (wird automatisch erneuert) |
| `CHANNEL_NAME` | Dein Twitch-Kanalname |
| `EXTENSION_CLIENT_ID` | Twitch Extension Client ID (optional) |
| `EXTENSION_SECRET` | Twitch Extension Secret Base64 (optional) |

5. Notiere die Railway-URL und trage sie als `EBS_BASE_URL` in die GitHub Secrets ein.

### Option 2: Lokal (für Tests oder Hobby-Streamer)

```bash
cd TwitchAddon
cp .env.example .env
# .env mit deinen Werten befüllen
bun install
bun run index.ts
```

Für HTTPS-Zugang (nötig für die Twitch Extension):

```bash
ngrok http 8081
# Generierte HTTPS-URL als EBS_BASE_URL verwenden
```

**Vollständige Anleitung:** [TwitchAddon/SETUP.md](TwitchAddon/SETUP.md)

---

## Anhang B – Twitch Extension einrichten

Nur nötig wenn du die Panel Extension im Twitch-Kanal anzeigen willst.

1. Gehe zu [dev.twitch.tv/console/extensions](https://dev.twitch.tv/console/extensions)
2. **Create Extension** → Typ: `Panel`
3. **Testing Base URI** = URL deines TwitchAddon-Servers (Railway oder ngrok)
4. Pfade eintragen:

| Feld | Wert |
|---|---|
| Panel Viewer Path | `/extension/panel.html` |
| Config Path | `/extension/config.html` |
| Mobile Path | `/extension/mobile.html` |

5. **Extension Client ID** und **Extension Secret** in `.env` / GitHub Secrets eintragen
6. Extension im Creator Dashboard aktivieren: **Extensions → Meine Extensions → Als Panel aktivieren**

---

## Anhang C – Discord Bot (optional)

Der Discord Bot postet automatische Nachrichten wenn Voting-Runden starten oder enden.  
Er wird durch Supabase Webhooks ausgelöst.

### Bot erstellen

1. Gehe zu [discord.com/developers/applications](https://discord.com/developers/applications)
2. **New Application** → Bot-Tab → **Add Bot**
3. Aktiviere **Server Members Intent** und **Message Content Intent**
4. Lade den Bot in deinen Server ein (Berechtigungen: `Send Messages`, `View Channels`)
5. Notiere den **Bot Token** und die **Channel ID** des Ziel-Kanals

### Auf Render deployen (empfohlen)

1. Erstelle ein Konto auf [render.com](https://render.com)
2. New **Web Service** → verbinde dein GitHub-Repo → Root Directory: `DiscordBot`
3. Build Command: `npm install && npm run build`  
   Start Command: `npm start`
4. Env-Variablen eintragen:

| Variable | Bedeutung |
|---|---|
| `DISCORD_TOKEN` | Discord Bot Token |
| `CHANNEL_ID` | Discord Kanal-ID |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (als API-Key-Auth) |
| `PORT` | `3000` (Render setzt das automatisch) |

5. Notiere die Render-URL und konfiguriere Supabase-Webhooks:
   - Supabase → Database → Webhooks → **New Webhook**
   - Events: z.B. `UPDATE` auf Tabelle `voting_rounds`
   - Webhook URL: `https://DEINE-RENDER-URL/start-runde-1` (je nach Event)

### Lokal

```bash
cd DiscordBot
cp .env.example .env   # (Datei selbst anlegen mit den obigen Variablen)
npm install
npm start
```

---

## Komplette GitHub Secrets Referenz

| Secret | Pflicht | Beschreibung |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase Project URL (`https://xxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service_role key (Admin-Rechte) |
| `VITE_TWITCH_CLIENT_ID` | ✅ | Twitch App Client ID |
| `TWITCH_CLIENT_SECRET` | ✅ | Twitch App Client Secret |
| `TWITCH_REFRESH_TOKEN` | ✅ | Twitch OAuth Refresh Token (Scopes: chat, moderation, subscriptions, redemptions) |
| `CHANNEL_NAME` | ✅ | Twitch-Kanalname (Kleinbuchstaben, ohne @) |
| `GH_TOKEN` | ✅ | GitHub Personal Access Token (Scope: `secrets:write`) – für automatischen Token-Refresh |
| `EBS_BASE_URL` | TwitchAddon | HTTPS-URL des TwitchAddon-Servers (Railway oder ngrok) |
| `EXTENSION_CLIENT_ID` | Extension | Client ID der Twitch Extension |
| `EXTENSION_SECRET` | Extension | Base64-kodiertes Extension Secret |

---

## Troubleshooting

| Problem | Lösung |
|---|---|
| Build schlägt fehl: `VITE_CHANNEL_NAME is undefined` | Secret `CHANNEL_NAME` in GitHub Actions setzen |
| Twitch Login funktioniert nicht | Redirect URL in Twitch App prüfen; muss mit Supabase-Callback übereinstimmen |
| Clip-Voting lädt nicht | Supabase-Migration ausführen (Schritt 7b) |
| Streamplan leer | `streamplan.icsUrl` in `siteConfig.ts` prüfen; kalender.digital-URL muss öffentlich sein |
| 404 bei direktem Aufruf von `/streamplan` etc. | GitHub Pages SPA-Fallback aktiv? `dist/404.html` muss existieren (wird automatisch erstellt) |
| GitHub Pages zeigt alten Stand | Actions → Deploy to GitHub Pages → Re-run |
| TwitchAddon startet nicht | `bun --version` prüfen; `.env` vollständig befüllt? |
| Extension zeigt HTTPS-Fehler | ngrok muss laufen; Testing Base URI in Twitch Dev Dashboard aktualisieren |
| Twitch Refresh Token abgelaufen | `twitch-sync.yml` Workflow manuell ausführen oder neuen Token aus Schritt 6b generieren |
| `rpc_missing`-Fehler im Moderatoren-Dashboard | SQL-Migration noch nicht ausgeführt → Schritt 7b wiederholen |
| `base: '/'` in vite.config.ts falsch | Ohne Custom Domain: `base: '/REPO-NAME/'` setzen |
