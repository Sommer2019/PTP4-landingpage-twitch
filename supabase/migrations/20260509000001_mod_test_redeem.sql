-- ════════════════════════════════════════════════════════════════
-- Mod-Test-Alerts für Channel-Point-Belohnungen
--
-- Mods/Broadcaster können einen Reward als Test-Alert auslösen –
-- ohne Punkteabzug, ohne Cooldown- oder Once-per-Stream-Lock.
-- Der reguläre Alert-Pipeline-Trigger (Overlay pollt
-- redeemed_rewards) feuert dabei wie bei einer echten Einlösung.
-- ════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────
-- 1. Spalte is_test markiert Test-Einlösungen.
--    Default false → bestehende Inserts (RPC redeem_reward,
--    Bot, alte Migrations) bleiben unverändert.
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.redeemed_rewards
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;


-- ────────────────────────────────────────────────────────────────
-- 2. handle_global_cooldown so anpassen, dass Test-Einlösungen
--    keinen redeemed_global-Eintrag erzeugen. Dadurch entsteht
--    weder ein Cooldown-Lock noch ein Once-per-Stream-Lock.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_global_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cooldown INTEGER;
BEGIN
  IF NEW.is_test IS TRUE THEN
    RETURN NEW;
  END IF;

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


-- ────────────────────────────────────────────────────────────────
-- 3. RPC mod_test_redeem_reward
--    Nur Mods/Broadcaster. Schreibt eine Zeile in redeemed_rewards
--    mit is_test=true und cost=0 – Overlay zieht den Eintrag wie
--    eine normale Einlösung. Punkteabzug und Cooldown entfallen.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mod_test_redeem_reward(p_reward_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward       rewards%ROWTYPE;
  v_twitch_id    text;
  v_redeemed_id  uuid;
BEGIN
  IF NOT (public.is_moderator_role()
          OR public.is_broadcaster_role()
          OR public.is_moderator()) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'reward_not_found');
  END IF;

  -- Twitch-User-ID des aufrufenden Mods aus dem JWT (raw_user_meta_data).
  -- Fallback auf Reward-ID-String, falls nichts auflösbar ist.
  SELECT COALESCE(
           u.raw_user_meta_data->>'provider_id',
           u.raw_user_meta_data->>'sub',
           u.id::text
         )
    INTO v_twitch_id
    FROM auth.users u
   WHERE u.id = auth.uid();

  IF v_twitch_id IS NULL THEN
    v_twitch_id := 'mod-test';
  END IF;

  INSERT INTO redeemed_rewards (
    twitch_user_id, reward_id, timestamp, cost, description, ttstext, is_test
  )
  VALUES (
    v_twitch_id,
    p_reward_id,
    now(),
    0,
    COALESCE(v_reward.text, v_reward.description),
    CASE WHEN v_reward.istts THEN COALESCE(v_reward.text, v_reward.description) ELSE NULL END,
    true
  )
  RETURNING id INTO v_redeemed_id;

  RETURN jsonb_build_object('success', true, 'redeemed_id', v_redeemed_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mod_test_redeem_reward(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_test_redeem_reward(text) TO service_role;
