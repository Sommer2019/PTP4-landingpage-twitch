// Pure Helper für den Discord-Bot — getrennt von index.ts, damit sie ohne
// discord.js / express importiert und getestet werden können.

export type RoundEndpoint =
    | 'start-runde-1'
    | 'ende-runde-1'
    | 'start-runde-2'
    | 'ende-runde-2'
    | 'start-jahr'
    | 'ende-jahr'

export const VOTING_URL = 'https://hd1920x1080.de/clipdesmonats'

const MESSAGES: Record<RoundEndpoint, string> = {
    'start-runde-1': `🚀 **Clip des Monats Runde 1 hat begonnen!** Jetzt abstimmen! ${VOTING_URL}`,
    'ende-runde-1': `🏁 **Clip des Monats Runde 1 ist beendet.** Die Ergebnisse werden ausgewertet! ${VOTING_URL}`,
    'start-runde-2': `🔥 **Clip des Monats Runde 2 startet jetzt!** Hier abstimmen und die besten Clips küren! ${VOTING_URL}`,
    'ende-runde-2': `🛑 **Clip des Monats Runde 2 ist vorbei.** Vielen Dank fürs Mitmachen! ${VOTING_URL}`,
    'start-jahr': `🌟 **Das Clip des Jahres Voting beginnt!** Ein Rückblick der Superlative. ${VOTING_URL}`,
    'ende-jahr': `🏆 **Das Clip des Jahres Voting ist abgeschlossen!** Die Legenden stehen fest. ${VOTING_URL}`,
}

export function buildRoundMessage(endpoint: RoundEndpoint): string {
    return MESSAGES[endpoint]
}

export function isAuthorized(providedKey: unknown, expectedKey: string | undefined): boolean {
    if (!expectedKey) return false
    if (typeof providedKey !== 'string') return false
    return providedKey === expectedKey
}

export function parsePort(value: string | undefined, fallback = 3000): number {
    const parsed = parseInt(value ?? '', 10)
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) return fallback
    return parsed
}
