/** Liefert eine anzeigbare Fehlermeldung für beliebige Fehlerwerte (string, Error, Objekt mit message). */
export function getErrorMessage(e: unknown): string {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: string }).message === 'string') {
    return (e as { message: string }).message
  }
  return 'Unbekannter Fehler'
}
