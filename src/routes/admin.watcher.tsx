import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Eye, Upload, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/watcher")({
  head: () => ({ meta: [{ title: "Train the Watcher — Scriptorium" }, { name: "robots", content: "noindex" }] }),
  component: AdminWatcher,
});

const VOICES = [
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel (deep, narrator)" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (warm baritone)" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian (mature, mystic)" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum (intense)" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris (calm)" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric (steady)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (young)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (soft female)" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda (warm female)" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice (bright female)" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura (young female)" },
];

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function AdminWatcher() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data: cfg, refetch } = useQuery({
    queryKey: ["watcher-config-admin"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("watcher_config").select("*").maybeSingle();
      return data;
    },
  });

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [lore, setLore] = useState("");
  const [includeChapters, setIncludeChapters] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!cfg) return;
    setName(cfg.name);
    setTagline(cfg.tagline);
    setVoiceId(cfg.voice_id);
    setSystemPrompt(cfg.system_prompt);
    setLore(cfg.lore ?? "");
    setIncludeChapters(cfg.include_chapters);
  }, [cfg]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("watcher_config")
      .update({ name, tagline, voice_id: voiceId, system_prompt: systemPrompt, lore, include_chapters: includeChapters })
      .eq("id", true);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("The Watcher remembers."); refetch(); }
  };

  const uploadAvatar = async (file: File) => {
    if (!ALLOWED.has(file.type)) { toast.error("Use JPG, PNG, or WebP."); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error("Max 4 MB."); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `watcher/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase.from("watcher_config").update({ avatar_url: pub.publicUrl }).eq("id", true);
    setUploading(false);
    if (error) toast.error(error.message);
    else { toast.success("New face given to the Watcher."); refetch(); }
  };

  if (loading || !user) return <div className="p-16 text-center text-muted-foreground">…</div>;
  if (!isAdmin) return <div className="p-16 text-center text-muted-foreground">Only the author may train the Watcher.</div>;

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Scriptorium
      </Link>

      <header className="text-center mb-10">
        <Eye className="h-8 w-8 text-primary mx-auto mb-3" />
        <h1 className="font-display text-5xl text-glow">Train the Watcher</h1>
        <p className="text-muted-foreground italic font-body mt-2">Teach it what it may reveal.</p>
      </header>

      <section className="rounded-xl border border-border/40 bg-card/60 p-6 mb-8 flex items-center gap-6">
        {cfg?.avatar_url ? (
          <img src={cfg.avatar_url} alt="Watcher" className="h-24 w-24 rounded-full object-cover border-2 border-primary/40" />
        ) : (
          <div className="h-24 w-24 rounded-full border-2 border-primary/40 bg-card flex items-center justify-center">
            <Eye className="h-10 w-10 text-primary" />
          </div>
        )}
        <div className="flex-1">
          <p className="font-display text-lg">{cfg?.name}</p>
          <label className="inline-flex items-center gap-2 mt-2 text-sm cursor-pointer text-primary hover:underline">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Change avatar"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
            />
          </label>
        </div>
      </section>

      <form onSubmit={save} className="rounded-xl border border-border/40 bg-card/60 p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} className="bg-input/40 mt-1" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Voice (ElevenLabs)</Label>
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="w-full bg-input/40 border border-border/40 rounded-md h-10 px-3 mt-1 font-sans text-sm"
              aria-label="ElevenLabs voice"
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
              {voiceId && !VOICES.some((v) => v.id === voiceId) && (
                <option value={voiceId}>Custom ({voiceId})</option>
              )}
            </select>
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Tagline</Label>
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} className="bg-input/40 mt-1" />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Custom voice ID (optional override)</Label>
          <Input value={voiceId} onChange={(e) => setVoiceId(e.target.value)} placeholder="Paste an ElevenLabs voice ID" className="bg-input/40 mt-1 font-mono text-xs" />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Personality (system prompt)</Label>
          <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={5} className="bg-input/40 mt-1 font-body" />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Training lore — extra events, characters, secrets, timelines
          </Label>
          <Textarea
            value={lore}
            onChange={(e) => setLore(e.target.value)}
            rows={14}
            placeholder="Everything you write here is fed to the Watcher as canonical truth. Paste character bios, world rules, unpublished spoilers you want it to know, etc."
            className="bg-input/40 mt-1 font-body"
          />
          <p className="text-xs text-muted-foreground mt-1 italic">The Watcher will only answer from this material and your published chapters.</p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeChapters} onChange={(e) => setIncludeChapters(e.target.checked)} />
          Also feed all published chapters to the Watcher
        </label>

        <Button type="submit" disabled={saving} className="bg-gold-gradient text-gold-foreground">
          {saving ? "Saving…" : "Save training"}
        </Button>
      </form>
    </div>
  );
}