import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/chapters")({
  head: () => ({
    meta: [
      { title: "Chapters — The Boy Who Saw The Truth" },
      { name: "description", content: "All published chapters of The Boy Who Saw The Truth." },
      { property: "og:title", content: "Chapters — The Boy Who Saw The Truth" },
      { property: "og:description", content: "Browse every published chapter of the serial novel The Boy Who Saw The Truth." },
      { property: "og:url", content: "https://the-truth-chronicles-reader.lovable.app/chapters" },
    ],
    links: [{ rel: "canonical", href: "https://the-truth-chronicles-reader.lovable.app/chapters" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Book",
          name: "The Boy Who Saw The Truth",
          url: "https://the-truth-chronicles-reader.lovable.app/chapters",
          bookFormat: "https://schema.org/EBook",
          inLanguage: "en",
        }),
      },
    ],
  }),
});

function ChaptersLayout() {
  return <Outlet />;
}