import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Paths;

public class OverlayApiServer {
    private final SupabaseClient supabaseClient;
    // rewards.json wird aus dem aktuellen Arbeitsverzeichnis geladen (liegt neben der EXE)
    private final String rewardsJsonPath = "rewards.json";

    public OverlayApiServer(SupabaseClient supabaseClient) throws IOException {
        this.supabaseClient = supabaseClient;
        HttpServer server = HttpServer.create(new java.net.InetSocketAddress(8081), 0);
        server.createContext("/api/redeemed_rewards", new RedeemedRewardsHandler());
        server.createContext("/api/rewards.json", new RewardsJsonHandler());
        // server.createContext("/api/redeem_reward", new RedeemRewardHandler()); // entfernt, Redeems laufen nur noch über Supabase
        server.createContext("/overlay.html", new StaticFileHandler("overlay.html", "text/html"));
        server.createContext("/media", new StaticDirHandler("media"));
        server.setExecutor(null);
        server.start();

        // Prüfe beim Start, ob rewards.json existiert, sonst Fehler ausgeben
        if (!Files.exists(Paths.get(rewardsJsonPath))) {
            System.err.println("[OverlayApiServer] WARNUNG: rewards.json wurde nicht gefunden! Bitte stelle sicher, dass sie neben der EXE liegt.");
        } else {
            System.out.println("[OverlayApiServer] rewards.json gefunden.");
        }
    }

