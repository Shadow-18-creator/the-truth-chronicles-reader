import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, errText } from "../supabase";

export default defineTool({
  name: "get_chapter",
  title: "Get chapter",
  description: "Get the full content of a published chapter by slug or number.",
  inputSchema: {
    slug: z.string().optional().describe("Chapter slug"),
    number: z.number().int().optional().describe("Chapter number"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug, number }, ctx) => {
    if (!ctx.isAuthenticated()) return errText("Not authenticated");
    if (!slug && number === undefined) return errText("Provide slug or number");
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("chapters")
      .select("id, number, slug, title, summary, content, published_at")
      .not("published_at", "is", null);
    q = slug ? q.eq("slug", slug) : q.eq("number", number!);
    const { data, error } = await q.maybeSingle();
    if (error) return errText(error.message);
    if (!data) return errText("Chapter not found");
    return {
      content: [{ type: "text", text: `# ${data.title}\n\n${data.content}` }],
      structuredContent: { chapter: data },
    };
  },
});