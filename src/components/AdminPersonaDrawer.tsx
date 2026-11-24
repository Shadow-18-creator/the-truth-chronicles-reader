import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  Bot,
  Loader2,
  CheckCircle2,
  KeyRound,
  Copy,
  BookOpen,
  ArrowRight,
  Scroll,
} from "lucide-react";
import { saveCharacterPersona, type SavePersonaResult } from "@/lib/character.functions";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";

interface AdminPersonaDrawerProps {
  trigger?: React.ReactNode;
  onPersonaCompiled?: (result: SavePersonaResult) => void;
}

const PRESET_TEMPLATES = [
  {
    label: "Darius (Protagonist)",
    id: "darius",
    name: "Darius — The Silent Seeker",
    personality: "Introspective, observant, speaks softly with heavy melancholy. Sees beyond physical veils. Unflinchingly loyal to truth, cautious with words.",
    context: "Stands inside the ruined archive of mirrors after discovering that his childhood journal contains glyphs he does not remember carving.",
  },
  {
    label: "Lucian (Sanctuary Guardian)",
    id: "lucian",
    name: "Lucian — Guardian of the First Veil",
    personality: "Ancient, austere, demanding. Speaks in resonant archaic prose. Values solemn vows, measures seekers by their resolve rather than their eloquence.",
    context: "Guarding the sealed corridor leading to the Scriptorium where unwritten prophecy scrolls rest.",
  },
  {
    label: "Elena (Rune Seer)",
    id: "elena",
    name: "Elena — The Weaver of Glyphs",
    personality: "Curious, agile-minded, warm yet enigmatic. Speaks with quick excitement when discussing arcane ciphers or astrological alignments.",
    context: "Deciphering margin annotations left by the previous archivist in the First Century chronicle.",
  },
];

