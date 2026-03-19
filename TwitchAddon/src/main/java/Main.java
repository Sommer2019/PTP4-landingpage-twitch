import io.github.cdimascio.dotenv.Dotenv;

import java.io.IOException;

public class Main {
    public static void main(String[] args) throws IOException {
        Dotenv dotenv = Dotenv.load();
        String supabaseUrl = dotenv.get("SUPABASE_URL");
        String supabaseApiKey = dotenv.get("SUPABASE_API_KEY");
        String twitchOauthToken = dotenv.get("TWITCH_OAUTH_TOKEN");
        String twitchClientId = dotenv.get("TWITCH_CLIENT_ID");
        String channelName = dotenv.get("CHANNEL_NAME");

        SupabaseClient supabaseClient = new SupabaseClient(supabaseUrl, supabaseApiKey);
        // Rewards aus rewards.json im aktuellen Arbeitsverzeichnis in die DB synchronisieren
        OverlayApiServer.syncRewardsFromJson(supabaseClient, "rewards.json");
        System.out.println("[Main] Starte Overlay-API-Server...");
        UserPointsManager pointsManager = new UserPointsManager(supabaseClient);
        TwitchBot bot = new TwitchBot(twitchOauthToken, twitchClientId, channelName, pointsManager);
        bot.connect();

        OverlayApiServer overlayApiServer = new OverlayApiServer(supabaseClient);

        System.out.println("Bot läuft. Punkte werden in Supabase gespeichert.");
    }
}
