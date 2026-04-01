-- Fix: Update ends_at when manually ending round2 and yearly voting
--
-- Bugs fixed:
--   1. admin_end_round2 was not updating ends_at when manually ending the round
--   2. admin_end_yearly was not updating ends_at when manually ending the voting
--
-- This causes the timer on the frontend to continue running even after the round is ended.

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
  SET status = 'completed',
      ends_at = now()
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
  SET status = 'completed',
      ends_at = now()
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

