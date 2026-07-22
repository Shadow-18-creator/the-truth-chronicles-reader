import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, errText } from "../supabase";

export default defineTool({
  name: "post_comment",
  title: "Post a comment on a chapter",
  description: "Post a comment on a chapter as the signed-in reader. Body must be 1-2000 characters.",
  inputSchema: {
    slug: z.string().optional(),
    number: z.number().int().optional(),
    body: z.string().min(1).max(2000),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ slug, number, body }, ctx) => {
    if (!ctx.isAuthenticated()) return errText("Not authenticated");
    if (!slug && number === undefined) return errText("Provide slug or number");
    const sb = supabaseForUser(ctx);
    let cq = sb.from("chapters").select("id, number, title").not("published_at", "is", null);
    cq = slug ? cq.eq("slug", slug) : cq.eq("number", number!);
    const { data: chapter, error: cerr } = await cq.maybeSingle();
    if (cerr) return errText(cerr.message);
    if (!chapter) return errText("Chapter not found");
    const { data, error } = await sb
      .from("comments")
      .insert({ chapter_id: chapter.id, user_id: ctx.getUserId()!, body })
      .select("id, body, created_at")
      .single();
    if (error) return errText(error.message);
    return {
      content: [{ type: "text", text: `Comment posted on chapter ${chapter.number}.` }],
      structuredContent: { comment: data },
    };
  },
});