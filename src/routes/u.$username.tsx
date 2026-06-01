import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Star, Heart, UserCircle2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/u/$username")({
  component: PublicProfile,
});

function PublicProfile() {
  const { username } = Route.useParams();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["public-profile-stats", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const [c, r, l] = await Promise.all([
        supabase.from("comments").select("id", { count: "exact", head: true }).eq("user_id", profile!.id),
        supabase.from("chapter_ratings").select("id", { count: "exact", head: true }).eq("user_id", profile!.id),
        supabase.from("message_likes").select("id", { count: "exact", head: true }).eq("recipient_id", profile!.id),
      ]);
      return { comments: c.count ?? 0, ratings: r.count ?? 0, likesReceived: l.count ?? 0 };
    },
  });

  if (isLoading) return <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Searching the veil…</div>;
  if (!profile) return null;

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <Link to="/users" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 font-sans">
        <ArrowLeft className="h-4 w-4" /> Seekers
      </Link>
      <header className="text-center mb-12">
        <div className="inline-flex h-24 w-24 rounded-full bg-primary/15 text-primary items-center justify-center mb-4 overflow-hidden border border-primary/30">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={`${profile.username} portrait`} className="h-full w-full object-cover" />
          ) : (
            <UserCircle2 className="h-16 w-16" />
          )}
        </div>
        <p className="text-primary text-xs font-sans tracking-[0.3em] uppercase mb-2">@{profile.username}</p>
        <h1 className="font-display text-4xl text-glow">{profile.display_name || profile.username}</h1>
        {profile.bio && <p className="font-body italic text-muted-foreground mt-3 max-w-md mx-auto">{profile.bio}</p>}
      </header>
      <div className="grid grid-cols-3 gap-4">
        <Stat icon={MessageCircle} value={stats?.comments ?? 0} label="Whispers" />
        <Stat icon={Star} value={stats?.ratings ?? 0} label="Rated" />
        <Stat icon={Heart} value={stats?.likesReceived ?? 0} label="Likes" />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-5 text-center">
      <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
      <p className="font-display text-3xl text-glow">{value}</p>
      <p className="text-xs font-sans uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
    </div>
  );
}