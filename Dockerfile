# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:26-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# Accept build-time env vars (VITE_ prefix → baked into bundle)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_TWITCH_CLIENT_ID

RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.30-alpine AS runner

# SPA-aware nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
