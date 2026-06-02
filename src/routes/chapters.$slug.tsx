import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bookmark, BookmarkCheck, MessageCircle, ArrowLeft, Star, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/chapters/$slug")({
  component: ChapterPage,
});

function ChapterPage() {
  const { slug } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: chapter, isLoading } = useQuery({
    queryKey: ["chapter", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: bookmark } = useQuery({
    queryKey: ["chapter-bookmark", chapter?.id, user?.id],
    enabled: !!chapter && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("chapter_bookmarks")
        .select("id")
        .eq("chapter_id", chapter!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: lineBookmarks } = useQuery({
    queryKey: ["line-bookmarks", chapter?.id, user?.id],
    enabled: !!chapter && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("line_bookmarks")
        .select("paragraph_index, note")
        .eq("chapter_id", chapter!.id)
        .eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", chapter?.id],
    enabled: !!chapter,
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("id, body, user_id, paragraph_index, created_at, profiles:user_id(username, display_name)")
        .eq("chapter_id", chapter!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: myRating } = useQuery({
    queryKey: ["chapter-rating", chapter?.id, user?.id],
    enabled: !!chapter && !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("my_chapter_rating", { _chapter_id: chapter!.id });
      return data == null ? null : { rating: data as number };
    },
  });

  const { data: ratingStats } = useQuery({
    queryKey: ["chapter-rating-stats", chapter?.id],
    enabled: !!chapter,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_ratings")
        .select("rating")
        .eq("chapter_id", chapter!.id);
      if (error) throw error;
      const count = data?.length ?? 0;
      const avg = count ? (data!.reduce((a, r) => a + r.rating, 0) / count) : 0;
      return { count, avg };
    },
  });

  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    if (!chapter) return;
    const ch = supabase
      .channel(`comments-${chapter.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `chapter_id=eq.${chapter.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["comments", chapter.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [chapter, qc]);

  if (isLoading) return <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Opening the page…</div>;
  if (!chapter) return null;

  const paragraphs = chapter.content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const bookmarkedSet = new Set((lineBookmarks ?? []).map((b) => b.paragraph_index));

  const toggleChapterBookmark = async () => {
    if (!user) { toast.error("Sign in to bookmark."); return; }
    if (bookmark) {
      await supabase.from("chapter_bookmarks").delete().eq("id", bookmark.id);
    } else {
      await supabase.from("chapter_bookmarks").insert({ user_id: user.id, chapter_id: chapter.id });
    }
    qc.invalidateQueries({ queryKey: ["chapter-bookmark", chapter.id, user.id] });
  };

  const toggleLineBookmark = async (idx: number) => {
    if (!user) { toast.error("Sign in to bookmark."); return; }
    if (bookmarkedSet.has(idx)) {
      await supabase.from("line_bookmarks").delete().eq("user_id", user.id).eq("chapter_id", chapter.id).eq("paragraph_index", idx);
    } else {
      await supabase.from("line_bookmarks").insert({ user_id: user.id, chapter_id: chapter.id, paragraph_index: idx });
    }
    qc.invalidateQueries({ queryKey: ["line-bookmarks", chapter.id, user.id] });
  };

  const rateChapter = async (stars: number) => {
    if (!user) { toast.error("Sign in to rate."); return; }
    const { error } = await supabase.from("chapter_ratings").upsert(
      { user_id: user.id, chapter_id: chapter.id, rating: stars },
      { onConflict: "chapter_id,user_id" }
    );
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["chapter-rating", chapter.id, user.id] });
    qc.invalidateQueries({ queryKey: ["chapter-rating-stats", chapter.id] });
    qc.invalidateQueries({ queryKey: ["chapter-ratings", "all"] });
  };

  const postComment = async () => {
    if (!user) { toast.error("Sign in to comment."); return; }
    if (!commentText.trim()) return;
    const { error } = await supabase.from("comments").insert({ chapter_id: chapter.id, user_id: user.id, body: commentText.trim() });
    if (error) { toast.error(error.message); return; }
    setCommentText("");
  };

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["comments", chapter.id] });
  };

  return (
    <article className="container mx-auto px-4 py-16 max-w-3xl">
      <Link to="/chapters" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 font-sans">
        <ArrowLeft className="h-4 w-4" /> All chapters
      </Link>

      <header className="text-center mb-12 pb-12 border-b border-border/40">
        <p className="font-sans text-xs tracking-[0.4em] uppercase text-primary mb-4">Chapter {chapter.number}</p>
        <h1 className="font-display text-4xl md:text-6xl text-glow mb-6">{chapter.title}</h1>
        {chapter.summary && <p className="font-body italic text-muted-foreground text-lg max-w-xl mx-auto">{chapter.summary}</p>}
        <Button onClick={toggleChapterBookmark} variant="outline" size="sm" className="mt-6 border-primary/40">
          {bookmark ? <><BookmarkCheck className="h-4 w-4 mr-2 text-primary" /> Bookmarked</> : <><Bookmark className="h-4 w-4 mr-2" /> Bookmark chapter</>}
        </Button>
        <div className="mt-6 flex items-center justify-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => rateChapter(s)} aria-label={`Rate ${s} stars`}
              className="text-primary/70 hover:text-primary transition-colors">
              <Star className={`h-5 w-5 ${(myRating?.rating ?? 0) >= s ? "fill-current text-primary" : ""}`} />
            </button>
          ))}
        </div>
        {ratingStats && (
          <p className="mt-3 font-sans text-xs tracking-widest uppercase text-muted-foreground">
            {ratingStats.count > 0
              ? <>Average <span className="text-primary">{ratingStats.avg.toFixed(1)}</span> / 5 · {ratingStats.count} rating{ratingStats.count === 1 ? "" : "s"}</>
              : <>No ratings yet — be the first</>}
          </p>
        )}
      </header>

      <div className="prose-like space-y-6 font-body text-lg leading-[1.85]">
        {paragraphs.map((p, i) => {
          const marked = bookmarkedSet.has(i);
          return (
            <div key={i} className="group relative">
              <p className={marked ? "border-l-2 border-primary pl-4" : "pl-4 border-l-2 border-transparent"}>{p}</p>
              <button
                onClick={() => toggleLineBookmark(i)}
                className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                aria-label="Bookmark this passage"
              >
                {marked ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
              </button>
            </div>
          );
        })}
      </div>

      <section className="mt-20 pt-12 border-t border-border/40">
        <h2 className="font-display text-3xl mb-6 flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-primary" /> Whispers
        </h2>

        {user ? (
          <div className="mb-8">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Leave a whisper…"
              className="bg-card/40 border-border/40 font-body"
              rows={3}
            />
            <Button onClick={postComment} className="mt-3 bg-gold-gradient text-gold-foreground font-sans" size="sm">Send into the dark</Button>
          </div>
        ) : (
          <p className="mb-8 text-muted-foreground"><Link to="/auth" className="text-primary underline">Sign in</Link> to leave a whisper.</p>
        )}

        <div className="space-y-4">
          {comments?.map((c: any) => (
            <div key={c.id} className="group rounded-lg border border-border/40 bg-card/40 p-4 flex justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-sans text-primary mb-1">
                  {c.profiles?.display_name || c.profiles?.username || "Reader"}
                </p>
                <p className="font-body break-words">{c.body}</p>
              </div>
              {(user && (user.id === c.user_id || isAdmin)) && (
                <button
                  onClick={() => deleteComment(c.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Delete comment"
                  title={isAdmin && user.id !== c.user_id ? "Delete (admin)" : "Delete"}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {comments && comments.length === 0 && <p className="text-muted-foreground italic">No whispers yet. Be the first.</p>}
        </div>
      </section>
    </article>
  );
}