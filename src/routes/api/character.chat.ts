import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { postToN8n } from "@/lib/character.functions";

const chatSchema = z.object({
  character_id: z.string().min(1),
  user_query: z.string().min(1),
  gemini_api_key: z.string().optional(),
}).strict();

export const Route = createFileRoute("/api/character/chat")({
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

          const parsed = chatSchema.safeParse(body);
          if (!parsed.success) {
            return new Response("Character ID and query are required.", { status: 400 });
          }

          const { character_id, user_query, gemini_api_key } = parsed.data;
          const webhookUrl = process.env.N8N_CHAT_CHARACTER_URL;
          const apiKey = gemini_api_key?.trim() || process.env.GEMINI_API_KEY || "";

          if (!webhookUrl) {
            return new Response(
              JSON.stringify({ error: "N8N_CHAT_CHARACTER_URL is not configured in .env." }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          }

          const payload = {
            gemini_api_key: apiKey,
            character_id: character_id.trim().toLowerCase(),
            user_query: user_query.trim(),
          };

          const { response: upstream, text: rawText } = await postToN8n(webhookUrl, payload);

          if (upstream.status === 404) {
            return new Response(
              JSON.stringify({
                success: false,
                notFound: true,
                character_id: payload.character_id,
                reply: `Character "${payload.character_id}" has not been compiled yet. The author must first compile their persona in the Scriptorium.`,
              }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }

          if (!upstream.ok) {
            if (
              rawText.toLowerCase().includes("not found") ||
              rawText.toLowerCase().includes("uncompiled")
            ) {
              return new Response(
                JSON.stringify({
                  success: false,
                  notFound: true,
                  character_id: payload.character_id,
                  reply: `Character "${payload.character_id}" has not awakened yet. Please compile this persona first.`,
                }),
                { status: 404, headers: { "Content-Type": "application/json" } }
              );
            }

            return new Response(rawText || "n8n character chat failed.", { status: upstream.status });
          }

          let resData: any;
          try {
            resData = JSON.parse(rawText);
          } catch {
            resData = { reply: rawText };
          }

          const item = Array.isArray(resData) ? resData[0] : resData;
          const reply =
            item?.reply || item?.output || item?.response || item?.text || item?.message || rawText;

          return new Response(
            JSON.stringify({
              success: true,
              character_id: payload.character_id,
              reply: reply || "…",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("API /api/character/chat error:", error);
          return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal error." }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
