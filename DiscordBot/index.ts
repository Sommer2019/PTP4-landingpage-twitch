import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const app = express();
app.use(express.json());

// Middleware zum Prüfen des API-Keys
app.use((req, res, next) => {
    const userKey = req.headers['x-api-key'];
    if (userKey === SUPABASE_SERVICE_ROLE_KEY) {
        next();
    } else {
        res.status(401).send('Nicht autorisiert!');
    }
});

// Discord Client Setup
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PORT = Number(process.env.PORT) || 3000;

// Hilfsfunktion zum Nachrichtensenden
const sendDiscordMessage = async (message: string) => {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID!) as TextChannel;
        if (channel) {
            await channel.send(message);
        }
    } catch (error) {
        console.error('Fehler beim Senden der Discord-Nachricht:', error);
    }
};

// --- API Endpunkte ---

app.post('/start-runde-1', (_req: Request, res: Response) => {
    sendDiscordMessage("🚀 **Clip des Monats Runde 1 hat begonnen!** Jetzt abstimmen! https://hd1920x1080.de/clipdesmonats");
    res.status(200).send({ status: 'Gesendet' });
});

app.post('/ende-runde-1', (_req: Request, res: Response) => {
    sendDiscordMessage("🏁 **Clip des Monats Runde 1 ist beendet.** Die Ergebnisse werden ausgewertet! https://hd1920x1080.de/clipdesmonats");
    res.status(200).send({ status: 'Gesendet' });
});

app.post('/start-runde-2', (_req: Request, res: Response) => {
    sendDiscordMessage("🔥 **Clip des Monats Runde 2 startet jetzt!** Hier abstimmen und die besten Clips küren! https://hd1920x1080.de/clipdesmonats");
    res.status(200).send({ status: 'Gesendet' });
});

app.post('/ende-runde-2', (_req: Request, res: Response) => {
    sendDiscordMessage("🛑 **Clip des Monats Runde 2 ist vorbei.** Vielen Dank fürs Mitmachen! https://hd1920x1080.de/clipdesmonats");
    res.status(200).send({ status: 'Gesendet' });
});

app.post('/start-jahr', (_req: Request, res: Response) => {
    sendDiscordMessage("🌟 **Das Clip des Jahres Voting beginnt!** Ein Rückblick der Superlative. https://hd1920x1080.de/clipdesmonats");
    res.status(200).send({ status: 'Gesendet' });
});

app.post('/ende-jahr', (_req: Request, res: Response) => {
    sendDiscordMessage("🏆 **Das Clip des Jahres Voting ist abgeschlossen!** Die Legenden stehen fest. https://hd1920x1080.de/clipdesmonats");
    res.status(200).send({ status: 'Gesendet' });
});

// Bot starten
client.once('ready', () => {
    console.log(`Eingeloggt als ${client.user?.tag}`);
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server läuft auf Port ${PORT}`);
    });
});

client.login(DISCORD_TOKEN);