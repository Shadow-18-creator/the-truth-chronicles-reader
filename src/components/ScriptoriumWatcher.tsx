import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Loader2, Sparkles, ShieldCheck, Send } from "lucide-react";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };
type Mode = "chat" | "polish" | "consistency";

export function ScriptoriumWatcher({ draft, onUseText }: { draft: string; onUseText: (text: string) => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<Mode | null>(null);
  const [lastPolish, setLastPolish] = useState<string | null>(null);

  const ask = async (mode: Mode, question: string) => {
    if (!draft.trim() && mode !== "chat") { toast.error("Write something in the chapter first."); return; }
    const next: Msg[] = [...messages, { role: "user", content: question }].slice(-20);
    setMessages(next);
    setBusy(mode);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { toast.error("Sign in again to reach the Watcher."); return; }
      const res = await fetch("/api/watcher/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: next, mode, draft: draft.slice(0, 60000) }),
      });
      if (!res.ok) { toast.error((await res.text()) || "The Watcher is silent."); return; }
      const { reply } = await res.json();
      setMessages([...next, { role: "assistant", content: reply || "…" }]);
      if (mode === "polish") setLastPolish(reply?.split(/\n\s*[-*•]\s/)[0]?.trim() ?? null);
    } catch {
      toast.error("The Watcher could not be reached.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <aside className="rounded-xl border border-primary/40 bg-card/60 p-4 flex flex-col gap-3 lg:sticky lg:top-20 max-h-[80vh]">
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg">The Watcher</h2>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">Author only</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => ask("polish", "Polish my draft.")}>
          {busy === "polish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Polish
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => ask("consistency", "Check my draft against the lore.")}>
          {busy === "consistency" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Lore check
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 min-h-[160px]">
        {messages.length === 0 && (
          <p className="text-xs italic text-muted-foreground font-body">Ask about your draft, polish it, or check it against your lore and earlier chapters.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`rounded-md px-3 py-2 text-sm font-body whitespace-pre-wrap ${m.role === "user" ? "bg-primary/10 border border-primary/30" : "bg-muted/40 border border-border/40"}`}>
            {m.content}
          </div>
        ))}
        {busy && <p className="text-xs italic text-muted-foreground">The Watcher reads your pages…</p>}
      </div>
      {lastPolish && (
        <Button type="button" size="sm" className="bg-gold-gradient text-gold-foreground" onClick={() => { onUseText(lastPolish); setLastPolish(null); toast.success("Polished text placed in your chapter."); }}>
          Use polished text
        </Button>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); const q = input.trim(); if (!q || busy) return; setInput(""); ask("chat", q); }}
      >
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="Ask the Watcher while you write…" className="bg-input/40 text-sm" aria-label="Question for the Watcher" />
        <Button type="submit" size="icon" disabled={!!busy || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </aside>
  );
}
