import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { checkRateLimit } from "@/lib/rate-limit.server";
import { getKeeperIpRateLimitKey, isKeeperVisitorId, KEEPER_IP_BURST_LIMIT } from "@/lib/keeper";
import { VOICES } from "@/lib/watcher-voices";

const RATE_LIMIT = { limit: 10, windowMinutes: 1 };
const keeperVoiceIds = new Set(VOICES.map((voice) => voice.id));
const voiceRequestSchema = z.object({
  text: z.string().trim().min(1).max(2500),
  voiceId: z.string().refine((voiceId) => keeperVoiceIds.has(voiceId)),
  elevenLabsKey: z.string().max(512).optional(),
}).strict();

export const Route = createFileRoute("/api/watcher/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return new Response("A valid text and voice are required.", { status: 400 });
          }
          const parsed = voiceRequestSchema.safeParse(body);
          if (!parsed.success) return new Response("A valid text and voice are required.", { status: 400 });
          const { text, voiceId, elevenLabsKey } = parsed.data;

          const clientIp = request.headers.get("cf-connecting-ip");
          const ipKey = await getKeeperIpRateLimitKey(clientIp);
          if (ipKey) {
            const ipRate = await checkRateLimit(ipKey, "keeper_voice_ip_burst", KEEPER_IP_BURST_LIMIT, 1);
            if (!ipRate.allowed) return new Response("Too many spoken replies from this network. Please try again shortly.", { status: 429 });
          }
          const visitorHeader = request.headers.get("x-keeper-visitor");
          const visitorKey = isKeeperVisitorId(visitorHeader)
            ? `keeper_visitor_${visitorHeader.toLowerCase()}`
            : ipKey ?? "keeper_unidentified";
          const rate = await checkRateLimit(visitorKey, "keeper_voice_burst", RATE_LIMIT.limit, RATE_LIMIT.windowMinutes);
          if (!rate.allowed) {
            return new Response("The Keeper's voice needs a breath — try again in a minute.", { status: 429 });
          }

          const key = elevenLabsKey || process.env.ELEVENLABS_API_KEY;
          if (!key) return new Response("ElevenLabs not connected", { status: 500 });

          const trimmed = text.trim();

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
