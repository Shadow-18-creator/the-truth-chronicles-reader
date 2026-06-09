import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { BookOpen, Star } from "lucide-react";

export const Route = createFileRoute("/chapters")({
  head: () => ({
    meta: [
      { title: "Chapters — The Boy Who Saw The Truth" },
      { name: "description", content: "All published chapters of The Boy Who Saw The Truth." },
      { property: "og:title", content: "Chapters — The Boy Who Saw The Truth" },
      { property: "og:description", content: "Browse every published chapter of the serial novel The Boy Who Saw The Truth." },
      { property: "og:url", content: "https://the-truth-chronicles-reader.lovable.app/chapters" },
    ],
    links: [{ rel: "canonical", href: "https://the-truth-chronicles-reader.lovable.app/chapters" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Book",
          name: "The Boy Who Saw The Truth",
          url: "https://the-truth-chronicles-reader.lovable.app/chapters",
          bookFormat: "https://schema.org/EBook",
          inLanguage: "en",
        }),
      },
    ],
  }),
  component: ChaptersPage,
});

function ChaptersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["chapters", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, number, slug, title, summary, published_at")
        .not("published_at", "is", null)
        .order("number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: ratings } = useQuery({
    queryKey: ["chapter-ratings", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_ratings")
        .select("chapter_id, rating");
      if (error) throw error;
      const map = new Map<string, { sum: number; count: number }>();
      for (const r of data ?? []) {
        const cur = map.get(r.chapter_id) ?? { sum: 0, count: 0 };
        cur.sum += r.rating;
        cur.count += 1;
        map.set(r.chapter_id, cur);
      }
      return map;
    },
  });

  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <header className="text-center mb-16">
        <p className="text-primary text-xs font-sans tracking-[0.3em] uppercase mb-3">The Archive</p>
        <h1 className="font-display text-5xl md:text-6xl text-glow mb-4">Chapters</h1>
        <p className="font-body text-muted-foreground italic">Read at your own pace. The veil keeps your place.</p>
      </header>

      {isLoading && <p className="text-center text-muted-foreground">Drawing back the curtains…</p>}

      {data && data.length === 0 && (
        <div className="rounded-lg border border-border/40 bg-card/40 p-12 text-center">
          <BookOpen className="h-10 w-10 text-primary/60 mx-auto mb-4" />
          <p className="text-muted-foreground italic">No chapters published yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {data?.map((c) => (
          <Link
            key={c.id}
            to="/chapters/$slug"
            params={{ slug: c.slug }}
            className="block group rounded-lg border border-border/40 bg-card/40 backdrop-blur p-6 hover:border-primary/50 hover:bg-card/70 transition-all"
          >
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="font-sans text-xs tracking-[0.3em] uppercase text-primary">
                    Ch. {c.number}
                  </span>
                  {c.published_at && (
                    <span className="font-sans text-xs text-muted-foreground/60">
                      {format(new Date(c.published_at), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
                <h2 className="font-display text-2xl group-hover:text-primary transition-colors">{c.title}</h2>
                {c.summary && <p className="font-body text-muted-foreground mt-2 italic line-clamp-2">{c.summary}</p>}
              </div>
              {(() => {
                const agg = ratings?.get(c.id);
                const avg = agg && agg.count ? agg.sum / agg.count : 0;
                return (
                  <div className="flex flex-col items-end shrink-0 min-w-[72px]">
                    <div className="flex items-center gap-1 text-primary">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="font-sans text-sm">{agg ? avg.toFixed(1) : "—"}</span>
                    </div>
                    <span className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground/70 mt-0.5">
                      {agg ? `${agg.count} rating${agg.count === 1 ? "" : "s"}` : "no ratings"}
                    </span>
                  </div>
                );
              })()}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}