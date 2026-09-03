import { defineConfig } from "vitest/config";

// Plain Node environment, not jsdom: every test here renders through react-dom/server's
// renderToStaticMarkup (a synchronous, DOM-free render) rather than mounting into a browser DOM, so
// there's no jsdom/@testing-library dependency to add just to prove a component doesn't throw.
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  esbuild: { jsx: "automatic" },
  test: { environment: "node" },
});
