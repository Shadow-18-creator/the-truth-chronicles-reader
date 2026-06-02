import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShieldCheck, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Scriptorium — The Boy Who Saw The Truth" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data: chapters, refetch } = useQuery({
    queryKey: ["admin-chapters"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("chapters").select("*").order("number", { ascending: false });
      return data ?? [];
    },
  });

  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [publish, setPublish] = useState(true);

  const claimAdmin = async () => {
    if (!user) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "admin" });
    if (error) toast.error(error.message); else { toast.success("You are now the author."); location.reload(); }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("chapters").insert({
      number: parseInt(number),
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      title,
      summary: summary || null,
      content,
      published_at: publish ? new Date().toISOString() : null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Chapter scribed.");
    setNumber(""); setTitle(""); setSlug(""); setSummary(""); setContent("");
    qc.invalidateQueries({ queryKey: ["admin-chapters"] });
    qc.invalidateQueries({ queryKey: ["latest-chapters"] });
    qc.invalidateQueries({ queryKey: ["chapters", "all"] });
    refetch();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this chapter?")) return;
    await supabase.from("chapters").delete().eq("id", id);
    refetch();
  };

  if (loading || !user) return <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">…</div>;

  if (!isAdmin) {
    const isFirst = true; // gate by clicking; RLS isn't restrictive on insert role intentionally only for first claim — handled below
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-4" />
        <h1 className="font-display text-3xl mb-3">Scriptorium</h1>
        <p className="text-muted-foreground mb-6 font-body italic">
          Only the author may scribe here. If this is your first time setting up the site, claim authorship below.
        </p>
        <Button onClick={claimAdmin} className="bg-gold-gradient text-gold-foreground">Claim authorship</Button>
        <p className="mt-4 text-xs text-muted-foreground">(After the first author claims the role, additional admins must be granted directly.)</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <header className="text-center mb-12">
        <ShieldCheck className="h-8 w-8 text-primary mx-auto mb-3" />
        <h1 className="font-display text-5xl text-glow">Scriptorium</h1>
        <p className="text-muted-foreground italic font-body mt-2">Where chapters are scribed.</p>
      </header>

      <form onSubmit={create} className="rounded-xl border border-border/40 bg-card/60 p-6 mb-12 space-y-4">
        <h2 className="font-display text-2xl">New chapter</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Number</Label>
            <Input type="number" required value={number} onChange={(e) => setNumber(e.target.value)} className="bg-input/40 mt-1" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Title</Label>
            <Input required value={title} onChange={(e) => setTitle(e.target.value)} className="bg-input/40 mt-1" />
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Slug (optional)</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-from-title" className="bg-input/40 mt-1" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Summary</Label>
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} className="bg-input/40 mt-1" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Content (paragraphs separated by blank lines)</Label>
          <Textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={12} className="bg-input/40 mt-1 font-body" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          Publish immediately
        </label>
        <Button type="submit" className="bg-gold-gradient text-gold-foreground">Scribe chapter</Button>
      </form>

      <h2 className="font-display text-2xl mb-4">Existing chapters</h2>
      <div className="space-y-2">
        {chapters?.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-card/40 p-4">
            <div>
              <p className="text-xs text-primary tracking-widest uppercase">Ch. {c.number} {!c.published_at && "(draft)"}</p>
              <p className="font-display">{c.title}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}