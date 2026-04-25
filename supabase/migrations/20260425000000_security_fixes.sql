-- ════════════════════════════════════════════════════════════════
-- Security Fixes
-- ════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────
-- 1. pg_net Extension Schema
--    pg_net erzeugt sein eigenes 'net'-Schema, daher ist dieses
--    Fix nur nötig wenn der Advisor die Extension als in 'public'
--    installiert meldet. Alternativ über Dashboard > Extensions.
-- ────────────────────────────────────────────────────────────────
-- ALTER EXTENSION pg_net SET SCHEMA extensions;
-- HINWEIS: Falls obiger Befehl fehlschlägt (pg_net besitzt eigenes
-- net-Schema), Extension im Supabase Dashboard deaktivieren und
-- neu aktivieren — dabei "extensions" als Schema wählen.


-- ────────────────────────────────────────────────────────────────
-- 2. Sichere Twitch-ID-Funktion via auth.identities
--    auth.identities ist nicht durch den User bearbeitbar,
--    im Gegensatz zu user_metadata im JWT-Token.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_twitch_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT provider_id
  FROM auth.identities
  WHERE user_id = auth.uid()
    AND provider = 'twitch'
  LIMIT 1;
$$;


-- ────────────────────────────────────────────────────────────────
-- 3. RLS-Policies: user_metadata → get_my_twitch_id()
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Nutzer können eigene Punkte sehen" ON public.points;
CREATE POLICY "Nutzer können eigene Punkte sehen"
  ON public.points FOR SELECT
  USING (twitch_user_id = public.get_my_twitch_id());

DROP POLICY IF EXISTS "Check Twitch Ban" ON public.points;
CREATE POLICY "Check Twitch Ban"
  ON public.points
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.banned_accounts
      WHERE banned_accounts.twitch_user_id = public.get_my_twitch_id()
    )
  );

DROP POLICY IF EXISTS "Check Twitch Ban" ON public.moderators;
CREATE POLICY "Check Twitch Ban"
  ON public.moderators
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.banned_accounts
      WHERE banned_accounts.twitch_user_id = public.get_my_twitch_id()
    )
  );

DROP POLICY IF EXISTS "select_own_ban" ON public.banned_accounts;
CREATE POLICY "select_own_ban"
  ON public.banned_accounts FOR SELECT
  USING (
    twitch_user_id = public.get_my_twitch_id()
    OR public.is_moderator()
  );


-- ────────────────────────────────────────────────────────────────
-- 4. clip_vote_counts View: security_invoker = on
--    View läuft jetzt mit Rechten des anfragenden Users statt
--    als postgres-Superuser.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW clipvoting.clip_vote_counts
WITH (security_invoker = on)
AS
SELECT
  rc.round_id,
  rc.clip_id,
  c.twitch_clip_id,
  c.title,
  c.creator_name,
  c.thumbnail_url,
  c.embed_url,
  c.clip_url,
  c.view_count,
  c.duration,
  c.twitch_created_at,
  COALESCE(vc.cnt, 0) AS vote_count
FROM clipvoting.round_clips rc
JOIN clipvoting.clips c ON c.id = rc.clip_id
LEFT JOIN (
  SELECT round_id, clip_id, count(*)::integer AS cnt
  FROM clipvoting.votes
  GROUP BY round_id, clip_id
) vc ON vc.round_id = rc.round_id AND vc.clip_id = rc.clip_id;

GRANT SELECT ON clipvoting.clip_vote_counts TO anon;
GRANT SELECT ON clipvoting.clip_vote_counts TO authenticated;
GRANT ALL   ON clipvoting.clip_vote_counts TO service_role;


