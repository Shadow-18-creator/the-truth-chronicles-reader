import { z } from "zod";

/** Validated request contract for author-only Watcher chat. */
export const watcherRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(4000),
  }).strict()).min(1).max(40),
  aiKey: z.string().max(512).optional(),
  aiProvider: z.enum(["openai", "gemini"]).optional(),
  elevenLabsKey: z.string().max(512).optional(),
  mode: z.enum(["chat", "polish", "consistency"]).optional(),
  draft: z.string().max(60000).optional(),
}).strict();

export type WatcherChatRequest = z.infer<typeof watcherRequestSchema>;
export type WatcherChatMessage = WatcherChatRequest["messages"][number];

/** Marks browser-supplied assistant history as unverified user context. */
export function toUntrustedModelMessages(messages: WatcherChatMessage[]) {
  return messages.slice(-8).map((message) => ({
    role: "user" as const,
    content: `${message.role === "assistant" ? "Unverified prior reply" : "User message"}: ${message.content}`,
  }));
}