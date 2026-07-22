import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, errText } from "../supabase";

export default defineTool({
  name: "list_my_bookmarks",
  title: "List my bookmarked chapters",
  description: "Return chapters the signed-in reader has bookmarked.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errText("Not authenticated");
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("chapter_bookmarks")
      .select("chapter_id, created_at, chapters(number, slug, title)")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false });
    if (error) return errText(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { bookmarks: data ?? [] },
    };
  },
});