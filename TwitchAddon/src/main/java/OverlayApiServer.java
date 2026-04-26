import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import java.io.IOException;

public class OverlayApiServer {
    private static final String EXTENSION_SECRET = System.getenv("EXTENSION_SECRET");

    public OverlayApiServer(SupabaseClient supabaseClient, TwitchBot bot) throws IOException {
        HttpServer server = HttpServer.create(new java.net.InetSocketAddress(8081), 0);
        server.createContext("/api/redeemed_rewards", new RedeemedRewardsHandler(supabaseClient));
        server.createContext("/api/rewards", new RewardsHandler(supabaseClient));
        server.createContext("/api/redeem_check", new RedeemCheckHandler(supabaseClient));
        server.createContext("/api/redeem", new RedeemHandler(supabaseClient, bot));
        server.createContext("/api/points", new PointsHandler(supabaseClient));
        server.createContext("/api/leaderboard", new LeaderboardHandler(supabaseClient));
        server.createContext("/overlay.html", new StaticFileHandler("overlay.html", "text/html"));
        server.createContext("/tts-test.html", new StaticFileHandler("tts-test.html", "text/html"));
        server.createContext("/media", new StaticDirHandler("media"));
        server.createContext("/api/tts", new TtsProxyHandler());
        server.createContext("/extension/", new StaticDirHandler("extension"));
        server.setExecutor(null);
        server.start();
    }

    /** Setzt CORS-Header für Twitch-Extension-Ursprünge. Nicht-Twitch-Origins erhalten einen sicheren Fallback. */
    public static void addCorsHeaders(HttpExchange exchange) {
        String origin = exchange.getRequestHeaders().getFirst("Origin");
        if (origin != null && (origin.endsWith(".twitch.tv") || origin.endsWith(".ext-twitch.tv"))) {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", origin);
        } else {
            // Fallback für lokale Tests / fremde Origins
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "https://supervisor.ext-twitch.tv");
        }
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, Authorization, x-extension-jwt");
        exchange.getResponseHeaders().add("Vary", "Origin");
    }

    /** Beantwortet CORS-Preflight-OPTIONS-Anfragen; gibt true zurück wenn behandelt. */
    public static boolean handleCorsPreFlight(HttpExchange exchange) throws IOException {
        if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
            addCorsHeaders(exchange);
            exchange.sendResponseHeaders(204, -1);
            return true;
        }
        return false;
    }

    /**
     * Dekodiert das Twitch Extension JWT und gibt die echte user_id zurück.
     * Gibt null zurück wenn das JWT ungültig ist oder keine user_id enthält.
     */
    public static String resolveUserIdFromJwt(String jwt) {
        if (jwt == null || jwt.isBlank() || EXTENSION_SECRET == null) return null;
        try {
            byte[] secretBytes = java.util.Base64.getDecoder().decode(EXTENSION_SECRET);
            Claims claims = Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(secretBytes))
                .build()
                .parseSignedClaims(jwt)
                .getPayload();
            // Enthält die echte Twitch-ID nur wenn Identity Linking in der Extension aktiv ist
            String userId = claims.get("user_id", String.class);
            return (userId != null && !userId.isBlank()) ? userId : null;
        } catch (Exception e) {
            return null;
        }
    }
}

