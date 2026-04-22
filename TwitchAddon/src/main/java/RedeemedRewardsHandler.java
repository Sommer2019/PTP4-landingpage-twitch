import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class RedeemedRewardsHandler implements HttpHandler {
    private final SupabaseClient supabaseClient;

    public RedeemedRewardsHandler(SupabaseClient supabaseClient) {
        this.supabaseClient = supabaseClient;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (OverlayApiServer.handleCorsPreFlight(exchange)) return;
        OverlayApiServer.addCorsHeaders(exchange);
        String method = exchange.getRequestMethod();
        if (method.equalsIgnoreCase("GET")) {
            JSONArray rewards = supabaseClient.getRedeemedRewardsWithUsernames();
            String response = rewards.toString();
            byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, responseBytes.length);
            OutputStream os = exchange.getResponseBody();
            os.write(responseBytes);
            os.close();
        } else if (method.equalsIgnoreCase("DELETE")) {
            String query = exchange.getRequestURI().getQuery();
            String id = null;
            if (query != null) {
                for (String param : query.split("&")) {
                    if (param.startsWith("id=")) {
                        id = param.substring(3);
                        break;
                    }
                }
            }

            if (id == null || id.isEmpty()) {
                String resp = "{\"error\":\"missing_id\"}";
                exchange.sendResponseHeaders(400, resp.length());
                exchange.getResponseBody().write(resp.getBytes());
                exchange.getResponseBody().close();
                return;
            }

            JSONObject redeemedReward = supabaseClient.getRedeemedRewardById(id);
            if (redeemedReward == null) {
                exchange.sendResponseHeaders(404, 0);
                exchange.getResponseBody().close();
                return;
            }

            String rewardId = redeemedReward.getString("reward_id");
            String redeemedBy = redeemedReward.optString("twitch_user_id", null);

            // 1. Einfach und ohne Wenn und Aber aus der Warteschlange löschen!
            boolean success = supabaseClient.deleteRedeemedReward(id);

            // 2. redeemed_global per Plugin setzen, sobald es erfolgreich verarbeitet wurde
            if (success) {
                boolean oncePerStream = supabaseClient.isRewardOncePerStream(rewardId);
                int cooldown = supabaseClient.getRewardCooldownFromDb(rewardId);

                if (oncePerStream || cooldown > 0) {
                    JSONObject globalLock = new JSONObject();
                    globalLock.put("reward_id", rewardId);
                    globalLock.put("redeemed_by", redeemedBy);
                    globalLock.put("is_active", true);

                    // Wenn oncePerStream, läuft es bis zum Stream-Ende (wo dein TwitchBot es ohnehin löscht).
                    // Falls es nur ein Cooldown ist, setzen wir die genaue Ablaufzeit.
                    if (!oncePerStream && cooldown > 0) {
                        java.time.OffsetDateTime expires = java.time.OffsetDateTime.now().plusSeconds(cooldown);
                        globalLock.put("expires_at", expires.toString());
                    }

                    System.out.println("[OverlayApiServer] Globaler Lock gesetzt für Reward: " + rewardId);
                }
            }

            String response = success ? "deleted" : "delete failed";
            exchange.sendResponseHeaders(success ? 200 : 500, response.length());
            OutputStream os = exchange.getResponseBody();
            os.write(response.getBytes());
            os.close();
        } else {
            exchange.sendResponseHeaders(405, 0);
            exchange.getResponseBody().close();
        }
    }
}

