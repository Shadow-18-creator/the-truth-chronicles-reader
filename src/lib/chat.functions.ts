import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkRateLimit } from "@/lib/rate-limit.server";

const CHAT_RATE = { limit: 20, windowMinutes: 1 };

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; body: string }) => {
    if (!input?.roomId || !input?.body?.trim()) throw new Error("Room and message required");
    if (input.body.trim().length > 2000) throw new Error("Message too long");
    return input;
  })
  .handler(async ({ data, context }) => {
    const rate = await checkRateLimit(context.userId, "chat_send", CHAT_RATE.limit, CHAT_RATE.windowMinutes);
    if (!rate.allowed) throw new Error("You are speaking too quickly — pause a breath.");

    const { error } = await context.supabase.from("chat_messages").insert({
      room_id: data.roomId,
      user_id: context.userId,
      body: data.body.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleMessageLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string; recipientId: string; liked: boolean }) => {
    if (!input?.messageId || !input?.recipientId) throw new Error("Message required");
    return input;
  })
  .handler(async ({ data, context }) => {
    if (data.liked) {
      await context.supabase.from("message_likes").delete().eq("message_id", data.messageId).eq("liker_id", context.userId);
    } else {
      await context.supabase.from("message_likes").insert({
        message_id: data.messageId,
        liker_id: context.userId,
        recipient_id: data.recipientId,
      });
    }
    return { ok: true };
  });

export const deleteChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string }) => {
    if (!input?.messageId) throw new Error("Message required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: msg, error: fetchErr } = await context.supabase
      .from("chat_messages")
      .select("user_id")
      .eq("id", data.messageId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (msg?.user_id !== context.userId && !isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("chat_messages").delete().eq("id", data.messageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleUserBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string; blocked: boolean }) => {
    if (!input?.targetUserId) throw new Error("User required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    if (data.blocked) {
      await (context.supabase as any).from("blocked_users").delete().eq("user_id", data.targetUserId);
    } else {
      await (context.supabase as any).from("blocked_users").insert({ user_id: data.targetUserId, blocked_by: context.userId });
    }
    return { ok: true };
  });
