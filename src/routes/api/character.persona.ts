import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { saveCompiledCharacter } from "@/lib/character-store.server";
import { postToN8n } from "@/lib/character.functions";

const personaSchema = z.object({
  character_id: z.string().min(1),
  character_name: z.string().min(1),
  raw_personality: z.string().min(1),
  event_context: z.string().min(1),
  gemini_api_key: z.string().optional(),
}).strict();

export const Route = createFileRoute("/api/character/persona")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return new Response("Invalid JSON payload.", { status: 400 });
          }

          const parsed = personaSchema.safeParse(body);
          if (!parsed.success) {
            return new Response("Invalid persona data. All fields required.", { status: 400 });
          }

          const { character_id, character_name, raw_personality, event_context, gemini_api_key } = parsed.data;
          const webhookUrl = process.env.N8N_SAVE_PERSONA_URL;
          const apiKey = gemini_api_key?.trim() || process.env.GEMINI_API_KEY || "";

          if (!webhookUrl) {
            return new Response(
              JSON.stringify({ error: "N8N_SAVE_PERSONA_URL is not configured in .env." }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          }

          const payload = {
            gemini_api_key: apiKey,
            character_id: character_id.trim().toLowerCase(),
            character_name: character_name.trim(),
            raw_personality: raw_personality.trim(),
            event_context: event_context.trim(),
          };

          const { response: upstream, text: rawText } = await postToN8n(webhookUrl, payload);

          if (!upstream.ok) {
            return new Response(rawText || "n8n compiler failed.", { status: upstream.status });
          }

          let resData: any;
          try {
            resData = JSON.parse(rawText);
          } catch {
            resData = { compiled_system_prompt: rawText };
          }

          const item = Array.isArray(resData) ? resData[0] : resData;
          const compiledPrompt =
            item?.compiled_system_prompt || item?.prompt || item?.system_prompt || item?.output || rawText;
          const status = item?.status || item?.deployment_status || "deployed";

          saveCompiledCharacter({
            character_id: payload.character_id,
            character_name: payload.character_name,
            raw_personality: payload.raw_personality,
            event_context: payload.event_context,
            compiled_system_prompt: compiledPrompt,
            deployment_status: status,
            updated_at: new Date().toISOString(),
          });

          return new Response(
            JSON.stringify({
              success: true,
              character_id: payload.character_id,
              character_name: payload.character_name,
              compiled_system_prompt: compiledPrompt,
              deployment_status: status,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("API /api/character/persona error:", error);
          return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal error." }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
