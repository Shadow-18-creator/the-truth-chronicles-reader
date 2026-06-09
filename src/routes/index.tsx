import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import heroImg from "@/assets/hero-mystic.jpg";
import { BookOpen, MessagesSquare, Sparkles, ArrowRight, ChevronDown, Pencil } from "lucide-react";

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
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
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

  const { data: meta } = useQuery({
    queryKey: ["novel-meta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("novel_meta")
        .select("summary, tags")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data ?? { summary: "", tags: [] as string[] };
    },
  });

  const [tagsOpen, setTagsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [tagsDraft, setTagsDraft] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");

  const openTagsEditor = () => {
    setTagsDraft((meta?.tags ?? []).join(", "));
    setTagsOpen(true);
  };
  const openSummaryEditor = () => {
    setSummaryDraft(meta?.summary ?? "");
    setSummaryOpen(true);
  };

  const saveTags = async () => {
    const tags = tagsDraft
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const { error } = await supabase.from("novel_meta").update({ tags }).eq("id", true);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tags updated");
    setTagsOpen(false);
    queryClient.invalidateQueries({ queryKey: ["novel-meta"] });
  };

  const saveSummary = async () => {
    const { error } = await supabase
      .from("novel_meta")
      .update({ summary: summaryDraft })
      .eq("id", true);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Summary updated");
    setSummaryOpen(false);
    queryClient.invalidateQueries({ queryKey: ["novel-meta"] });
  };

  const tags = meta?.tags ?? [];
  const summary = meta?.summary ?? "";

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
            <span className="block mt-4 text-2xl md:text-3xl font-body italic text-muted-foreground font-normal">
              A Mystical Serial Novel
            </span>
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

      {(tags.length > 0 || summary || isAdmin) && (
        <section className="container mx-auto px-4 pt-16 pb-4 max-w-3xl">
          {(tags.length > 0 || isAdmin) && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              {tags.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="font-sans text-xs tracking-wider uppercase border-primary/40 text-primary/90 bg-primary/5 px-3 py-1"
                >
                  {t}
                </Badge>
              ))}
              {isAdmin && (
                <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={openTagsEditor}
                      className="h-7 text-xs text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      {tags.length ? "Edit tags" : "Add tags"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit tags</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">Comma-separated, e.g. Psychological, Action, Supernatural, Mythology meets Cyberpunk</p>
                    <Input
                      value={tagsDraft}
                      onChange={(e) => setTagsDraft(e.target.value)}
                      placeholder="Psychological, Action, Supernatural"
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTagsOpen(false)}>Cancel</Button>
                      <Button onClick={saveTags}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}

          {(summary || isAdmin) && (
            <Collapsible>
              <div className="flex items-center justify-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="font-sans text-sm border-primary/30 hover:bg-primary/10 group"
                  >
                    About the story
                    <ChevronDown className="h-4 w-4 ml-2 transition-transform group-data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                {isAdmin && (
                  <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={openSummaryEditor}
                        className="h-8 text-xs text-muted-foreground hover:text-primary"
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        {summary ? "Edit" : "Add"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>About the story</DialogTitle>
                      </DialogHeader>
                      <Textarea
                        value={summaryDraft}
                        onChange={(e) => setSummaryDraft(e.target.value)}
                        rows={10}
                        placeholder="Write a summary of the novel..."
                      />
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setSummaryOpen(false)}>Cancel</Button>
                        <Button onClick={saveSummary}>Save</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <CollapsibleContent className="mt-6">
                <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-6 md:p-8">
                  {summary ? (
                    <p className="font-body text-base md:text-lg text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {summary}
                    </p>
                  ) : (
                    <p className="font-body italic text-muted-foreground text-center">
                      No summary yet.
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </section>
      )}

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