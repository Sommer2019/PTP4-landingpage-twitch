-- ── donation_triggers ────────────────────────────────────────────
-- Stores donation triggers that can be managed by moderators.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."donation_triggers" (
    "id"          uuid        DEFAULT extensions.gen_random_uuid() NOT NULL PRIMARY KEY,
    "trigger_id"  text        NOT NULL UNIQUE,
    "price"       text        NOT NULL,
    "amount_value" numeric,
    "description" text        NOT NULL,
    "trigger_text" text,
    "audio_url"   text,
    "is_enabled"  boolean     NOT NULL DEFAULT true,
    "sort_order"  integer     NOT NULL DEFAULT 0,
    "created_at"  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."donation_triggers" OWNER TO "postgres";

ALTER TABLE "public"."donation_triggers" ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ──────────────────────────────────────────────────

CREATE POLICY "Anyone can read donation_triggers"
    ON "public"."donation_triggers"
    FOR SELECT
    USING (true);

CREATE POLICY "Moderators can insert donation_triggers"
    ON "public"."donation_triggers"
    FOR INSERT
    WITH CHECK (public.is_moderator_role() OR public.is_broadcaster_role());

CREATE POLICY "Moderators can update donation_triggers"
    ON "public"."donation_triggers"
    FOR UPDATE
    USING (public.is_moderator_role() OR public.is_broadcaster_role())
    WITH CHECK (public.is_moderator_role() OR public.is_broadcaster_role());

CREATE POLICY "Moderators can delete donation_triggers"
    ON "public"."donation_triggers"
    FOR DELETE
    USING (public.is_moderator_role() OR public.is_broadcaster_role());

-- ── Seed with existing triggers ───────────────────────────────────

INSERT INTO "public"."donation_triggers"
    (trigger_id, price, amount_value, description, trigger_text, audio_url, sort_order)
VALUES
    ('taschengeld', '1€ – 1,19€',  1.00,  'Taschengeld',                                        'Donation Sounds wird abgespielt (Danke von den Kids) 🎉', NULL,                    10),
    ('tts',         'ab 1,20€',    1.20,  'TTS',                                                 'Text to Speech wird abgespielt 🔊',                        NULL,                    20),
    ('knock',       '4,20€',       4.20,  'KnockKnock',                                          'Knock Knock wird abgespielt 🚪',                           '/audio/knock.mp3',      30),
    ('majortom',    '5,00€',       5.00,  'Major Tom',                                           'Major Tom wird abgespielt 🧑🏼‍🚀',                         '/audio/MajorTom.mp3',   40),
    ('scream',      '6,66€',       6.66,  'Scream',                                              'Scream wird abgespielt 😱',                                '/audio/scream.mp3',     50),
    ('fliege1',     '7,77€',       7.77,  'nervige Fliege (60 Sekunden)',                        'nervige Fliege wird abgespielt 🪰',                        '/audio/Fliege1.mp3',    60),
    ('centershock', '9,20€',       9.20,  'Sauer macht Lustig – CenterShock',                   'Stefan isst einen CenterShock & Sound wird abgespielt 🍋', '/audio/CenterShock.mp3',70),
    ('yt-sound',    '10,80€',      10.80, 'Youtube Mitglieder Sound',                            'Youtube Mitglieder Sound wird abgespielt 🪩',              '/audio/1080.mp3',       80),
    ('fliege2',     '14,44€',      14.44, 'Fliege XXL — 2 Minuten',                             'sehr nervige Fliege wird abgespielt 🪰',                   '/audio/Fliege2.mp3',    90),
    ('1920',        '19,20€',      19.20, '1920',                                                '1920 wird abgespielt ⁉️',                                  '/audio/1920.mp3',       100),
    ('fliege3',     '19,66€',      19.66, 'Fliege ultra lang',                                  'ultra nervige Fliege wird abgespielt 🪰',                  '/audio/Fliege3.mp3',    110),
    ('hotnuts',     '25,00€',      25.00, '8 Hot Nuts + FIRE!!! (nur wenn verfügbar)',           'Stefan isst 8 Hot Nuts & Sound wird abgespielt 🔥',        '/audio/FIRE.mp3',       120),
    ('sandwich',    'x66,66€',     66.66, 'Satanisches Sandwich (nur wenn verfügbar)',           'Stefan isst ein satanisches Sandwich (Oreo + Hotnuts + Centershock) & Sound wird abgespielt 🔥', '/audio/Sandwich.mp3', 130)
ON CONFLICT (trigger_id) DO NOTHING;
