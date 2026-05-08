FROM oven/bun:1-alpine

ARG SUPABASE_URL
ARG SUPABASE_API_KEY
ARG TWITCH_CLIENT_ID
ARG TWITCH_CLIENT_SECRET
ARG CHANNEL_NAME
ARG TWITCH_REFRESH_TOKEN

ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_API_KEY=$SUPABASE_API_KEY
ENV TWITCH_CLIENT_ID=$TWITCH_CLIENT_ID
ENV TWITCH_CLIENT_SECRET=$TWITCH_CLIENT_SECRET
ENV CHANNEL_NAME=$CHANNEL_NAME
ENV TWITCH_REFRESH_TOKEN=$TWITCH_REFRESH_TOKEN

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