-- ────────────────────────────────────────────────────────────────
-- 5. Funktionen: SET search_path hinzufügen
--    Verhindert Search-Path-Injection durch böswillige Schemas.
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION clipvoting.schedule_discord_notify(p_endpoint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = clipvoting, public, net
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'discord_api_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE WARNING 'discord_api_key not found in vault';
    RETURN;
  END IF;

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

-- Trigger-Funktion: handle_global_cooldown
CREATE OR REPLACE FUNCTION public.handle_global_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cooldown INTEGER;
BEGIN
  SELECT cooldown INTO v_cooldown
  FROM rewards
  WHERE id = NEW.reward_id;

  IF v_cooldown IS NOT NULL AND v_cooldown != 0 THEN
    INSERT INTO redeemed_global (reward_id, redeemed_at, redeemed_by, expires_at, is_active)
    VALUES (
      NEW.reward_id,
      NEW.timestamp,
      NEW.twitch_user_id,
      NEW.timestamp + (v_cooldown * INTERVAL '1 second'),
      TRUE
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger-Funktion: sync_reward_columns
CREATE OR REPLACE FUNCTION public.sync_reward_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Trigger-Funktion: clamp_points
CREATE OR REPLACE FUNCTION public.clamp_points()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.points > 2147483647 THEN
    NEW.points := 2147483647;
  END IF;
  IF NEW.points < 0 THEN
    NEW.points := 0;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger-Funktion: ensure_rewards_id
CREATE OR REPLACE FUNCTION public.ensure_rewards_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    NEW.id := gen_random_uuid()::text;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_all_active_redeemed_global()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE redeemed_global SET is_active = false WHERE is_active = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_expired_redeemed_global()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE redeemed_global
  SET is_active = false
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_redeemed_global_for_session(p_session_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE redeemed_global
  SET is_active = false
  WHERE is_active = true
    AND stream_id = p_session_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_moderator_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND is_moderator = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_broadcaster_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND is_broadcaster = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_vip_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND is_vip = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_onlybart_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND (is_subscriber = true OR is_vip = true OR is_moderator = true OR is_broadcaster = true)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_onlybart_view_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND (is_subscriber = true OR is_vip = true OR is_moderator = true OR is_broadcaster = true)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_ban_account(
  p_twitch_user_id text,
  p_display_name   text,
  p_banned_by      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_moderator() THEN
    RAISE EXCEPTION 'forbidden: caller is not a moderator';
  END IF;

  INSERT INTO public.banned_accounts (twitch_user_id, display_name, banned_by)
  VALUES (p_twitch_user_id, p_display_name, p_banned_by)
  ON CONFLICT (twitch_user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    banned_by    = EXCLUDED.banned_by,
    updated_at   = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_ban_account(
  p_twitch_user_id text,
  p_display_name   text DEFAULT NULL,
  p_banned_by      text DEFAULT NULL,
  p_reason         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u RECORD;
BEGIN
  INSERT INTO public.banned_accounts (twitch_user_id, display_name, banned_by, reason)
  VALUES (p_twitch_user_id, p_display_name, p_banned_by, p_reason)
  ON CONFLICT (twitch_user_id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, public.banned_accounts.display_name),
    banned_by    = COALESCE(EXCLUDED.banned_by,    public.banned_accounts.banned_by),
    reason       = COALESCE(EXCLUDED.reason,        public.banned_accounts.reason);

  -- Aktive Sessions des gebannten Users löschen (erzwungener Logout)
  FOR u IN
    SELECT id FROM auth.users
    WHERE COALESCE(
      raw_user_meta_data ->> 'provider_id',
      raw_user_meta_data ->> 'sub',
      raw_user_meta_data ->> 'user_login',
      raw_user_meta_data ->> 'login'
    ) = p_twitch_user_id
  LOOP
    DELETE FROM auth.sessions WHERE user_id = u.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_account(p_twitch_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.banned_accounts WHERE twitch_user_id = p_twitch_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_account(p_twitch_user_id_int integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_unban_account(p_twitch_user_id_int::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_account(p_twitch_user_id_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_unban_account(p_twitch_user_id_uuid::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_account_json(p_payload json)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
BEGIN
  IF p_payload IS NULL THEN
    RETURN jsonb_build_object('error', 'missing_payload');
  END IF;
  v_id := COALESCE(p_payload->>'p_twitch_user_id', p_payload->>'twitch_user_id');
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('error', 'missing_twitch_user_id');
  END IF;
  RETURN public.admin_unban_account(v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_account_text(p_twitch_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_unban_account(p_twitch_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_reward(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    DELETE FROM rewards WHERE id = p_id;
    RETURN jsonb_build_object('success', true);
  END IF;

  IF NOT (public.is_moderator_role() OR public.is_broadcaster_role() OR public.is_moderator()) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  DELETE FROM rewards WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_ban_before_login(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_twitch_id text;
  is_banned   boolean;
BEGIN
  v_twitch_id := (event->'user_identity'->>'identity_id');

  SELECT EXISTS (
    SELECT 1 FROM public.banned_accounts
    WHERE twitch_user_id = v_twitch_id
  ) INTO is_banned;

  IF is_banned THEN
    RAISE EXCEPTION 'Login verweigert: Dein Twitch-Account ist gesperrt.';
  END IF;

  RETURN event;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_bartclicker_leaderboard(p_limit integer DEFAULT 100)
RETURNS TABLE(
  rank          bigint,
  user_id       uuid,
  total_ever    numeric,
  rebirth_count integer,
  last_updated  timestamptz
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY bs.total_ever DESC, bs.rebirth_count DESC),
    bs.user_id,
    bs.total_ever,
    bs.rebirth_count,
    bs.last_updated
  FROM bartclicker_scores bs
  WHERE bs.total_ever > 0 OR bs.rebirth_count > 0
  ORDER BY bs.total_ever DESC, bs.rebirth_count DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_bartclicker_leaderboard_with_names(p_limit integer DEFAULT 100)
RETURNS TABLE(
  rank          bigint,
  user_id       uuid,
  total_ever    numeric,
  rebirth_count integer,
  last_updated  timestamptz,
  display_name  text
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY bs.total_ever DESC, bs.rebirth_count DESC),
    bs.user_id,
    bs.total_ever,
    bs.rebirth_count,
    bs.last_updated,
    COALESCE(
      p.username,
      'Player ' || ROW_NUMBER() OVER (ORDER BY bs.total_ever DESC, bs.rebirth_count DESC)::text
    )::text
  FROM bartclicker_scores bs
  LEFT JOIN profiles p ON p.id = bs.user_id
  WHERE bs.total_ever > 0 OR bs.rebirth_count > 0
  ORDER BY bs.total_ever DESC, bs.rebirth_count DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_twitch_user_id text,
  p_reward_id      text,
  p_description    text,
  p_cost           integer,
  p_ttstext        text,
  p_stream_id      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward         jsonb;
  v_once           boolean := false;
  v_cooldown       int     := 0;
  v_last           timestamptz;
  v_redeemed_id    uuid;
  v_global_id      uuid;
  v_active_session uuid;
  v_meta           jsonb := jsonb_build_object('description', p_description);
  v_expires        timestamptz;
  v_stream_end     timestamptz;
BEGIN
  SELECT to_jsonb(r.*) INTO v_reward FROM rewards r WHERE r.id = p_reward_id LIMIT 1;
  IF v_reward IS NULL THEN
    RETURN jsonb_build_object('error', 'reward_not_found');
  END IF;

  IF (v_reward ? 'is_enabled') AND NOT (v_reward->>'is_enabled')::boolean THEN
    RETURN jsonb_build_object('error', 'reward_disabled');
  END IF;

  IF    (v_reward ? 'onceperstream') THEN v_once := (v_reward->>'onceperstream')::boolean;
  ELSIF (v_reward ? 'oncePerStream') THEN v_once := (v_reward->>'oncePerStream')::boolean;
  ELSE  v_once := false;
  END IF;

  IF (v_reward ? 'cooldown') THEN
    v_cooldown := COALESCE((v_reward->>'cooldown')::int, 0);
  END IF;

  IF p_stream_id IS NULL THEN
    SELECT id INTO v_active_session
    FROM stream_sessions WHERE is_active = true ORDER BY started_at DESC LIMIT 1;
    IF v_active_session IS NOT NULL THEN
      p_stream_id := v_active_session::text;
    END IF;
  END IF;

  IF v_once THEN
    IF p_stream_id IS NOT NULL THEN
      IF EXISTS(
        SELECT 1 FROM redeemed_global
        WHERE reward_id = p_reward_id AND stream_id = p_stream_id
          AND is_active = true AND (expires_at IS NULL OR expires_at > now())
      ) THEN
        RETURN jsonb_build_object('error', 'once_per_stream_active');
      END IF;
    ELSE
      IF EXISTS(
        SELECT 1 FROM redeemed_global
        WHERE reward_id = p_reward_id
          AND is_active = true AND (expires_at IS NULL OR expires_at > now())
      ) THEN
        RETURN jsonb_build_object('error', 'once_per_stream_active');
      END IF;
    END IF;
  END IF;

  SELECT redeemed_at INTO v_last
  FROM redeemed_global WHERE reward_id = p_reward_id ORDER BY redeemed_at DESC LIMIT 1;
  IF v_last IS NOT NULL AND v_cooldown > 0 THEN
    IF (now() - v_last) < (v_cooldown || ' seconds')::interval THEN
      RETURN jsonb_build_object(
        'error', 'cooldown_active',
        'remaining', (v_cooldown - EXTRACT(EPOCH FROM (now() - v_last)))::int
      );
    END IF;
  END IF;

  v_expires := NULL;
  IF v_cooldown > 0 THEN
    v_expires := now() + (v_cooldown || ' seconds')::interval;
  ELSIF v_once THEN
    IF p_stream_id IS NOT NULL THEN
      BEGIN
        SELECT ended_at INTO v_stream_end
        FROM stream_sessions WHERE id = p_stream_id::uuid LIMIT 1;
      EXCEPTION WHEN others THEN
        v_stream_end := NULL;
      END;
      v_expires := CASE WHEN v_stream_end IS NOT NULL THEN v_stream_end ELSE NULL END;
    ELSE
      v_expires := now() + interval '24 hours';
    END IF;
  END IF;

  IF v_expires IS NOT NULL THEN
    v_expires := LEAST(v_expires, now() + interval '30 days');
  END IF;

  BEGIN
    UPDATE points SET points = points - p_cost WHERE twitch_user_id = p_twitch_user_id;

    INSERT INTO redeemed_rewards (twitch_user_id, reward_id, timestamp, cost, description, ttstext)
    VALUES (p_twitch_user_id, p_reward_id, now(), p_cost, p_description, p_ttstext)
    RETURNING id INTO v_redeemed_id;

    INSERT INTO redeemed_global (reward_id, redeemed_by, redeemed_at, expires_at, stream_id, is_active, meta)
    VALUES (p_reward_id, p_twitch_user_id, now(), v_expires, p_stream_id, true, v_meta)
    RETURNING id INTO v_global_id;

    RETURN jsonb_build_object('success', true, 'redeemed_id', v_redeemed_id, 'global_id', v_global_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'unique_violation');
  END;
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 6. storage.onlybart-media: breite SELECT-Policy entfernen
--    Öffentliche Buckets brauchen keine SELECT-Policy für
--    URL-Zugriff. Die Policy erlaubt aber das Auflisten aller
--    Dateien — das ist unbeabsichtigt.
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Everyone can read media" ON storage.objects;


-- ────────────────────────────────────────────────────────────────
-- 7. page_views: INSERT-Policy einschränken
--    WITH CHECK (true) erlaubt beliebige Daten. Wir erzwingen
--    jetzt dass page_path gesetzt und sinnvoll begrenzt ist.
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "insert_anon" ON public.page_views;
CREATE POLICY "insert_anon" ON public.page_views
  FOR INSERT
  WITH CHECK (
    page_path IS NOT NULL
    AND length(page_path) BETWEEN 1 AND 200
  );


-- ────────────────────────────────────────────────────────────────
-- 8. redeemed_global: fehlende RLS-Policies
--    Tabelle wird ausschließlich über SECURITY DEFINER-Funktionen
--    und service_role beschrieben. Direkte Lesezugriffe werden
--    auf Mods/Broadcaster beschränkt.
-- ────────────────────────────────────────────────────────────────
CREATE POLICY "service_role_full_access" ON public.redeemed_global
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

CREATE POLICY "mods_can_read" ON public.redeemed_global
  FOR SELECT
  USING (public.is_moderator_role() OR public.is_broadcaster_role());


-- ────────────────────────────────────────────────────────────────
-- 9. stream_sessions: fehlende RLS-Policies
--    Wird vom TwitchBot (service_role) beschrieben.
--    Leserechte für authentifizierte User (Stream-Status ist
--    öffentliche Info).
-- ────────────────────────────────────────────────────────────────
CREATE POLICY "service_role_full_access" ON public.stream_sessions
  USING (current_setting('request.jwt.claim.role', true) = 'service_role')
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

CREATE POLICY "authenticated_can_read" ON public.stream_sessions
  FOR SELECT
  USING (true);


-- ────────────────────────────────────────────────────────────────
-- 10. HaveIBeenPwned (Leaked Password Protection)
--     Kann nicht per SQL aktiviert werden.
--     → Supabase Dashboard > Authentication > Security >
--       "Enable Leaked Password Protection" aktivieren.
--  Für uns irrelevant, da auth per twitch und nicht im freeplan enthalten
-- ────────────────────────────────────────────────────────────────