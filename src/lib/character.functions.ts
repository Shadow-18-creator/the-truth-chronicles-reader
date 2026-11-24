import { createServerFn } from "@tanstack/react-start";
import {
  getCompiledCharacters,
  getCompiledCharacter,
  saveCompiledCharacter,
  type CompiledCharacter,
} from "@/lib/character-store.server";

export type { CompiledCharacter } from "@/lib/character-store.server";

export interface SavePersonaInput {
  character_id: string;
  character_name: string;
  raw_personality: string;
  event_context: string;
  gemini_api_key?: string;
}

export interface ChatCharacterInput {
  character_id: string;
  user_query: string;
  gemini_api_key?: string;
}

export interface SavePersonaResult {
  success: boolean;
  character_id: string;
  character_name: string;
  compiled_system_prompt: string;
  deployment_status: string;
  error?: string;
}

export interface ChatCharacterResult {
  success: boolean;
  reply: string;
  character_id: string;
  notFound?: boolean;
  error?: string;
}

/**
 * Direct Gemini Native Compiler (matches the exact prompt & model from the n8n workflow)
 */
export async function compilePersonaWithGemini(
  apiKey: string,
  raw_personality: string,
  event_context: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: 'You are a master narrative architect. Summarize the provided character notes and event context into a strict, second-person system prompt of under 250 words that starts with "You are...". It must define the character\'s personality traits, speech tone, world rules, and boundaries. Output only the system prompt text.',
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Raw personality notes:\n${raw_personality}\n\nEvent context:\n${event_context}`,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini direct compilation failed (${res.status}): ${errText}`);
  }

  const json: any = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No output text received from Gemini.");
  return text.trim();
}

/**
 * Direct Gemini Native Chat (matches the exact prompt & model from the n8n workflow)
 */
