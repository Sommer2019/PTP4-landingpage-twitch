/**
 * Einstiegspunkt des Discord-Bots: startet einen Express-Server, dessen
 * API-Endpunkte Voting-Nachrichten in einen Discord-Channel posten.
 */
import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as dotenv from 'dotenv';
import { buildRoundMessage, isAuthorized, parsePort, type RoundEndpoint } from './lib';

dotenv.config();

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const app = express();
app.use(express.json());

// Rate-Limit gegen Brute-Force auf den API-Key — 60 Requests pro Minute pro IP
app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Zu viele Anfragen — bitte später erneut versuchen.',
}));

app.use((req: Request, res: Response, next: express.NextFunction) => {
    if (isAuthorized(req.headers['x-api-key'], SUPABASE_SERVICE_ROLE_KEY)) {
        next();
    } else {
        res.status(401).send('Nicht autorisiert!');
    }
});

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PORT: number = parsePort(process.env.PORT);

/** Postet eine Nachricht in den konfigurierten Channel; Fehler werden geloggt, nicht geworfen. */
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

/** Registriert einen POST-Endpunkt, der die zur Runde gehörende Voting-Nachricht in Discord postet. */
function registerRoundEndpoint(endpoint: RoundEndpoint) {
    app.post(`/${endpoint}`, (_req: Request, res: Response) => {
        sendDiscordMessage(buildRoundMessage(endpoint));
        res.status(200).send({ status: 'Gesendet' });
    });
}

registerRoundEndpoint('start-runde-1');
registerRoundEndpoint('ende-runde-1');
registerRoundEndpoint('start-runde-2');
registerRoundEndpoint('ende-runde-2');
registerRoundEndpoint('start-jahr');
registerRoundEndpoint('ende-jahr');

// Health-Check — muss vor client.login registriert sein, damit der Server sofort antwortet
app.get('/', (_req: Request, res: Response) => {
    res.status(200).send('OK');
});

client.once('clientReady', () => {
    console.log(`Eingeloggt als ${client.user?.tag}`);
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server läuft auf Port ${PORT}`);
    });
});

client.login(DISCORD_TOKEN);
