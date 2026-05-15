/** Laufzeitzustand eines im Chat anwesenden Zuschauers; die Flags verhindern doppelte Punktevergabe. */
export interface UserSession {
  username: string
  userid: string
  joinTimestamp: number
  hasReceived5MinPoints: boolean
  hasReceived30MinPoints: boolean
  hasReceivedStayTillEndPoints: boolean
}

/** Erwartete Umgebungsvariablen für Bot und Server. */
export interface Env {
  SUPABASE_URL: string
  SUPABASE_API_KEY: string
  TWITCH_OAUTH_TOKEN: string
  TWITCH_CLIENT_ID: string
  TWITCH_CLIENT_SECRET: string
  TWITCH_REFRESH_TOKEN: string
  CHANNEL_NAME: string
  EXTENSION_SECRET: string
}
