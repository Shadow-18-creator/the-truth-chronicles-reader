import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { checkRateLimit } from "@/lib/rate-limit.server";
import { generateImage, profileAvatarImageSettings } from "@/lib/image-gateway.server";

const RATE_LIMIT = { limit: 3, windowMinutes: 10 };

export const Route = createFileRoute("/api/profile-avatar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) return new Response("Sign in to create a portrait.", { status: 401 });

          const token = authHeader.slice("Bearer ".length).trim();
          const url = process.env.SUPABASE_URL;
          const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!url || !publishableKey || !token) return new Response("Sign in to create a portrait.", { status: 401 });

          const supabase = createClient<Database>(url, publishableKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
          const userId = claims?.claims?.sub;
          if (claimsError || !userId) return new Response("Your session has expired. Please sign in again.", { status: 401 });

          const rate = await checkRateLimit(userId, "profile_avatar_generation", RATE_LIMIT.limit, RATE_LIMIT.windowMinutes);
          if (!rate.allowed) return new Response("You have reached the portrait limit. Try again in a few minutes.", { status: 429 });

          const body = (await request.json()) as { prompt?: unknown; stream?: unknown };
          if (typeof body.prompt !== "string" || body.prompt.trim().length < 3) {
            return new Response("Describe the character you want to create.", { status: 400 });
          }
          const prompt = body.prompt.trim().slice(0, 700);
          const stream = body.stream !== false;
          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("AI portrait generation is not configured yet.", { status: 500 });

          const finalPrompt = [
            "Create a square 2D character portrait for a profile avatar.",
            "Make it a single centered character from the shoulders up, with a clean readable silhouette, expressive face, polished illustration, and a simple atmospheric background.",
            "Do not include words, letters, logos, watermarks, borders, multiple characters, or real-person likenesses.",
            `Visual direction: ${prompt}`,
          ].join("\n");

          const upstream = await generateImage(
            { ...profileAvatarImageSettings, apiKey: key },
            finalPrompt,
            stream,
            request.signal,
          );
          if (!upstream.ok || !upstream.body) {
            return new Response(await upstream.text(), {
              status: upstream.status,
              headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "text/plain" },
            });
          }

          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              "Content-Type": upstream.headers.get("Content-Type") ?? (stream ? "text/event-stream" : "application/json"),
              "Cache-Control": "no-cache",
            },
          });
        } catch (error) {
          if (request.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
            return new Response(null, { status: 499 });
          }
          console.error("Profile avatar generation failed", error);
          return new Response("The portrait could not be created. Please try again.", { status: 500 });
        }
      },
    },
  },
});