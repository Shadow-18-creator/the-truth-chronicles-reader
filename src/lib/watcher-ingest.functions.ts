import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WatcherSource = {
  id: string;
  title: string;
  kind: string;
  source_url: string | null;
  status: string;
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  raw_text: string;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: author access only");
}

export const listWatcherSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data, error } = await (context as never as { supabase: any }).supabase
      .from("watcher_sources")
      .select("id,title,kind,source_url,status,error_message,chunk_count,created_at,raw_text")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as WatcherSource[];
  });

export const addWatcherSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; kind: "text" | "file" | "url" | "qa"; text?: string; url?: string }) => {
    if (!input?.title?.trim()) throw new Error("Title is required");
    if (input.kind === "url") {
      if (!input.url) throw new Error("URL is required");
      const u = new URL(input.url);
      if (!/^https?:$/.test(u.protocol)) throw new Error("Only http(s) URLs are allowed");
    } else if (!input.text?.trim()) {
      throw new Error("Text is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chunkText, embedTexts, stripHtml } = await import("./watcher-ingest.server");

    let raw = data.text?.trim() ?? "";
    if (data.kind === "url") {
      const res = await fetch(data.url!, { headers: { "User-Agent": "WatcherBot/1.0" } });
      if (!res.ok) throw new Error(`Could not fetch that page (${res.status})`);
      raw = stripHtml(await res.text());
      if (!raw) throw new Error("That page had no readable text");
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("watcher_sources")
      .insert({
        title: data.title.trim(),
        kind: data.kind,
        source_url: data.url ?? null,
        raw_text: raw.slice(0, 400000),
        status: "processing",
        created_by: (context as never as { userId: string }).userId,
      })
      .select("id")
      .single();
    if (insErr || !inserted) throw new Error(insErr?.message ?? "Could not save source");

    const sourceId = inserted.id as string;
    try {
      const chunks = chunkText(raw);
      if (chunks.length === 0) throw new Error("No text to index");
      const vectors = await embedTexts(chunks);
      const rows = chunks.map((content, i) => ({
        source_id: sourceId,
        chunk_index: i,
        content,
        embedding: JSON.stringify(vectors[i]) as unknown as string,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabaseAdmin.from("watcher_chunks").insert(rows.slice(i, i + 100) as never);
        if (error) throw new Error(error.message);
      }
      await supabaseAdmin
        .from("watcher_sources")
        .update({ status: "ready", chunk_count: chunks.length, error_message: null })
        .eq("id", sourceId);
      return { id: sourceId, chunks: chunks.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Indexing failed";
      await supabaseAdmin.from("watcher_sources").update({ status: "failed", error_message: message }).eq("id", sourceId);
      throw new Error(message);
    }
  });

export const reindexWatcherSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chunkText, embedTexts } = await import("./watcher-ingest.server");

    const { data: src, error } = await supabaseAdmin
      .from("watcher_sources")
      .select("id, raw_text")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !src) throw new Error("Source not found");

    await supabaseAdmin.from("watcher_chunks").delete().eq("source_id", data.id);
    await supabaseAdmin.from("watcher_sources").update({ status: "processing" }).eq("id", data.id);

    try {
      const chunks = chunkText(src.raw_text ?? "");
      if (chunks.length === 0) throw new Error("No text to index");
      const vectors = await embedTexts(chunks);
      const rows = chunks.map((content, i) => ({
        source_id: data.id,
        chunk_index: i,
        content,
        embedding: JSON.stringify(vectors[i]) as unknown as string,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const { error: e2 } = await supabaseAdmin.from("watcher_chunks").insert(rows.slice(i, i + 100) as never);
        if (e2) throw new Error(e2.message);
      }
      await supabaseAdmin
        .from("watcher_sources")
        .update({ status: "ready", chunk_count: chunks.length, error_message: null })
        .eq("id", data.id);
      return { chunks: chunks.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Indexing failed";
      await supabaseAdmin.from("watcher_sources").update({ status: "failed", error_message: message }).eq("id", data.id);
      throw new Error(message);
    }
  });

export const deleteWatcherSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("watcher_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
