import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import org.json.JSONArray;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class LeaderboardHandler implements HttpHandler {
    private final SupabaseClient supabaseClient;

    public LeaderboardHandler(SupabaseClient supabaseClient) {
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
        int limit = 10;
        String query = exchange.getRequestURI().getQuery();
        if (query != null) {
            for (String param : query.split("&")) {
                if (param.startsWith("limit=")) {
                    try { limit = Integer.parseInt(param.substring("limit=".length())); } catch (NumberFormatException ignored) {}
                    break;
                }
            }
        }
        JSONArray leaderboard = supabaseClient.getLeaderboard(limit);
        byte[] bytes = leaderboard.toString().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.getResponseBody().close();
    }
}

