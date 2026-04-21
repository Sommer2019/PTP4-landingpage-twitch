# Nutze ein leichtes Java-Image
FROM eclipse-temurin:21-jre-alpine

# Arbeitsverzeichnis im Container
WORKDIR /app

# Kopiere die JAR aus deinem Repo in den Container
COPY ChannelPointsBot-1.0-SNAPSHOT.jar app.jar

# Befehl zum Starten des Bots
CMD ["java", "-jar", "app.jar"]
