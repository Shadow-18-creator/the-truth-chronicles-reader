import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  FileText,
  Globe,
  HelpCircle,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

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

type QAPair = { id: string; question: string; answer: string };

function TrainWatcherPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const [files, setFiles] = useState<File[]>([]);
  const [manualText, setManualText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [qaPairs, setQaPairs] = useState<QAPair[]>([
    { id: crypto.randomUUID(), question: "", answer: "" },
  ]);
  const [isTraining, setIsTraining] = useState(false);
  const [lastTrainedAt, setLastTrainedAt] = useState<Date | null>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const allowed = picked.filter((f) =>
      /\.(pdf|txt|docx)$/i.test(f.name) ||
      ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(f.type)
    );
    if (allowed.length !== picked.length) {
      toast.error("Only PDF, TXT, or DOCX files are accepted.");
    }
    setFiles((prev) => [...prev, ...allowed]);
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const addUrl = () => {
    const v = urlInput.trim();
    if (!v) return;
    try {
      const u = new URL(v);
      if (!/^https?:$/.test(u.protocol)) throw new Error("bad protocol");
      if (urls.includes(u.toString())) {
        toast.error("URL already added.");
        return;
      }
      setUrls((prev) => [...prev, u.toString()]);
      setUrlInput("");
    } catch {
      toast.error("Enter a valid http(s) URL.");
    }
  };

  const removeUrl = (idx: number) => setUrls((prev) => prev.filter((_, i) => i !== idx));

  const addQaPair = () =>
    setQaPairs((prev) => [...prev, { id: crypto.randomUUID(), question: "", answer: "" }]);

  const removeQaPair = (id: string) =>
    setQaPairs((prev) => (prev.length === 1 ? prev : prev.filter((p) => p.id !== id)));

  const updateQaPair = (id: string, field: "question" | "answer", value: string) =>
    setQaPairs((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const totalItems =
    files.length +
    (manualText.trim() ? 1 : 0) +
    urls.length +
    qaPairs.filter((q) => q.question.trim() && q.answer.trim()).length;

  const startTraining = async () => {
    if (totalItems === 0) {
      toast.error("Add at least one piece of training material.");
      return;
    }
    setIsTraining(true);
    setLastTrainedAt(null);
    try {
      // Simulated training pipeline — replace with real ingestion when backend is ready.
      await new Promise((r) => setTimeout(r, 1800));
      setLastTrainedAt(new Date());
      toast.success(`Training complete — processed ${totalItems} item${totalItems === 1 ? "" : "s"}.`);
    } finally {
      setIsTraining(false);
    }
  };

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
            Feed the Watcher documents, live web sources, and curated Q&amp;A so it can answer readers with your voice.
          </p>
        </div>
        {lastTrainedAt && (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Last trained {lastTrainedAt.toLocaleTimeString()}
          </Badge>
        )}
      </div>

      {/* Text & Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Text &amp; Documents
          </CardTitle>
          <CardDescription>Upload PDF, TXT, or DOCX files, or paste raw text below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label
              htmlFor="train-file"
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-colors"
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Click to upload files</span>
              <span className="text-xs text-muted-foreground">PDF, TXT, DOCX · multiple allowed</span>
            </Label>
            <input
              id="train-file"
              type="file"
              multiple
              accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFileChange}
            />
            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="truncate flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      {f.name}
                      <span className="text-xs text-muted-foreground">({Math.ceil(f.size / 1024)} KB)</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeFile(i)}
                      aria-label={`Remove ${f.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-text">Paste text</Label>
            <Textarea
              id="manual-text"
              placeholder="Paste lore, character notes, chapter summaries…"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              className="min-h-40"
            />
          </div>
        </CardContent>
      </Card>

      {/* URLs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Website URLs
          </CardTitle>
          <CardDescription>Add pages the Watcher should crawl and learn from.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="url"
              placeholder="https://example.com/lore"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl();
                }
              }}
            />
            <Button type="button" onClick={addUrl} className="sm:w-auto">
              <Plus className="h-4 w-4" /> Add URL
            </Button>
          </div>
          {urls.length === 0 ? (
            <p className="text-xs text-muted-foreground">No URLs added yet.</p>
          ) : (
            <ul className="space-y-2">
              {urls.map((u, i) => (
                <li
                  key={u}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="truncate">{u}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeUrl(i)}
                    aria-label={`Remove ${u}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Q&A */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" /> Q&amp;A Pairs
          </CardTitle>
          <CardDescription>Teach the Watcher exact answers to common questions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qaPairs.map((pair, idx) => (
            <div
              key={pair.id}
              className="rounded-lg border border-border p-4 space-y-3 bg-muted/20"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Pair #{idx + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => removeQaPair(pair.id)}
                  disabled={qaPairs.length === 1}
                  aria-label="Remove pair"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`q-${pair.id}`}>Question</Label>
                <Input
                  id={`q-${pair.id}`}
                  placeholder="Who is the Watcher?"
                  value={pair.question}
                  onChange={(e) => updateQaPair(pair.id, "question", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`a-${pair.id}`}>Answer</Label>
                <Textarea
                  id={`a-${pair.id}`}
                  placeholder="The Watcher is…"
                  value={pair.answer}
                  onChange={(e) => updateQaPair(pair.id, "answer", e.target.value)}
                  className="min-h-24"
                />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addQaPair}>
            <Plus className="h-4 w-4" /> Add another pair
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">
          {totalItems === 0
            ? "Add training material to enable the Watcher."
            : `${totalItems} item${totalItems === 1 ? "" : "s"} ready to train.`}
        </p>
        <Button
          size="lg"
          onClick={startTraining}
          disabled={isTraining || totalItems === 0}
          className="min-w-48"
        >
          {isTraining ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Training…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Start Training
            </>
          )}
        </Button>
      </div>
    </div>
  );
}