import { createServerFn } from "@tanstack/react-start";
import {
  getCompiledCharacters,
  saveCompiledCharacter,
  type CompiledCharacter,
} from "@/lib/character-store.server";

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
 * Task 1: Server Handler to compile and save character persona via n8n webhook.
 * Webhook URL and Gemini API key are kept strictly on the server.
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

    if (!webhookUrl) {
      throw new Error(
        "N8N_SAVE_PERSONA_URL is not configured in .env. Please configure your live n8n webhook URL."
      );
    }

    const payload = {
      gemini_api_key: geminiApiKey,
      character_id: data.character_id.trim().toLowerCase(),
      character_name: data.character_name.trim(),
      raw_personality: data.raw_personality.trim(),
      event_context: data.event_context.trim(),
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `n8n Persona Compiler returned status ${response.status}: ${errorText || "Unknown error"}`
        );
      }

      let resData: any;
      const rawText = await response.text();
      try {
        resData = JSON.parse(rawText);
      } catch {
        resData = { compiled_system_prompt: rawText };
      }

      // Handle both single object and array responses from n8n nodes
      const parsedItem = Array.isArray(resData) ? resData[0] : resData;

      const compiledPrompt =
        parsedItem?.compiled_system_prompt ||
        parsedItem?.prompt ||
        parsedItem?.system_prompt ||
        parsedItem?.output ||
        (typeof parsedItem === "string" ? parsedItem : rawText);

      const status =
        parsedItem?.status ||
        parsedItem?.deployment_status ||
        (response.ok ? "deployed" : "failed");

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
    } catch (err) {
      console.error("saveCharacterPersona error:", err);
      throw new Error(
        err instanceof Error ? err.message : "Failed to compile character persona via n8n."
      );
    }
  });

/**
 * Task 2: Server Handler to chat with an in-character AI agent via n8n webhook.
 * Gracefully handles 404 / "Not Found" if character has not been compiled yet.
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

    if (!webhookUrl) {
      throw new Error(
        "N8N_CHAT_CHARACTER_URL is not configured in .env. Please configure your live n8n webhook URL."
      );
    }

    const payload = {
      gemini_api_key: geminiApiKey,
      character_id: data.character_id.trim().toLowerCase(),
      user_query: data.user_query.trim(),
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Handle 404 / Not Found gracefully
      if (response.status === 404) {
        return {
          success: false,
          notFound: true,
          character_id: payload.character_id,
          reply: `Character "${payload.character_id}" has not been compiled into this sanctuary yet. The author must first compile their persona in the Scriptorium.`,
        };
      }

      const rawText = await response.text();
      if (!response.ok) {
        // Check if error body mentions not found / uncompiled
        if (
          rawText.toLowerCase().includes("not found") ||
          rawText.toLowerCase().includes("uncompiled") ||
          rawText.toLowerCase().includes("no persona")
        ) {
          return {
            success: false,
            notFound: true,
            character_id: payload.character_id,
            reply: `Character "${payload.character_id}" has not awakened yet. Please ask the author to compile this persona.`,
          };
        }

        throw new Error(
          `n8n Character Chat returned status ${response.status}: ${rawText || "Service error"}`
        );
      }

      let resData: any;
      try {
        resData = JSON.parse(rawText);
      } catch {
        resData = { reply: rawText };
      }

      const parsedItem = Array.isArray(resData) ? resData[0] : resData;
      const reply =
        parsedItem?.reply ||
        parsedItem?.output ||
        parsedItem?.response ||
        parsedItem?.text ||
        parsedItem?.message ||
        (typeof parsedItem === "string" ? parsedItem : rawText);

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
