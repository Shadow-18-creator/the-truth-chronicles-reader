import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Msg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/watcher/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages } = (await request.json()) as { messages?: Msg[] };
          if (!Array.isArray(messages) || messages.length === 0) {
            return new Response("messages required", { status: 400 });
          }

          const lovableKey = process.env.LOVABLE_API_KEY;
          if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

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

          let chapterCorpus = "";
          if (cfg?.include_chapters !== false) {
            const { data: chapters } = await supabase
              .from("chapters")
              .select("number, title, summary, content, published_at")
              .not("published_at", "is", null)
              .order("number", { ascending: true });
            chapterCorpus = (chapters ?? [])
              .map((c) => `--- Chapter ${c.number}: ${c.title} ---\n${c.summary ? c.summary + "\n\n" : ""}${c.content}`)
              .join("\n\n");
          }

          const system = [
            basePrompt,
            `Your name is ${name}. Never break character.`,
            lore ? `# Additional Lore\n${lore}` : "",
            chapterCorpus ? `# Story Chapters (canonical source of truth)\n${chapterCorpus}` : "",
            trainingImages.length ? `# Visual references\nYou have been shown ${trainingImages.length} training image(s) depicting canonical characters, places, or symbols from the story. Treat what you see in those images as truth.` : "",
          ]
            .filter(Boolean)
            .join("\n\n");

          const systemContent = trainingImages.length
            ? [
                { type: "text", text: system },
                ...trainingImages.slice(0, 8).map((url) => ({ type: "image_url", image_url: { url } })),
              ]
            : system;

          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lovableKey}`,
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [{ role: "system", content: systemContent }, ...messages.slice(-20)],
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error("Watcher chat gateway error", res.status, errText);
            if (res.status === 429) return new Response("Rate limit — try again in a moment.", { status: 429 });
            if (res.status === 402) return new Response("The Watcher has run out of breath. Add credits.", { status: 402 });
            return new Response("The Watcher is silent.", { status: 500 });
          }

          const json = await res.json();
          const reply = json?.choices?.[0]?.message?.content ?? "";
          return Response.json({ reply });
        } catch (e) {
          console.error("Watcher chat error", e);
          return new Response("Watcher error", { status: 500 });
        }
      },
    },
  },
});