export function AdminPersonaDrawer({ trigger, onPersonaCompiled }: AdminPersonaDrawerProps) {
  const [open, setOpen] = useState(false);
  const [characterId, setCharacterId] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [rawPersonality, setRawPersonality] = useState("");
  const [eventContext, setEventContext] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [result, setResult] = useState<SavePersonaResult | null>(null);

  const savePersonaFn = useServerFn(saveCharacterPersona);

  const applyTemplate = (tpl: typeof PRESET_TEMPLATES[0]) => {
    setCharacterId(tpl.id);
    setCharacterName(tpl.name);
    setRawPersonality(tpl.personality);
    setEventContext(tpl.context);
    toast.info(`Pre-filled template: ${tpl.label}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!characterId.trim()) {
      toast.error("Character ID slug is required.");
      return;
    }
    if (!characterName.trim()) {
      toast.error("Character Name is required.");
      return;
    }
    if (!rawPersonality.trim()) {
      toast.error("Raw personality description is required.");
      return;
    }
    if (!eventContext.trim()) {
      toast.error("Event context is required.");
      return;
    }

    setIsCompiling(true);
    setResult(null);

    try {
      const res = await savePersonaFn({
        data: {
          character_id: characterId.trim(),
          character_name: characterName.trim(),
          raw_personality: rawPersonality.trim(),
          event_context: eventContext.trim(),
          gemini_api_key: geminiApiKey.trim() || undefined,
        },
      });

      setResult(res);
      toast.success(`✦ Persona for "${res.character_name}" compiled & deployed!`, {
        description: `Status: ${res.deployment_status}`,
      });
      if (onPersonaCompiled) onPersonaCompiled(res);
    } catch (err) {
      console.error("Compilation error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to compile persona.");
    } finally {
      setIsCompiling(false);
    }
  };

  const copyPrompt = () => {
    if (result?.compiled_system_prompt) {
      navigator.clipboard.writeText(result.compiled_system_prompt);
      toast.success("Compiled system prompt copied to clipboard.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" className="border-primary/40 hover:bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4 mr-2" />
            Character Persona Compiler (n8n)
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl bg-card/95 border-l border-border/50 backdrop-blur-xl overflow-y-auto p-6"
      >
        <SheetHeader className="text-left border-b border-border/40 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <SheetTitle className="font-display text-2xl text-glow">
              Character Persona Compiler
            </SheetTitle>
          </div>
          <SheetDescription className="font-body text-muted-foreground text-sm">
            Live n8n Agent pipeline. Compiles raw personality and story context into an
            in-character AI persona deployed for reader chat.
          </SheetDescription>
        </SheetHeader>

        {/* Preset Templates */}
        <div className="mb-6">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block font-sans">
            Quick Character Presets
          </Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_TEMPLATES.map((tpl) => (
              <Button
                key={tpl.id}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs font-sans border-border/60 hover:border-primary/50"
                onClick={() => applyTemplate(tpl)}
              >
                <BookOpen className="h-3 w-3 mr-1" />
                {tpl.label}
              </Button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="char-id" className="text-xs font-sans uppercase tracking-widest">
                Character ID (Slug) *
              </Label>
              <Input
                id="char-id"
                placeholder="e.g. darius, lucian"
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value)}
                className="bg-input/40 border-border/40 font-mono text-sm"
                required
              />
              <p className="text-[11px] text-muted-foreground font-sans">
                Unique identifier used by n8n to index this persona.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="char-name" className="text-xs font-sans uppercase tracking-widest">
                Character Display Name *
              </Label>
              <Input
                id="char-name"
                placeholder="e.g. Darius — The Silent Seeker"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                className="bg-input/40 border-border/40 text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="raw-personality" className="text-xs font-sans uppercase tracking-widest">
              Raw Personality & Mannerisms *
            </Label>
            <Textarea
              id="raw-personality"
              rows={4}
              placeholder="Describe their traits, vocal habits, temperament, secrets, philosophical outlook, and moral compass..."
              value={rawPersonality}
              onChange={(e) => setRawPersonality(e.target.value)}
              className="bg-input/40 border-border/40 font-body text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-context" className="text-xs font-sans uppercase tracking-widest">
              Active Event Context *
            </Label>
            <Textarea
              id="event-context"
              rows={3}
              placeholder="Where is the character currently? What recent plot developments, dangers, or discoveries are top of mind?"
              value={eventContext}
              onChange={(e) => setEventContext(e.target.value)}
              className="bg-input/40 border-border/40 font-body text-sm"
              required
            />
          </div>

          <div className="space-y-1.5 p-3 rounded-md border border-border/40 bg-muted/20">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans mb-1">
              <KeyRound className="h-3.5 w-3.5 text-primary" />
              <span>Optional Gemini API Key (BYOK Override)</span>
            </div>
            <Input
              type="password"
              placeholder="Leave blank to use server GEMINI_API_KEY from .env"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="bg-input/30 border-border/30 text-xs font-mono"
            />
          </div>

          <Button
            type="submit"
            disabled={isCompiling}
            className="w-full bg-gold-gradient text-gold-foreground font-semibold shadow-md py-5"
          >
            {isCompiling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Compiling Persona in n8n Agent Pipeline…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Compile & Deploy Character Persona
              </>
            )}
          </Button>
        </form>

        {/* Compilation Output Display */}
        {result && (
          <div className="mt-8 border border-primary/40 rounded-xl bg-card/70 p-5 shadow-arcane space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <h3 className="font-display text-lg text-glow">
                  {result.character_name}
                </h3>
              </div>
              <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-sans text-xs">
                ✦ {result.deployment_status || "Deployed"}
              </Badge>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-sans uppercase tracking-widest text-primary">
                  <Scroll className="h-3.5 w-3.5" />
                  <span>Compiled System Prompt</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={copyPrompt}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="p-3.5 rounded-lg bg-background/80 border border-border/40 text-xs font-mono text-muted-foreground max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {result.compiled_system_prompt}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <Button asChild size="sm" className="bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30">
                <Link to="/characters/chat">
                  Test Character Chat
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
