-- ════════════════════════════════════════════════════════════════
-- Realtime fuer redeemed_rewards aktivieren
--
-- Nur Tabellen in der Publikation supabase_realtime liefern
-- postgres_changes-Events an Realtime-Clients. Die ControllMobile-
-- Bridge (TwitchAddon/ControllMobile.js) lauscht auf INSERTs in
-- redeemed_rewards, daher muss die Tabelle in der Publikation sein.
-- ════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'redeemed_rewards'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.redeemed_rewards';
  END IF;
END
$$;
