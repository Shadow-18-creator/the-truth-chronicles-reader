import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit.server";
import {
  getKeeperIpRateLimitKey,
  isKeeperVisitorId,
  KEEPER_DAILY_LIMIT,
  KEEPER_IP_BURST_LIMIT,
  KEEPER_IP_DAILY_LIMIT,
} from "@/lib/keeper";
import { VOICES } from "@/lib/watcher-voices";

const keeperVoiceIds = new Set(VOICES.map((voice) => voice.id));
const voiceRequestSchema = z.object({
  text: z.string().trim().min(1).max(2500),
  voiceId: z.string().refine((voiceId) => keeperVoiceIds.has(voiceId)),
  elevenLabsKey: z.string().max(512).optional(),
}).strict();

export const Route = createFileRoute("/api/keeper/tts")({
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

          const ipKey = await getKeeperIpRateLimitKey(request.headers.get("cf-connecting-ip"));
          if (ipKey) {
            const ipBurst = await checkRateLimit(ipKey, "keeper_voice_ip_burst", KEEPER_IP_BURST_LIMIT, 1);
            if (!ipBurst.allowed) return new Response("Too many spoken replies from this network. Please try again shortly.", { status: 429 });
            const ipDaily = await checkRateLimit(ipKey, "keeper_voice_ip_daily", KEEPER_IP_DAILY_LIMIT, 1440);
            if (!ipDaily.allowed) return new Response("The Keeper's voice is resting for this network today. Please try again tomorrow.", { status: 429 });
          }

          const visitorHeader = request.headers.get("x-keeper-visitor");
          const visitorKey = isKeeperVisitorId(visitorHeader)
            ? `keeper_visitor_${visitorHeader.toLowerCase()}`
            : ipKey ?? "keeper_unidentified";
          const daily = await checkRateLimit(visitorKey, "keeper_voice_daily", KEEPER_DAILY_LIMIT, 1440);
          if (!daily.allowed) return new Response("You've used all 50 spoken replies for today. The Keeper returns tomorrow.", { status: 429 });
          const burst = await checkRateLimit(visitorKey, "keeper_voice_burst", 10, 1);
          if (!burst.allowed) return new Response("The Keeper's voice needs a breath — try again in a minute.", { status: 429 });

          const key = elevenLabsKey || process.env.ELEVENLABS_API_KEY;
          if (!key) return new Response("ElevenLabs is not connected.", { status: 503 });

          const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
            {
              method: "POST",
              headers: { "xi-api-key": key, "Content-Type": "application/json" },
              body: JSON.stringify({
                text: text.trim(),
                model_id: "eleven_turbo_v2_5",
                voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true },
              }),
            },
          );

          if (!response.ok) {
            const detail = (await response.text()).replaceAll(key, "[redacted]");
            console.error("Keeper ElevenLabs error", response.status, detail);
            if (response.status === 401) return new Response("Your ElevenLabs key was rejected — check it and try again.", { status: 402 });
            if (response.status === 429) return new Response("ElevenLabs rate limit hit — slow down or switch keys.", { status: 429 });
            return new Response("The Keeper's voice is temporarily unavailable.", { status: response.status });
          }

          return new Response(await response.arrayBuffer(), {
            status: 200,
            headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
          });
        } catch (error) {
          console.error("Keeper voice error", error);
          return new Response("The Keeper's voice is temporarily unavailable.", { status: 500 });
        }
      },
    },
  },
});