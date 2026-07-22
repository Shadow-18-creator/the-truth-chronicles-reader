import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, errText } from "../supabase";

export default defineTool({
  name: "list_chapters",
  title: "List chapters",
  description: "List published chapters of 'The Boy Who Saw The Truth' with number, title, slug and summary.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max chapters to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errText("Not authenticated");
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("chapters")
      .select("id, number, slug, title, summary, published_at")
      .not("published_at", "is", null)
      .order("number", { ascending: true })
      .limit(limit ?? 50);
    if (error) return errText(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { chapters: data ?? [] },
    };
  },
});