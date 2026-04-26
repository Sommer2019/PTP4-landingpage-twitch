/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // Kanalname für den Client (VITE_-Präfix damit Vite ihn bereitstellt)
  readonly VITE_CHANNEL_NAME?: string
  // Optional: Chat-Fallback-URL vollständig überschreiben
  readonly VITE_CHAT_FALLBACK_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

