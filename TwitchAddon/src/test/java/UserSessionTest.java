import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class UserSessionTest {

    @Test
    void constructor_setsFieldsCorrectly() {
        long before = System.currentTimeMillis();
        UserSession session = new UserSession("alice", "uid42", before);

        assertEquals("alice", session.username);
        assertEquals("uid42", session.userid);
        assertEquals(before, session.joinTimestamp);
    }

    @Test
    void constructor_defaultsBooleanFlagsToFalse() {
        UserSession session = new UserSession("bob", "uid1", System.currentTimeMillis());

        assertFalse(session.isFollower);
        assertFalse(session.hasReceivedFollowPoints);
        assertFalse(session.hasReceived5MinPoints);
        assertFalse(session.hasReceived30MinPoints);
        assertFalse(session.hasReceivedStayTillEndPoints);
    }

    @Test
    void fields_areMutable() {
        UserSession session = new UserSession("carol", "uid2", System.currentTimeMillis());
        session.isFollower = true;
        session.hasReceivedFollowPoints = true;
        session.hasReceived5MinPoints = true;
        session.hasReceived30MinPoints = true;
        session.hasReceivedStayTillEndPoints = true;

        assertTrue(session.isFollower);
        assertTrue(session.hasReceivedFollowPoints);
        assertTrue(session.hasReceived5MinPoints);
        assertTrue(session.hasReceived30MinPoints);
        assertTrue(session.hasReceivedStayTillEndPoints);
    }
}
