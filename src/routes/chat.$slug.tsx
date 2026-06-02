import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Heart, Trash2, Ban } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/chat/$slug")({
  component: ChatRoom,
});

function ChatRoom() {
  const { slug } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: room } = useQuery({
    queryKey: ["room", slug],
    queryFn: async () => {
      const { data } = await supabase.from("chat_rooms").select("*").eq("slug", slug).maybeSingle();
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", room?.id],
    enabled: !!room,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, body, user_id, created_at, profiles:user_id(username, display_name, avatar_url)")
        .eq("room_id", room!.id)
        .order("created_at", { ascending: true })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: admins } = useQuery({
    queryKey: ["admin-ids"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      return new Set((data ?? []).map((r: any) => r.user_id));
    },
  });

  const { data: blockedSet } = useQuery({
    queryKey: ["blocked-users"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("blocked_users").select("user_id");
      return new Set((data ?? []).map((r: any) => r.user_id));
    },
  });

  const messageIds = (messages ?? []).map((m: any) => m.id);

  const { data: likes } = useQuery({
    queryKey: ["message-likes", room?.id, messageIds.join(",")],
    enabled: messageIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("message_likes")
        .select("message_id, liker_id")
        .in("message_id", messageIds);
      return data ?? [];
    },
  });

  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const l of likes ?? []) {
    likeCounts.set(l.message_id, (likeCounts.get(l.message_id) ?? 0) + 1);
    if (user && l.liker_id === user.id) likedByMe.add(l.message_id);
  }

  useEffect(() => {
    if (!room) return;
    const ch = supabase
      .channel(`room-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `room_id=eq.${room.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["messages", room.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_likes" }, () => {
        qc.invalidateQueries({ queryKey: ["message-likes", room.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [room, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Sign in to chat."); return; }
    if (!text.trim() || !room) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("chat_messages").insert({ room_id: room.id, user_id: user.id, body });
    if (error) toast.error(error.message);
  };

  const toggleLike = async (m: any) => {
    if (!user) { toast.error("Sign in to give a like."); return; }
    if (m.user_id === user.id) { toast.error("You can't like your own message."); return; }
    if (likedByMe.has(m.id)) {
      await supabase.from("message_likes").delete().eq("message_id", m.id).eq("liker_id", user.id);
    } else {
      const { error } = await supabase.from("message_likes").insert({
        message_id: m.id, liker_id: user.id, recipient_id: m.user_id,
      });
      if (error) toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["message-likes", room?.id] });
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("chat_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const toggleBlock = async (targetUserId: string) => {
    if (!user || !isAdmin) return;
    if (blockedSet?.has(targetUserId)) {
      const { error } = await (supabase as any).from("blocked_users").delete().eq("user_id", targetUserId);
      if (error) { toast.error(error.message); return; }
      toast.success("User unblocked.");
    } else {
      if (!confirm("Block this user from posting?")) return;
      const { error } = await (supabase as any).from("blocked_users").insert({ user_id: targetUserId, blocked_by: user.id });
      if (error) { toast.error(error.message); return; }
      toast.success("User blocked.");
    }
    qc.invalidateQueries({ queryKey: ["blocked-users"] });
  };

  if (!room) return <div className="p-8 text-muted-foreground">Loading room…</div>;

  return (
    <div className="flex flex-col h-[70vh]">
      <header className="px-6 py-4 border-b border-border/40">
        <h2 className="font-display text-2xl">{room.name}</h2>
        {room.description && <p className="text-sm text-muted-foreground font-body italic">{room.description}</p>}
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages?.map((m: any) => (
          (() => {
            const isAuthor = admins?.has(m.user_id);
            const isBlocked = blockedSet?.has(m.user_id);
            const canDelete = user && (user.id === m.user_id || isAdmin);
            return (
          <div key={m.id} className="group flex items-start gap-3">
            {m.profiles?.avatar_url ? (
              <img src={m.profiles.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-sans text-xs shrink-0">
                {(m.profiles?.display_name || m.profiles?.username || "?")[0]?.toUpperCase()}
              </div>
            )}
            <div className={`flex-1 min-w-0 rounded-lg px-3 py-2 ${
              isAuthor
                ? "bg-gold-gradient text-gold-foreground border border-primary/60 shadow-[0_0_20px_rgba(212,175,55,0.25)]"
                : "bg-white text-slate-900"
            }`}>
              <div className="flex items-baseline gap-2">
                {m.profiles?.username ? (
                  <Link
                    to="/u/$username"
                    params={{ username: m.profiles.username }}
                    className={`font-sans text-sm hover:underline ${isAuthor ? "text-gold-foreground font-semibold" : "text-slate-700"}`}
                  >
                    {m.profiles.display_name || m.profiles.username}
                    {isAuthor && <span className="ml-2 text-[10px] uppercase tracking-widest">Author</span>}
                    {isBlocked && <span className="ml-2 text-[10px] uppercase tracking-widest text-destructive">Blocked</span>}
                  </Link>
                ) : (
                  <span className="font-sans text-sm">Reader</span>
                )}
                <span className={`text-xs ${isAuthor ? "text-gold-foreground/70" : "text-slate-500"}`}>{format(new Date(m.created_at), "p")}</span>
              </div>
              <p className="font-body break-words">{m.body}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => toggleLike(m)}
                className={`flex items-center gap-1 text-xs font-sans px-2 py-1 rounded-md transition-colors ${
                  likedByMe.has(m.id) ? "text-primary" : "text-muted-foreground/60 hover:text-primary opacity-0 group-hover:opacity-100"
                } ${(likeCounts.get(m.id) ?? 0) > 0 ? "!opacity-100" : ""}`}
                aria-label="Like message"
              >
                <Heart className={`h-3.5 w-3.5 ${likedByMe.has(m.id) ? "fill-current" : ""}`} />
                {(likeCounts.get(m.id) ?? 0) > 0 && <span>{likeCounts.get(m.id)}</span>}
              </button>
              {isAdmin && user && user.id !== m.user_id && (
                <button
                  onClick={() => toggleBlock(m.user_id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1.5 py-1 rounded-md text-muted-foreground/60 hover:text-destructive"
                  aria-label={isBlocked ? "Unblock user" : "Block user"}
                  title={isBlocked ? "Unblock user" : "Block user"}
                >
                  <Ban className="h-3.5 w-3.5" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => deleteMessage(m.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1.5 py-1 rounded-md text-muted-foreground/60 hover:text-destructive"
                  aria-label="Delete message"
                  title="Delete message"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
            );
          })()
        ))}
        {messages && messages.length === 0 && <p className="text-center text-muted-foreground italic py-12">Silence. Be the first to speak.</p>}
        <div ref={endRef} />
      </div>

      {room.author_only_post && !isAdmin ? (
        <p className="px-6 py-4 border-t border-border/40 text-sm text-muted-foreground italic">Only the author may speak here.</p>
      ) : (
        <form onSubmit={send} className="flex gap-2 px-6 py-4 border-t border-border/40">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={user ? "Speak into the dark…" : "Sign in to chat"} disabled={!user} className="bg-input/40 border-border/40 font-body" />
          <Button type="submit" disabled={!user || !text.trim()} className="bg-gold-gradient text-gold-foreground"><Send className="h-4 w-4" /></Button>
        </form>
      )}
    </div>
  );
}