public class UserSession {
    public String username;
    public long joinTimestamp;
    public boolean isFollower;
    public boolean hasReceivedFollowPoints;
    public boolean hasReceived5MinPoints;
    public boolean hasReceived30MinPoints;
    public boolean hasReceivedStayTillEndPoints;

    public UserSession(String username, long joinTimestamp) {
        this.username = username;
        this.joinTimestamp = joinTimestamp;
        this.isFollower = false;
        this.hasReceivedFollowPoints = false;
        this.hasReceived5MinPoints = false;
        this.hasReceived30MinPoints = false;
        this.hasReceivedStayTillEndPoints = false;
    }
}

