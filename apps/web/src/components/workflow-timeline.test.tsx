import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Project } from "@pageloom/core";
import { WorkflowTimeline } from "./workflow-timeline";

// Regression coverage for /projects/view: a project document missing both `workflowStage` and
// `journeyStage` (or holding a `journeyStage` value the legacy lookup table doesn't recognize) used
// to leave `current` undefined, and `s.stageLabel(undefined)` threw `Cannot read properties of
// undefined (reading 'replaceAll')` - crashing the whole project detail page around it.
const malformedProject = {
  id: "p1", name: "Test Project", clientName: "Test Client", progress: 0, budget: 0, revenue: 0, cost: 0, updatedAt: "2026-01-15T10:30:00.000Z",
} as unknown as Project;

describe("WorkflowTimeline", () => {
  it("does not throw when both workflowStage and journeyStage are missing", () => {
    expect(() => renderToStaticMarkup(<WorkflowTimeline project={malformedProject} />)).not.toThrow();
  });

  it("does not throw when journeyStage holds a value the legacy lookup doesn't recognize", () => {
    const project = { ...malformedProject, journeyStage: "some_future_stage" } as unknown as Project;
    expect(() => renderToStaticMarkup(<WorkflowTimeline project={project} />)).not.toThrow();
  });
});
