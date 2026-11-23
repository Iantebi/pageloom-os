import { defineConfig } from "vitest/config";

// Only inside `firebase emulators:exec --project demo-...` (the tests refuse to run otherwise).
export default defineConfig({ test: { include: ["test-emulator/**/*.test.ts"] } });
