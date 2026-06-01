import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Bookmark } from "lucide-react";

export const Route = createFileRoute("/bookmarks")({
  head: () => ({ meta: [{ title: "Your Bookmarks — Nightveil" }] }),
  component: BookmarksPage,
});

function BookmarksPage() {
  const { user } = useAuth();

  const { data: chapters } = useQuery({
    queryKey: ["my-bookmarks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("chapter_bookmarks")
        .select("created_at, chapters(id, number, slug, title, summary)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: lines } = useQuery({
    queryKey: ["my-line-bookmarks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("line_bookmarks")
        .select("id, paragraph_index, note, created_at, chapters(number, slug, title)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!user) return (
    <div className="container mx-auto px-4 py-20 text-center">
      <p className="text-muted-foreground"><Link to="/auth" className="text-primary underline">Sign in</Link> to view your bookmarks.</p>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <header className="text-center mb-12">
        <Bookmark className="h-8 w-8 text-primary mx-auto mb-3" />
        <h1 className="font-display text-5xl text-glow">Your Bookmarks</h1>
      </header>

      <section className="mb-12">
        <h2 className="font-display text-2xl mb-4">Chapters</h2>
        {chapters && chapters.length === 0 && <p className="text-muted-foreground italic">No chapters bookmarked yet.</p>}
        <div className="space-y-2">
          {chapters?.map((b: any) => b.chapters && (
            <Link key={b.chapters.id} to="/chapters/$slug" params={{ slug: b.chapters.slug }}
              className="block rounded-lg border border-border/40 bg-card/40 p-4 hover:border-primary/50 transition-colors">
              <p className="text-xs text-primary tracking-widest uppercase font-sans">Ch. {b.chapters.number}</p>
              <p className="font-display text-lg">{b.chapters.title}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl mb-4">Passages</h2>
        {lines && lines.length === 0 && <p className="text-muted-foreground italic">No passages marked yet. Hover any paragraph while reading to bookmark it.</p>}
        <div className="space-y-2">
          {lines?.map((b: any) => b.chapters && (
            <Link key={b.id} to="/chapters/$slug" params={{ slug: b.chapters.slug }}
              className="block rounded-lg border border-border/40 bg-card/40 p-4 hover:border-primary/50 transition-colors">
              <p className="text-xs text-primary tracking-widest uppercase font-sans">Ch. {b.chapters.number} — paragraph {b.paragraph_index + 1}</p>
              <p className="font-display">{b.chapters.title}</p>
              {b.note && <p className="mt-1 text-sm italic text-muted-foreground">"{b.note}"</p>}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}