import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const getPublicWatcherConfig = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) throw new Error("Watcher details are unavailable.");

  const publicClient = createClient<Database>(url, publishableKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await publicClient
    .from("watcher_config")
    .select("name, tagline, avatar_url, voice_id")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    console.error("Public Watcher details unavailable", error);
    throw new Error("Watcher details are unavailable.");
  }
  return data;
});