import { describe, expect, it } from "vitest";
import { evaluateRateLimitWindow, type RateLimitConfig, type RateLimitWindowState } from "./rate-limit.js";

// These exercise the pure fixed-window decision function directly — no Firestore involved, so no
// mocking/faking of firebase-admin is needed (this codebase has no such mock; Firestore-touching
// code elsewhere is instead covered by pure-function tests like this one, or by source-text
// assertions — see rate-limit-wiring.test.ts for the latter, matching e.g. business-automation.test.ts).
describe("evaluateRateLimitWindow (fixed-window rate limiter core)", () => {
  const config: RateLimitConfig = { windowMs: 60_000, max: 3 };

  it("allows the first request ever and opens a new window", () => {
    const decision = evaluateRateLimitWindow(undefined, 1_000, config);
    expect(decision.allow).toBe(true);
    expect(decision.nextState).toEqual({ windowStart: 1_000, count: 1 });
  });

  it("allows exactly `max` requests within one window before refusing the next", () => {
    let state: RateLimitWindowState | undefined;
    let now = 0;
    for (let i = 0; i < config.max; i++) {
      const decision = evaluateRateLimitWindow(state, now, config);
      expect(decision.allow).toBe(true);
      state = decision.nextState;
      now += 10;
    }
    expect(state).toEqual({ windowStart: 0, count: config.max });

    const overLimit = evaluateRateLimitWindow(state, now, config);
    expect(overLimit.allow).toBe(false);
    // Refusing a request must not increment the stored count further.
    expect(overLimit.nextState).toEqual(state);
  });

  it("computes retryAfterSeconds counting down to the window's end", () => {
    const state: RateLimitWindowState = { windowStart: 0, count: config.max };
    const decision = evaluateRateLimitWindow(state, 45_000, config);
    expect(decision.allow).toBe(false);
    expect(decision.retryAfterSeconds).toBe(15); // 60_000 - 45_000 = 15_000ms -> 15s
  });

  it("never reports a zero or negative retryAfterSeconds even a millisecond before the window rolls over", () => {
    const state: RateLimitWindowState = { windowStart: 0, count: config.max };
    const decision = evaluateRateLimitWindow(state, 59_999, config);
    expect(decision.allow).toBe(false);
    expect(decision.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("rolls over into a fresh window once the previous window has fully elapsed, resetting the count", () => {
    const state: RateLimitWindowState = { windowStart: 0, count: config.max };
    const decision = evaluateRateLimitWindow(state, 60_000, config);
    expect(decision.allow).toBe(true);
    expect(decision.nextState).toEqual({ windowStart: 60_000, count: 1 });
  });

  it("keeps counting inside the same window right up to (but not including) windowMs elapsed", () => {
    const state: RateLimitWindowState = { windowStart: 0, count: 1 };
    const decision = evaluateRateLimitWindow(state, 59_999, config);
    expect(decision.allow).toBe(true);
    expect(decision.nextState).toEqual({ windowStart: 0, count: 2 });
  });

  it("is independent per limiter config: a higher max allows more requests in the same window", () => {
    const generous: RateLimitConfig = { windowMs: 60_000, max: 100 };
    const state: RateLimitWindowState = { windowStart: 0, count: config.max }; // would be refused under the stricter config
    const decision = evaluateRateLimitWindow(state, 1_000, generous);
    expect(decision.allow).toBe(true);
  });
});
