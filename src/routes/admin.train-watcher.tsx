import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  FileText,
  Globe,
  HelpCircle,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  addWatcherSource,
  deleteWatcherSource,
  listWatcherSources,
  reindexWatcherSource,
} from "@/lib/watcher-ingest.functions";

export const Route = createFileRoute("/admin/train-watcher")({
  head: () => ({
    meta: [
      { title: "Train Watcher AI Assistant" },
      { name: "description", content: "Admin dashboard to train the Watcher AI with documents, URLs, and Q&A pairs." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrainWatcherPage,
});

function TrainWatcherPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listFn = useServerFn(listWatcherSources);
  const addFn = useServerFn(addWatcherSource);
  const delFn = useServerFn(deleteWatcherSource);
  const reindexFn = useServerFn(reindexWatcherSource);

  const sourcesQuery = useQuery({
    queryKey: ["watcher-sources"],
    queryFn: () => listFn({}),
    enabled: !!user && isAdmin,
  });

  const [docTitle, setDocTitle] = useState("");
  const [manualText, setManualText] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: (input: { title: string; kind: "text" | "file" | "url" | "qa"; text?: string; url?: string }) =>
      addFn({ data: input }),
    onSuccess: (res) => {
      toast.success(`Indexed into the Watcher's memory — ${res.chunks} passage${res.chunks === 1 ? "" : "s"}.`);
      void qc.invalidateQueries({ queryKey: ["watcher-sources"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Training failed"),
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-serif">Sign in required</h1>
        <p className="text-muted-foreground">You must be signed in as the author to train the Watcher.</p>
        <Button asChild>
          <Link to="/auth" search={{ next: "/admin/train-watcher" }}>Sign in</Link>
        </Button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-serif">Author access only</h1>
        <p className="text-muted-foreground">Only the claimed author can access the Watcher training hall.</p>
        <Button asChild variant="outline">
          <Link to="/profile">Go to profile</Link>
        </Button>
      </div>
    );
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of picked) {
      if (!/\.(txt|md|markdown|csv|json)$/i.test(f.name)) {
        toast.error(`${f.name}: only plain-text files (.txt, .md, .csv, .json) can be read directly — paste PDF/DOCX text below.`);
        continue;
      }
      const text = await f.text();
      await addMutation.mutateAsync({ title: f.name, kind: "file", text });
    }
  };

  const submitText = () => {
    if (!manualText.trim()) return toast.error("Paste some text first.");
    addMutation.mutate(
      { title: docTitle.trim() || "Pasted text", kind: "text", text: manualText },
      { onSuccess: () => { setManualText(""); setDocTitle(""); } },
    );
  };

  const submitUrl = () => {
    if (!urlInput.trim()) return toast.error("Enter a URL first.");
    addMutation.mutate(
      { title: urlTitle.trim() || urlInput.trim(), kind: "url", url: urlInput.trim() },
      { onSuccess: () => { setUrlInput(""); setUrlTitle(""); } },
    );
  };

  const submitQa = () => {
    if (!question.trim() || !answer.trim()) return toast.error("Both question and answer are required.");
    addMutation.mutate(
      { title: `Q&A — ${question.trim().slice(0, 60)}`, kind: "qa", text: `Question: ${question}\nAnswer: ${answer}` },
      { onSuccess: () => { setQuestion(""); setAnswer(""); } },
    );
  };

  const sources = sourcesQuery.data ?? [];
  const totalChunks = sources.reduce((n, s) => n + (s.chunk_count ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <button
            onClick={() => navigate({ to: "/admin" })}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Scriptorium
          </button>
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-primary" />
            Train Watcher AI Assistant
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Everything you add here is stored in the Watcher&rsquo;s private notebook, split into passages and indexed.
            When a reader asks a question, the Watcher searches this notebook first and answers only from it.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant="secondary" className="gap-1">
            <Database className="h-3 w-3" /> {sources.length} source{sources.length === 1 ? "" : "s"} · {totalChunks} passages
          </Badge>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/admin/watcher">Voice &amp; avatar</Link></Button>
            <Button asChild size="sm"><Link to="/watcher">Talk to Watcher</Link></Button>
          </div>
        </div>
      </div>

      {/* Text & Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Text &amp; Documents
          </CardTitle>
          <CardDescription>Upload plain-text files, or paste chapters, lore and notes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label
              htmlFor="train-file"
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-colors"
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Click to upload files</span>
              <span className="text-xs text-muted-foreground">.txt, .md, .csv, .json · multiple allowed</span>
            </Label>
            <input
              id="train-file"
              type="file"
              multiple
              accept=".txt,.md,.markdown,.csv,.json,text/plain"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-title">Title (optional)</Label>
            <Input id="doc-title" placeholder="Chapter 4 notes" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
            <Label htmlFor="manual-text">Paste text</Label>
            <Textarea
              id="manual-text"
              placeholder="Paste lore, character notes, chapter summaries…"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              className="min-h-40"
            />
            <Button onClick={submitText} disabled={addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add to Watcher&rsquo;s memory
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* URLs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Website URLs
          </CardTitle>
          <CardDescription>The page is fetched, stripped to text and indexed immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Label (optional)" value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)} />
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="url"
              placeholder="https://example.com/lore"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitUrl(); } }}
            />
            <Button type="button" onClick={submitUrl} disabled={addMutation.isPending} className="sm:w-auto">
              <Plus className="h-4 w-4" /> Fetch &amp; index
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Q&A */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" /> Q&amp;A Pair
          </CardTitle>
          <CardDescription>Teach the Watcher an exact answer to a common question.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qa-q">Question</Label>
            <Input id="qa-q" placeholder="Who is the Watcher?" value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qa-a">Answer</Label>
            <Textarea id="qa-a" placeholder="The Watcher is…" value={answer} onChange={(e) => setAnswer(e.target.value)} className="min-h-24" />
          </div>
          <Button onClick={submitQa} disabled={addMutation.isPending}>
            <Plus className="h-4 w-4" /> Add pair
          </Button>
        </CardContent>
      </Card>

      {/* Library */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> Watcher&rsquo;s Notebook
          </CardTitle>
          <CardDescription>Everything currently indexed. Re-index after editing, or remove a source entirely.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sourcesQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the notebook…
            </div>
          ) : sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing indexed yet. Add text, a URL, or a Q&amp;A pair above.</p>
          ) : (
            <ul className="space-y-2">
              {sources.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{s.title}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">{s.kind}</Badge>
                      {s.status === "ready" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <CheckCircle2 className="h-3 w-3" /> {s.chunk_count} passages
                        </span>
                      ) : (
                        <span className="text-xs text-destructive">{s.status}</span>
                      )}
                    </div>
                    {s.error_message && <p className="text-xs text-destructive">{s.error_message}</p>}
                    {s.source_url && <p className="text-xs text-muted-foreground truncate">{s.source_url}</p>}
                    <p className="text-xs text-muted-foreground line-clamp-2">{s.raw_text.slice(0, 180)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Re-index ${s.title}`}
                      disabled={busy === s.id}
                      onClick={async () => {
                        setBusy(s.id);
                        try {
                          const r = await reindexFn({ data: { id: s.id } });
                          toast.success(`Re-indexed — ${r.chunks} passages.`);
                          void qc.invalidateQueries({ queryKey: ["watcher-sources"] });
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Re-index failed");
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Delete ${s.title}`}
                      onClick={async () => {
                        try {
                          await delFn({ data: { id: s.id } });
                          toast.success("Removed from the Watcher's memory.");
                          void qc.invalidateQueries({ queryKey: ["watcher-sources"] });
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Delete failed");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
