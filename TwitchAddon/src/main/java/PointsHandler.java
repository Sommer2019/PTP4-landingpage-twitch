import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import org.json.JSONObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class PointsHandler implements HttpHandler {
    private final SupabaseClient supabaseClient;

    public PointsHandler(SupabaseClient supabaseClient) {
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
        String userId = null;
        if (query != null) {
            for (String param : query.split("&")) {
                if (param.startsWith("user_id=")) {
                    userId = param.substring("user_id=".length());
                    break;
                }
            }
        }
        if (userId == null || userId.isBlank()) {
            String resp = "{\"error\":\"missing_user_id\"}";
            byte[] bytes = resp.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(400, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.getResponseBody().close();
            return;
        }
        // Wenn user_id mit "U" anfängt (Opaque ID) → JWT aus Header lesen und echte ID extrahieren
        if (userId.startsWith("U")) {
            String jwt = exchange.getRequestHeaders().getFirst("x-extension-jwt");
            String resolvedId = OverlayApiServer.resolveUserIdFromJwt(jwt);
            if (resolvedId != null) {
                userId = resolvedId;
            }
        }
        int points = supabaseClient.getPointsByUserId(userId);
        JSONObject result = new JSONObject();
        result.put("twitch_user_id", userId);
        result.put("points", points == -1 ? 0 : points);
        result.put("registered", points != -1);
        byte[] bytes = result.toString().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.getResponseBody().close();
    }
}

