import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessagesSquare, Crown, BookOpen } from "lucide-react";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "The Halls — Nightveil" }] }),
  component: ChatLayout,
});

function ChatLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isRoom = pathname !== "/chat" && pathname.startsWith("/chat/");

  const { data: rooms } = useQuery({
    queryKey: ["chat-rooms"],
    queryFn: async () => {
      const { data } = await supabase.from("chat_rooms").select("*").order("kind").order("name");
      return data ?? [];
    },
  });

  const iconFor = (kind: string) => kind === "author" ? Crown : kind === "chapter" ? BookOpen : MessagesSquare;

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <header className="text-center mb-10">
        <p className="text-primary text-xs font-sans tracking-[0.3em] uppercase mb-3">Gathering Place</p>
        <h1 className="font-display text-5xl text-glow">The Halls</h1>
      </header>
      <div className="grid md:grid-cols-[260px_1fr] gap-6">
        <aside className="rounded-lg border border-border/40 bg-card/40 p-3 h-fit">
          <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground px-3 py-2">Rooms</p>
          <nav className="space-y-1">
            {rooms?.map((r) => {
              const Icon = iconFor(r.kind);
              const active = pathname === `/chat/${r.slug}`;
              return (
                <Link key={r.id} to="/chat/$slug" params={{ slug: r.slug }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-sans transition-colors ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{r.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <section className="rounded-lg border border-border/40 bg-card/40 min-h-[60vh]">
          {isRoom ? <Outlet /> : (
            <div className="h-full flex items-center justify-center p-12 text-center">
              <p className="font-body italic text-muted-foreground">Choose a hall to enter.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}