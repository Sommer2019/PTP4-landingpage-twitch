import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UserPointsManagerTest {

    private SupabaseClient mockSupabase;
    private UserPointsManager manager;

    @BeforeEach
    void setUp() {
        mockSupabase = Mockito.mock(SupabaseClient.class);
        manager = new UserPointsManager(mockSupabase, "broadcaster123");
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
        when(mockSupabase.existsUser("alice", "uid1")).thenReturn(true);

        manager.userJoined("alice", "uid1");

        assertNotNull(manager.getSession("alice"));
        assertEquals("alice", manager.getSession("alice").username);
    }

    @Test
    void userJoined_callsCreateUserWhenUserDoesNotExist() {
        when(mockSupabase.existsUser("newbie", "uid2")).thenReturn(false);

        manager.userJoined("newbie", "uid2");

        verify(mockSupabase).createUser("newbie", "uid2");
    }

    @Test
    void userJoined_doesNotCreateUserWhenAlreadyExists() {
        when(mockSupabase.existsUser("veteran", "uid3")).thenReturn(true);

        manager.userJoined("veteran", "uid3");

        verify(mockSupabase, never()).createUser(anyString(), anyString());
    }

    @Test
    void userJoined_ignoresBroadcaster() {
        manager.userJoined("StreamerName", "broadcaster123");

        assertNull(manager.getSession("StreamerName"));
        verify(mockSupabase, never()).existsUser(anyString(), anyString());
    }

    // ── userLeft ───────────────────────────────────────────────────────────

    @Test
    void userLeft_removesSession() {
        when(mockSupabase.existsUser("alice", "uid1")).thenReturn(true);
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
        manager.addPoints("alice", "uid1", 10, "follow");

        verify(mockSupabase).addOrUpdatePoints("alice", "uid1", 10, "follow");
    }

    @Test
    void addPoints_skipsBroadcasterUnlessSpecialReason() {
        manager.addPoints("StreamerName", "broadcaster123", 50, "watch");

        verify(mockSupabase, never()).addOrUpdatePoints(anyString(), anyString(), anyInt(), anyString());
    }

    // ── setFollower ────────────────────────────────────────────────────────

    @Test
    void setFollower_updatesSessionFlag() {
        when(mockSupabase.existsUser("alice", "uid1")).thenReturn(true);
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
        when(mockSupabase.existsUser(anyString(), anyString())).thenReturn(true);
        manager.userJoined("alice", "uid1");
        manager.userJoined("bob", "uid2");

        assertEquals(2, manager.getAllSessions().size());
    }
}
