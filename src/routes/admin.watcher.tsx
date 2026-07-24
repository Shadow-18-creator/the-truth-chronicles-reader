import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Eye, Upload, ArrowLeft, X, ImagePlus, Sparkles, Save, Database, Volume2, Link as LinkIcon } from "lucide-react";

export const Route = createFileRoute("/admin/watcher")({
  head: () => ({
    meta: [
      { title: "Train the Watcher — Scriptorium" },
      { name: "description", content: "Author-only page for updating the Watcher's lore, image training references, avatar, and ElevenLabs voice." },
      { property: "og:title", content: "Train the Watcher — Scriptorium" },
      { property: "og:description", content: "Update the Watcher's stored text lore, image references, avatar, and voice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
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
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { next: "/admin/watcher" } });
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
  const [uploadingTraining, setUploadingTraining] = useState(false);
  const trainingImages: string[] = (cfg?.training_images as string[] | null) ?? [];

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
      .update({
        name: name.trim() || "Watcher",
        tagline: tagline.trim(),
        voice_id: voiceId.trim(),
        system_prompt: systemPrompt.trim() || "You are the Watcher.",
        lore: lore.trim(),
        include_chapters: includeChapters,
        training_images: trainingImages,
      })
      .eq("id", true);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Watcher training data saved.");
      refetch();
      qc.invalidateQueries({ queryKey: ["watcher-config-public"] });
    }
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
    else {
      toast.success("New avatar saved for the Watcher.");
      refetch();
      qc.invalidateQueries({ queryKey: ["watcher-config-public"] });
    }
  };

  const uploadTrainingImage = async (file: File) => {
    if (!ALLOWED.has(file.type)) { toast.error("Use JPG, PNG, or WebP."); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error("Max 4 MB."); return; }
    setUploadingTraining(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `watcher/training-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) { toast.error(upErr.message); setUploadingTraining(false); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const next = [...trainingImages, pub.publicUrl];
    const { error } = await supabase.from("watcher_config").update({ training_images: next }).eq("id", true);
    setUploadingTraining(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Training image stored for the Watcher.");
      refetch();
      qc.invalidateQueries({ queryKey: ["watcher-config-public"] });
    }
  };

  const removeTrainingImage = async (url: string) => {
    const next = trainingImages.filter((u) => u !== url);
    const { error } = await supabase.from("watcher_config").update({ training_images: next }).eq("id", true);
    if (error) toast.error(error.message);
    else {
      refetch();
      qc.invalidateQueries({ queryKey: ["watcher-config-public"] });
    }
  };

  if (loading || !user) return <div className="p-16 text-center text-muted-foreground">…</div>;
  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-xl text-center">
        <Eye className="h-10 w-10 text-primary mx-auto mb-4" />
        <h1 className="font-display text-4xl text-glow mb-3">Train the Watcher</h1>
        <p className="text-muted-foreground font-body italic mb-6">
          This page opens only for the account that has claimed authorship. Sign in with that account, then use the direct link below.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Button asChild className="bg-gold-gradient text-gold-foreground">
            <Link to="/admin/watcher">Open direct link</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/profile">Check authorship</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Scriptorium
      </Link>

      <header className="text-center mb-10">
        <Eye className="h-8 w-8 text-primary mx-auto mb-3" />
        <h1 className="font-display text-5xl text-glow">Train the Watcher</h1>
        <p className="text-muted-foreground italic font-body mt-2">Store and update the Watcher's text lore, image references, avatar, and voice.</p>
        <p className="text-xs text-muted-foreground mt-3 font-sans">
          <Sparkles className="h-3 w-3 inline mr-1 text-primary" />
          AI mind: <span className="text-primary">Google Gemini 3.6 Flash</span> through Lovable AI · Voice: <span className="text-primary">ElevenLabs</span>
        </p>
      </header>

      <section className="grid md:grid-cols-3 gap-3 mb-8">
        <div className="rounded-lg border border-border/40 bg-card/40 p-4">
          <Database className="h-5 w-5 text-primary mb-2" />
          <p className="font-display">Training data</p>
          <p className="text-xs text-muted-foreground">Saved in the site backend and updated when you press Save.</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card/40 p-4">
          <Volume2 className="h-5 w-5 text-primary mb-2" />
          <p className="font-display">Voice option</p>
          <p className="text-xs text-muted-foreground">Choose an ElevenLabs voice below or paste your own voice ID.</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card/40 p-4">
          <LinkIcon className="h-5 w-5 text-primary mb-2" />
          <p className="font-display">Direct page</p>
          <Link to="/admin/watcher" className="text-xs text-primary underline">/admin/watcher</Link>
        </div>
      </section>

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
          <p className="text-xs text-muted-foreground mb-1">Avatar option — shown to readers on Talk to Watcher</p>
          <label className="inline-flex items-center gap-2 mt-2 text-sm cursor-pointer text-primary hover:underline">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload / change Watcher avatar"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border/40 bg-card/60 p-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-xl">Training images</h2>
            <p className="text-xs text-muted-foreground italic font-body">Stored image references: character portraits, maps, sigils, scenes.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer px-3 py-2 rounded-md bg-gold-gradient text-gold-foreground">
            <ImagePlus className="h-4 w-4" />
            {uploadingTraining ? "Uploading…" : "Add image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTrainingImage(f); e.currentTarget.value = ""; }}
            />
          </label>
        </div>
        {trainingImages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 italic">No images yet. Add character portraits or scenes so the Watcher can recognize them.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {trainingImages.map((url) => (
              <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-border/40">
                <img src={url} alt="Training reference" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeTrainingImage(url)}
                  aria-label="Remove training image"
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <form onSubmit={save} className="rounded-xl border border-border/40 bg-card/60 p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">Text training data</h2>
            <p className="text-xs text-muted-foreground">Last stored update: {cfg?.updated_at ? new Date(cfg.updated_at).toLocaleString() : "not saved yet"}</p>
          </div>
          <Button type="submit" disabled={saving} className="bg-gold-gradient text-gold-foreground shrink-0">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save / update"}
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} className="bg-input/40 mt-1" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Voice selector (ElevenLabs)</Label>
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
            Stored training lore — events, characters, secrets, timelines
          </Label>
          <Textarea
            value={lore}
            onChange={(e) => setLore(e.target.value)}
            rows={14}
            placeholder="Everything you write here is fed to the Watcher as canonical truth. Paste character bios, world rules, unpublished spoilers you want it to know, etc."
            className="bg-input/40 mt-1 font-body"
          />
          <p className="text-xs text-muted-foreground mt-1 italic">This text is stored as the Watcher's training data and can be updated anytime.</p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeChapters} onChange={(e) => setIncludeChapters(e.target.checked)} />
          Also feed all published chapters to the Watcher
        </label>

        <Button type="submit" disabled={saving} className="bg-gold-gradient text-gold-foreground">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save / update Watcher training data"}
        </Button>
      </form>
    </div>
  );
}