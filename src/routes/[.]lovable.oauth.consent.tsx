import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{
    data: {
      client?: { name?: string; client_name?: string } | null;
      redirect_url?: string;
      redirect_to?: string;
      scopes?: string[];
    } | null;
    error: { message: string } | null;
  }>;
  approveAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
  denyAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
};

function oauthApi(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

function safeRelative(p: string | null): string | null {
  if (!p) return null;
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  return p;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      window.location.href = immediate;
      return data;
    }
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="container mx-auto max-w-md py-20 text-center font-body">
      <p className="text-destructive">Could not load this authorization request:</p>
      <p className="mt-2 text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) { setBusy(false); setError(err.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  const relative = safeRelative(null);
  void relative;

  return (
    <main className="container mx-auto max-w-md py-16">
      <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur p-8 shadow-arcane text-center">
        <Eye className="h-10 w-10 text-primary mx-auto mb-4 glow-gold" />
        <h1 className="font-display text-3xl text-glow">
          Connect {clientName}
        </h1>
        <p className="mt-3 text-muted-foreground font-body">
          {clientName} is asking to use <span className="text-foreground">The Boy Who Saw The Truth</span> as you.
        </p>
        <p className="mt-2 text-sm text-muted-foreground font-body">
          It will be able to call this app's tools while you're signed in. This does not bypass this app's permissions.
        </p>
        {error && <p role="alert" className="mt-4 text-destructive text-sm">{error}</p>}
        <div className="mt-8 flex flex-col gap-3">
          <Button disabled={busy} onClick={() => decide(true)} className="w-full bg-gold-gradient text-gold-foreground glow-gold">
            Approve
          </Button>
          <Button disabled={busy} onClick={() => decide(false)} variant="ghost" className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </main>
  );
}