import org.json.JSONObject;
import org.json.JSONArray;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse.BodyHandlers;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SupabaseClient {
    private static final Logger logger = LoggerFactory.getLogger(SupabaseClient.class);
    private final String supabaseUrl;
    private final String apiKey;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final String tableName = "points";
    private String twitchClientId = System.getenv("TWITCH_CLIENT_ID");
    private String twitchOauthToken = System.getenv("TWITCH_OAUTH_TOKEN");
    private String twitchRefreshToken = System.getenv("TWITCH_REFRESH_TOKEN");
    private final String twitchClientSecret = System.getenv("TWITCH_CLIENT_SECRET");
    private final Map<String, CachedUsername> usernameCache = new ConcurrentHashMap<>();
    private static final long USERNAME_CACHE_TTL_MS = 6L * 60L * 60L * 1000L;
    private static final long USERNAME_NEGATIVE_CACHE_TTL_MS = 10L * 60L * 1000L;

    private static class CachedUsername {
        private final String username;
        private final long expiresAt;

        private CachedUsername(String username, long expiresAt) {
            this.username = username;
            this.expiresAt = expiresAt;
        }
    }

    public SupabaseClient(String supabaseUrl, String apiKey) {
        this.supabaseUrl = supabaseUrl;
        this.apiKey = apiKey;
    }

    /**
     * Setzt die Twitch OAuth-Credentials (z.B. nach einem Token-Refresh).
     */
    public void setTwitchCredentials(String clientId, String oauthToken) {
        this.twitchClientId = clientId;
        this.twitchOauthToken = oauthToken;
        logger.info("setTwitchCredentials: Credentials aktualisiert (clientId={}, token={})",
            clientId == null ? "null" : "***", oauthToken == null ? "null" : "***");
    }

    public void addOrUpdatePoints(String username, String userid, int points, String reason) {
        logger.info("addOrUpdatePoints: {} | {} | {}", username, points, reason);
        int current = getPoints(username, userid);
        int finalPoints = current + points;
        logger.info("Add points: {} (current: {} + points: {})", finalPoints, current, points);

        JSONObject json = new JSONObject();
        json.put("twitch_user_id", userid);
        json.put("points", finalPoints);  // Immer addieren
        json.put("reason", reason);
        json.put("timestamp", System.currentTimeMillis());

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/rest/v1/" + tableName + "?twitch_user_id=eq." + userid))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .method("PATCH", BodyPublishers.ofString(json.toString()))
                .timeout(Duration.ofSeconds(10))
                .build();
        try {
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            logger.info("Supabase PATCH Status: {} | Body: {}", response.statusCode(), response.body());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logger.error("Supabase PATCH fehlgeschlagen: {} {}", response.statusCode(), response.body());
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Fehler beim Supabase PATCH: {}", e.getMessage(), e);
        }
    }

    public int getPoints(String username, String userid) {
        logger.info("getPoints: {}", username);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/rest/v1/" + tableName + "?twitch_user_id=eq." + userid))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .build();
        try {
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            logger.info("Supabase GET Status: {} | Body: {}", response.statusCode(), response.body());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                JSONArray arr = new JSONArray(response.body());
                if (!arr.isEmpty()) {
                    return arr.getJSONObject(0).getInt("points");
                }
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Fehler beim Supabase GET: {}", e.getMessage(), e);
        }
        return 0;
    }

    /**
     * Prüft, ob ein User bereits in der Datenbank existiert.
     */
    public boolean existsUser(String username, String userid) {
        logger.info("existsUser: {}", username);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/rest/v1/" + tableName + "?twitch_user_id=eq." + userid))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .build();
        try {
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            logger.info("Supabase existsUser Status: {} | Body: {}", response.statusCode(), response.body());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                JSONArray arr = new JSONArray(response.body());
                return !arr.isEmpty();
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Fehler bei existsUser: {}", e.getMessage(), e);
        }
        return false;
    }

    /**
     * Legt einen neuen User mit 0 Punkten an.
     */
    public void createUser(String username, String userid) {
        logger.info("createUser: {}", username);
        JSONObject json = new JSONObject();
        json.put("twitch_user_id", userid);
        json.put("points", 0);
        json.put("reason", "init");
        json.put("timestamp", System.currentTimeMillis());
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/rest/v1/" + tableName))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(BodyPublishers.ofString(json.toString()))
                .timeout(Duration.ofSeconds(10))
                .build();
        try {
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            logger.info("Supabase createUser Status: {} | Body: {}", response.statusCode(), response.body());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logger.error("Supabase createUser fehlgeschlagen: {} {}", response.statusCode(), response.body());
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Fehler bei createUser: {}", e.getMessage(), e);
        }
    }

    /**
     * Gibt alle eingelösten Rewards aus der Tabelle redeemed_rewards zurück.
     */
    public JSONArray getRedeemedRewards() {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/rest/v1/redeemed_rewards"))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .build();
        try {
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                return new JSONArray(response.body());
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Fehler beim Supabase GET redeemed_rewards: {}", e.getMessage(), e);
        }
        return new JSONArray();
    }

    /**
     * Liefert eingelöste Rewards inkl. gemapptem Anzeigenamen aus twitch_user_id.
     */
    public JSONArray getRedeemedRewardsWithUsernames() {
        JSONArray rewards = getRedeemedRewards();
        logger.info("getRedeemedRewardsWithUsernames: Verarbeite {} Rewards", rewards.length());
        for (int i = 0; i < rewards.length(); i++) {
            JSONObject reward = rewards.optJSONObject(i);
            if (reward == null) {
                continue;
            }

            String twitchUserId = reward.optString("twitch_user_id", null);
            String username = firstNonBlank(
                    reward.optString("username", null),
                    reward.optString("user", null),
                    reward.optString("twitch_user_name", null)
            );

            logger.info("Reward {}: twitchUserId={}, existingUsername={}", i, twitchUserId, username);

            if (isBlank(username) && !isBlank(twitchUserId)) {
                logger.info("Versuche Username über Twitch API zu laden für ID: {}", twitchUserId);
                username = resolveTwitchUsernameById(twitchUserId);
                logger.info("Twitch API Ergebnis für {}: {}", twitchUserId, username);
            }

            String displayUser = !isBlank(username)
                    ? username
                    : (!isBlank(twitchUserId) ? "User " + twitchUserId : "Unbekannt");

            logger.info("Setze display_user für Reward {}: {}", i, displayUser);
            reward.put("display_user", displayUser);
            if (!isBlank(username)) {
                reward.put("username", username);
                reward.put("user", username);
                reward.put("twitch_user_name", username);
            }
        }
        return rewards;
    }

    private String resolveTwitchUsernameById(String twitchUserId) {
        if (isBlank(twitchUserId)) {
            logger.debug("resolveTwitchUsernameById: twitchUserId ist leer");
            return null;
        }

        long now = System.currentTimeMillis();
        CachedUsername cached = usernameCache.get(twitchUserId);
        if (cached != null && cached.expiresAt > now) {
            logger.debug("resolveTwitchUsernameById: {} aus Cache ({} Sekunden alt)", twitchUserId, (now - (cached.expiresAt - USERNAME_CACHE_TTL_MS)) / 1000);
            return emptyToNull(cached.username);
        }

        String token = normalizeOAuthToken(twitchOauthToken);
        if (isBlank(twitchClientId) || isBlank(token)) {
            logger.error("resolveTwitchUsernameById: Twitch API-Credentials nicht gesetzt (clientId={}, token={})",
                twitchClientId == null ? "null" : "***", token == null ? "null" : "***");
            return null;
        }

        try {
            logger.info("resolveTwitchUsernameById: Frage Twitch Helix API für ID {} auf", twitchUserId);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.twitch.tv/helix/channels?broadcaster_id=" + twitchUserId))
                    .header("Client-ID", twitchClientId)
                    .header("Authorization", "Bearer " + token)
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            logger.info("resolveTwitchUsernameById: Helix API Status {} für ID {} | Response: {}", response.statusCode(), twitchUserId, response.body());

            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                JSONObject json = new JSONObject(response.body());
                JSONArray data = json.optJSONArray("data");
                if (data != null && !data.isEmpty()) {
                    String username = firstNonBlank(
                            data.getJSONObject(0).optString("broadcaster_name", null),
                            data.getJSONObject(0).optString("broadcaster_login", null)
                    );
                    logger.info("resolveTwitchUsernameById: Gefunden '{}' für ID {}", username, twitchUserId);
                    usernameCache.put(twitchUserId, new CachedUsername(nullToEmpty(username), now + USERNAME_CACHE_TTL_MS));
                    return username;
                } else {
                    logger.warn("resolveTwitchUsernameById: Leeres data-Array von Helix API für ID {}", twitchUserId);
                }
            } } else if (response.statusCode() == 401) {
                  logger.warn("resolveTwitchUsernameById: 401 - versuche Token-Refresh...");
                  try {
                      String newToken = TwitchOAuthUtil.refreshAccessToken(
                          twitchClientId,
                          twitchClientSecret,
                          twitchRefreshToken
                      );
                      if (newToken != null) {
                          setTwitchCredentials(twitchClientId, newToken);
                          // Einmal wiederholen mit neuem Token
                          HttpRequest retryRequest = HttpRequest.newBuilder()
                              .uri(URI.create("https://api.twitch.tv/helix/channels?broadcaster_id=" + twitchUserId))
                              .header("Client-ID", twitchClientId)
                              .header("Authorization", "Bearer " + newToken)
                              .header("Accept", "application/json")
                              .timeout(Duration.ofSeconds(10))
                              .GET()
                              .build();
                          HttpResponse<String> retryResponse = client.send(retryRequest, BodyHandlers.ofString());
                          if (retryResponse.statusCode() >= 200 && retryResponse.statusCode() < 300) {
                              JSONObject json = new JSONObject(retryResponse.body());
                              JSONArray data = json.optJSONArray("data");
                              if (data != null && !data.isEmpty()) {
                                  String username = firstNonBlank(
                                      data.getJSONObject(0).optString("broadcaster_name", null),
                                      data.getJSONObject(0).optString("broadcaster_login", null)
                                  );
                                  usernameCache.put(twitchUserId, new CachedUsername(nullToEmpty(username), now + USERNAME_CACHE_TTL_MS));
                                  return username;
                              }
                          }
                      }
                  } catch (Exception refreshEx) {
                      logger.error("Token-Refresh fehlgeschlagen: {}", refreshEx.getMessage());
                  }
              } else {
                logger.error("resolveTwitchUsernameById: Helix API Fehler Status {} für ID {}: {}", response.statusCode(), twitchUserId, response.body());
            }
        } catch (Exception e) {
            logger.error("Konnte Twitch-Username für ID {} nicht auflösen: {}", twitchUserId, e.getMessage(), e);
        }

        usernameCache.put(twitchUserId, new CachedUsername("", now + USERNAME_NEGATIVE_CACHE_TTL_MS));
        logger.warn("resolveTwitchUsernameById: Kein Username gefunden für ID {}", twitchUserId);
        return null;
    }

    private String normalizeOAuthToken(String token) {

        if (isBlank(token)) {
            return null;
        }
        String trimmed = token.trim();
        if (trimmed.startsWith("oauth:")) {
            return trimmed.substring("oauth:".length());
        }
        return trimmed;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) {
                return value;
            }
        }
        return null;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String emptyToNull(String value) {
        return isBlank(value) ? null : value;
    }

    /**
     * Löscht einen Reward aus redeemed_rewards anhand der ID.
     */
    public boolean deleteRedeemedReward(String id) {
        if (id == null) {
            logger.error("deleteRedeemedReward: ID ist null!");
            return false;
        }
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/rest/v1/redeemed_rewards?id=eq." + id))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .method("DELETE", BodyPublishers.noBody())
                .timeout(Duration.ofSeconds(10))
                .build();
        try {
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            logger.info("Supabase DELETE redeemed_reward Status: {} | Body: {}", response.statusCode(), response.body());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logger.error("Supabase DELETE fehlgeschlagen: {} {}", response.statusCode(), response.body());
            }
            return response.statusCode() >= 200 && response.statusCode() < 300;
        } catch (IOException | InterruptedException e) {
            logger.error("Fehler beim Supabase DELETE redeemed_reward: {}", e.getMessage(), e);
        }
        return false;
    }

    // Fügt einen Reward als Upsert in die Tabelle rewards ein
    public void upsertReward(JSONObject reward) {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(supabaseUrl + "/rest/v1/rewards"))
            .header("apikey", apiKey)
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .POST(BodyPublishers.ofString("[" + reward.toString() + "]"))
            .timeout(Duration.ofSeconds(10))
            .build();
        try {
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            logger.info("Supabase UPSERT Reward Status: {} | Body: {}", response.statusCode(), response.body());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logger.error("Supabase UPSERT Reward fehlgeschlagen: {} {}", response.statusCode(), response.body());
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Fehler beim Supabase UPSERT Reward: {}", e.getMessage(), e);
        }
    }

    // Gibt den Cooldown einer Belohnung aus der DB zurück (in Sekunden)
    public int getRewardCooldownFromDb(String rewardId) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/rest/v1/rewards?id=eq." + rewardId))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .build();
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                JSONArray arr = new JSONArray(response.body());
                if (!arr.isEmpty()) {
                    return arr.getJSONObject(0).optInt("cooldown", 0);
                }
            }
        } catch (Exception e) {
            logger.error("Fehler beim Supabase GET rewards (cooldown): {}", e.getMessage(), e);
        }
        return 0;
    }

    /**
     * Prüft, ob ein Reward das Flag onceperstream gesetzt hat.
     */
    public boolean isRewardOncePerStream(String rewardId) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/rest/v1/rewards?id=eq." + rewardId))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .build();
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                JSONArray arr = new JSONArray(response.body());
                if (!arr.isEmpty()) {
                    return arr.getJSONObject(0).optBoolean("onceperstream", false);
                }
            }
        } catch (Exception e) {
            logger.error("Fehler beim Supabase GET rewards (onceperstream): {}", e.getMessage(), e);
        }
        return false;
    }

    // Gibt den letzten Einlösezeitpunkt für einen Reward eines Users zurück (Unix-Timestamp in ms, 0 falls nie eingelöst)
    public long getLastRedemptionTimestampFromRedeemedRewards(String userId, String rewardId) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/rest/v1/redeemed_rewards?select=timestamp&user_id=eq." + userId + "&reward_id=eq." + rewardId + "&order=timestamp.desc&limit=1"))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .build();
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                JSONArray arr = new JSONArray(response.body());
                if (!arr.isEmpty()) {
                    return arr.getJSONObject(0).optLong("timestamp", 0);
                }
            }
        } catch (Exception e) {
            logger.error("Fehler beim Supabase GET redeemed_rewards (timestamp): {}", e.getMessage(), e);
        }
        return 0;
    }

    // Fügt eine Reward-Einlösung in redeemed_rewards ein
    public void insertRedeemedReward(JSONObject redeemedReward) {
        // DEPRECATED: Verwende stattdessen redeemRewardRpc(...) um atomare Prüfungen (cooldown/oncePerStream) serverseitig durchzuführen.
        try {
            String rewardId = redeemedReward.optString("reward_id", null);
            String twitchId = redeemedReward.optString("twitch_user_id", null);
            String description = redeemedReward.optString("description", null);
            int cost = redeemedReward.optInt("cost", 0);
            String tts = redeemedReward.has("ttsText") ? redeemedReward.optString("ttsText", null) : null;
            // Falls die RPC nicht existiert, fällt redeemRewardRpc intern auf direktes Insert zurück
            boolean ok = redeemRewardRpc(twitchId, rewardId, description, cost, tts, null);
            if (!ok) {
                logger.warn("insertRedeemedReward: redeemRewardRpc returned false, fallback to direct insert");
                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(supabaseUrl + "/rest/v1/redeemed_rewards"))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(BodyPublishers.ofString("[" + redeemedReward.toString() + "]"))
                    .timeout(Duration.ofSeconds(10))
                    .build();
                HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    logger.error("Supabase INSERT redeemed_rewards fehlgeschlagen (fallback): {} {}", response.statusCode(), response.body());
                }
            }
        } catch (Exception e) {
            logger.error("Fehler beim Supabase INSERT redeemed_rewards (via RPC fallback): {}", e.getMessage(), e);
        }
    }

    /**
     * Ruft die Supabase RPC-Funktion 'redeem_reward' auf. Liefert true bei Erfolg.
     */
    public boolean redeemRewardRpc(String twitchUserId, String rewardId, String description, int cost, String ttsText, String streamId) {
        try {
            JSONObject params = new JSONObject();
            params.put("p_twitch_user_id", twitchUserId);
            params.put("p_reward_id", rewardId);
            params.put("p_description", description);
            params.put("p_cost", cost);
            params.put("p_ttstext", ttsText);
            params.put("p_stream_id", streamId);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(supabaseUrl + "/rpc/redeem_reward"))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(BodyPublishers.ofString(params.toString()))
                    .timeout(Duration.ofSeconds(10))
                    .build();
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                // Response ist JSON mit Ergebnis
                String body = response.body();
                JSONObject res = new JSONObject(body);
                if (res.has("success") && res.getBoolean("success")) {
                    return true;
                } else {
                    logger.info("redeemRewardRpc: returned: {}", res.toString());
                    return false;
                }
            }
        } catch (Exception e) {
            logger.error("Fehler beim Aufruf der RPC redeem_reward: {}", e.getMessage(), e);
        }
        return false;
    }

    /**
     * Gibt einen einzelnen eingelösten Reward anhand der ID zurück (aus redeemed_rewards).
     */
    public JSONObject getRedeemedRewardById(String id) {
        if (id == null) return null;
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/rest/v1/redeemed_rewards?id=eq." + id))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .build();
        try {
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                JSONArray arr = new JSONArray(response.body());
                if (arr.length() > 0) {
                    return arr.getJSONObject(0);
                }
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Fehler beim Supabase GET redeemed_reward by id: {}", e.getMessage(), e);
        }
        return null;
    }

    // Gibt alle Rewards aus der Tabelle rewards zurück
    public JSONArray getRewards() {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/rest/v1/rewards"))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .build();
        try {
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                return new JSONArray(response.body());
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Fehler beim Supabase GET rewards: {}", e.getMessage(), e);
        }
        return new JSONArray();
    }

    /**
     * Prüft, ob eine aktive (globale) Einlösung für ein Reward existiert.
     * Wenn streamId != null übergibt, wird zusätzlich nach stream_id gefiltert.
     */
    public boolean hasActiveGlobalRedemption(String rewardId, String streamId) {
        try {
            String url = supabaseUrl + "/rest/v1/redeemed_global?reward_id=eq." + rewardId + "&is_active=eq.true&limit=1";
            if (streamId != null && !streamId.isEmpty()) {
                url += "&stream_id=eq." + streamId;
            }
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(10))
                    .build();
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                JSONArray arr = new JSONArray(response.body());
                if (arr.isEmpty()) return false;
                // Check expires_at: consider entry active only if expires_at is null or in the future
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject obj = arr.getJSONObject(i);
                    if (!obj.has("expires_at") || obj.isNull("expires_at")) {
                        return true;
                    }
                    String expires = obj.optString("expires_at", null);
                    if (expires != null) {
                        java.time.OffsetDateTime odt = java.time.OffsetDateTime.parse(expires);
                        if (odt.toInstant().isAfter(java.time.Instant.now())) {
                            return true;
                        }
                    }
                }
                return false;
            }
        } catch (Exception e) {
            logger.error("Fehler beim Supabase GET redeemed_global (hasActiveGlobalRedemption): {}", e.getMessage(), e);
        }
        return false;
    }

    /**
     * Liefert den letzten globalen Einlösezeitpunkt (epoch ms) für ein Reward oder 0.
     */
    public long getLastGlobalRedemptionTimestamp(String rewardId) {
        try {
            String url = supabaseUrl + "/rest/v1/redeemed_global?select=redeemed_at&reward_id=eq." + rewardId + "&order=redeemed_at.desc&limit=1";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(10))
                    .build();
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                JSONArray arr = new JSONArray(response.body());
                if (!arr.isEmpty()) {
                    String ts = arr.getJSONObject(0).optString("redeemed_at", null);
                    if (ts != null) {
                        // parse ISO timestamptz und zurückgeben als epoch ms
                        java.time.OffsetDateTime odt = java.time.OffsetDateTime.parse(ts);
                        return odt.toInstant().toEpochMilli();
                    }
                }
            }
        } catch (Exception e) {
            logger.error("Fehler beim Supabase GET redeemed_global (last timestamp): {}", e.getMessage(), e);
        }
        return 0;
    }

    /**
     * Erstellt eine neue Stream-Session in `stream_sessions` und gibt die erzeugte ID zurück (oder null bei Fehler).
     */
    public String createStreamSession(String streamIdentifier) {
        try {
            JSONObject json = new JSONObject();
            json.put("stream_identifier", streamIdentifier);
            json.put("is_active", true);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(supabaseUrl + "/rest/v1/stream_sessions"))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    // return representation so we get the created row with id
                    .header("Prefer", "return=representation")
                    .POST(BodyPublishers.ofString("[" + json + "]"))
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                JSONArray arr = new JSONArray(response.body());
                if (!arr.isEmpty()) {
                    return arr.getJSONObject(0).optString("id", null);
                }
            } else {
                logger.error("Supabase CREATE stream_session fehlgeschlagen: {} {}", response.statusCode(), response.body());
            }
        } catch (Exception e) {
            logger.error("Fehler beim CREATE stream_session: {}", e.getMessage(), e);
        }
        return null;
    }

    /**
     * Markiert eine Stream-Session als beendet (is_active = false, ended_at gesetzt).
     */
    public boolean endStreamSession(String sessionId) {
        if (sessionId == null) return false;
        try {
            JSONObject json = new JSONObject();
            json.put("is_active", false);
            json.put("ended_at", java.time.OffsetDateTime.now().toString());

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(supabaseUrl + "/rest/v1/stream_sessions?id=eq." + sessionId))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .method("PATCH", BodyPublishers.ofString(json.toString()))
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            return response.statusCode() >= 200 && response.statusCode() < 300;
        } catch (Exception e) {
            logger.error("Fehler beim Beenden der stream_session: {}", e.getMessage(), e);
        }
        return false;
    }

    /**
     * Deaktiviert alle globalen Einlösungen für eine bestimmte Stream-Session (setzt is_active = false).
     */
    public boolean deactivateGlobalRedemptionsForStream(String sessionId) {
        if (sessionId == null) return false;
        try {
            JSONObject json = new JSONObject();
            json.put("is_active", false);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(supabaseUrl + "/rest/v1/redeemed_global?stream_id=eq." + sessionId))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .method("PATCH", BodyPublishers.ofString(json.toString()))
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            return response.statusCode() >= 200 && response.statusCode() < 300;
        } catch (Exception e) {
            logger.error("Fehler beim Deaktivieren der redeemed_global für Session {}: {}", sessionId, e.getMessage(), e);
        }
        return false;
    }

    /**
     * Deaktiviert alle aktiven globalen Einlösungen (Hilfsfunktion beim Streamende, um einmal-pro-stream Locks zu resetten).
     */
    public boolean deactivateAllActiveGlobalRedemptions() {
        try {
            JSONObject json = new JSONObject();
            json.put("is_active", false);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(supabaseUrl + "/rest/v1/redeemed_global?is_active=eq.true"))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .method("PATCH", BodyPublishers.ofString(json.toString()))
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            return response.statusCode() >= 200 && response.statusCode() < 300;
        } catch (Exception e) {
            logger.error("Fehler beim Deaktivieren aller aktiven redeemed_global Einträge: {}", e.getMessage(), e);
        }
        return false;
    }

    /**
     * Gibt die Punkte eines Users anhand der Twitch-User-ID zurück, oder -1 wenn nicht gefunden.
     */
    public int getPointsByUserId(String twitchUserId) {
        if (twitchUserId == null || twitchUserId.isBlank()) return -1;
        String encodedId;
        try {
            encodedId = java.net.URLEncoder.encode(twitchUserId, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            logger.error("Fehler beim URL-Encoding der twitch_user_id: {}", e.getMessage());
            return -1;
        }
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/rest/v1/" + tableName + "?twitch_user_id=eq." + encodedId + "&select=points"))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .build();
        try {
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                JSONArray arr = new JSONArray(response.body());
                if (!arr.isEmpty()) {
                    return arr.getJSONObject(0).optInt("points", 0);
                }
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Fehler beim Supabase GET points by userId: {}", e.getMessage(), e);
        }
        return -1;
    }

    /**
     * Gibt die Top-N User nach Punkten zurück (für Leaderboard).
     */
    public JSONArray getLeaderboard(int limit) {
        if (limit <= 0) limit = 10;
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/rest/v1/" + tableName + "?select=twitch_user_id,points&order=points.desc&limit=" + limit))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .build();
        try {
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null) {
                JSONArray arr = new JSONArray(response.body());
                // Resolve usernames for each entry
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject entry = arr.getJSONObject(i);
                    String userId = entry.optString("twitch_user_id", null);
                    if (userId != null) {
                        String name = resolveTwitchUsernameById(userId);
                        entry.put("display_name", name != null ? name : userId);
                    }
                }
                return arr;
            }
        } catch (IOException | InterruptedException e) {
            logger.error("Fehler beim Supabase GET leaderboard: {}", e.getMessage(), e);
        }
        return new JSONArray();
    }

    /**
     * Löscht alle Einträge aus redeemed_rewards (z.B. am Stream-Ende für Cleanup).
     */
    public boolean deleteAllRedeemedRewards() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(supabaseUrl + "/rest/v1/redeemed_rewards"))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .method("DELETE", BodyPublishers.noBody())
                    .timeout(Duration.ofSeconds(10))
                    .build();
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
            logger.info("Supabase DELETE all redeemed_rewards Status: {}", response.statusCode());
            return response.statusCode() >= 200 && response.statusCode() < 300;
        } catch (Exception e) {
            logger.error("Fehler beim Löschen aller redeemed_rewards: {}", e.getMessage(), e);
        }
        return false;
    }
}
