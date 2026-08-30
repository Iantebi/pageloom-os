import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("scheduled function memory allocation", () => {
  // The default 256MiB allocation was observed exceeding its limit in production logs for
  // monitorBusinessRisks, monitorWorkflowTimeouts, and dailyCeoReport (Cloud Run kills the
  // instance and Cloud Scheduler retries, producing noisy failures with no functional bug).
  // 512MiB mirrors the already-verified fix for monitorBusinessRisks.
  it("gives monitorBusinessRisks 512MiB", () => {
    expect(indexSource).toMatch(/monitorBusinessRisks=onSchedule\(\{[^}]*memory:"512MiB"/);
  });
  it("gives monitorWorkflowTimeouts 512MiB", () => {
    expect(indexSource).toMatch(/monitorWorkflowTimeouts=onSchedule\(\{[^}]*memory:"512MiB"/);
  });
  it("gives dailyCeoReport 512MiB", () => {
    expect(indexSource).toMatch(/dailyCeoReport=onSchedule\(\{[^}]*memory:"512MiB"/);
  });
});
