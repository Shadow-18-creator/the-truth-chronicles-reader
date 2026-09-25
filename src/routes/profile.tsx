import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Star, Heart, ShieldCheck, Camera, Sparkles, WandSparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AVATAR_STYLES, SeekerAvatar, type AvatarStyle } from "@/components/SeekerAvatar";
import { streamImage } from "@/lib/stream-image";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — The Boy Who Saw The Truth" },
      { name: "description", content: "Manage your seeker profile, change your username, and view your reading activity on The Boy Who Saw The Truth." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: { edit?: unknown }): { edit?: boolean } =>
    search.edit === undefined ? {} : { edit: search.edit === true || search.edit === "true" },
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/profile" });
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [c, r, l] = await Promise.all([
        supabase.from("comments").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.rpc("user_chapters_rated_count", { _user_id: user!.id }),
        supabase.from("message_likes").select("id", { count: "exact", head: true }).eq("recipient_id", user!.id),
      ]);
      const given = await supabase.from("message_likes").select("id", { count: "exact", head: true }).eq("liker_id", user!.id);
      return {
        comments: c.count ?? 0,
        ratings: (r.data as number | null) ?? 0,
        likesReceived: l.count ?? 0,
        likesGiven: given.count ?? 0,
      };
    },
  });

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>("moonlit");
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState("Mystical fantasy illustration");
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
  const [generatedAvatarFinal, setGeneratedAvatarFinal] = useState(false);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    if (search.edit) setEditing(true);
  }, [search.edit]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? "");
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setAvatarStyle((profile.avatar_style as AvatarStyle) || "moonlit");
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (clean.length < 3) { toast.error("Username must be 3+ chars (a-z, 0-9, _)."); return; }
    if (clean !== profile?.username) {
      const { data: taken } = await supabase.from("profiles").select("id").eq("username", clean).neq("id", user.id).maybeSingle();
      if (taken) { toast.error("That sigil is already taken."); return; }
    }
    const { data: updated, error } = await supabase.from("profiles").update({
      username: clean, display_name: displayName.trim() || clean, bio: bio.trim() || null, avatar_style: avatarStyle,
    }).eq("id", user.id).select().maybeSingle();
    if (error) { toast.error(error.message); return; }
    if (!updated) { toast.error("Could not save — please sign in again."); return; }
    toast.success("Profile saved.");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
    qc.invalidateQueries({ queryKey: ["profile-by-username"] });
    navigate({ to: "/profile", search: { edit: false }, replace: true });
  };

  const { data: anyAdmin } = useQuery({
    queryKey: ["any-admin"],
    queryFn: async () => {
      const { count } = await supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
      return (count ?? 0) > 0;
    },
  });

  const claimAuthorship = async () => {
    if (!user) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "admin" });
    if (error) { toast.error(error.message); return; }
    toast.success("The quill is yours.");
    location.reload();
  };

  const saveAvatarBlob = async (blob: Blob, extension: string) => {
    if (!user) return false;
    setUploading(true);
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: blob.type });
    if (upErr) { setUploading(false); toast.error(upErr.message); return false; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
    setUploading(false);
    if (dbErr) { toast.error(dbErr.message); return false; }
    toast.success("Portrait updated.");
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
    return true;
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB."); return; }
    const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
    const ALLOWED_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" };
    if (!ALLOWED.includes(file.type as any)) {
      toast.error("Only JPG, PNG, GIF, or WebP images are allowed.");
      return;
    }
    const nameExt = file.name.split(".").pop()?.toLowerCase() || "";
    if (nameExt === "svg" || file.type === "image/svg+xml") {
      toast.error("SVG images are not allowed.");
      return;
    }
    const ext = ALLOWED_EXT[file.type];
    await saveAvatarBlob(file, ext);
  };

  const generateAvatar = async () => {
    const prompt = aiPrompt.trim();
    if (prompt.length < 3) { setAvatarError("Describe your character first."); return; }
    setGeneratingAvatar(true);
    setAvatarError(null);
    setGeneratedAvatar(null);
    setGeneratedAvatarFinal(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in again before creating a portrait.");
      await streamImage(
        "/api/profile/avatar",
        { prompt: `${aiStyle}; ${prompt}`, partial_images: 1 },
        (dataUrl, isFinal) => {
          setGeneratedAvatar(dataUrl);
          setGeneratedAvatarFinal(isFinal);
        },
        undefined,
        { Authorization: `Bearer ${token}` },
      );
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message.replace(/^Image generation failed:\s*\d+\s*/, "") : "The portrait could not be created.");
    } finally {
      setGeneratingAvatar(false);
    }
  };

  const useGeneratedAvatar = async () => {
    if (!generatedAvatar || !generatedAvatarFinal) return;
    const blob = await fetch(generatedAvatar).then((response) => response.blob());
    const saved = await saveAvatarBlob(blob, "png");
    if (saved) {
      setAiOpen(false);
      setGeneratedAvatar(null);
      setAiPrompt("");
      setAvatarError(null);
    }
  };

  if (loading || !user || !profile) return <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Summoning your sigil…</div>;

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <header className="text-center mb-12">
        <label className="relative inline-flex h-24 w-24 rounded-full bg-primary/15 text-primary items-center justify-center cursor-pointer group overflow-hidden border border-primary/30">
          <SeekerAvatar style={profile.avatar_style} imageUrl={profile.avatar_url} alt="Your portrait" className="h-full w-full" glyphClassName="text-4xl" />
          <span className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Camera className="h-6 w-6" />
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={uploading} />
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
            <Camera className="h-4 w-4" />
            Upload photo
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={uploadAvatar} disabled={uploading || generatingAvatar} />
          </label>
          <Button type="button" variant="outline" size="sm" onClick={() => setAiOpen(true)} disabled={uploading || generatingAvatar}>
            <WandSparkles className="h-4 w-4" />
            Create with AI
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground font-sans">{uploading ? "Saving portrait…" : "Upload a photo or create a 2D portrait beside it"}</p>
        <p className="text-primary text-xs font-sans tracking-[0.3em] uppercase mb-2">@{profile.username}</p>
        <h1 className="font-display text-4xl text-glow">{profile.display_name || profile.username}</h1>
        {profile.bio && <p className="font-body italic text-muted-foreground mt-3 max-w-md mx-auto">{profile.bio}</p>}
        <p className="text-xs text-muted-foreground/60 font-sans mt-3">Only you see your account email: {user.email}</p>
      </header>

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="bg-card border-border/40 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Create your 2D portrait</DialogTitle>
            <DialogDescription className="font-body text-muted-foreground">
              Describe the character you want. Lovable AI will create a square portrait for your profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="avatar-style" className="text-xs font-sans uppercase tracking-widest text-muted-foreground">Visual direction</label>
              <Select value={aiStyle} onValueChange={setAiStyle}>
                <SelectTrigger id="avatar-style" className="bg-input/40 border-border/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mystical fantasy illustration">Mystical fantasy illustration</SelectItem>
                  <SelectItem value="Manga-inspired ink and color">Manga-inspired ink and color</SelectItem>
                  <SelectItem value="Dark graphic novel art">Dark graphic novel art</SelectItem>
                  <SelectItem value="Painterly storybook portrait">Painterly storybook portrait</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="avatar-prompt" className="text-xs font-sans uppercase tracking-widest text-muted-foreground">Character description</label>
              <Textarea id="avatar-prompt" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value.slice(0, 600))} rows={4} maxLength={600} placeholder="A quiet young seeker with silver eyes, a midnight cloak, and a small golden sigil..." className="bg-input/40 border-border/40" />
              <p className="text-right text-[11px] text-muted-foreground">{aiPrompt.length}/600</p>
            </div>
            {generatedAvatar && (
              <div className="space-y-3 rounded-md border border-primary/30 bg-background/30 p-3">
                <img src={generatedAvatar} alt="Generated portrait preview" className={`mx-auto aspect-square h-56 w-56 rounded-full object-cover border border-primary/40 ${generatedAvatarFinal ? "blur-0" : "blur-2xl"} transition-[filter]`} />
                <p className="text-center text-xs text-muted-foreground">{generatedAvatarFinal ? "Preview ready — save it when you like it." : "The portrait is still taking shape…"}</p>
              </div>
            )}
            {avatarError && <p role="alert" className="text-sm text-destructive">{avatarError}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAiOpen(false)}>Cancel</Button>
              <Button type="button" variant="outline" onClick={generateAvatar} disabled={generatingAvatar || !aiPrompt.trim()}>
                {generatingAvatar ? <Loader2 className="animate-spin" /> : generatedAvatar ? <RefreshCw /> : <WandSparkles />}
                {generatingAvatar ? "Creating…" : generatedAvatar ? "Generate again" : "Create portrait"}
              </Button>
              <Button type="button" onClick={useGeneratedAvatar} disabled={!generatedAvatarFinal || uploading} className="bg-gold-gradient text-gold-foreground">Use this portrait</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Portrait generation uses the site’s available AI allowance and may be limited during busy periods.</p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <StatCard icon={MessageCircle} value={stats?.comments ?? 0} label="Whispers" />
        <StatCard icon={Star} value={stats?.ratings ?? 0} label="Chapters rated" />
        <StatCard icon={Heart} value={stats?.likesReceived ?? 0} label="Likes received" />
        <StatCard icon={Heart} value={stats?.likesGiven ?? 0} label="Likes given" />
      </div>

      <section className="rounded-lg border border-border/40 bg-card/40 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">Your sigil</h2>
          {!editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>}
        </div>
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-sans uppercase tracking-widest text-muted-foreground">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 bg-input/40 border-border/40" />
              <p className="text-xs text-muted-foreground mt-1">lowercase, numbers, underscores</p>
            </div>
            <div>
              <label className="text-xs font-sans uppercase tracking-widest text-muted-foreground">Display name</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 bg-input/40 border-border/40" />
            </div>
            <div>
              <label className="text-xs font-sans uppercase tracking-widest text-muted-foreground">Bio</label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="mt-1 bg-input/40 border-border/40" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> 2D portrait
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
                {AVATAR_STYLES.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setAvatarStyle(avatar.id)}
                    aria-label={`Choose ${avatar.name} portrait`}
                    aria-pressed={avatarStyle === avatar.id}
                    className={`rounded-lg border p-2 transition-colors ${avatarStyle === avatar.id ? "border-primary bg-primary/10" : "border-border/40 hover:border-primary/50"}`}
                  >
                    <SeekerAvatar style={avatar.id} className="mx-auto h-10 w-10" glyphClassName="text-lg" />
                    <span className="mt-1 block truncate text-[10px] text-muted-foreground">{avatar.name}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Your uploaded portrait remains visible when one is set.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} className="bg-gold-gradient text-gold-foreground">Save</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Share your public sigil at{" "}
            <Link to="/u/$username" params={{ username: profile.username }} className="text-primary underline">/u/{profile.username}</Link>
          </p>
        )}
      </section>

      {!isAdmin && (
        <section className="rounded-lg border border-primary/40 bg-card/40 p-6 mt-6 text-center">
          <ShieldCheck className="h-8 w-8 text-primary mx-auto mb-3" />
          <h2 className="font-display text-2xl mb-2">Claim Authorship</h2>
          {anyAdmin ? (
            <p className="text-sm text-muted-foreground italic">The quill has already been claimed by another.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                No author has stepped forward yet. Claim the quill to unlock the Scriptorium and publish chapters.
              </p>
              <Button onClick={claimAuthorship} className="bg-gold-gradient text-gold-foreground">
                Take up the quill
              </Button>
            </>
          )}
        </section>
      )}

      {isAdmin && (
        <section className="rounded-lg border border-primary/40 bg-card/40 p-6 mt-6 text-center">
          <ShieldCheck className="h-8 w-8 text-primary mx-auto mb-3" />
          <p className="font-sans text-xs uppercase tracking-[0.3em] text-primary">You bear the quill</p>
          <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild className="bg-gold-gradient text-gold-foreground">
              <Link to="/admin/train-watcher">Train the Watcher</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin">Enter the Scriptorium</Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-5 text-center">
      <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
      <p className="font-display text-3xl text-glow">{value}</p>
      <p className="text-xs font-sans uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
    </div>
  );
}