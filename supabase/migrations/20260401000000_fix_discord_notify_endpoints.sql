-- Fix Discord notification endpoints in admin voting functions.
-- 
-- Bugs fixed:
--   1. admin_end_round2 was calling /ende-jahr instead of /ende-runde-2
--   2. admin_end_yearly was calling /ende-runde-2 instead of /ende-jahr
--   3. admin_start_round2 was missing the /start-runde-2 Discord notification
--   4. admin_start_yearly was missing the /start-jahr Discord notification

CREATE OR REPLACE FUNCTION "public"."admin_end_round2"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'clipvoting', 'public'
    AS $$
DECLARE
  v_round  record;
  v_winner record;
BEGIN
  IF NOT is_moderator() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT *
  INTO v_round
  FROM clipvoting.voting_rounds
  WHERE type = 'round2'
    AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  IF v_round IS NULL THEN
    RETURN jsonb_build_object('error', 'no_active_round2');
  END IF;

  UPDATE clipvoting.voting_rounds
  SET status = 'completed'
  WHERE id = v_round.id;

  -- Gewinner ermitteln
  SELECT rc.clip_id
  INTO v_winner
  FROM round_clips rc
           LEFT JOIN (SELECT clip_id, count(*) AS cnt FROM votes WHERE round_id = v_round.id GROUP BY clip_id) vc
                     ON vc.clip_id = rc.clip_id
  WHERE rc.round_id = v_round.id
  ORDER BY coalesce(vc.cnt, 0) DESC, rc.clip_id LIMIT 1;

  IF v_winner IS NOT NULL THEN
    INSERT INTO monthly_winners (year, month, clip_id)
    VALUES (v_round.year, v_round.month, v_winner.clip_id)
    ON CONFLICT (year, month) DO NOTHING;
  END IF;

  PERFORM clipvoting.schedule_discord_notify('/ende-runde-2');
  RETURN jsonb_build_object('success', true, 'winner_clip_id', v_winner.clip_id);
END;
$$;


CREATE OR REPLACE FUNCTION "public"."admin_end_yearly"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'clipvoting', 'public'
    AS $$
DECLARE
  v_round  record;
  v_winner record;
BEGIN
  IF NOT is_moderator() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT *
  INTO v_round
  FROM clipvoting.voting_rounds
  WHERE type = 'yearly'
    AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  IF v_round IS NULL THEN
    RETURN jsonb_build_object('error', 'no_active_yearly');
  END IF;

  UPDATE clipvoting.voting_rounds
  SET status = 'completed'
  WHERE id = v_round.id;

  SELECT rc.clip_id
  INTO v_winner
  FROM round_clips rc
           LEFT JOIN (SELECT clip_id, count(*) AS cnt FROM votes WHERE round_id = v_round.id GROUP BY clip_id) vc
                     ON vc.clip_id = rc.clip_id
  WHERE rc.round_id = v_round.id
  ORDER BY coalesce(vc.cnt, 0) DESC, rc.clip_id LIMIT 1;

  IF v_winner IS NOT NULL THEN
    INSERT INTO yearly_winners (year, clip_id)
    VALUES (v_round.year, v_winner.clip_id)
    ON CONFLICT (year) DO NOTHING;
  END IF;

  PERFORM clipvoting.schedule_discord_notify('/ende-jahr');
  RETURN jsonb_build_object('success', true, 'winner_clip_id', v_winner.clip_id);
END;
$$;


CREATE OR REPLACE FUNCTION "public"."admin_start_round2"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'clipvoting', 'public'
    AS $$
DECLARE
  v_round record;
BEGIN
  IF NOT is_moderator() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT *
  INTO v_round
  FROM clipvoting.voting_rounds
  WHERE type = 'round2'
    AND status = 'pending'
  ORDER BY created_at DESC LIMIT 1;

  IF v_round IS NULL THEN
    RETURN jsonb_build_object('error', 'no_pending_round2');
  END IF;

  UPDATE clipvoting.voting_rounds
  SET status    = 'active',
      starts_at = now(),
      ends_at   = now() + interval '24 hours'
  WHERE id = v_round.id;

  PERFORM clipvoting.schedule_discord_notify('/start-runde-2');
  RETURN jsonb_build_object('success', true, 'round_id', v_round.id);
END;
$$;


CREATE OR REPLACE FUNCTION "public"."admin_start_yearly"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'clipvoting', 'public'
    AS $$
DECLARE
  v_year    integer := extract(year from now())::integer;
  v_round   record;
  v_winner  record;
BEGIN
  IF NOT is_moderator() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Prüfen ob bereits existiert
  SELECT *
  INTO v_round
  FROM clipvoting.voting_rounds
  WHERE type = 'yearly' AND year = v_year LIMIT 1;
  IF v_round IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'yearly_already_exists');
  END IF;

  -- Runde erstellen
  INSERT INTO clipvoting.voting_rounds (type, status, year, starts_at, ends_at)
  VALUES ('yearly', 'active', v_year, now(), now() + interval '7 days') RETURNING *
  INTO v_round;

  -- Monatsgewinner Dez(Vorjahr) bis Nov(Jahr) einfügen
  INSERT INTO round_clips (round_id, clip_id)
  SELECT v_round.id, mw.clip_id
  FROM monthly_winners mw
  WHERE (mw.year = v_year - 1 AND mw.month = 12)
     OR (mw.year = v_year AND mw.month <= 11) ON CONFLICT DO NOTHING;

  PERFORM clipvoting.schedule_discord_notify('/start-jahr');
  RETURN jsonb_build_object('success', true, 'round_id', v_round.id);
END;
$$;
