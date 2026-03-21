import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.OutputStream;
import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class TtsProxyHandler implements HttpHandler {
    private final java.net.http.HttpClient httpClient = java.net.http.HttpClient.newHttpClient();
    // Einfaches Cache für UserId->Username
    private static final Map<String, String> usernameCache = new ConcurrentHashMap<>();
    private static final String TWITCH_CLIENT_ID = System.getenv("TWITCH_CLIENT_ID");
    private static final String TWITCH_OAUTH_TOKEN = System.getenv("TWITCH_OAUTH_TOKEN");

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String query = exchange.getRequestURI().getQuery();
        String text = "";
        String twitchUserId = null;

        if (query != null) {
            for (String param : query.split("&")) {
                if (param.startsWith("text=")) {
                    text = java.net.URLDecoder.decode(param.substring(5), java.nio.charset.StandardCharsets.UTF_8);
                } else if (param.startsWith("twitch_user_id=")) {
                    twitchUserId = java.net.URLDecoder.decode(param.substring(15), java.nio.charset.StandardCharsets.UTF_8);
                }
            }
        }

        if (text.isEmpty()) {
            exchange.sendResponseHeaders(400, 0);
            exchange.close();
            return;
        }

        // Username auflösen, falls UserId vorhanden
        if (twitchUserId != null && !twitchUserId.isEmpty()) {
            String username = usernameCache.get(twitchUserId);
            if (username == null && TWITCH_CLIENT_ID != null && TWITCH_OAUTH_TOKEN != null) {
                try {
                    java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                        .uri(URI.create("https://api.twitch.tv/helix/users?id=" + twitchUserId))
                        .header("Client-Id", TWITCH_CLIENT_ID)
                        .header("Authorization", "Bearer " + TWITCH_OAUTH_TOKEN)
                        .GET()
                        .build();
                    java.net.http.HttpResponse<String> resp = httpClient.send(req, java.net.http.HttpResponse.BodyHandlers.ofString());
                    if (resp.statusCode() == 200) {
                        org.json.JSONObject json = new org.json.JSONObject(resp.body());
                        if (json.has("data")) {
                            org.json.JSONArray arr = json.getJSONArray("data");
                            if (!arr.isEmpty()) {
                                username = arr.getJSONObject(0).optString("display_name", null);
                                if (username != null) {
                                    usernameCache.put(twitchUserId, username);
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    // Fehler ignorieren, Username bleibt null
                }
            }
            if (username != null) {
                text = username + ": " + text;
            }
        }

        // Google Translate TTS URL
        String ttsUrl = "https://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&q="
                + java.net.URLEncoder.encode(text, java.nio.charset.StandardCharsets.UTF_8);

        java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                .uri(URI.create(ttsUrl))
                .header("User-Agent", "Mozilla/5.0") // Wichtig, um 404 zu vermeiden
                .GET()
                .build();

        try {
            java.net.http.HttpResponse<byte[]> response = httpClient.send(request, java.net.http.HttpResponse.BodyHandlers.ofByteArray());

            if (response.statusCode() == 200) {
                byte[] audioData = response.body();
                exchange.getResponseHeaders().add("Content-Type", "audio/mpeg");
                // CORS Header hinzufügen, falls nötig (für OBS oft hilfreich)
                exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");

                exchange.sendResponseHeaders(200, audioData.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(audioData);
                }
            } else {
                exchange.sendResponseHeaders(response.statusCode(), 0);
            }
        } catch (InterruptedException e) {
            exchange.sendResponseHeaders(500, 0);
        } finally {
            exchange.close();
        }
    }
}