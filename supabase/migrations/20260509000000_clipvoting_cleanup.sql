-- ════════════════════════════════════════════════════════════════
-- Clipvoting: Verlierer-Clips automatisch löschen
-- Reduziert den Speicherbedarf, indem Clips aus alten Voting-Runden
-- entfernt werden, sobald sie nicht mehr angezeigt oder bewertet
-- werden. Monats- und Jahressieger bleiben unangetastet.
-- ════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────
-- 1. Cleanup-Funktion
--
--    Behält Clips die ...
--      a) in einer aktiven oder ausstehenden Runde sind
--      b) zur selben (Jahr, Monat) wie eine aktive/ausstehende
--         Runde gehören (Round-1-Ergebnisse vor Round 2 Start)
--      c) in der zuletzt erstellten Runde sind (Default-Anzeige
--         falls keine aktive/ausstehende Runde existiert)
--      d) als Monatssieger gespeichert sind
--      e) als Jahressieger gespeichert sind
--    … und löscht alle anderen.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION clipvoting.cleanup_unused_clips()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = clipvoting, public
AS $$
DECLARE
  v_deleted integer := 0;
  v_latest_round_id uuid;
BEGIN
  SELECT id INTO v_latest_round_id
  FROM clipvoting.voting_rounds
  ORDER BY created_at DESC
  LIMIT 1;

  WITH keep AS (
    SELECT rc.clip_id
    FROM clipvoting.round_clips rc
    JOIN clipvoting.voting_rounds vr ON vr.id = rc.round_id
    WHERE vr.status IN ('active', 'pending')

    UNION
    SELECT rc.clip_id
    FROM clipvoting.round_clips rc
    JOIN clipvoting.voting_rounds vr ON vr.id = rc.round_id
    WHERE EXISTS (
      SELECT 1
      FROM clipvoting.voting_rounds vr2
      WHERE vr2.status IN ('active', 'pending')
        AND vr2.year = vr.year
        AND COALESCE(vr2.month, -1) = COALESCE(vr.month, -1)
    )

    UNION
    SELECT clip_id
    FROM clipvoting.round_clips
    WHERE round_id = v_latest_round_id

    UNION
    SELECT clip_id FROM clipvoting.monthly_winners

    UNION
    SELECT clip_id FROM clipvoting.yearly_winners
  )
  DELETE FROM clipvoting.clips c
  WHERE c.id NOT IN (SELECT clip_id FROM keep WHERE clip_id IS NOT NULL);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

ALTER FUNCTION clipvoting.cleanup_unused_clips() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION clipvoting.cleanup_unused_clips() TO service_role;


-- ────────────────────────────────────────────────────────────────
-- 2. Manueller Mod-Trigger
--    Erlaubt Moderatoren das Cleanup über die UI auszulösen.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_cleanup_clips()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = clipvoting, public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT is_moderator() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  v_deleted := clipvoting.cleanup_unused_clips();
  RETURN jsonb_build_object('success', true, 'deleted', v_deleted);
END;
$$;

ALTER FUNCTION public.admin_cleanup_clips() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.admin_cleanup_clips() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_clips() TO service_role;


-- ────────────────────────────────────────────────────────────────
-- 3. admin_end_round2 ergänzen
--    Nach dem Festschreiben des Monatssiegers werden alle Clips
--    der vorigen Runde 1 (Verlierer) und nicht in Runde 2
--    gelandeten Clips automatisch gelöscht.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_end_round2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = clipvoting, public
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
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_round IS NULL THEN
    RETURN jsonb_build_object('error', 'no_active_round2');
  END IF;

  UPDATE clipvoting.voting_rounds
  SET status = 'completed',
      ends_at = now()
  WHERE id = v_round.id;

  SELECT rc.clip_id
  INTO v_winner
  FROM clipvoting.round_clips rc
  LEFT JOIN (
    SELECT clip_id, count(*) AS cnt
    FROM clipvoting.votes
    WHERE round_id = v_round.id
    GROUP BY clip_id
  ) vc ON vc.clip_id = rc.clip_id
  WHERE rc.round_id = v_round.id
  ORDER BY COALESCE(vc.cnt, 0) DESC, rc.clip_id
  LIMIT 1;

  IF v_winner IS NOT NULL THEN
    INSERT INTO clipvoting.monthly_winners (year, month, clip_id)
    VALUES (v_round.year, v_round.month, v_winner.clip_id)
    ON CONFLICT (year, month) DO NOTHING;
  END IF;

  PERFORM clipvoting.schedule_discord_notify('/ende-runde-2');
  PERFORM clipvoting.cleanup_unused_clips();

  RETURN jsonb_build_object('success', true, 'winner_clip_id', v_winner.clip_id);
END;
$$;

ALTER FUNCTION public.admin_end_round2() OWNER TO postgres;


-- ────────────────────────────────────────────────────────────────
-- 4. admin_end_yearly ergänzen
--    Nach Festschreiben des Jahressiegers laufen Monatssieger-Clips
--    durch das Cleanup, soweit sie nicht mehr angezeigt werden.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_end_yearly()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = clipvoting, public
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
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_round IS NULL THEN
    RETURN jsonb_build_object('error', 'no_active_yearly');
  END IF;

  UPDATE clipvoting.voting_rounds
  SET status = 'completed',
      ends_at = now()
  WHERE id = v_round.id;

  SELECT rc.clip_id
  INTO v_winner
  FROM clipvoting.round_clips rc
  LEFT JOIN (
    SELECT clip_id, count(*) AS cnt
    FROM clipvoting.votes
    WHERE round_id = v_round.id
    GROUP BY clip_id
  ) vc ON vc.clip_id = rc.clip_id
  WHERE rc.round_id = v_round.id
  ORDER BY COALESCE(vc.cnt, 0) DESC, rc.clip_id
  LIMIT 1;

  IF v_winner IS NOT NULL THEN
    INSERT INTO clipvoting.yearly_winners (year, clip_id)
    VALUES (v_round.year, v_winner.clip_id)
    ON CONFLICT (year) DO NOTHING;
  END IF;

  PERFORM clipvoting.schedule_discord_notify('/ende-jahr');
  PERFORM clipvoting.cleanup_unused_clips();

  RETURN jsonb_build_object('success', true, 'winner_clip_id', v_winner.clip_id);
END;
$$;

ALTER FUNCTION public.admin_end_yearly() OWNER TO postgres;
