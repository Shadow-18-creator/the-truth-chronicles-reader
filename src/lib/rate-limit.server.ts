// Server-only rate-limit helper. Uses the database so limits survive worker restarts.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getBucket(windowMinutes: number): Date {
  const now = new Date();
  const epoch = Math.floor(now.getTime() / 1000 / 60 / windowMinutes);
  return new Date(epoch * windowMinutes * 60 * 1000);
}

export async function checkRateLimit(
  key: string,
  action: string,
  limit: number,
  windowMinutes: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { allowed: true, remaining: limit, resetAt: new Date(Date.now() + windowMinutes * 60 * 1000) };

  const supabaseAdmin = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = getBucket(windowMinutes).toISOString();

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("rate_limits")
    .select("id, count")
    .eq("key", key)
    .eq("action", action)
    .eq("bucket", bucket)
    .maybeSingle();

  if (fetchErr) {
    console.error("Rate limit fetch error", fetchErr);
    return { allowed: true, remaining: limit, resetAt: new Date(Date.now() + windowMinutes * 60 * 1000) };
  }

  const current = existing?.count ?? 0;
  if (current >= limit) {
    return { allowed: false, remaining: 0, resetAt: new Date(new Date(bucket).getTime() + windowMinutes * 60 * 1000) };
  }

  const next = current + 1;
  const { error: upsertErr } = await supabaseAdmin
    .from("rate_limits")
    .upsert(
      { key, action, bucket, count: next, updated_at: new Date().toISOString() },
      { onConflict: "key, action, bucket" },
    );

  if (upsertErr) {
    console.error("Rate limit upsert error", upsertErr);
    return { allowed: true, remaining: Math.max(0, limit - next), resetAt: new Date(Date.now() + windowMinutes * 60 * 1000) };
  }

  return { allowed: true, remaining: Math.max(0, limit - next), resetAt: new Date(Date.now() + windowMinutes * 60 * 1000) };
}