export async function chatWithCharacterGemini(
  apiKey: string,
  systemPrompt: string,
  userQuery: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userQuery }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini direct chat failed (${res.status}): ${errText}`);
  }

  const json: any = await res.json();
  const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error("No reply text received from Gemini.");
  return reply.trim();
}

export async function postToN8n(primaryUrl: string, payload: unknown): Promise<{ response: Response; text: string }> {
  let response = await fetch(primaryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let text = await response.text();

  // If 404 with n8n unregistered webhook message, automatically try alternative (test <-> prod)
  if (response.status === 404 && text.includes("The requested webhook")) {
    let altUrl: string | null = null;
    if (primaryUrl.includes("/webhook-test/")) {
      altUrl = primaryUrl.replace("/webhook-test/", "/webhook/");
    } else if (primaryUrl.includes("/webhook/")) {
      altUrl = primaryUrl.replace("/webhook/", "/webhook-test/");
    }

    if (altUrl) {
      try {
        const altResponse = await fetch(altUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const altText = await altResponse.text();
        if (altResponse.ok || (!altText.includes("The requested webhook") && altResponse.status !== 404)) {
          response = altResponse;
          text = altText;
        }
      } catch {
        // retain original response
      }
    }
  }

  return { response, text };
}

/**
 * Task 1: Server Handler to compile and save character persona via n8n webhook or direct Gemini fallback.
 */
export const saveCharacterPersona = createServerFn({ method: "POST" })
  .validator((input: SavePersonaInput) => {
    if (!input.character_id?.trim()) throw new Error("Character ID is required.");
    if (!input.character_name?.trim()) throw new Error("Character Name is required.");
    if (!input.raw_personality?.trim()) throw new Error("Raw Personality is required.");
    if (!input.event_context?.trim()) throw new Error("Event Context is required.");
    return input;
  })
  .handler(async ({ data }): Promise<SavePersonaResult> => {
    const webhookUrl = process.env.N8N_SAVE_PERSONA_URL;
    const geminiApiKey =
      data.gemini_api_key?.trim() || process.env.GEMINI_API_KEY || "";

    if (!geminiApiKey) {
      throw new Error(
        "A Google Gemini API key is required to compile personas. Please paste your key into the 'Optional Gemini API Key (BYOK Override)' field below, or set GEMINI_API_KEY in your .env file."
      );
    }

    const payload = {
      gemini_api_key: geminiApiKey,
      character_id: data.character_id.trim().toLowerCase(),
      character_name: data.character_name.trim(),
      raw_personality: data.raw_personality.trim(),
      event_context: data.event_context.trim(),
    };

    let compiledPrompt = "";
    let status = "deployed";

    // 1. Try n8n webhook first if configured
    if (webhookUrl) {
      try {
        const { response, text: rawText } = await postToN8n(webhookUrl, payload);
        if (response.ok) {
          let resData: any;
          try {
            resData = JSON.parse(rawText);
          } catch {
            resData = { compiled_system_prompt: rawText };
          }

          const parsedItem = Array.isArray(resData) ? resData[0] : resData;
          compiledPrompt =
            parsedItem?.compiled_system_prompt ||
            parsedItem?.prompt ||
            parsedItem?.system_prompt ||
            parsedItem?.output ||
            (typeof parsedItem === "string" ? parsedItem : rawText);

          status =
            parsedItem?.status ||
            parsedItem?.deployment_status ||
            "deployed";
        } else {
          console.warn(`n8n webhook returned status ${response.status}. Attempting direct Gemini compilation.`);
        }
      } catch (n8nErr) {
        console.warn("n8n webhook failed, falling back to direct Gemini compilation:", n8nErr);
      }
    }

    // 2. Direct Gemini fallback (if n8n is offline, expired, or not configured)
    if (!compiledPrompt) {
      if (!geminiApiKey) {
        throw new Error(
          "n8n webhook is offline and no Gemini API Key was provided. Please configure GEMINI_API_KEY or enter your key in the BYOK field."
        );
      }
      compiledPrompt = await compilePersonaWithGemini(
        geminiApiKey,
        payload.raw_personality,
        payload.event_context
      );
      status = "deployed";
    }

    // Persist character in our server character store
    saveCompiledCharacter({
      character_id: payload.character_id,
      character_name: payload.character_name,
      raw_personality: payload.raw_personality,
      event_context: payload.event_context,
      compiled_system_prompt: compiledPrompt,
      deployment_status: status,
      updated_at: new Date().toISOString(),
    });

    return {
      success: true,
      character_id: payload.character_id,
      character_name: payload.character_name,
      compiled_system_prompt: compiledPrompt,
      deployment_status: status,
    };
  });

/**
 * Task 2: Server Handler to chat with an in-character AI agent via n8n webhook or direct Gemini fallback.
 */
export const chatWithCharacter = createServerFn({ method: "POST" })
  .validator((input: ChatCharacterInput) => {
    if (!input.character_id?.trim()) throw new Error("Character ID is required.");
    if (!input.user_query?.trim()) throw new Error("Query is required.");
    return input;
  })
  .handler(async ({ data }): Promise<ChatCharacterResult> => {
    const webhookUrl = process.env.N8N_CHAT_CHARACTER_URL;
    const geminiApiKey =
      data.gemini_api_key?.trim() || process.env.GEMINI_API_KEY || "";

    if (!geminiApiKey) {
      throw new Error(
        "A Google Gemini API key is required to commune with this character. Please enter your key in the API key override field or set GEMINI_API_KEY in .env."
      );
    }

    const payload = {
      gemini_api_key: geminiApiKey,
      character_id: data.character_id.trim().toLowerCase(),
      user_query: data.user_query.trim(),
    };

    let reply = "";
    let isNotFound = false;

    try {
      // 1. Try n8n webhook if configured
      if (webhookUrl) {
        try {
          const { response, text: rawText } = await postToN8n(webhookUrl, payload);

          if (response.status === 404) {
            if (!rawText.includes("not registered")) {
              isNotFound = true;
            }
          } else if (response.ok) {
            let resData: any;
            try {
              resData = JSON.parse(rawText);
            } catch {
              resData = { reply: rawText };
            }

            const parsedItem = Array.isArray(resData) ? resData[0] : resData;
            reply =
              parsedItem?.reply ||
              parsedItem?.output ||
              parsedItem?.response ||
              parsedItem?.text ||
              parsedItem?.message ||
              (typeof parsedItem === "string" ? parsedItem : rawText);
          }
        } catch (n8nErr) {
          console.warn("n8n chat webhook failed, falling back to direct Gemini engine:", n8nErr);
        }
      }

      if (isNotFound) {
        return {
          success: false,
          notFound: true,
          character_id: payload.character_id,
          reply: `Character "${payload.character_id}" has not been compiled into this sanctuary yet. The author must first compile their persona in the Scriptorium.`,
        };
      }

      // 2. Direct Gemini chat fallback (if n8n is offline, expired, or not configured)
      if (!reply) {
        const character = getCompiledCharacter(payload.character_id);
        if (!character || !character.compiled_system_prompt) {
          return {
            success: false,
            notFound: true,
            character_id: payload.character_id,
            reply: `Character "${payload.character_id}" has not been compiled yet. Please compile this persona in the Scriptorium first.`,
          };
        }

        if (!geminiApiKey) {
          throw new Error(
            "Gemini API key is required to commune with the character directly. Please add GEMINI_API_KEY to your environment or BYOK field."
          );
        }

        reply = await chatWithCharacterGemini(
          geminiApiKey,
          character.compiled_system_prompt,
          payload.user_query
        );
      }

      return {
        success: true,
        character_id: payload.character_id,
        reply: reply || "…",
      };
    } catch (err) {
      console.error("chatWithCharacter error:", err);
      throw new Error(
        err instanceof Error ? err.message : "The character could not be reached through the veil."
      );
    }
  });

/**
 * Helper to fetch all available compiled characters from server store.
 */
export const getAvailableCharacters = createServerFn({ method: "GET" }).handler(
  async (): Promise<CompiledCharacter[]> => {
    return getCompiledCharacters();
  }
);
