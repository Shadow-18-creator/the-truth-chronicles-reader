import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/watcher/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { text, voiceId } = (await request.json()) as { text?: string; voiceId?: string };
          if (!text || !voiceId) return new Response("text and voiceId required", { status: 400 });

          const key = process.env.ELEVENLABS_API_KEY;
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