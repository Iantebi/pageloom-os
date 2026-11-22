import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as functions from "./index.js";

// PageLoom OS was retired on 2026-11-19. This package must not define any deployable function, so
// that no deploy path (or a future firebase.json mistake) can re-create the OS functions.
// The backup functions' own guards (memory, schedule, service accounts) live in backup-functions/.
const indexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const RETIRED = ["api", "executeAgentTask", "processWorkflowEvent", "initializeProjectWorkflow", "handleWorkflowTaskResult",
  "monitorWorkflowTimeouts", "recoverAgentQueue", "monitorBusinessRisks", "dailyCeoReport"];

describe("retired PageLoom OS functions codebase", () => {
  it("exports nothing at runtime", () => {
    expect(Object.keys(functions)).toEqual([]);
  });
  it("declares no trigger and no exported const", () => {
    expect(indexSource).not.toMatch(/export\s+const\s/);
    expect(indexSource).not.toMatch(/\bon(Request|Call|Schedule|Document\w*)\s*\(/);
  });
  it.each(RETIRED)("does not define the retired function %s", (name) => {
    expect(indexSource).not.toMatch(new RegExp(`export\s+const\s+${name}\b`));
  });
});
