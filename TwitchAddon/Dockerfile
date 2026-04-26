FROM oven/bun:1-alpine

WORKDIR /app

COPY TwitchAddon/package.json ./
COPY TwitchAddon/index.ts ./
COPY TwitchAddon/bot/ ./bot/
# .env wird im CI erstellt und hier eingebunden (enthält Twitch/Supabase-Secrets)
COPY TwitchAddon/.env ./

# Statische Assets (Extension-HTML, Overlay, Media)
COPY TwitchAddon/extension/ ./extension/
COPY TwitchAddon/overlay.html ./
COPY TwitchAddon/media/ ./media/

CMD ["bun", "run", "index.ts"]
