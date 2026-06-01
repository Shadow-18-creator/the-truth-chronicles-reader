import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
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
        .select("id, body, user_id, created_at, profiles:user_id(username, display_name)")
        .eq("room_id", room!.id)
        .order("created_at", { ascending: true })
        .limit(200);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!room) return;
    const ch = supabase
      .channel(`room-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `room_id=eq.${room.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["messages", room.id] });
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

  if (!room) return <div className="p-8 text-muted-foreground">Loading room…</div>;

  return (
    <div className="flex flex-col h-[70vh]">
      <header className="px-6 py-4 border-b border-border/40">
        <h2 className="font-display text-2xl">{room.name}</h2>
        {room.description && <p className="text-sm text-muted-foreground font-body italic">{room.description}</p>}
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages?.map((m: any) => (
          <div key={m.id} className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-sans text-xs shrink-0">
              {(m.profiles?.display_name || m.profiles?.username || "?")[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-sans text-sm text-primary">{m.profiles?.display_name || m.profiles?.username || "Reader"}</span>
                <span className="text-xs text-muted-foreground/60">{format(new Date(m.created_at), "p")}</span>
              </div>
              <p className="font-body break-words">{m.body}</p>
            </div>
          </div>
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