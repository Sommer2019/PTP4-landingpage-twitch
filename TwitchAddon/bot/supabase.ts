/** Supabase REST-Client — ersetzt SupabaseClient.java via fetch statt OkHttp. */

interface CachedEntry { username: string; expiresAt: number }

export class SupabaseClient {
  private readonly base: string
  private readonly apiKey: string
  private twitchClientId: string
  private twitchOauthToken: string
  private readonly twitchRefreshToken: string
  private readonly twitchClientSecret: string
  private readonly usernameCache = new Map<string, CachedEntry>()
  private static readonly USERNAME_TTL = 6 * 60 * 60 * 1000
  private static readonly USERNAME_NEGATIVE_TTL = 10 * 60 * 1000

  constructor(
    supabaseUrl: string,
    apiKey: string,
    twitchClientId: string,
    twitchOauthToken: string,
    twitchRefreshToken: string,
    twitchClientSecret: string,
  ) {
    this.base = supabaseUrl
    this.apiKey = apiKey
    this.twitchClientId = twitchClientId
    this.twitchOauthToken = twitchOauthToken
    this.twitchRefreshToken = twitchRefreshToken
    this.twitchClientSecret = twitchClientSecret
  }

  setTwitchCredentials(clientId: string, oauthToken: string): void {
    this.twitchClientId = clientId
    this.twitchOauthToken = oauthToken
  }

