import { createFileRoute } from "@tanstack/react-router";
import { getCompiledCharacters } from "@/lib/character-store.server";

export const Route = createFileRoute("/api/character/list")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const list = getCompiledCharacters();
          return new Response(JSON.stringify(list), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