    class RedeemedRewardsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            if (method.equalsIgnoreCase("GET")) {
                JSONArray rewards = supabaseClient.getRedeemedRewards();
                String response = rewards.toString();
                byte[] responseBytes = response.getBytes(java.nio.charset.StandardCharsets.UTF_8);
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
                System.out.println("[OverlayApiServer] DELETE-Request für redeemed_reward id=" + id);
                // NEU: Vor dem Löschen prüfen, ob Cooldown abgelaufen ist
                JSONObject redeemedReward = supabaseClient.getRedeemedRewardById(id);
                if (redeemedReward == null) {
                    exchange.sendResponseHeaders(404, 0);
                    exchange.getResponseBody().close();
                    return;
                }
                String rewardId = redeemedReward.getString("reward_id");
                long timestamp = redeemedReward.getLong("timestamp");
                int cooldown = supabaseClient.getRewardCooldownFromDb(rewardId); // Sekunden
                long now = System.currentTimeMillis();
                long elapsed = (now - timestamp) / 1000L;
                if (cooldown > 0 && elapsed < cooldown) {
                    // Cooldown noch aktiv, nicht löschen
                    JSONObject resp = new JSONObject();
                    resp.put("success", false);
                    resp.put("cooldown", cooldown);
                    resp.put("remaining", cooldown - elapsed);
                    String respStr = resp.toString();
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(429, respStr.length());
                    exchange.getResponseBody().write(respStr.getBytes());
                    exchange.getResponseBody().close();
                    return;
                }
                // Cooldown abgelaufen, jetzt löschen
                boolean success = supabaseClient.deleteRedeemedReward(id);
                System.out.println("[OverlayApiServer] DELETE-Result für id=" + id + ": " + (success ? "deleted" : "not found"));
                String response = success ? "deleted" : "not found";
                exchange.sendResponseHeaders(success ? 200 : 404, response.length());
                OutputStream os = exchange.getResponseBody();
                os.write(response.getBytes());
                os.close();
            } else {
                exchange.sendResponseHeaders(405, 0);
                exchange.getResponseBody().close();
            }
        }
    }

    class RewardsJsonHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            if (method.equalsIgnoreCase("GET")) {
                try {
                    String json = new String(Files.readAllBytes(Paths.get(rewardsJsonPath)));
                    // Teste, ob JSON gültig ist
                    new org.json.JSONArray(json); // oder new org.json.JSONObject(json) bei Objekt
                    byte[] jsonBytes = json.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, jsonBytes.length);
                    OutputStream os = exchange.getResponseBody();
                    os.write(jsonBytes);
                    os.close();
                } catch (Exception e) {
                    System.err.println("[OverlayApiServer] Fehler beim Lesen/Parsen von rewards.json: " + e.getMessage());
                    exchange.sendResponseHeaders(500, 0);
                    exchange.getResponseBody().close();
                }
            } else if (method.equalsIgnoreCase("POST")) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());
                    // Teste, ob JSON gültig ist
                    new org.json.JSONArray(body); // oder new org.json.JSONObject(body) bei Objekt
                    Files.write(Paths.get(rewardsJsonPath), body.getBytes());
                    exchange.sendResponseHeaders(200, 0);
                    exchange.getResponseBody().close();
                } catch (Exception e) {
                    System.err.println("[OverlayApiServer] Fehler beim Schreiben/Parsen von rewards.json: " + e.getMessage());
                    exchange.sendResponseHeaders(400, 0);
                    exchange.getResponseBody().close();
                }
            } else {
                exchange.sendResponseHeaders(405, 0);
                exchange.getResponseBody().close();
            }
        }
    }

    // Handler für das Einlösen von Rewards mit Cooldown-Prüfung wurde entfernt, da Redeems nur noch über Supabase laufen

    static class StaticFileHandler implements HttpHandler {
        private final String resourcePath;
        private final String contentType;
        public StaticFileHandler(String resourcePath, String contentType) {
            this.resourcePath = resourcePath;
            this.contentType = contentType;
        }
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try (java.io.InputStream is = getClass().getClassLoader().getResourceAsStream(resourcePath)) {
                if (is == null) {
                    exchange.sendResponseHeaders(404, 0);
                    exchange.getResponseBody().close();
                    return;
                }
                byte[] data = is.readAllBytes();
                exchange.getResponseHeaders().add("Content-Type", contentType);
                exchange.sendResponseHeaders(200, data.length);
                OutputStream os = exchange.getResponseBody();
                os.write(data);
                os.close();
            } catch (IOException e) {
                exchange.sendResponseHeaders(500, 0);
                exchange.getResponseBody().close();
            }
        }
    }

    static class StaticDirHandler implements HttpHandler {
        private final String resourceDir;
        public StaticDirHandler(String resourceDir) {
            this.resourceDir = resourceDir;
        }
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String uri = exchange.getRequestURI().getPath();
            String fileName = uri.substring(uri.lastIndexOf("/") + 1);
            String resourcePath = resourceDir + "/" + fileName;
            try (java.io.InputStream is = getClass().getClassLoader().getResourceAsStream(resourcePath)) {
                if (is == null) {
                    exchange.sendResponseHeaders(404, 0);
                    exchange.getResponseBody().close();
                    return;
                }
                String contentType = java.nio.file.Files.probeContentType(java.nio.file.Paths.get(fileName));
                byte[] data = is.readAllBytes();
                exchange.getResponseHeaders().add("Content-Type", contentType != null ? contentType : "application/octet-stream");
                exchange.sendResponseHeaders(200, data.length);
                OutputStream os = exchange.getResponseBody();
                os.write(data);
                os.close();
            } catch (IOException e) {
                exchange.sendResponseHeaders(500, 0);
                exchange.getResponseBody().close();
            }
        }
    }

    // Synchronisiert alle Rewards aus rewards.json in die Supabase-DB
    public static void syncRewardsFromJson(SupabaseClient supabaseClient, String rewardsJsonPath) {
        try {
            String json = new String(Files.readAllBytes(Paths.get(rewardsJsonPath)));
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject reward = arr.getJSONObject(i);
                supabaseClient.upsertReward(reward);
            }
            System.out.println("Rewards erfolgreich mit Supabase synchronisiert.");
        } catch (Exception e) {
            System.err.println("Fehler beim Synchronisieren der Rewards: " + e.getMessage());
        }
    }
}
