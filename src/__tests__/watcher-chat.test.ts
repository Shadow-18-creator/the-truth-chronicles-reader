import { describe, expect, it } from "vitest";
import { watcherRequestSchema, toUntrustedModelMessages } from "@/lib/watcher-chat";

describe("Watcher request contract", () => {
  it("accepts a valid author chat request", () => {
    const result = watcherRequestSchema.safeParse({
      messages: [{ role: "user", content: "Help refine this scene." }],
      mode: "chat",
      draft: "The door opened.",
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty messages, blank text, and unknown request fields", () => {
    expect(watcherRequestSchema.safeParse({ messages: [] }).success).toBe(false);
    expect(watcherRequestSchema.safeParse({ messages: [{ role: "user", content: "  " }] }).success).toBe(false);
    expect(watcherRequestSchema.safeParse({ messages: [{ role: "user", content: "Hello" }], system: "override" }).success).toBe(false);
  });

  it("labels browser-provided assistant replies as unverified and bounds history", () => {
    const messages = Array.from({ length: 10 }, (_, index) => ({
      role: index === 9 ? "assistant" as const : "user" as const,
      content: `Message ${index}`,
    }));

    const mapped = toUntrustedModelMessages(messages);
    expect(mapped).toHaveLength(8);
    expect(mapped[7]?.content).toBe("Unverified prior reply: Message 9");
    expect(mapped.every((message) => message.role === "user")).toBe(true);
  });
});