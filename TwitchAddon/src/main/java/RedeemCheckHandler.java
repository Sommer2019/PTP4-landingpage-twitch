import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import org.json.JSONObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class RedeemCheckHandler implements HttpHandler {
    private final SupabaseClient supabaseClient;

    public RedeemCheckHandler(SupabaseClient supabaseClient) {
        this.supabaseClient = supabaseClient;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (OverlayApiServer.handleCorsPreFlight(exchange)) return;
        OverlayApiServer.addCorsHeaders(exchange);
        if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
            exchange.sendResponseHeaders(405, 0);
            exchange.getResponseBody().close();
            return;
        }
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
        if (id == null) {
            exchange.sendResponseHeaders(400, 0);
            exchange.getResponseBody().close();
            return;
        }
        JSONObject redeemedReward = supabaseClient.getRedeemedRewardById(id);
        if (redeemedReward == null) {
            exchange.sendResponseHeaders(404, 0);
            exchange.getResponseBody().close();
            return;
        }

        // DEPRECATED: Diese Prüfung sollte nur noch zur Info dienen.
        // Die Cooldown/Once-Per-Stream Prüfung und Punkte-Debit erfolgen jetzt ALLE in der RPC-Funktion!
        // Daher werden hier KEINE Punkte mehr automatisch zurückgegeben.

        String rewardId = redeemedReward.optString("reward_id", null);

        // Check once-per-stream (nur zur Info)
        boolean oncePerStream = supabaseClient.isRewardOncePerStream(rewardId);
        if (oncePerStream) {
            boolean activeGlobal = supabaseClient.hasActiveGlobalRedemption(rewardId, null);
            if (activeGlobal) {
                JSONObject resp = new JSONObject();
                resp.put("allowed", false);
                resp.put("error", "once_per_stream_active");
                resp.put("info", "RPC sollte dies bereits blockiert haben. Punkte wurden NICHT zurückgegeben (RPC handhabt Debit).");
                String respStr = resp.toString();
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, respStr.length());
                exchange.getResponseBody().write(respStr.getBytes());
                exchange.getResponseBody().close();
                return;
            }
        }

        // Check global cooldown (nur zur Info)
        long lastGlobal = supabaseClient.getLastGlobalRedemptionTimestamp(rewardId);
        int cooldown = supabaseClient.getRewardCooldownFromDb(rewardId);
        long now = System.currentTimeMillis();
        if (lastGlobal > 0) {
            long globalElapsed = (now - lastGlobal) / 1000L;
            if (cooldown > 0 && globalElapsed < cooldown) {
                JSONObject resp = new JSONObject();
                resp.put("allowed", false);
                resp.put("error", "cooldown_active");
                resp.put("remaining", cooldown - globalElapsed);
                resp.put("info", "RPC sollte dies bereits blockiert haben. Punkte wurden NICHT zurückgegeben (RPC handhabt Debit).");
                String respStr = resp.toString();
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, respStr.length());
                exchange.getResponseBody().write(respStr.getBytes());
                exchange.getResponseBody().close();
                return;
            }
        }

        // No block -> allowed
        JSONObject ok = new JSONObject();
        ok.put("allowed", true);
        String okStr = ok.toString();
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, okStr.length());
        exchange.getResponseBody().write(okStr.getBytes());
        exchange.getResponseBody().close();
    }
}

