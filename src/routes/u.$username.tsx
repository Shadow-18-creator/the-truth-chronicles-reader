import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MessageCircle, Star, Heart, ArrowLeft } from "lucide-react";
import { SeekerAvatar } from "@/components/SeekerAvatar";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => {
    const url = `https://the-truth-chronicles-reader.lovable.app/u/${params.username}`;
    const name = params.username;
    const title = `${name} (@${params.username}) — Seeker on The Boy Who Saw The Truth`;
    const description = `Sign in to view seeker ${name}'s profile on The Boy Who Saw The Truth.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: PublicProfile,
});

function PublicProfile() {
  const { username } = Route.useParams();
  const { user, loading } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["public-profile-stats", profile?.id],
    enabled: !!profile && !!user,
    queryFn: async () => {
      const [c, r, l] = await Promise.all([
        supabase.from("comments").select("id", { count: "exact", head: true }).eq("user_id", profile!.id),
        supabase.rpc("user_chapters_rated_count", { _user_id: profile!.id }),
        supabase.from("message_likes").select("id", { count: "exact", head: true }).eq("recipient_id", profile!.id),
      ]);
      return { comments: c.count ?? 0, ratings: (r.data as number | null) ?? 0, likesReceived: l.count ?? 0 };
    },
  });

  if (loading || (user && isLoading)) return <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Searching the veil…</div>;
  if (!user) return (
    <div className="container mx-auto px-4 py-20 max-w-xl text-center">
      <h1 className="font-display text-3xl text-glow">Sign in to view this profile</h1>
      <p className="mt-3 text-muted-foreground">Reader profiles are available to signed-in members.</p>
      <Link to="/auth" search={{ next: `/u/${encodeURIComponent(username)}` }} className="mt-6 inline-flex text-primary underline">Sign in</Link>
    </div>
  );
  if (!profile) return <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Seeker not found.</div>;

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <Link to="/users" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 font-sans">
        <ArrowLeft className="h-4 w-4" /> Seekers
      </Link>
      <header className="text-center mb-12">
        <div className="inline-flex h-24 w-24 rounded-full bg-primary/15 text-primary items-center justify-center mb-4 overflow-hidden border border-primary/30">
          <SeekerAvatar style={profile.avatar_style} imageUrl={profile.avatar_url} alt={`${profile.username} portrait`} className="h-full w-full" glyphClassName="text-4xl" />
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