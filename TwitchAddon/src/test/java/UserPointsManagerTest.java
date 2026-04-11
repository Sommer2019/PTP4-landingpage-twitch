import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class UserPointsManagerTest {

    private FakeSupabaseClient mockSupabase;
    private UserPointsManager manager;

    @BeforeEach
    void setUp() {
        mockSupabase = new FakeSupabaseClient();
        manager = new UserPointsManager(mockSupabase, "broadcaster123");
    }

    private static class FakeSupabaseClient extends SupabaseClient {
        private boolean existsUserResult = false;
        private String lastCreatedUsername;
        private String lastCreatedUserId;
        private String lastPointsUsername;
        private String lastPointsUserId;
        private int lastPoints;
        private String lastPointsReason;

        private FakeSupabaseClient() {
            super(null, null);
        }

        void setExistsUserResult(boolean existsUserResult) {
            this.existsUserResult = existsUserResult;
        }

        @Override
        public boolean existsUser(String username, String userid) {
            return existsUserResult;
        }

        @Override
        public void createUser(String username, String userid) {
            this.lastCreatedUsername = username;
            this.lastCreatedUserId = userid;
        }

        @Override
        public void addOrUpdatePoints(String username, String userid, int points, String reason) {
            this.lastPointsUsername = username;
            this.lastPointsUserId = userid;
            this.lastPoints = points;
            this.lastPointsReason = reason;
        }

        void resetCalls() {
            lastCreatedUsername = null;
            lastCreatedUserId = null;
            lastPointsUsername = null;
            lastPointsUserId = null;
            lastPoints = 0;
            lastPointsReason = null;
        }
    }

    // ── isBroadcaster ──────────────────────────────────────────────────────

    @Test
    void isBroadcaster_returnsTrueForBroadcasterUserId() {
        assertTrue(manager.isBroadcaster("StreamerName", "broadcaster123"));
    }

    @Test
    void isBroadcaster_returnsFalseForOtherUser() {
        assertFalse(manager.isBroadcaster("alice", "uid_alice"));
    }

    @Test
    void isBroadcaster_returnsFalseForNullUserId() {
        assertFalse(manager.isBroadcaster("someone", null));
    }

    // ── userJoined ─────────────────────────────────────────────────────────

    @Test
    void userJoined_createsSessionForRegularUser() {
        mockSupabase.setExistsUserResult(true);

        manager.userJoined("alice", "uid1");

        assertNotNull(manager.getSession("alice"));
        assertEquals("alice", manager.getSession("alice").username);
    }

    @Test
    void userJoined_callsCreateUserWhenUserDoesNotExist() {
        mockSupabase.setExistsUserResult(false);

        manager.userJoined("newbie", "uid2");

        assertEquals("newbie", mockSupabase.lastCreatedUsername);
        assertEquals("uid2", mockSupabase.lastCreatedUserId);
    }

    @Test
    void userJoined_doesNotCreateUserWhenAlreadyExists() {
        mockSupabase.setExistsUserResult(true);

        manager.userJoined("veteran", "uid3");

        assertNull(mockSupabase.lastCreatedUsername);
        assertNull(mockSupabase.lastCreatedUserId);
    }

    @Test
    void userJoined_ignoresBroadcaster() {
        manager.userJoined("StreamerName", "broadcaster123");

        assertNull(manager.getSession("StreamerName"));
        assertNull(mockSupabase.lastCreatedUsername);
        assertNull(mockSupabase.lastCreatedUserId);
    }

    // ── userLeft ───────────────────────────────────────────────────────────

    @Test
    void userLeft_removesSession() {
        mockSupabase.setExistsUserResult(true);
        manager.userJoined("alice", "uid1");

        manager.userLeft("alice");

        assertNull(manager.getSession("alice"));
    }

    @Test
    void userLeft_doesNothingForUnknownUser() {
        // Should not throw
        assertDoesNotThrow(() -> manager.userLeft("ghost"));
    }

    // ── addPoints ──────────────────────────────────────────────────────────

    @Test
    void addPoints_delegatesToSupabase() {
        mockSupabase.resetCalls();
        manager.addPoints("alice", "uid1", 10, "follow");

        assertEquals("alice", mockSupabase.lastPointsUsername);
        assertEquals("uid1", mockSupabase.lastPointsUserId);
        assertEquals(10, mockSupabase.lastPoints);
        assertEquals("follow", mockSupabase.lastPointsReason);
    }

    @Test
    void addPoints_skipsBroadcasterUnlessSpecialReason() {
        mockSupabase.resetCalls();
        manager.addPoints("StreamerName", "broadcaster123", 50, "watch");

        assertNull(mockSupabase.lastPointsUsername);
        assertNull(mockSupabase.lastPointsUserId);
    }

    // ── setFollower ────────────────────────────────────────────────────────

    @Test
    void setFollower_updatesSessionFlag() {
        mockSupabase.setExistsUserResult(true);
        manager.userJoined("alice", "uid1");

        manager.setFollower("alice");

        assertTrue(manager.getSession("alice").isFollower);
    }

    @Test
    void setFollower_doesNothingWhenNoSession() {
        // Should not throw
        assertDoesNotThrow(() -> manager.setFollower("nobody"));
    }

    // ── getAllSessions ─────────────────────────────────────────────────────

    @Test
    void getAllSessions_returnsAllActiveSessions() {
        mockSupabase.setExistsUserResult(true);
        manager.userJoined("alice", "uid1");
        manager.userJoined("bob", "uid2");

        assertEquals(2, manager.getAllSessions().size());
    }
}
