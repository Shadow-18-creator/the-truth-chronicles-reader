import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-mystic.jpg";
import { BookOpen, MessagesSquare, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Boy Who Saw The Truth — A Mystical Serial Novel" },
      { name: "description", content: "Read the latest chapters, mark passages that haunt you, and gather with fellow readers in the mystical halls." },
      { property: "og:title", content: "The Boy Who Saw The Truth — A Mystical Serial Novel" },
      { property: "og:description", content: "Read, bookmark, and discuss a serialized novel of veils and shadows." },
      { property: "og:url", content: "https://the-truth-chronicles-reader.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://the-truth-chronicles-reader.lovable.app/" }],
  }),
  component: Index,
});

function Index() {
  const { data: chapters } = useQuery({
    queryKey: ["latest-chapters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, number, slug, title, summary, published_at")
        .not("published_at", "is", null)
        .order("number", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={heroImg}
            alt=""
            width={1920}
            height={1080}
            className="h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />
        </div>

        <div className="container mx-auto px-4 py-32 md:py-48 text-center">
          <p className="font-sans text-xs uppercase tracking-[0.4em] text-primary mb-6 animate-shimmer">
            <Sparkles className="inline h-3 w-3 mr-2" />
            A serial of veils and shadows
          </p>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-semibold text-glow leading-[1.05] mb-6">
            The Boy Who Saw The Truth
          </h1>
          <p className="font-body text-xl md:text-2xl italic text-muted-foreground max-w-2xl mx-auto mb-10">
            "Some doors only open at the hour the moon forgets her name."
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/chapters">
              <Button size="lg" className="bg-gold-gradient text-gold-foreground hover:opacity-90 font-sans px-8 glow-gold">
                <BookOpen className="h-4 w-4 mr-2" />
                Read the latest chapter
              </Button>
            </Link>
            <Link to="/chat">
              <Button size="lg" variant="outline" className="font-sans px-8 border-primary/40 hover:bg-primary/10">
                <MessagesSquare className="h-4 w-4 mr-2" />
                Enter the halls
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-primary text-xs font-sans tracking-[0.3em] uppercase mb-2">Recent</p>
            <h2 className="font-display text-4xl md:text-5xl">Latest Chapters</h2>
          </div>
          <Link to="/chapters" className="hidden md:flex items-center gap-2 text-sm font-sans text-muted-foreground hover:text-primary transition-colors">
            All chapters <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {chapters && chapters.length === 0 && (
          <div className="rounded-lg border border-border/40 bg-card/40 p-12 text-center">
            <p className="text-muted-foreground italic">The first chapter is being scribed. Return soon.</p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {chapters?.map((c) => (
            <Link
              key={c.id}
              to="/chapters/$slug"
              params={{ slug: c.slug }}
              className="group relative rounded-xl border border-border/40 bg-card/60 backdrop-blur p-8 hover:border-primary/50 transition-all hover:shadow-arcane hover:-translate-y-1"
            >
              <p className="font-sans text-xs tracking-[0.3em] uppercase text-primary mb-3">
                Chapter {c.number}
              </p>
              <h3 className="font-display text-2xl mb-3 group-hover:text-glow transition-all">
                {c.title}
              </h3>
              {c.summary && (
                <p className="font-body text-muted-foreground italic line-clamp-3">{c.summary}</p>
              )}
              <ArrowRight className="absolute top-8 right-8 h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-20 border-t border-border/40">
        <div className="grid md:grid-cols-3 gap-12 text-center">
          {[
            { icon: BookOpen, title: "Read at your pace", desc: "Bookmark chapters and even individual passages. Return whenever the moon rises." },
            { icon: Sparkles, title: "Mark the moments", desc: "Save the lines that struck you. Add a private note. The veil remembers." },
            { icon: MessagesSquare, title: "Gather in the halls", desc: "Discuss in the lounge, ask the author directly, or theorize in chapter rooms." },
          ].map((p) => (
            <div key={p.title}>
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-primary mb-4 glow-gold">
                <p.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl mb-2">{p.title}</h3>
              <p className="font-body text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}