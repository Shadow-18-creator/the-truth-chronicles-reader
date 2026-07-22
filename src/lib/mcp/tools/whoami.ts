import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, errText } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the signed-in reader's profile (username, display name).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errText("Not authenticated");
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("profiles")
      .select("id, username, display_name, bio")
      .eq("id", ctx.getUserId()!)
      .maybeSingle();
    if (error) return errText(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { profile: data, email: ctx.getUserEmail() ?? null },
    };
  },
});