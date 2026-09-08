import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Plain Node environment, not jsdom: every test here renders through react-dom/server's
// renderToStaticMarkup (a synchronous, DOM-free render) rather than mounting into a browser DOM, so
// there's no jsdom/@testing-library dependency to add just to prove a component doesn't throw.
export default defineConfig({
  // fileURLToPath (not the raw .pathname string) - on Windows, a file:// URL's .pathname keeps a
  // leading slash before the drive letter (e.g. "/C:/Users/...") and leaves spaces %-encoded, which
  // breaks every "@/..." import resolution. fileURLToPath decodes and normalizes it correctly on
  // every platform, matching the same fix already applied in apps/web/scripts/sync-csp.mjs.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: { environment: "node" },
});
