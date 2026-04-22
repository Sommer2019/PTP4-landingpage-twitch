import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import org.json.JSONArray;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class RewardsHandler implements HttpHandler {
    private final SupabaseClient supabaseClient;

    public RewardsHandler(SupabaseClient supabaseClient) {
        this.supabaseClient = supabaseClient;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (OverlayApiServer.handleCorsPreFlight(exchange)) return;
        OverlayApiServer.addCorsHeaders(exchange);
        String method = exchange.getRequestMethod();
        if (method.equalsIgnoreCase("GET")) {
            JSONArray rewards = supabaseClient.getRewards(); // Annahme: getRewards() liefert alle Rewards aus der DB
            String response = rewards.toString();
            byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, responseBytes.length);
            OutputStream os = exchange.getResponseBody();
            os.write(responseBytes);
            os.close();
        } else {
            exchange.sendResponseHeaders(405, 0);
            exchange.getResponseBody().close();
        }
    }
}

