// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  const projectId = env.SUPABASE_PROJECT_ID || env.VITE_SUPABASE_PROJECT_ID || "";
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";

  return {
    tanstackStart: {
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      // nitro/vite builds from this
      server: { entry: "server" },
    },
    vite: {
      define: {
        "globalThis.process.env.SUPABASE_ANON_KEY": JSON.stringify(publicKey),
        "globalThis.process.env.SUPABASE_PROJECT_ID": JSON.stringify(projectId),
        "globalThis.process.env.SUPABASE_URL": JSON.stringify(supabaseUrl),
        "process.env.SUPABASE_ANON_KEY": JSON.stringify(publicKey),
        "process.env.SUPABASE_PROJECT_ID": JSON.stringify(projectId),
        "process.env.SUPABASE_URL": JSON.stringify(supabaseUrl),
      },
      plugins: [mcpPlugin()],
    },
  };
});
