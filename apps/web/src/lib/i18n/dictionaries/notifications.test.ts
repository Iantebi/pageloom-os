import { describe, expect, it } from "vitest";
import { notifications } from "./notifications";

// Regression coverage for issue #27 / #35: a notification document with a recognized `type` but a
// missing/undefined `params` field (e.g. written by an older producer, or a partial write) must
// degrade to a safe string instead of throwing `Cannot read properties of undefined` - which used to
// crash the notification list, and with it the whole /dashboard page it's embedded in.
describe("notifications.format", () => {
  it("does not throw when params is undefined for a known type", () => {
    expect(() => notifications.he.format("support_ticket_created", undefined)).not.toThrow();
    expect(() => notifications.en.format("support_ticket_created", undefined)).not.toThrow();
  });

  it("returns a string (not undefined) so callers don't fall through to item.title unnecessarily", () => {
    expect(typeof notifications.he.format("support_ticket_created", undefined)).toBe("string");
    expect(typeof notifications.en.format("domain_expiry", undefined)).toBe("string");
  });

  it("does not throw when params is undefined for every known notification type", () => {
    const types: string[] = [
      "domain_expiry", "ssl_expiry", "backup_failure", "customer_inactivity", "project_stalled",
      "negative_profitability", "support_ticket_created", "support_ticket_resolved",
      "website_content_submitted", "website_content_changes_requested", "website_content_rejected",
      "website_content_published", "workflow_stage_changed", "payment_confirmed",
      "website_brief_received", "materials_missing", "build_started", "preview_ready",
      "revision_received", "revision_resolved", "final_approval_recorded", "website_live",
      "post_launch_follow_up", "discovery_submitted", "discovery_information_requested",
    ];
    for (const type of types) {
      expect(() => notifications.he.format(type, undefined)).not.toThrow();
      expect(() => notifications.en.format(type, undefined)).not.toThrow();
    }
  });

  it("still returns undefined for an unrecognized type, preserving the item.title fallback", () => {
    expect(notifications.he.format("some_future_type", { anything: 1 })).toBeUndefined();
    expect(notifications.he.format(undefined, undefined)).toBeUndefined();
  });

  it("still formats real params correctly (no behavior change for well-formed data)", () => {
    expect(notifications.en.format("domain_expiry", { domain: "example.com", daysRemaining: 5 }))
      .toBe("Domain example.com expires in 5 days");
  });
});
