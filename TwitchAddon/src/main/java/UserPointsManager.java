import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class UserPointsManager {
    private static final Logger logger = LoggerFactory.getLogger(UserPointsManager.class);
    private final SupabaseClient supabaseClient;
    private final Map<String, UserSession> sessions = new ConcurrentHashMap<>();

    public UserPointsManager(SupabaseClient supabaseClient) {
        this.supabaseClient = supabaseClient;
    }

    public void userJoined(String username, String userid) {
        logger.info("userJoined: {}", username);
        sessions.put(username, new UserSession(username, userid, System.currentTimeMillis()));
        // Prüfe, ob User in DB existiert, sonst anlegen
        if (!supabaseClient.existsUser(username, userid)) {
            supabaseClient.createUser(username, userid);
        }
    }

    public void userLeft(String username) {
        logger.info("userLeft: {}", username);
        sessions.remove(username);
    }

    public UserSession getSession(String username) {
        return sessions.get(username);
    }

    public void addPoints(String username, String userid, int points, String reason) {
        logger.info("addPoints: {} | {} | {}", username, points, reason);
        supabaseClient.addOrUpdatePoints(username, userid, points, reason);
    }

    public void setFollower(String username) {
        logger.info("setFollower: {}", username);
        UserSession session = sessions.get(username);
        if (session != null) session.isFollower = true;
    }

    public Map<String, UserSession> getAllSessions() {
        return sessions;
    }
}
