-- ============================================================
-- Supabase SQL Setup für Bartclicker Leaderboard mit Profiles
-- ============================================================
-- Kopiere diese Befehle in den Supabase SQL Editor und führe sie aus!

-- 1. Erstelle die profiles Tabelle
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are public" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Erstelle die RPC-Funktion für Leaderboard mit Namen
CREATE OR REPLACE FUNCTION get_bartclicker_leaderboard_with_names(p_limit integer DEFAULT 100)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  total_ever numeric,
  rebirth_count integer,
  last_updated timestamptz,
  display_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY bs.total_ever DESC, bs.rebirth_count DESC) as rank,
    bs.user_id,
    bs.total_ever,
    bs.rebirth_count,
    bs.last_updated,
    COALESCE(p.username, 'Player ' || ROW_NUMBER() OVER (ORDER BY bs.total_ever DESC, bs.rebirth_count DESC)::text)::text as display_name
  FROM bartclicker_scores bs
  LEFT JOIN profiles p ON p.id = bs.user_id
  WHERE bs.total_ever > 0 OR bs.rebirth_count > 0
  ORDER BY bs.total_ever DESC, bs.rebirth_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Gib Permissions
GRANT EXECUTE ON FUNCTION get_bartclicker_leaderboard_with_names(integer) TO anon, authenticated;
GRANT SELECT ON profiles TO anon, authenticated;

-- ============================================================
-- Fertig! Jetzt sollte alles funktionieren.
-- ============================================================

