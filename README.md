# PTP4 – Twitch Landing Page

A modular, ready-to-fork Twitch landing page built with **React + Vite + TypeScript**.  
Every text, link, colour and ID lives in one central config file – just fill in your own values and deploy.

---

## Table of Contents

1. [Features](#features)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
   - [Environment Variables (`.env`)](#environment-variables-env)
   - [Site Config (`siteConfig.ts`)](#site-config-siteconfigts)
4. [Adding a New Language](#adding-a-new-language)
5. [Changing the Brand Color](#changing-the-brand-color)
6. [StreamElements / Donations](#streamelements--donations)
7. [Streamplan / Calendar](#streamplan--calendar)
8. [Redirects](#redirects)
9. [Supabase Setup](#supabase-setup)
10. [Development](#development)
11. [Deployment](#deployment)

---

## Features

- 🎨 **Modular brand color** – one env var (`VITE_ACCENT_COLOR`) recolors the entire UI
- 🌐 **Auto-detected language list** – add a JSON file, list the code, done
- 🔗 **All links & IDs in one place** – `src/config/siteConfig.ts`
- 📺 **Live Twitch embed** with offline fallback & next-stream countdown
- 📅 **Streamplan** (iCal / kalender.digital integration)
- 💸 **StreamElements donations** with configurable trigger list
- 🔒 **Auth via Supabase** (Twitch OAuth) with moderator / broadcaster roles
- 🌙 **Dark / Light / System theme** toggle

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/PTP4-landingpage-twitch-HD.git
cd PTP4-landingpage-twitch-HD

# 2. Install dependencies
npm install

# 3. Copy the env template and fill in your values
cp .env.example .env
# → edit .env (see section below)

# 4. Adjust the site config
#    → edit src/config/siteConfig.ts (see section below)

# 5. Start the dev server
npm run dev
```

---

## Configuration

### Environment Variables (`.env`)

Copy `.env.example` to `.env` and set the following variables:

| Variable | Required | Description |
|---|---|---|
| `VITE_CHANNEL_NAME` | ✅ | Your Twitch channel login name (lowercase) |
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous/public key |
| `VITE_TWITCH_CLIENT_ID` | ✅ | Twitch application Client ID (for auth) |
| `VITE_STREAMELEMENTS_CHANNEL` | ✅ | StreamElements channel ID as in the donation URL (`channelname-1234`) |
| `VITE_ACCENT_COLOR` | ☑️ | Primary brand color as a 6-digit hex, e.g. `#7C4DFF` (default: purple) |
| `VITE_LANGUAGES` | ☑️ | Comma-separated language codes to enable, e.g. `de,en` (default: `de,en,gsw`) |

> **Never commit your `.env` file.** It is already listed in `.gitignore`.

---

### Site Config (`siteConfig.ts`)

Open `src/config/siteConfig.ts` – this is **the single place** to customize everything visible on the page:

| Section | What to change |
|---|---|
| `profile` | Channel name, subtitle i18n key, profile image path |
| `twitch` | Driven by `VITE_CHANNEL_NAME`; override `icsUrl` for the stream schedule |
| `impressum` | Legal contact details (name, address, e-mail) |
| `streamplan` | Main ICS URL + per-category ICS URLs and colors |
| `streamelements` | Driven by `VITE_STREAMELEMENTS_CHANNEL`; customize donation triggers |
| `links` | Card links shown on the home page |
| `games` | Game-related links section |
| `clips` | Clips & Shorts section |
| `partners` | Partner / sponsor cards |
| `footerLinks` | Impressum / Datenschutz links |
| `redirects` | Short-URL redirects, e.g. `/yt` → YouTube |
| `accentColor` | Driven by `VITE_ACCENT_COLOR` |
| `languages` | Driven by `VITE_LANGUAGES` |

---

## Adding a New Language

1. Create a translation file at `src/i18n/locales/<code>.json`  
   (copy `en.json` as a starting point and translate the values).
2. Add the language code to `VITE_LANGUAGES` in your `.env`:
   ```
   VITE_LANGUAGES=de,en,gsw,fr
   ```
3. *(Optional)* Add a flag emoji and display name for the new code in  
   `KNOWN_LANGUAGES` inside `src/components/SettingsBar/SettingsBar.tsx`.

The i18n setup uses `import.meta.glob` to auto-discover all `*.json` files in the locales directory, so no other code changes are needed.

---

## Changing the Brand Color

Set `VITE_ACCENT_COLOR` in your `.env` to any 6-digit hex color:

```
VITE_ACCENT_COLOR=#E91E63   # pink
VITE_ACCENT_COLOR=#00BCD4   # cyan
VITE_ACCENT_COLOR=#FF5722   # orange
```

The color is injected at startup as the `--accent` CSS custom property (and its RGB components as `--accent-rgb`), so the entire UI recolors automatically without rebuilding.

---

## StreamElements / Donations

1. Find your StreamElements donation URL:  
   `https://streamelements.com/<YOUR_CHANNEL_ID>/tip`
2. Set `VITE_STREAMELEMENTS_CHANNEL=<YOUR_CHANNEL_ID>` in `.env`.
3. Customize the donation trigger list in `siteConfig.ts` → `streamelements.triggers`.  
   Each trigger has an `id`, `price`, optional `amountValue`, description i18n key, and optional audio file.

---

## Streamplan / Calendar

The stream schedule is powered by iCal (`.ics`) feeds from [kalender.digital](https://kalender.digital) or any compatible provider.

1. Replace `streamplan.icsUrl` with your main calendar ICS URL.
2. Add / remove / recolor categories in `streamplan.categories`.  
   Each category needs an `id`, label i18n key, its own `url`, and a `color`.

---

## Redirects

Short-URL redirects are defined in `siteConfig.redirects`:

```typescript
redirects: {
  "/yt": "https://youtube.com/@yourchannel",
  "/dc": "https://discord.gg/yourserver",
  // ...
}
```

Add as many entries as you like. They are handled client-side via React Router.

---

## Supabase Setup

1. Create a [Supabase](https://supabase.com) project.
2. Enable **Twitch** as an OAuth provider under  
   *Authentication → Providers → Twitch*.
3. Copy the project URL and anon key to your `.env`.
4. Deploy the Edge Functions from `supabase/functions/` using the Supabase CLI:
   ```bash
   supabase functions deploy
   supabase secrets set TWITCH_CLIENT_ID=... TWITCH_CLIENT_SECRET=... TWITCH_CHANNEL=...
   ```

---

## Development

```bash
npm run dev        # start dev server (http://localhost:5173)
npm run build      # production build → dist/
npm run preview    # preview production build locally
npm run lint       # ESLint
npm run test       # Vitest unit tests
npm run test:coverage  # coverage report
```

---

## Deployment

The project outputs a static site to `dist/` and can be deployed to any static host (Vercel, Netlify, Cloudflare Pages, etc.).

Set all required `VITE_*` environment variables in your hosting provider's dashboard.  
For Supabase Edge Functions, use `supabase secrets set` – these values are **not** exposed to the browser.
