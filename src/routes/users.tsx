import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "Seekers — Readers of The Boy Who Saw The Truth" },
      { name: "description", content: "Browse fellow seekers reading The Boy Who Saw The Truth. Find readers, see profiles, and join the conversation." },
      { property: "og:title", content: "Seekers — Readers of The Boy Who Saw The Truth" },
      { property: "og:description", content: "Browse fellow seekers reading The Boy Who Saw The Truth." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://the-truth-chronicles-reader.lovable.app/users" },
      { name: "twitter:title", content: "Seekers — Readers of The Boy Who Saw The Truth" },
      { name: "twitter:description", content: "Browse fellow seekers reading The Boy Who Saw The Truth." },
    ],
    links: [{ rel: "canonical", href: "https://the-truth-chronicles-reader.lovable.app/users" }],
  }),
  component: UsersPage,
});

function UsersPage() {
  const [q, setQ] = useState("");

  const { data: users, isFetching } = useQuery({
    queryKey: ["users-search", q],
    queryFn: async () => {
      const term = q.trim();
      let query = supabase.from("profiles").select("id, username, display_name, bio").limit(40);
      if (term) query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
      else query = query.order("created_at", { ascending: false });
      const { data } = await query;
      return data ?? [];
    },
  });

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <header className="text-center mb-10">
        <p className="text-primary text-xs font-sans tracking-[0.3em] uppercase mb-3">Find a Seeker</p>
        <h1 className="font-display text-5xl text-glow">The Roster</h1>
      </header>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username…"
          aria-label="Search seekers by username"
          className="pl-10 bg-input/40 border-border/40 font-body" />
      </div>

      <div className="space-y-2">
        {users?.map((u) => (
          <Link key={u.id} to="/u/$username" params={{ username: u.username }}
            className="flex items-center gap-4 rounded-lg border border-border/40 bg-card/40 p-4 hover:border-primary/40 transition-colors">
            <UserCircle2 className="h-10 w-10 text-primary/70 shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-lg">{u.display_name || u.username}</p>
              <p className="text-xs font-sans text-muted-foreground">@{u.username}</p>
            </div>
          </Link>
        ))}
        {!isFetching && users && users.length === 0 && (
          <p className="text-center text-muted-foreground italic py-8">No seekers match that name.</p>
        )}
      </div>
    </div>
  );
}