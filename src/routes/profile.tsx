import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Star, Heart, UserCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Your Profile — Nightveil" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
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
        supabase.from("chapter_ratings").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("message_likes").select("id", { count: "exact", head: true }).eq("recipient_id", user!.id),
      ]);
      const given = await supabase.from("message_likes").select("id", { count: "exact", head: true }).eq("liker_id", user!.id);
      return {
        comments: c.count ?? 0,
        ratings: r.count ?? 0,
        likesReceived: l.count ?? 0,
        likesGiven: given.count ?? 0,
      };
    },
  });

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? "");
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (clean.length < 3) { toast.error("Username must be 3+ chars (a-z, 0-9, _)."); return; }
    const { error } = await supabase.from("profiles").update({
      username: clean, display_name: displayName.trim() || clean, bio: bio.trim() || null,
    }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved.");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
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

  if (loading || !user || !profile) return <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Summoning your sigil…</div>;

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <header className="text-center mb-12">
        <div className="inline-flex h-24 w-24 rounded-full bg-primary/15 text-primary items-center justify-center mb-4">
          <UserCircle2 className="h-16 w-16" />
        </div>
        <p className="text-primary text-xs font-sans tracking-[0.3em] uppercase mb-2">@{profile.username}</p>
        <h1 className="font-display text-4xl text-glow">{profile.display_name || profile.username}</h1>
        {profile.bio && <p className="font-body italic text-muted-foreground mt-3 max-w-md mx-auto">{profile.bio}</p>}
      </header>

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
          <Link to="/admin" className="font-display text-xl text-glow underline mt-2 inline-block">Enter the Scriptorium</Link>
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