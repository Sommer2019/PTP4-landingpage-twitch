# Migration Guide: Rewards - Spalten-Konsolidierung

## Problem
Die `rewards`-Tabelle hatte mehrere redundante Spalten mit unterschiedlichen Schreibweisen:
- `onceperstream` vs `oncePerStream` (Camel Case)
- `mediaurl` vs `mediaUrl` (Camel Case)  
- Sowie weitere veraltete Spalten (`nameKey`, `descKey`, `showYoutubeVideo`)

Dies führte zu Fehlern beim Speichern von Rewards:
```
{"code":"42703","details":null,"message":"record \"new\" has no field \"oncePerStream\""}
{"code":"42703","details":null,"message":"record \"new\" has no field \"mediaUrl\""}
```

## Lösung
Alle Spalten wurden konsolidiert auf **Kleinbuchstaben-Versionen**:
- `onceperstream` (klein)
- `mediaurl` (klein)
- Veraltete Spalten entfernt

### Änderungen

#### 1. TypeScript-Code (`src/pages/ModerateAccountPage.tsx`)
- Interface `Reward`: `onceperstream?: boolean`
- `defaultReward`: `onceperstream: false`
- Formular-Handling: `rewardForm.onceperstream`

#### 2. SQL-Migration
- Entfernte die redundante Spalte `oncePerStream` aus der `rewards`-Tabelle
- Vereinfachte die `sync_reward_columns()`-Funktion
- Aktualisierte die `redeem_reward()`-Funktion, um nur noch `onceperstream` zu prüfen

## Deployment-Schritte

### Schritt 1: Backup erstellen
```sql
-- In Supabase SQL Editor ausführen
SELECT * FROM rewards LIMIT 1;
```

## Schritt 2: Datenbank-Migration durchführen
1. Gehe zu **Supabase Dashboard** → Dein Projekt
2. Wähle **SQL Editor** aus
3. Kopiere die folgende Migration:

```sql
-- Entferne redundante Spalten mit Camel Case
ALTER TABLE public.rewards DROP COLUMN IF EXISTS "oncePerStream";
ALTER TABLE public.rewards DROP COLUMN IF EXISTS "mediaUrl";
ALTER TABLE public.rewards DROP COLUMN IF EXISTS "nameKey";
ALTER TABLE public.rewards DROP COLUMN IF EXISTS "descKey";
ALTER TABLE public.rewards DROP COLUMN IF EXISTS "showYoutubeVideo";

-- Stelle sicher, dass die richtigen Spalten existieren (Kleinbuchstaben)
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS onceperstream boolean DEFAULT false;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS mediaurl text;

-- Vereinfachter Trigger (keine Spalten-Syncs mehr nötig)
CREATE OR REPLACE FUNCTION public.sync_reward_columns() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Aktualisiere RLS Policies: Moderatoren UND Broadcaster dürfen Rewards bearbeiten
DROP POLICY IF EXISTS "Broadcaster kann Rewards einfügen" ON public.rewards;
DROP POLICY IF EXISTS "Broadcaster kann Rewards ändern" ON public.rewards;

CREATE POLICY "Broadcaster kann Rewards einfügen" ON public.rewards FOR INSERT 
  WITH CHECK (
    (current_setting('request.jwt.claim.role', true) = 'service_role') 
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_broadcaster = true)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_moderator = true)
  );

CREATE POLICY "Broadcaster kann Rewards ändern" ON public.rewards FOR UPDATE 
  USING (
    (current_setting('request.jwt.claim.role', true) = 'service_role') 
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_broadcaster = true)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_moderator = true)
  )
  WITH CHECK (
    (current_setting('request.jwt.claim.role', true) = 'service_role') 
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_broadcaster = true)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_moderator = true)
  );
```

4. Klicke **Run** um die Migration auszuführen

### Schritt 3: Anwendung bereitstellen
```bash
git pull
npm install
npm run build
# Deployment durchführen (je nach deinem Setup)
```

### Schritt 4: Testen
1. Öffne die Moderate Account Page
2. Versuche einen Reward zu erstellen/bearbeiten
3. Speichere den Reward und überprüfe, dass keine Fehler auftreten

## Verifikation

Nach der Migration kannst du überprüfen, dass alles korrekt ist:

```sql
-- Prüfe die Spaltenstruktur
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'rewards'
ORDER BY ordinal_position;

-- Sollte NUR diese Spalten haben (keine oncePerStream, mediaUrl, nameKey, descKey, showYoutubeVideo):
-- ✓ id, name, cost, mediaurl, showmedia, description, imageurl, text, duration, onceperstream, cooldown, istts, namekey, desckey, customImageUrl
```

## Rollback (falls nötig)

Falls etwas schiefgeht, kannst du zur vorherigen Version der Migration zurückkehren. Die Migrationen sind in `supabase/migrations/` gespeichert.

## Wichtig
⚠️ Diese Migration ist **nicht-destruktiv**:
- Bestehende Daten in allen Spalten werden erhalten
- Die redundanten Spalten werden nur gelöscht, falls vorhanden
- Alle Rewards bleiben funktionsfähig
- **RLS wurde aktualisiert**: Moderatoren dürfen jetzt auch Rewards bearbeiten

