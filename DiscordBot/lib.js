"use strict";
// Pure Helper für den Discord-Bot — getrennt von index.ts, damit sie ohne
// discord.js / express importiert und getestet werden können.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VOTING_URL = void 0;
exports.buildRoundMessage = buildRoundMessage;
exports.isAuthorized = isAuthorized;
exports.parsePort = parsePort;
exports.VOTING_URL = 'https://hd1920x1080.de/clipdesmonats';
const MESSAGES = {
    'start-runde-1': `🚀 **Clip des Monats Runde 1 hat begonnen!** Jetzt abstimmen! ${exports.VOTING_URL}`,
    'ende-runde-1': `🏁 **Clip des Monats Runde 1 ist beendet.** Die Ergebnisse werden ausgewertet! ${exports.VOTING_URL}`,
    'start-runde-2': `🔥 **Clip des Monats Runde 2 startet jetzt!** Hier abstimmen und die besten Clips küren! ${exports.VOTING_URL}`,
    'ende-runde-2': `🛑 **Clip des Monats Runde 2 ist vorbei.** Vielen Dank fürs Mitmachen! ${exports.VOTING_URL}`,
    'start-jahr': `🌟 **Das Clip des Jahres Voting beginnt!** Ein Rückblick der Superlative. ${exports.VOTING_URL}`,
    'ende-jahr': `🏆 **Das Clip des Jahres Voting ist abgeschlossen!** Die Legenden stehen fest. ${exports.VOTING_URL}`,
};
/** Liefert die fertige Discord-Nachricht für den angegebenen Runden-Endpunkt. */
function buildRoundMessage(endpoint) {
    return MESSAGES[endpoint];
}
/** Prüft den mitgeschickten API-Key gegen den erwarteten Key. */
function isAuthorized(providedKey, expectedKey) {
    // Fehlender erwarteter Key bedeutet "nicht konfiguriert" — niemals durchlassen.
    if (!expectedKey)
        return false;
    if (typeof providedKey !== 'string')
        return false;
    return providedKey === expectedKey;
}
/** Parst einen Port-String; fällt bei ungültigem Wert oder Bereichsüberschreitung auf den Fallback zurück. */
function parsePort(value, fallback = 3000) {
    const parsed = parseInt(value ?? '', 10);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535)
        return fallback;
    return parsed;
}
