import { createFileRoute } from "@tanstack/react-router";
import { checkRateLimit } from "@/lib/rate-limit.server";

type Body = {
  text?: string;
  voiceId?: string;
  elevenLabsKey?: string;
};

const RATE_LIMIT = { limit: 10, windowMinutes: 1 };

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}

export const Route = createFileRoute("/api/watcher/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { text, voiceId, elevenLabsKey } = (await request.json()) as Body;
          if (!text || !voiceId) return new Response("text and voiceId required", { status: 400 });

          const ip = getClientIp(request);
          const rate = await checkRateLimit(ip, "watcher_tts", RATE_LIMIT.limit, RATE_LIMIT.windowMinutes);
          if (!rate.allowed) {
            return new Response("The Watcher's voice is tired — too many spoken words too quickly.", { status: 429 });
          }

          const key = elevenLabsKey || process.env.ELEVENLABS_API_KEY;
          if (!key) return new Response("ElevenLabs not connected", { status: 500 });

          const trimmed = text.slice(0, 2500);

          const res = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
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
