import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { TRANSLATION_LANGUAGES } from "@/lib/translation-catalog";
import { checkRateLimit } from "@/lib/rate-limit.server";

type TranslationBody = {
  chapterId?: string;
  languageCode?: string;
};

type TranslationResult = {
  translatedTitle: string;
  translatedSummary: string | null;
  translatedParagraphs: string[];
};

const languageCodes = new Set(TRANSLATION_LANGUAGES.map((language) => language.code));

function splitParagraphs(content: string) {
  return content.split(/\n\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

async function hashContent(content: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/public/translate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as TranslationBody;
          if (!body.chapterId || !body.languageCode) return jsonError("Chapter and language are required.", 400);
          if (!languageCodes.has(body.languageCode)) return jsonError("That language is not supported.", 400);

          const rate = await checkRateLimit(
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
            "chapter_translation",
            8,
            1,
          );
          if (!rate.allowed) return jsonError("Translations are briefly rate limited. Try again in a moment.", 429);

          const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: chapter, error: chapterError } = await supabase
            .from("chapters")
            .select("id, title, summary, content, published_at")
            .eq("id", body.chapterId)
            .not("published_at", "is", null)
            .maybeSingle();
          if (chapterError || !chapter) return jsonError("Chapter not found.", 404);

          const sourceContentHash = await hashContent(chapter.content);
          const { data: cached } = await supabase
            .from("chapter_translations")
            .select("translated_title, translated_summary, translated_paragraphs, source_content_hash, status, reviewed")
            .eq("chapter_id", chapter.id)
            .eq("language_code", body.languageCode)
            .eq("status", "ready")
            .maybeSingle();
          if (cached && cached.source_content_hash === sourceContentHash) {
            return Response.json({
              sourceContentHash,
              reviewed: cached.reviewed,
              translation: {
                translatedTitle: cached.translated_title,
                translatedSummary: cached.translated_summary,
                translatedParagraphs: Array.isArray(cached.translated_paragraphs) ? cached.translated_paragraphs : [],
              },
            });
          }

          const language = TRANSLATION_LANGUAGES.find((item) => item.code === body.languageCode);
          if (!language) return jsonError("That language is not supported.", 400);
          const paragraphs = splitParagraphs(chapter.content);
          const prompt = [
            `Translate this published novel chapter from English into ${language.name} (${language.nativeName}).`,
            "Return valid JSON only with exactly these keys: translatedTitle, translatedSummary, translatedParagraphs.",
            "translatedParagraphs must contain exactly one translation for every source paragraph, in the same order.",
            "Preserve names, invented terms, punctuation, paragraph meaning, tone, and dialogue. Do not summarize, omit, or add commentary.",
            "Use natural, grammatically correct literary language used by native readers.",
            JSON.stringify({ title: chapter.title, summary: chapter.summary ?? "", paragraphs }),
          ].join("\n\n");

          const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": process.env["LOVABLE_API_KEY"]!,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              model: "openai/gpt-5.6-sol",
              input: prompt,
              stream: true,
              reasoning: { effort: "medium", summary: "auto" },
              include: ["reasoning.encrypted_content"],
            }),
          });
          if (!response.ok) {
            const message = await response.text();
            console.error("Translation gateway error", response.status, message);
            if (response.status === 429) return jsonError("Translation is busy. Please try again shortly.", 429);
            if (response.status === 402) return jsonError("Shared translation credits are exhausted. Please try again later.", 402);
            if (response.status === 401) return jsonError("The translation service is not configured.", 503);
            return jsonError("The translation could not be completed.", 502);
          }

          const reader = response.body?.getReader();
          if (!reader) return jsonError("The translation service returned no content.", 502);
          const decoder = new TextDecoder();
          let buffer = "";
          let output = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";
            for (const event of events) {
              for (const line of event.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                try {
                  const payload = JSON.parse(line.slice(6)) as { type?: string; delta?: string };
                  if (payload.type === "response.output_text.delta" && payload.delta) output += payload.delta;
                } catch {
                  // Ignore non-JSON keep-alive events.
                }
              }
            }
          }

          let translation: TranslationResult;
          try {
            translation = JSON.parse(output) as TranslationResult;
          } catch {
            return jsonError("The translation returned an invalid format. Please try again.", 502);
          }
          if (
            typeof translation.translatedTitle !== "string" ||
            !Array.isArray(translation.translatedParagraphs) ||
            translation.translatedParagraphs.length !== paragraphs.length
          ) {
            return jsonError("The translation did not preserve the chapter structure. Please try again.", 502);
          }

          const { error: saveError } = await supabase.from("chapter_translations").upsert(
            {
              chapter_id: chapter.id,
              language_code: body.languageCode,
              translated_title: translation.translatedTitle,
              translated_summary: translation.translatedSummary ?? null,
              translated_paragraphs: translation.translatedParagraphs,
              source_content_hash: sourceContentHash,
              status: "ready",
              model: "openai/gpt-5.6-sol",
              reviewed: false,
            },
            { onConflict: "chapter_id,language_code" },
          );
          if (saveError) {
            console.error("Translation save error", saveError);
            return jsonError("The translation was created but could not be saved.", 500);
          }
          return Response.json({ sourceContentHash, reviewed: false, translation });
        } catch (error) {
          console.error("Translation request error", error);
          return jsonError("The translation could not be completed.", 500);
        }
      },
    },
  },
});