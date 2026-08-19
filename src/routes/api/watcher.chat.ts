import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { checkRateLimit } from "@/lib/rate-limit.server";

type Msg = { role: "user" | "assistant"; content: string };

type Body = {
  messages?: Msg[];
  aiKey?: string;
  aiProvider?: "openai" | "gemini";
  elevenLabsKey?: string;
};

const RATE_LIMIT = { limit: 12, windowMinutes: 1 };

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}

export const Route = createFileRoute("/api/watcher/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const { messages } = body;
          if (!Array.isArray(messages) || messages.length === 0) {
            return new Response("messages required", { status: 400 });
          }

          const ip = getClientIp(request);
          const rateKey = ip;
          const rate = await checkRateLimit(rateKey, "watcher_chat", RATE_LIMIT.limit, RATE_LIMIT.windowMinutes);
          if (!rate.allowed) {
            return new Response("The Watcher is resting — too many questions too quickly. Try again in a moment.", { status: 429 });
          }

          const supabase = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );

          const { data: cfg } = await supabase.from("watcher_config").select("*").maybeSingle();
          const name = cfg?.name ?? "Watcher";
          const basePrompt = cfg?.system_prompt ?? "You are the Watcher.";
          const lore = cfg?.lore ?? "";
          const trainingImages: string[] = (cfg?.training_images as string[] | null) ?? [];

          // --- Retrieval from the Watcher's private knowledge library ---
          let retrieved = "";
          try {
            const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
            if (lastUser.trim()) {
              const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
                },
                body: JSON.stringify({ model: "google/gemini-embedding-2", input: lastUser.slice(0, 4000) }),
              });
              if (embRes.ok) {
                const embJson = (await embRes.json()) as { data?: { embedding?: number[] }[] };
                const vector = embJson?.data?.[0]?.embedding;
                if (Array.isArray(vector)) {
                  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
                  const { data: matches } = await supabaseAdmin.rpc("match_watcher_chunks", {
                    query_embedding: JSON.stringify(vector) as unknown as string,
                    match_count: 12,
                  });
                  retrieved = (matches ?? [])
                    .map((m: { title: string; content: string }) => `[${m.title}]\n${m.content}`)
                    .join("\n\n");
                }
              }
            }
          } catch (err) {
            console.error("Watcher retrieval failed", err);
          }

          // --- Optional chapter summaries for grounding (lightweight) ---
          let chapterSummaryCorpus = "";
          if (cfg?.include_chapters !== false) {
            const { data: chapters } = await supabase
              .from("chapters")
              .select("number, title, summary, published_at")
              .not("published_at", "is", null)
              .order("number", { ascending: true });
            chapterSummaryCorpus = (chapters ?? [])
              .map((c) => `--- Chapter ${c.number}: ${c.title} ---\n${c.summary ?? ""}`)
              .filter((s) => s.trim())
              .join("\n\n");
          }

          const system = [
            basePrompt,
            `Your name is ${name}. Never break character.`,
            lore ? `# Additional Lore\n${lore}` : "",
            retrieved
              ? `# Retrieved knowledge (most relevant passages from the author's training library — prefer these when answering)\n${retrieved}`
              : "",
            chapterSummaryCorpus ? `# Story Chapters (canonical source of truth — summaries only)\n${chapterSummaryCorpus}` : "",
            trainingImages.length
              ? `# Visual references\nYou have been shown ${trainingImages.length} training image(s) depicting canonical characters, places, or symbols from the story. Treat what you see in those images as truth.`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n");

          const systemContent = trainingImages.length
            ? [
                { type: "text" as const, text: system },
                ...trainingImages.slice(0, 8).map((url) => ({ type: "image_url" as const, image_url: { url } })),
              ]
            : system;

          const recentMessages = messages.slice(-8);

          // --- Use the reader's own key if provided, otherwise the site key ---
          let reply = "";
          if (body.aiKey && body.aiProvider) {
            const baseURL =
              body.aiProvider === "gemini"
                ? "https://generativelanguage.googleapis.com/v1beta/openai/"
                : "https://api.openai.com/v1/";
            const model = body.aiProvider === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini";

            const res = await fetch(`${baseURL}chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${body.aiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [{ role: "system", content: systemContent }, ...recentMessages],
                max_tokens: 1024,
              }),
            });

            if (!res.ok) {
              const errText = await res.text();
              console.error("Watcher BYO AI error", res.status, errText);
              if (res.status === 401) return new Response("Your API key was rejected — check it and try again.", { status: 402 });
              if (res.status === 429) return new Response("Your AI provider rate limit was hit — slow down or switch keys.", { status: 429 });
              return new Response("The Watcher could not speak through your key. " + errText.slice(0, 120), { status: 502 });
            }

            const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
            reply = json?.choices?.[0]?.message?.content ?? "";
          } else {
            const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
              },
              body: JSON.stringify({
                model: "google/gemini-3.6-flash",
                messages: [{ role: "system", content: systemContent }, ...recentMessages],
              }),
            });

            if (!res.ok) {
              const errText = await res.text();
              console.error("Watcher chat gateway error", res.status, errText);
              if (res.status === 429) return new Response("Rate limit — try again in a moment.", { status: 429 });
              if (res.status === 402) return new Response("The Watcher has run out of breath. Add credits.", { status: 402 });
              return new Response("The Watcher is silent.", { status: 500 });
            }

            const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
            reply = json?.choices?.[0]?.message?.content ?? "";
          }

          return Response.json({ reply });
        } catch (e) {
          console.error("Watcher chat error", e);
          return new Response("The Watcher is silent.", { status: 500 });
        }
      },
    },
  },
});
