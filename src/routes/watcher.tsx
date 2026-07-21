import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Send, Volume2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/watcher")({
  head: () => ({
    meta: [
      { title: "Talk to Watcher — The Boy Who Saw The Truth" },
      { name: "description", content: "Speak with the Watcher, the mystical guardian who knows the events of the novel. Ask questions and hear its voice." },
      { property: "og:title", content: "Talk to Watcher — The Boy Who Saw The Truth" },
      { property: "og:description", content: "Speak with the Watcher, the mystical guardian of the novel." },
      { property: "og:url", content: "https://the-truth-chronicles-reader.lovable.app/watcher" },
    ],
    links: [{ rel: "canonical", href: "https://the-truth-chronicles-reader.lovable.app/watcher" }],
  }),
  component: WatcherPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function WatcherPage() {
  const { data: cfg } = useQuery({
    queryKey: ["watcher-config-public"],
    queryFn: async () => {
      const { data } = await supabase.from("watcher_config").select("name, tagline, avatar_url, voice_id").maybeSingle();
      return data;
    },
  });

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setSending(true);
    try {
      const res = await fetch("/api/watcher/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) {
        const err = await res.text();
        toast.error(err || "The Watcher is silent.");
        setMessages(next);
        return;
      }
      const { reply } = await res.json();
      setMessages([...next, { role: "assistant", content: reply || "…" }]);
    } catch {
      toast.error("The veil is torn — try again.");
    } finally {
      setSending(false);
    }
  };

  const speak = async (idx: number, text: string) => {
    if (!cfg?.voice_id) { toast.error("The Watcher has no voice yet."); return; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSpeakingId(idx);
    try {
      const res = await fetch("/api/watcher/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: cfg.voice_id }),
      });
      if (!res.ok) { toast.error("Voice failed."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
      await audio.play();
    } catch {
      toast.error("Voice failed.");
      setSpeakingId(null);
    }
  };

  const name = cfg?.name ?? "Watcher";

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <header className="text-center mb-8">
        <p className="text-primary text-xs font-sans tracking-[0.3em] uppercase mb-3">Beyond the Veil</p>
        <div className="flex flex-col items-center gap-4">
          {cfg?.avatar_url ? (
            <img src={cfg.avatar_url} alt={name} className="h-28 w-28 rounded-full object-cover border-2 border-primary/40 shadow-[0_0_40px_rgba(212,175,55,0.35)]" />
          ) : (
            <div className="h-28 w-28 rounded-full bg-gold-gradient/10 border-2 border-primary/40 flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.35)]">
              <Eye className="h-12 w-12 text-primary" />
            </div>
          )}
          <h1 className="font-display text-5xl text-glow">{name}</h1>
          {cfg?.tagline && <p className="text-muted-foreground italic font-body">{cfg.tagline}</p>}
        </div>
      </header>

      <div className="rounded-xl border border-border/40 bg-card/50 min-h-[50vh] flex flex-col">
        <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {messages.length === 0 && (
            <p className="text-center text-muted-foreground italic py-16">Ask the Watcher a question about the tale…</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-4 py-3 font-body whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary/15 text-foreground border border-primary/30"
                  : "bg-gold-gradient text-gold-foreground border border-primary/50 shadow-[0_0_20px_rgba(212,175,55,0.2)]"
              }`}>
                {m.content}
                {m.role === "assistant" && (
                  <button
                    onClick={() => speak(i, m.content)}
                    disabled={speakingId === i}
                    className="mt-2 flex items-center gap-1 text-xs opacity-70 hover:opacity-100"
                    aria-label="Hear the Watcher"
                  >
                    {speakingId === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
                    <span>Hear</span>
                  </button>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-lg px-4 py-3 bg-card/60 border border-border/40 text-muted-foreground italic font-body">
                The Watcher stirs…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 p-4 border-t border-border/40">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the Watcher…"
            aria-label="Question for the Watcher"
            disabled={sending}
            className="bg-input/40 border-border/40 font-body"
          />
          <Button type="submit" disabled={sending || !input.trim()} className="bg-gold-gradient text-gold-foreground">
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}