-- ════════════════════════════════════════════════════════════════
-- Rewards: neue IDs als aufsteigende Zahlen statt UUID
--
-- Bestehende Rewards sind bereits numerisch nummeriert.
-- Diese Migration:
--  1. Legt eine Sequence an, gestartet bei MAX(existing_id) + 1
--     (so kollidiert keine neue ID mit bereits vergebenen).
--  2. Schreibt den BEFORE-INSERT-Trigger ensure_rewards_id() um,
--     so dass NULL/leere IDs aus der Sequence gefuellt werden.
-- Spaltentyp bleibt text — die Frontend-/Bot-Codes erwarten string-IDs,
-- numeric-strings ('1','2',...) sind kompatibel.
-- ════════════════════════════════════════════════════════════════

CREATE SEQUENCE IF NOT EXISTS public.rewards_id_seq AS bigint START 1 MINVALUE 1;

-- Sequence auf MAX(numerische id)+1 setzen, damit Neueintraege nicht kollidieren.
-- Nicht-numerische Alt-IDs (z.B. UUID-Reste) werden ignoriert.
SELECT setval(
  'public.rewards_id_seq',
  GREATEST(
    1,
    COALESCE(
      (SELECT MAX(id::bigint) FROM public.rewards WHERE id ~ '^[0-9]+$'),
      0
    )
  ),
  true
);

-- Trigger-Funktion: bei INSERT ohne id (oder leerem string) aus Sequence fuellen.
CREATE OR REPLACE FUNCTION public.ensure_rewards_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    NEW.id := nextval('public.rewards_id_seq')::text;
  END IF;
  RETURN NEW;
END;
$$;

-- Default auf Spalte umstellen, falls jemand am Trigger vorbei direkt INSERTed.
ALTER TABLE public.rewards
  ALTER COLUMN id SET DEFAULT nextval('public.rewards_id_seq')::text;

-- Sequence der Tabelle "zuordnen" — beim DROP TABLE wird die Sequence
-- mitentfernt, sauberes Cleanup.
ALTER SEQUENCE public.rewards_id_seq OWNED BY public.rewards.id;
