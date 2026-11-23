import { configDefaults, defineConfig } from "vitest/config";

// `npm test`: unit + mocked resilience tests only. The emulator suite needs a running Firestore
// emulator and runs separately (`npm run test:emulator`, see vitest.emulator.config.mjs).
export default defineConfig({ test: { exclude: [...configDefaults.exclude, "lib/**", "test-emulator/**"] } });
