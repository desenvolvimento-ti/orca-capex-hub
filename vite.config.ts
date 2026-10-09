// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Redirect TanStack Start's server entry to src/server.ts (our SSR error wrapper).
// Lovable builds use its Cloudflare target; other deployments use the pinned Node target.
export default defineConfig({
  // MainDeploy runs this app as a Node container; Lovable keeps its
  // platform-selected Cloudflare preset.
  nitro: { preset: "node-server" },
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    build: {
      rollupOptions: {
        // The MCP SDK dynamically imports this Cloudflare-only module for
        // optional metrics and falls back to process.env on Node.
        external: ["cloudflare:workers"],
      },
    },
    // The MCP route generator compares Windows and POSIX path separators
    // incorrectly. Its generated routes are committed and remain available locally.
    plugins: process.platform === "win32" ? [] : [mcpPlugin()],
  },
});
