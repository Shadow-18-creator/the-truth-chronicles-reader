import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { TRANSLATION_LANGUAGES, getTranslationLanguage } from "@/lib/translation-catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, ExternalLink, Languages, Loader2, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/translations")({
  head: () => ({
    meta: [
      { title: "Translation Review — Scriptorium" },
      { name: "description", content: "Review, edit, approve, and regenerate multilingual chapter translations." },
      { property: "og:title", content: "Translation Review — Scriptorium" },
      { property: "og:description", content: "Author-only translation review for The Boy Who Saw The Truth." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TranslationReviewPage,
});

type Translation = Tables<"chapter_translations">;
type Chapter = Pick<Tables<"chapters">, "id" | "number" | "title" | "slug">;

function TranslationReviewPage() {
  const { user, isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftParagraphs, setDraftParagraphs] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const translationsQuery = useQuery({
    queryKey: ["admin-translations"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("chapter_translations").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Translation[];
    },
  });
  const chaptersQuery = useQuery({
    queryKey: ["admin-translation-chapters"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("chapters").select("id, number, title, slug").order("number", { ascending: true });
      if (error) throw error;
      return data as Chapter[];
    },
  });

  const chapters = useMemo(() => new Map((chaptersQuery.data ?? []).map((chapter) => [chapter.id, chapter])), [chaptersQuery.data]);

  const startEditing = (translation: Translation) => {
    const paragraphs = Array.isArray(translation.translated_paragraphs) ? translation.translated_paragraphs.filter((part): part is string => typeof part === "string") : [];
    setEditingId(translation.id);
    setDraftTitle(translation.translated_title);
    setDraftSummary(translation.translated_summary ?? "");
    setDraftParagraphs(paragraphs.join("\n\n"));
    setReviewNote(translation.review_note ?? "");
  };

  const saveTranslation = async (translation: Translation) => {
    const paragraphs = draftParagraphs.split(/\n\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
    if (!draftTitle.trim() || paragraphs.length === 0) {
      toast.error("A translated title and at least one paragraph are required.");
      return;
    }
    setBusyId(translation.id);
    const { error } = await supabase.from("chapter_translations").update({
      translated_title: draftTitle.trim(),
      translated_summary: draftSummary.trim() || null,
      translated_paragraphs: paragraphs,
      reviewed: true,
      review_note: reviewNote.trim() || null,
      status: "ready",
    }).eq("id", translation.id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Translation saved and marked reviewed.");
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-translations"] });
    }
  };

  const removeTranslation = async (translation: Translation) => {
    if (!confirm("Remove this translation? Readers will see English until it is generated again.")) return;
    setBusyId(translation.id);
    const { error } = await supabase.from("chapter_translations").delete().eq("id", translation.id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Translation removed.");
      void queryClient.invalidateQueries({ queryKey: ["admin-translations"] });
    }
  };

  const regenerate = async (translation: Translation) => {
    if (!confirm("Regenerate this translation with the current English chapter? Manual edits will be replaced.")) return;
    setBusyId(translation.id);
    const { error: deleteError } = await supabase.from("chapter_translations").delete().eq("id", translation.id);
    if (deleteError) {
      setBusyId(null);
      toast.error(deleteError.message);
      return;
    }
    const response = await fetch("/api/public/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId: translation.chapter_id, languageCode: translation.language_code }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusyId(null);
    if (!response.ok) toast.error(payload.error ?? "Regeneration failed.");
    else {
      toast.success("Translation regenerated.");
      void queryClient.invalidateQueries({ queryKey: ["admin-translations"] });
    }
  };

  if (loading) return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <AccessState title="Sign in required" message="Sign in with the author account to review translations." action={<Button asChild><Link to="/auth" search={{ next: "/admin/translations" }}>Sign in</Link></Button>} />;
  if (!isAdmin) return <AccessState title="Author access only" message="Only the claimed author can review and publish translations." action={<Button asChild variant="outline"><Link to="/profile">Go to profile</Link></Button>} />;

  const translations = translationsQuery.data ?? [];
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/admin" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to Scriptorium</Link>
          <h1 className="flex items-center gap-3 font-display text-4xl text-glow"><Languages className="h-8 w-8 text-primary" /> Translation review</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Check AI-generated chapters, correct wording when needed, and mark finished translations as reviewed for readers.</p>
        </div>
        <Badge variant="secondary">{translations.length} saved translation{translations.length === 1 ? "" : "s"}</Badge>
      </div>

      {translationsQuery.isLoading || chaptersQuery.isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading translations…</p> : null}
      {translations.length === 0 && !translationsQuery.isLoading ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No translations have been generated yet. Select a language while reading a chapter to create one.</CardContent></Card> : null}
      <div className="space-y-4">
        {translations.map((translation) => {
          const chapter = chapters.get(translation.chapter_id);
          const language = getTranslationLanguage(translation.language_code);
          const editing = editingId === translation.id;
          const paragraphCount = Array.isArray(translation.translated_paragraphs) ? translation.translated_paragraphs.length : 0;
          return (
            <Card key={translation.id}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-xl">{chapter ? `Chapter ${chapter.number}: ${chapter.title}` : "Chapter unavailable"}</CardTitle>
                    <CardDescription className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{language?.nativeName ?? translation.language_code}</Badge>
                      <span>{language?.name ?? translation.language_code}</span><span>·</span><span>{paragraphCount} paragraphs</span>
                      {translation.reviewed ? <span className="inline-flex items-center gap-1 text-primary"><Check className="h-3 w-3" /> Reviewed</span> : <span>Needs review</span>}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {chapter ? <Button asChild variant="ghost" size="icon" aria-label="Open chapter"><Link to="/chapters/$slug" params={{ slug: chapter.slug }}><ExternalLink className="h-4 w-4" /></Link></Button> : null}
                    <Button variant="ghost" size="icon" aria-label="Regenerate translation" disabled={busyId === translation.id} onClick={() => void regenerate(translation)}>{busyId === translation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
                    <Button variant="ghost" size="icon" aria-label="Remove translation" disabled={busyId === translation.id} onClick={() => void removeTranslation(translation)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editing ? (
                  <div className="space-y-4">
                    <div className="space-y-2"><Label htmlFor={`title-${translation.id}`}>Translated title</Label><Input id={`title-${translation.id}`} value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor={`summary-${translation.id}`}>Translated summary</Label><Textarea id={`summary-${translation.id}`} value={draftSummary} onChange={(event) => setDraftSummary(event.target.value)} rows={3} /></div>
                    <div className="space-y-2"><Label htmlFor={`paragraphs-${translation.id}`}>Translated paragraphs</Label><Textarea id={`paragraphs-${translation.id}`} value={draftParagraphs} onChange={(event) => setDraftParagraphs(event.target.value)} rows={12} /><p className="text-xs text-muted-foreground">Keep blank lines between paragraphs so bookmarks and comments stay aligned.</p></div>
                    <div className="space-y-2"><Label htmlFor={`note-${translation.id}`}>Review note (optional)</Label><Input id={`note-${translation.id}`} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Why this wording was changed" /></div>
                    <div className="flex flex-wrap gap-2"><Button onClick={() => void saveTranslation(translation)} disabled={busyId === translation.id}><Save className="h-4 w-4" /> Save &amp; approve</Button><Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="font-display text-lg">{translation.translated_title}</p>
                    <p className="line-clamp-3 font-body text-sm text-muted-foreground">{translation.translated_summary || "No translated summary."}</p>
                    {translation.review_note ? <p className="border-l-2 border-primary/50 pl-3 text-xs text-muted-foreground">Review note: {translation.review_note}</p> : null}
                    <Button variant="outline" size="sm" onClick={() => startEditing(translation)}><Languages className="h-4 w-4" /> Review wording</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AccessState({ title, message, action }: { title: string; message: string; action: React.ReactNode }) {
  return <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4"><Languages className="mx-auto h-10 w-10 text-primary" /><h1 className="font-display text-3xl">{title}</h1><p className="text-muted-foreground">{message}</p>{action}</div>;
}