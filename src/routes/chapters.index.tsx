import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { BookOpen, Star } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getAllChapterRatings } from "@/lib/chapter.functions";

export const Route = createFileRoute("/chapters/")({
  component: ChaptersPage,
});

function ChaptersPage() {
  const fetchRatings = useServerFn(getAllChapterRatings);
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
      const obj = await fetchRatings();
      return new Map(Object.entries(obj).map(([key, value]) => [key, value as { sum: number; count: number }]));
    },
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <header className="mb-16 text-center">
        <p className="mb-3 font-sans text-xs uppercase tracking-[0.3em] text-primary">The Archive</p>
        <h1 className="mb-4 font-display text-5xl text-glow md:text-6xl">Chapters</h1>
        <p className="font-body italic text-muted-foreground">Read at your own pace. The veil keeps your place.</p>
      </header>

      {isLoading && <p className="text-center text-muted-foreground">Drawing back the curtains…</p>}
      {data && data.length === 0 && (
        <div className="rounded-lg border border-border/40 bg-card/40 p-12 text-center">
          <BookOpen className="mx-auto mb-4 h-10 w-10 text-primary/60" />
          <p className="text-muted-foreground italic">No chapters published yet.</p>
        </div>
      )}
      <div className="space-y-3">
        {data?.map((chapter) => {
          const aggregate = ratings?.get(chapter.id);
          const average = aggregate && aggregate.count ? aggregate.sum / aggregate.count : 0;
          return (
            <Link
              key={chapter.id}
              to="/chapters/$slug"
              params={{ slug: chapter.slug }}
              className="group block rounded-lg border border-border/40 bg-card/40 p-6 backdrop-blur transition-all hover:border-primary/50 hover:bg-card/70"
            >
              <div className="flex items-baseline justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline gap-3">
                    <span className="font-sans text-xs uppercase tracking-[0.3em] text-primary">Ch. {chapter.number}</span>
                    {chapter.published_at && <span className="font-sans text-xs text-muted-foreground/60">{format(new Date(chapter.published_at), "MMM d, yyyy")}</span>}
                  </div>
                  <h2 className="font-display text-2xl transition-colors group-hover:text-primary">{chapter.title}</h2>
                  {chapter.summary && <p className="mt-2 line-clamp-2 font-body italic text-muted-foreground">{chapter.summary}</p>}
                </div>
                <div className="flex min-w-[72px] shrink-0 flex-col items-end">
                  <div className="flex items-center gap-1 text-primary"><Star className="h-4 w-4 fill-current" /><span className="font-sans text-sm">{aggregate ? average.toFixed(1) : "—"}</span></div>
                  <span className="mt-0.5 font-sans text-[10px] uppercase tracking-widest text-muted-foreground/70">{aggregate ? `${aggregate.count} rating${aggregate.count === 1 ? "" : "s"}` : "no ratings"}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}