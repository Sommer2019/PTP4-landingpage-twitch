FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# JAR liegt nach mvn package in TwitchAddon/target/
# Context ist Repo-Root, daher der volle Pfad
COPY TwitchAddon/target/ChannelPointsBot-1.0-SNAPSHOT.jar app.jar

CMD ["java", "-jar", "app.jar"]