  private get baseHeaders(): HeadersInit {
    return {
      apikey: this.apiKey,
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
  }

  private async supaFetch(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${this.base}${path}`, {
      ...init,
      headers: { ...this.baseHeaders as Record<string, string>, ...(init.headers as Record<string, string> ?? {}) },
      signal: AbortSignal.timeout(10_000),
    })
  }

  // ── Punkte-Tabelle ──────────────────────────────────────────────────────────

  async existsUser(userid: string): Promise<boolean> {
    try {
      const r = await this.supaFetch(`/rest/v1/points?twitch_user_id=eq.${userid}`)
      if (!r.ok) return false
      const arr = await r.json() as unknown[]
      return arr.length > 0
    } catch { return false }
  }

  async createUser(userid: string): Promise<void> {
    try {
      await this.supaFetch('/rest/v1/points', {
        method: 'POST',
        body: JSON.stringify({ twitch_user_id: userid, points: 0, reason: 'init', timestamp: Date.now() }),
      })
    } catch (e) { console.error('[Supabase] createUser Fehler:', e) }
  }

  async getPointsByUserId(userid: string): Promise<number> {
    try {
      const r = await this.supaFetch(`/rest/v1/points?twitch_user_id=eq.${encodeURIComponent(userid)}&select=points`)
      if (!r.ok) return -1
      const arr = await r.json() as { points: number }[]
      return arr.length ? arr[0].points : -1
    } catch { return -1 }
  }

  async addOrUpdatePoints(userid: string, points: number, reason: string): Promise<void> {
    try {
      const current = await this.getPointsByUserId(userid)
      const finalPoints = Math.min((current < 0 ? 0 : current) + points, 2_147_483_647)
      const r = await this.supaFetch(`/rest/v1/points?twitch_user_id=eq.${userid}`, {
        method: 'PATCH',
        body: JSON.stringify({ twitch_user_id: userid, points: finalPoints, reason, timestamp: Date.now() }),
      })
      if (!r.ok) console.error('[Supabase] addOrUpdatePoints fehlgeschlagen:', r.status)
    } catch (e) { console.error('[Supabase] addOrUpdatePoints Fehler:', e) }
  }

  async getLeaderboard(limit = 10): Promise<Record<string, unknown>[]> {
    try {
      const r = await this.supaFetch(`/rest/v1/points?select=twitch_user_id,points&order=points.desc&limit=${limit}`)
      if (!r.ok) return []
      const arr = await r.json() as { twitch_user_id: string; points: number }[]
      // Anzeigenamen für jeden Eintrag auflösen
      return await Promise.all(arr.map(async (e) => ({
        ...e,
        display_name: (await this.resolveTwitchUsernameById(e.twitch_user_id)) ?? e.twitch_user_id,
      })))
    } catch { return [] }
  }

  // ── Rewards ─────────────────────────────────────────────────────────────────

  async getRewards(): Promise<unknown[]> {
    try {
      const r = await this.supaFetch('/rest/v1/rewards')
      return r.ok ? await r.json() as unknown[] : []
    } catch { return [] }
  }

  async getRewardById(rewardId: string): Promise<Record<string, unknown> | null> {
    try {
      const r = await this.supaFetch(`/rest/v1/rewards?id=eq.${rewardId}`)
      if (!r.ok) return null
      const arr = await r.json() as Record<string, unknown>[]
      return arr[0] ?? null
    } catch { return null }
  }

  async createReward(payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    try {
      const r = await this.supaFetch('/rest/v1/rewards', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        console.error('[Supabase] createReward fehlgeschlagen:', r.status, await r.text())
        return null
      }
      const arr = await r.json() as Record<string, unknown>[]
      return arr[0] ?? null
    } catch (e) {
      console.error('[Supabase] createReward Fehler:', e)
      return null
    }
  }

  async updateReward(rewardId: string, payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    try {
      const r = await this.supaFetch(`/rest/v1/rewards?id=eq.${encodeURIComponent(rewardId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        console.error('[Supabase] updateReward fehlgeschlagen:', r.status, await r.text())
        return null
      }
      const arr = await r.json() as Record<string, unknown>[]
      return arr[0] ?? null
    } catch (e) {
      console.error('[Supabase] updateReward Fehler:', e)
      return null
    }
  }

  async deleteReward(rewardId: string): Promise<boolean> {
    try {
      const r = await this.supaFetch(`/rest/v1/rewards?id=eq.${encodeURIComponent(rewardId)}`, {
        method: 'DELETE',
      })
      return r.ok
    } catch (e) {
      console.error('[Supabase] deleteReward Fehler:', e)
      return false
    }
  }

  async getRewardCooldown(rewardId: string): Promise<number> {
    try {
      const r = await this.supaFetch(`/rest/v1/rewards?id=eq.${rewardId}`)
      if (!r.ok) return 0
      const arr = await r.json() as { cooldown?: number }[]
      return arr[0]?.cooldown ?? 0
    } catch { return 0 }
  }

  async isRewardOncePerStream(rewardId: string): Promise<boolean> {
    try {
      const r = await this.supaFetch(`/rest/v1/rewards?id=eq.${rewardId}`)
      if (!r.ok) return false
      const arr = await r.json() as { onceperstream?: boolean }[]
      return arr[0]?.onceperstream ?? false
    } catch { return false }
  }

  // ── Eingelöste Rewards ───────────────────────────────────────────────────────

  async getRedeemedRewards(): Promise<Record<string, unknown>[]> {
    try {
      const r = await this.supaFetch('/rest/v1/redeemed_rewards')
      return r.ok ? await r.json() as Record<string, unknown>[] : []
    } catch { return [] }
  }

  async getRedeemedRewardsWithUsernames(): Promise<Record<string, unknown>[]> {
    const rewards = await this.getRedeemedRewards()
    for (const reward of rewards) {
      const userId = reward.twitch_user_id as string | null
      const existingName = (reward.username ?? reward.user ?? reward.twitch_user_name) as string | null
      let displayUser = existingName

      if (!displayUser && userId) {
        displayUser = await this.resolveTwitchUsernameById(userId)
      }

      reward.display_user = displayUser ?? (userId ? `User ${userId}` : 'Unbekannt')
      if (displayUser) {
        reward.username = displayUser
        reward.user = displayUser
        reward.twitch_user_name = displayUser
      }
    }
    return rewards
  }

  async getRedeemedRewardById(id: string): Promise<Record<string, unknown> | null> {
    try {
      const r = await this.supaFetch(`/rest/v1/redeemed_rewards?id=eq.${id}`)
      if (!r.ok) return null
      const arr = await r.json() as Record<string, unknown>[]
      return arr[0] ?? null
    } catch { return null }
  }

  async deleteRedeemedReward(id: string): Promise<boolean> {
    try {
      const r = await this.supaFetch(`/rest/v1/redeemed_rewards?id=eq.${id}`, { method: 'DELETE' })
      return r.ok
    } catch { return false }
  }

  async deleteAllRedeemedRewards(): Promise<boolean> {
    try {
      const r = await this.supaFetch('/rest/v1/redeemed_rewards', { method: 'DELETE' })
      return r.ok
    } catch { return false }
  }

  async getLastRedemptionTimestamp(userId: string, rewardId: string): Promise<number> {
    try {
      const r = await this.supaFetch(
        `/rest/v1/redeemed_rewards?select=timestamp&user_id=eq.${userId}&reward_id=eq.${rewardId}&order=timestamp.desc&limit=1`,
      )
      if (!r.ok) return 0
      const arr = await r.json() as { timestamp?: number }[]
      return arr[0]?.timestamp ?? 0
    } catch { return 0 }
  }

  // ── Globale Reward-Locks ────────────────────────────────────────────────────

  async hasActiveGlobalRedemption(rewardId: string, streamId: string | null): Promise<boolean> {
    try {
      let url = `/rest/v1/redeemed_global?reward_id=eq.${rewardId}&is_active=eq.true&limit=10`
      if (streamId) url += `&stream_id=eq.${streamId}`
      const r = await this.supaFetch(url)
      if (!r.ok) return false
      const arr = await r.json() as { expires_at?: string | null }[]
      if (!arr.length) return false
      // Gilt nur als aktiv wenn expires_at null oder in der Zukunft liegt
      return arr.some((e) => !e.expires_at || new Date(e.expires_at).getTime() > Date.now())
    } catch { return false }
  }

  async getLastGlobalRedemptionTimestamp(rewardId: string): Promise<number> {
    try {
      const r = await this.supaFetch(
        `/rest/v1/redeemed_global?select=redeemed_at&reward_id=eq.${rewardId}&order=redeemed_at.desc&limit=1`,
      )
      if (!r.ok) return 0
      const arr = await r.json() as { redeemed_at?: string }[]
      const ts = arr[0]?.redeemed_at
      return ts ? new Date(ts).getTime() : 0
    } catch { return 0 }
  }

  async deactivateAllActiveGlobalRedemptions(): Promise<boolean> {
    try {
      const r = await this.supaFetch('/rest/v1/redeemed_global?is_active=eq.true', {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      })
      return r.ok
    } catch { return false }
  }

  async deactivateGlobalRedemptionsForStream(sessionId: string): Promise<boolean> {
    try {
      const r = await this.supaFetch(`/rest/v1/redeemed_global?stream_id=eq.${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      })
      return r.ok
    } catch { return false }
  }

  // ── Stream-Sessions ──────────────────────────────────────────────────────────

  async createStreamSession(streamIdentifier: string): Promise<string | null> {
    try {
      const r = await this.supaFetch('/rest/v1/stream_sessions', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify([{ stream_identifier: streamIdentifier, is_active: true }]),
      })
      if (!r.ok) {
        console.error('[Supabase] createStreamSession fehlgeschlagen:', r.status)
        return null
      }
      const arr = await r.json() as { id: string }[]
      return arr[0]?.id ?? null
    } catch (e) {
      console.error('[Supabase] createStreamSession Fehler:', e)
      return null
    }
  }

  async endStreamSession(sessionId: string): Promise<boolean> {
    try {
      const r = await this.supaFetch(`/rest/v1/stream_sessions?id=eq.${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false, ended_at: new Date().toISOString() }),
      })
      return r.ok
    } catch { return false }
  }

  // ── RPC ─────────────────────────────────────────────────────────────────────

  async redeemRewardRpc(
    twitchUserId: string,
    rewardId: string,
    description: string,
    cost: number,
    ttsText: string | null,
    streamId: string | null,
  ): Promise<Record<string, unknown> | null> {
    try {
      const r = await this.supaFetch('/rest/v1/rpc/redeem_reward', {
        method: 'POST',
        body: JSON.stringify({
          p_twitch_user_id: twitchUserId,
          p_reward_id: rewardId,
          p_description: description,
          p_cost: cost,
          p_ttstext: ttsText,
          p_stream_id: streamId,
        }),
      })
      if (!r.ok) {
        console.error('[Supabase] redeemRewardRpc HTTP Fehler:', r.status, await r.text())
        return null
      }
      return await r.json() as Record<string, unknown>
    } catch (e) {
      console.error('[Supabase] redeemRewardRpc Fehler:', e)
      return null
    }
  }

  // ── Twitch-Username-Auflösung (gecacht) ─────────────────────────────────────

  private normalizeToken(token: string): string {
    return token.startsWith('oauth:') ? token.slice('oauth:'.length) : token
  }

  async resolveTwitchUsernameById(userId: string): Promise<string | null> {
    if (!userId) return null
    const now = Date.now()
    const cached = this.usernameCache.get(userId)
    if (cached && cached.expiresAt > now) return cached.username || null

    const token = this.normalizeToken(this.twitchOauthToken)
    if (!this.twitchClientId || !token) return null

    try {
      const r = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${userId}`, {
        headers: { 'Client-ID': this.twitchClientId, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      })

      if (r.status === 401) {
        // Token abgelaufen — einmalig erneuern und nochmals versuchen
        const newToken = await refreshOauthToken(this.twitchClientId, this.twitchClientSecret, this.twitchRefreshToken)
        if (newToken) {
          this.setTwitchCredentials(this.twitchClientId, newToken)
          const retry = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${userId}`, {
            headers: { 'Client-ID': this.twitchClientId, Authorization: `Bearer ${newToken}` },
            signal: AbortSignal.timeout(10_000),
          })
          if (retry.ok) {
            const json = await retry.json() as { data: { broadcaster_name?: string; broadcaster_login?: string }[] }
            const name = json.data[0]?.broadcaster_name ?? json.data[0]?.broadcaster_login ?? null
            this.usernameCache.set(userId, { username: name ?? '', expiresAt: now + SupabaseClient.USERNAME_TTL })
            return name
          }
        }
      } else if (r.ok) {
        const json = await r.json() as { data: { broadcaster_name?: string; broadcaster_login?: string }[] }
        const name = json.data[0]?.broadcaster_name ?? json.data[0]?.broadcaster_login ?? null
        this.usernameCache.set(userId, { username: name ?? '', expiresAt: now + SupabaseClient.USERNAME_TTL })
        return name
      }
    } catch (e) {
      console.error('[Supabase] resolveTwitchUsernameById Fehler:', e)
    }

    this.usernameCache.set(userId, { username: '', expiresAt: now + SupabaseClient.USERNAME_NEGATIVE_TTL })
    return null
  }
}

// ── OAuth-Hilfsfunktion ──────────────────────────────────────────────────────

export async function refreshOauthToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string | null> {
  try {
    const r = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) {
      console.error('[OAuth] Refresh fehlgeschlagen:', r.status, await r.text())
      return null
    }
    const json = await r.json() as { access_token: string }
    return json.access_token
  } catch (e) {
    console.error('[OAuth] Refresh Fehler:', e)
    return null
  }
}

export async function getBroadcasterId(
  channelName: string,
  clientId: string,
  oauthToken: string,
): Promise<string | null> {
  try {
    const token = oauthToken.startsWith('oauth:') ? oauthToken.slice('oauth:'.length) : oauthToken
    const r = await fetch(`https://api.twitch.tv/helix/users?login=${channelName}`, {
      headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!r.ok) return null
    const json = await r.json() as { data: { id: string }[] }
    return json.data[0]?.id ?? null
  } catch { return null }
}
