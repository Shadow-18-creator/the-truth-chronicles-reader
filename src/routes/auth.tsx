import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Moon } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Enter — Nightveil" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) toast.error(error.message);
      else { toast.success("Welcome to Nightveil."); navigate({ to: "/" }); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else { toast.success("Welcome back."); navigate({ to: "/" }); }
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto px-4 py-20 max-w-md">
      <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur p-8 shadow-arcane">
        <div className="text-center mb-8">
          <Moon className="h-8 w-8 text-primary mx-auto mb-3 glow-gold" />
          <h1 className="font-display text-3xl text-glow">{mode === "signin" ? "Return to the veil" : "Cross the threshold"}</h1>
          <p className="text-muted-foreground text-sm mt-2 font-body italic">
            {mode === "signin" ? "Sign in to continue your reading." : "Create an account to bookmark and gather."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-input/40 border-border/60 mt-1" />
          </div>
          <div>
            <Label className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Password</Label>
            <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="bg-input/40 border-border/60 mt-1" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gold-gradient text-gold-foreground font-sans glow-gold">
            {loading ? "…" : mode === "signin" ? "Enter" : "Create account"}
          </Button>
        </form>

        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-6 w-full text-sm text-muted-foreground hover:text-primary font-sans">
          {mode === "signin" ? "New here? Create an account" : "Already a reader? Sign in"}
        </button>
      </div>
    </div>
  );
}