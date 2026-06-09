import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = "https://the-truth-chronicles-reader.lovable.app";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: { path: string; lastmod?: string; changefreq?: string; priority?: string }[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/chapters", changefreq: "weekly", priority: "0.9" },
          { path: "/chat", changefreq: "daily", priority: "0.6" },
          { path: "/users", changefreq: "weekly", priority: "0.5" },
        ];

        const { data: chapters } = await supabase
          .from("chapters")
          .select("slug, published_at")
          .not("published_at", "is", null);
        for (const c of chapters ?? []) {
          entries.push({
            path: `/chapters/${c.slug}`,
            lastmod: c.published_at ?? undefined,
            changefreq: "monthly",
            priority: "0.8",
          });
        }

        const { data: profiles } = await supabase.from("profiles").select("username");
        for (const p of profiles ?? []) {
          if (p.username) entries.push({ path: `/u/${p.username}`, changefreq: "monthly", priority: "0.3" });
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});