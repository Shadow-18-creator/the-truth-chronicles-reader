import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  AlertCircle,
  KeyRound,
  RotateCcw,
  User,
  MessagesSquare,
  HelpCircle,
} from "lucide-react";
import {
  chatWithCharacter,
  getAvailableCharacters,
  type CompiledCharacter,
} from "@/lib/character.functions";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

interface Msg {
  role: "user" | "character";
  content: string;
  timestamp: string;
  isNotFound?: boolean;
}

export function CharacterChatWidget({ defaultCharacterId }: { defaultCharacterId?: string }) {
  const { user, isAdmin } = useAuth();
  const getCharsFn = useServerFn(getAvailableCharacters);
  const chatFn = useServerFn(chatWithCharacter);

  const DAILY_LIMIT = 5;
  const [dailyUsage, setDailyUsage] = useState<number>(0);

  useEffect(() => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const savedDate = localStorage.getItem("ttc_communion_date");
      if (savedDate !== today) {
        localStorage.setItem("ttc_communion_date", today);
        localStorage.setItem("ttc_communion_count", "0");
        setDailyUsage(0);
      } else {
        const count = parseInt(localStorage.getItem("ttc_communion_count") || "0", 10);
        setDailyUsage(count);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const remaining = isAdmin ? 999 : Math.max(0, DAILY_LIMIT - dailyUsage);
  const isQuotaExhausted = !isAdmin && remaining <= 0;

  const { data: availableCharacters, isLoading: isLoadingChars } = useQuery({
    queryKey: ["available-characters"],
    queryFn: () => getCharsFn(),
  });

  const [selectedCharId, setSelectedCharId] = useState<string>(
    defaultCharacterId || "darius"
  );
  const [customCharId, setCustomCharId] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showKeyOverride, setShowKeyOverride] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync default character once characters are loaded
  useEffect(() => {
    if (availableCharacters && availableCharacters.length > 0 && !selectedCharId) {
      setSelectedCharId(availableCharacters[0].character_id);
    }
  }, [availableCharacters, selectedCharId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeCharRecord: CompiledCharacter | undefined = availableCharacters?.find(
    (c) => c.character_id.toLowerCase() === selectedCharId.toLowerCase()
  );

  const activeCharName = activeCharRecord?.character_name || (isCustomMode && customCharId ? customCharId : selectedCharId);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputQuery.trim();
    const charId = isCustomMode ? customCharId.trim().toLowerCase() : selectedCharId.trim().toLowerCase();

    if (!query || isSending) return;
    if (isQuotaExhausted) {
      toast.error("Daily limit reached (5/5 requests). Your communion energy replenishes tomorrow!");
      return;
    }
    if (!charId) {
      toast.error("Please select or enter a character.");
      return;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: Msg = { role: "user", content: query, timestamp };
    const nextList = [...messages, userMsg];

    setMessages(nextList);
    setInputQuery("");
    setIsSending(true);

    try {
      const res = await chatFn({
        data: {
          character_id: charId,
          user_query: query,
          gemini_api_key: geminiApiKey.trim() || undefined,
        },
      });

      const replyTimestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (res.notFound) {
        setMessages([
          ...nextList,
          {
            role: "character",
            content: res.reply,
            timestamp: replyTimestamp,
            isNotFound: true,
          },
        ]);
        toast.warning(`Persona "${charId}" not awakened yet.`);
      } else {
        setMessages([
          ...nextList,
          {
            role: "character",
            content: res.reply,
            timestamp: replyTimestamp,
          },
        ]);
        if (!isAdmin) {
          const nextCount = dailyUsage + 1;
          setDailyUsage(nextCount);
          try {
            localStorage.setItem("ttc_communion_count", nextCount.toString());
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      toast.error(err instanceof Error ? err.message : "The character could not be reached.");
      setMessages([
        ...nextList,
        {
          role: "character",
          content: "The astral connection wavered — could not reach this soul through the veil. Please try speaking again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    toast.info("Conversation cleared.");
  };

  return (
    <div className="flex flex-col h-[700px] max-h-[82vh] rounded-2xl border border-primary/30 bg-card/70 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Top Header & Character Selector */}
      <div className="p-4 sm:p-5 border-b border-border/40 bg-card/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center text-primary shadow-glow">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg text-glow">{activeCharName}</h2>
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px] font-sans">
                ✦ In-Character
              </Badge>
              {isAdmin ? (
                <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px] font-sans">
                  Admin (Unlimited)
                </Badge>
              ) : (
                <Badge
                  variant={isQuotaExhausted ? "destructive" : "secondary"}
                  className="text-[10px] font-sans"
                  title="Daily reader communion allowance"
                >
                  {isQuotaExhausted ? "Daily Limit Reached (5/5)" : `${remaining}/${DAILY_LIMIT} Daily Communions Left`}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-body italic">
              {activeCharRecord?.event_context ? activeCharRecord.event_context.slice(0, 80) + "…" : "Powered by live n8n persona agent"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Character Switcher */}
          {!isCustomMode ? (
            <Select
              value={selectedCharId}
              onValueChange={(val) => {
                if (val === "__custom__") {
                  setIsCustomMode(true);
                } else {
                  setSelectedCharId(val);
                }
              }}
            >
              <SelectTrigger className="w-[200px] h-9 text-xs bg-input/40 border-border/40">
                <SelectValue placeholder="Choose a character…" />
              </SelectTrigger>
              <SelectContent>
                {availableCharacters?.map((c) => (
                  <SelectItem key={c.character_id} value={c.character_id} className="text-xs">
                    {c.character_name}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__" className="text-xs italic text-primary">
                  + Enter custom character ID
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="character_id slug…"
                value={customCharId}
                onChange={(e) => setCustomCharId(e.target.value)}
                className="w-36 h-9 text-xs bg-input/40 font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-xs"
                onClick={() => setIsCustomMode(false)}
              >
                Cancel
              </Button>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetChat}
            className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
            title="Reset conversation"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-body">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground max-w-md mx-auto">
            <Sparkles className="h-10 w-10 text-primary/40 mb-3" />
            <h3 className="font-display text-xl text-glow mb-1">
              Speak with {activeCharName}
            </h3>
            <p className="text-sm italic mb-4">
              "The veil thins when you speak their name. Ask about what they saw, what haunts them, or what they seek."
            </p>
            {activeCharRecord?.raw_personality && (
              <div className="text-xs border border-primary/20 rounded-lg p-3 bg-primary/5 text-left text-muted-foreground leading-relaxed">
                <p className="font-semibold text-primary mb-1 font-sans uppercase tracking-wider text-[10px]">Persona Traits</p>
                {activeCharRecord.raw_personality}
              </div>
            )}
          </div>
        )}

        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          return (
            <div
              key={idx}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[85%] ${isUser ? "ml-auto" : "mr-auto"}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-sans text-muted-foreground">
                {isUser ? (
                  <span>Seeker • {m.timestamp}</span>
                ) : (
                  <span>{activeCharName} • {m.timestamp}</span>
                )}
              </div>

              {m.isNotFound ? (
                <div className="rounded-2xl px-4 py-3 bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm shadow-sm space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-300">Persona Uncompiled (404)</p>
                      <p className="text-xs text-amber-200/90 leading-relaxed mt-1">{m.content}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="pt-2 border-t border-amber-500/20 flex justify-end">
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/20">
                        <Link to="/admin">Open Persona Compiler in Admin →</Link>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md ${
                    isUser
                      ? "bg-primary text-primary-foreground font-sans rounded-tr-none"
                      : "bg-muted/60 border border-border/50 text-foreground font-body rounded-tl-none whitespace-pre-wrap"
                  }`}
                >
                  {m.content}
                </div>
              )}
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs italic font-sans p-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>{activeCharName} is formulating their thought…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Optional Gemini BYOK Key Bar */}
      {showKeyOverride && (
        <div className="px-4 py-2 border-t border-border/40 bg-muted/40 flex items-center gap-2 text-xs">
          <KeyRound className="h-3.5 w-3.5 text-primary shrink-0" />
          <Input
            type="password"
            placeholder="Personal Gemini API key override (optional)..."
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            className="h-7 text-xs bg-input/40 border-border/40 font-mono"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowKeyOverride(false)}
            className="h-7 px-2 text-[11px]"
          >
            Hide
          </Button>
        </div>
      )}

      {/* Daily limit reached banner */}
      {isQuotaExhausted && (
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 text-amber-300 text-xs flex items-center justify-between font-sans">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            You have used all 5 character communions for today. The veil closes until dawn.
          </span>
          <span className="text-[11px] opacity-75">Resets daily</span>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 sm:p-4 border-t border-border/40 bg-card/90 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 text-muted-foreground hover:text-primary shrink-0"
          title="Toggle Gemini API Key Override"
          onClick={() => setShowKeyOverride(!showKeyOverride)}
        >
          <KeyRound className="h-4 w-4" />
        </Button>

        <Input
          placeholder={
            isQuotaExhausted
              ? "Daily communion limit reached (5/5). The character rests until tomorrow…"
              : `Speak with ${activeCharName}…`
          }
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          disabled={isSending || isQuotaExhausted}
          className="flex-1 bg-input/40 border-border/40 font-body text-sm h-10 px-4 focus-visible:ring-primary/40 disabled:opacity-60"
        />

        <Button
          type="submit"
          disabled={isSending || !inputQuery.trim() || isQuotaExhausted}
          className="bg-gold-gradient text-gold-foreground h-10 px-4 font-semibold shadow-md shrink-0 disabled:opacity-50"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
