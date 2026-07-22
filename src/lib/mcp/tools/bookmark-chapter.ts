import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, errText } from "../supabase";

export default defineTool({
  name: "bookmark_chapter",
  title: "Bookmark a chapter",
  description: "Bookmark a chapter for the signed-in reader by chapter slug or number.",
  inputSchema: {
    slug: z.string().optional(),
    number: z.number().int().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  handler: async ({ slug, number }, ctx) => {
    if (!ctx.isAuthenticated()) return errText("Not authenticated");
    if (!slug && number === undefined) return errText("Provide slug or number");
    const sb = supabaseForUser(ctx);
    let cq = sb.from("chapters").select("id, number, slug, title").not("published_at", "is", null);
    cq = slug ? cq.eq("slug", slug) : cq.eq("number", number!);
    const { data: chapter, error: cerr } = await cq.maybeSingle();
    if (cerr) return errText(cerr.message);
    if (!chapter) return errText("Chapter not found");
    const { error } = await sb
      .from("chapter_bookmarks")
      .upsert({ user_id: ctx.getUserId()!, chapter_id: chapter.id }, { onConflict: "user_id,chapter_id" });
    if (error) return errText(error.message);
    return {
      content: [{ type: "text", text: `Bookmarked chapter ${chapter.number}: ${chapter.title}` }],
      structuredContent: { chapter },
    };
  },
});