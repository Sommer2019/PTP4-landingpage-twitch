"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Einstiegspunkt des Discord-Bots: startet einen Express-Server, dessen
 * API-Endpunkte Voting-Nachrichten in einen Discord-Channel posten.
 */
const discord_js_1 = require("discord.js");
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv = __importStar(require("dotenv"));
const lib_1 = require("./lib");
dotenv.config();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Rate-Limit gegen Brute-Force auf den API-Key — 60 Requests pro Minute pro IP
app.use((0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Zu viele Anfragen — bitte später erneut versuchen.',
}));
app.use((req, res, next) => {
    if ((0, lib_1.isAuthorized)(req.headers['x-api-key'], SUPABASE_SERVICE_ROLE_KEY)) {
        next();
    }
    else {
        res.status(401).send('Nicht autorisiert!');
    }
});
const client = new discord_js_1.Client({
    intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildMessages]
});
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PORT = (0, lib_1.parsePort)(process.env.PORT);
/** Postet eine Nachricht in den konfigurierten Channel; Fehler werden geloggt, nicht geworfen. */
const sendDiscordMessage = async (message) => {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (channel) {
            await channel.send(message);
        }
    }
    catch (error) {
        console.error('Fehler beim Senden der Discord-Nachricht:', error);
    }
};
// --- API Endpunkte ---
/** Registriert einen POST-Endpunkt, der die zur Runde gehörende Voting-Nachricht in Discord postet. */
function registerRoundEndpoint(endpoint) {
    app.post(`/${endpoint}`, (_req, res) => {
        sendDiscordMessage((0, lib_1.buildRoundMessage)(endpoint));
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
app.get('/', (_req, res) => {
    res.status(200).send('OK');
});
client.once('clientReady', () => {
    console.log(`Eingeloggt als ${client.user?.tag}`);
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server läuft auf Port ${PORT}`);
    });
});
client.login(DISCORD_TOKEN);
