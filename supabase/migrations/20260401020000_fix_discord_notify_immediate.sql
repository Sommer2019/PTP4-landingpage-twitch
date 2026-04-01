-- Verwende direkt pg_net ohne cron.schedule, da dies zu Verzögerungen und Timezone-Problemen führen kann.

CREATE SCHEMA IF NOT EXISTS "net";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "net";

CREATE OR REPLACE FUNCTION clipvoting.schedule_discord_notify(p_endpoint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key text;
BEGIN
  -- Key aus Vault laden
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'discord_api_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE WARNING 'discord_api_key not found in vault';
    RETURN;
  END IF;

  -- Wir senden den Request sofort asynchron über pg_net,
  -- anstatt mühsam cron Jobs zu erstellen, die oft wegen Timezones (UTC) nie auslösen.
  -- TODO CHANGEIT ON DEPLOY: Ersetze den URL mit der tatsächlichen URL des Discord-Notify-Endpoints.
  PERFORM net.http_post(
    url     := 'https://ptp4-landingpage-twitch-hd.onrender.com' || p_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-api-key',    v_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;
