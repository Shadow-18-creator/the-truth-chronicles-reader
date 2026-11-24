import { createFileRoute, Link } from "@tanstack/react-router";
import { CharacterChatWidget } from "@/components/CharacterChatWidget";
import { useAuth } from "@/lib/auth-context";
import { AdminPersonaDrawer } from "@/components/AdminPersonaDrawer";
import { Sparkles, ArrowLeft, Bot, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/characters/chat")({
  head: () => ({
    meta: [
      { title: "Character Echoes — The Boy Who Saw The Truth" },
      { name: "description", content: "Speak directly with the living characters of the novel, powered by live n8n AI persona agents." },
      { property: "og:title", content: "Character Echoes — The Boy Who Saw The Truth" },
      { property: "og:description", content: "Speak directly with the living characters of the novel." },
    ],
  }),
  component: CharacterChatPage,
});

function CharacterChatPage() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <Link
            to="/chapters"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-3 font-sans"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Archive
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-sans text-xs uppercase tracking-[0.3em] text-primary">Sanctuary Echoes</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-glow">
            Character Persona Chat
          </h1>
          <p className="font-body italic text-muted-foreground mt-2 max-w-xl">
            Direct communion with novel souls compiled through live n8n agent orchestration.
          </p>
        </div>

        {isAdmin && (
          <div className="self-start sm:self-center">
            <AdminPersonaDrawer />
          </div>
        )}
      </div>

      <CharacterChatWidget />
    </div>
  );
}
