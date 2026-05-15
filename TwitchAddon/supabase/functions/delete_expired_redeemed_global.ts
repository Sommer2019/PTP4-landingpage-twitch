// Supabase Edge Function: räumt die redeemed_global-Tabelle auf.
// Gedacht für einen geplanten Trigger (Scheduled Function), der regelmäßig läuft.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ResponseLike {
  status(code: number): this;
  json(body: unknown): void;
}

/** Löscht redeemed_global-Einträge, deren redeemed_at in der Vergangenheit liegt. */
export default async function handler(res: ResponseLike) {
  const { error } = await supabase
    .from('redeemed_global')
    .delete()
    .lt('redeemed_at', new Date().toISOString());
  if (error) {
    res.status(500).json({ error: error.message });
  } else {
    res.status(200).json({ message: 'Expired redeemed_global rows deleted.' });
  }
}
