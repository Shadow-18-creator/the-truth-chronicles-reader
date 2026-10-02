import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { checkRateLimit } from "@/lib/rate-limit.server";

type Body = {
  text?: string;
  voiceId?: string;
  elevenLabsKey?: string;
};

const RATE_LIMIT = { limit: 10, windowMinutes: 1 };

export const Route = createFileRoute("/api/watcher/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response("Sign in to hear the Watcher's voice.", { status: 401 });
          }

          const token = authHeader.slice("Bearer ".length).trim();
          const url = process.env.SUPABASE_URL;
          const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!token || !url || !publishableKey) {
            return new Response("Sign in to hear the Watcher's voice.", { status: 401 });
          }

          const authClient = createClient<Database>(url, publishableKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
          const userId = claimsData?.claims?.sub;
          if (claimsError || typeof userId !== "string" || !userId) {
            return new Response("Sign in to hear the Watcher's voice.", { status: 401 });
          }

          const body = (await request.json()) as Body;
          const { text, voiceId, elevenLabsKey } = body;
          if (typeof text !== "string" || !text.trim() || typeof voiceId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(voiceId)) {
            return new Response("A valid text and voice are required.", { status: 400 });
          }

          const rate = await checkRateLimit(userId, "watcher_tts", RATE_LIMIT.limit, RATE_LIMIT.windowMinutes);
          if (!rate.allowed) {
            return new Response("The Watcher's voice is tired — too many spoken words too quickly.", { status: 429 });
          }

          const key = elevenLabsKey || process.env.ELEVENLABS_API_KEY;
          if (!key) return new Response("ElevenLabs not connected", { status: 500 });

          const trimmed = text.trim().slice(0, 2500);

          const res = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
            {
              method: "POST",
              headers: { "xi-api-key": key, "Content-Type": "application/json" },
              body: JSON.stringify({
                text: trimmed,
                model_id: "eleven_turbo_v2_5",
                voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true },
              }),
            },
          );

          if (!res.ok) {
            const err = await res.text();
            console.error("ElevenLabs error", res.status, err);
            if (res.status === 401) return new Response("Your ElevenLabs key was rejected — check it and try again.", { status: 402 });
            if (res.status === 429) return new Response("ElevenLabs rate limit hit — slow down or switch keys.", { status: 429 });
            return new Response(err || "TTS failed", { status: res.status });
          }

          const buf = await res.arrayBuffer();
          return new Response(buf, {
            status: 200,
            headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
          });
        } catch (e) {
          console.error("Watcher TTS error", e);
          return new Response("TTS error", { status: 500 });
        }
      },
    },
  },
});
