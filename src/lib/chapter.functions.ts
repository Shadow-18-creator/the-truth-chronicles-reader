import { createServerFn } from "@tanstack/react-start";

export const getAllChapterRatings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("get_chapter_rating_stats");
  if (error) throw new Error(error.message);
  const map = new Map<string, { sum: number; count: number }>();
  for (const r of (data ?? []) as Array<{ chapter_id: string; avg_rating: number; rating_count: number }>) {
    map.set(r.chapter_id, { sum: Number(r.avg_rating) * Number(r.rating_count), count: Number(r.rating_count) });
  }
  return Object.fromEntries(map.entries());
});

export const getChapterRatingStats = createServerFn({ method: "GET" })
  .inputValidator((input: { chapterId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("get_chapter_rating_stat", { _chapter_id: data.chapterId });
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0] as { avg_rating: number | null; rating_count: number | null } | undefined;
    return { count: Number(row?.rating_count ?? 0), avg: row?.avg_rating != null ? Number(row.avg_rating) : 0 };
  });
