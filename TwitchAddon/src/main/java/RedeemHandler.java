import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class RedeemHandler implements HttpHandler {
    private static final Logger logger = LoggerFactory.getLogger(RedeemHandler.class);
    private final SupabaseClient supabaseClient;
    private final TwitchBot bot;

    public RedeemHandler(SupabaseClient supabaseClient, TwitchBot bot) {
        this.supabaseClient = supabaseClient;
        this.bot = bot;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (OverlayApiServer.handleCorsPreFlight(exchange)) return;
        OverlayApiServer.addCorsHeaders(exchange);

        if (!exchange.getRequestMethod().equalsIgnoreCase("POST")) {
            exchange.sendResponseHeaders(405, -1);
            return;
        }

        // 1. JWT prüfen — echte Twitch-User-ID aus der Signatur lesen, niemals aus dem Request-Body
        String jwt = exchange.getRequestHeaders().getFirst("x-extension-jwt");
        String twitchUserId = OverlayApiServer.resolveUserIdFromJwt(jwt);
        if (twitchUserId == null) {
            logger.warn("RedeemHandler: ungültiges oder fehlendes JWT");
            sendJson(exchange, 401, new JSONObject().put("error", "invalid_jwt"));
            return;
        }

        // 2. Stream-Status prüfen
        if (!bot.isStreamOnline()) {
            logger.info("RedeemHandler: Einlösung abgelehnt — Stream offline (user={})", twitchUserId);
            sendJson(exchange, 403, new JSONObject().put("error", "stream_offline"));
            return;
        }

        // 3. Request-Body parsen — nur reward_id und tts_text werden akzeptiert; cost/user_id aus dem Body werden ignoriert
        JSONObject body;
        try {
            body = parseBody(exchange);
        } catch (Exception e) {
            sendJson(exchange, 400, new JSONObject().put("error", "invalid_body"));
            return;
        }

        String rewardId = body.optString("reward_id", null);
        String ttsText = (!body.isNull("tts_text")) ? body.optString("tts_text", null) : null;

        if (rewardId == null || rewardId.isBlank()) {
            sendJson(exchange, 400, new JSONObject().put("error", "missing_reward_id"));
            return;
        }

        // 4. Reward aus der DB laden — maßgebliche Quelle für Kosten, Status und Beschreibung
        JSONObject reward = supabaseClient.getRewardById(rewardId);
        if (reward == null) {
            sendJson(exchange, 404, new JSONObject().put("error", "reward_not_found"));
            return;
        }
        if (!reward.optBoolean("is_enabled", true)) {
            sendJson(exchange, 403, new JSONObject().put("error", "reward_disabled"));
            return;
        }
        int cost = reward.optInt("cost", 0);

        // 5. Punkte serverseitig prüfen — der Client kann den Kostenwert nicht beeinflussen
        int currentPoints = supabaseClient.getPointsByUserId(twitchUserId);
        if (currentPoints < 0) {
            sendJson(exchange, 403, new JSONObject().put("error", "user_not_found"));
            return;
        }
        if (currentPoints < cost) {
            logger.info("RedeemHandler: Nicht genug Punkte — user={} hat={} braucht={}", twitchUserId, currentPoints, cost);
            sendJson(exchange, 403, new JSONObject().put("error", "not_enough_points"));
            return;
        }

        // 6. Beschreibung serverseitig aus DB-Feldern und optionalem TTS-Text zusammenbauen
        String description = buildDescription(reward, ttsText, twitchUserId);
        String ttsToSend = resolveTtsToSend(reward, ttsText);

        // 7. Supabase RPC aufrufen — twitchUserId stammt ausschließlich aus dem verifizierten JWT
        String streamId = bot.getCurrentStreamSessionId();
        JSONObject result = supabaseClient.redeemRewardRpcFull(twitchUserId, rewardId, description, cost, ttsToSend, streamId);

        if (result == null) {
            logger.error("RedeemHandler: RPC returned null (user={}, reward={})", twitchUserId, rewardId);
            sendJson(exchange, 500, new JSONObject().put("error", "rpc_error"));
            return;
        }

        logger.info("RedeemHandler: RPC result={} user={} reward={}", result, twitchUserId, rewardId);
        sendJson(exchange, 200, result);
    }

    private String buildDescription(JSONObject reward, String ttsText, String twitchUserId) {
        boolean isTts = reward.optBoolean("istts", false);
        String rewardText = reward.isNull("text") ? null : reward.optString("text", null);
        String rewardDesc = reward.isNull("description") ? null : reward.optString("description", null);

        String raw;
        if (isTts) {
            if (rewardText != null && !rewardText.isBlank()) {
                raw = rewardText;
            } else {
                boolean hasDesc = rewardDesc != null && !rewardDesc.isBlank();
                boolean hasTts = ttsText != null && !ttsText.isBlank();
                if (hasDesc && hasTts) raw = rewardDesc + " " + ttsText;
                else if (hasDesc) raw = rewardDesc;
                else raw = hasTts ? ttsText : "";
            }
        } else {
            raw = rewardDesc != null ? rewardDesc : "";
        }

        return raw.replace("%name%", twitchUserId);
    }

    private String resolveTtsToSend(JSONObject reward, String ttsText) {
        if (!reward.optBoolean("istts", false)) return null;
        String rewardText = reward.isNull("text") ? null : reward.optString("text", null);
        if (rewardText != null && !rewardText.isBlank()) return null;
        return (ttsText != null && !ttsText.isBlank()) ? ttsText : null;
    }

    private JSONObject parseBody(HttpExchange exchange) throws Exception {
        try (InputStream is = exchange.getRequestBody()) {
            String body = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            return new JSONObject(body);
        }
    }

    private void sendJson(HttpExchange exchange, int status, JSONObject json) throws IOException {
        byte[] bytes = json.toString().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
