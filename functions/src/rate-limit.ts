import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { db } from "./firebase.js";
import { operationalLog, safeErrorName } from "./observability.js";
import type { AuthenticatedRequest } from "./auth.js";

/**
 * Firestore-backed fixed-window rate limiter.
 *
 * Cloud Functions 2nd-gen (Cloud Run under the hood) runs many stateless instances concurrently
 * and can scale to zero, so an in-memory counter (e.g. a plain Map) would reset per-instance and
 * never see the true aggregate request rate. Firestore is already this codebase's only shared,
 * persistent store (no Redis/Memorystore is provisioned), so counters live in `rateLimits/{key}`
 * and are checked-and-incremented atomically inside `db.runTransaction`, matching the
 * read-then-write-under-transaction pattern already used elsewhere for correctness under
 * concurrency (see `claimCustomerInvitations` in customer-invitations.ts, and the notification
 * transaction in business-automation.ts).
 *
 * Deliberately a simple fixed-window counter, not a token bucket: a document holds
 * { windowStart, count }. A request inside the current window increments count; once the window
 * has elapsed, the next request starts a fresh window. This under- and over-counts slightly at
 * window edges compared to a sliding window, which is an acceptable trade for staying simple and
 * matching this codebase's existing style.
 */

export interface RateLimitWindowState {
  windowStart: number;
  count: number;
}

export interface RateLimitConfig {
  /** Length of one fixed window, in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed inside one window. */
  max: number;
}

export interface RateLimitDecision {
  allow: boolean;
  nextState: RateLimitWindowState;
  retryAfterSeconds: number;
}

/**
 * Pure fixed-window decision function: no Firestore, no clock reads — fully unit-testable.
 * Rolls a fresh window once the previous one has expired; otherwise increments (or, once the
 * limit is reached, refuses to increment further) inside the current window.
 */
export function evaluateRateLimitWindow(state: RateLimitWindowState | undefined, nowMs: number, config: RateLimitConfig): RateLimitDecision {
  const active = state && nowMs - state.windowStart < config.windowMs ? state : { windowStart: nowMs, count: 0 };
  const retryAfterSeconds = Math.max(1, Math.ceil((active.windowStart + config.windowMs - nowMs) / 1000));
  if (active.count >= config.max) return { allow: false, nextState: active, retryAfterSeconds };
  return { allow: true, nextState: { windowStart: active.windowStart, count: active.count + 1 }, retryAfterSeconds };
}

async function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitDecision> {
  const ref = db.collection("rateLimits").doc(key);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? (snapshot.data() as RateLimitWindowState) : undefined;
    const decision = evaluateRateLimitWindow(current, Date.now(), config);
    transaction.set(ref, { windowStart: decision.nextState.windowStart, count: decision.nextState.count, updatedAt: new Date().toISOString() });
    return decision;
  });
}

// Never log a raw identity (uid or IP) — a short, non-reversible fingerprint is enough to
// correlate repeated abuse events for the same caller without writing PII into logs.
function identityFingerprint(identity: string) {
  return createHash("sha256").update(identity).digest("hex").slice(0, 16);
}

/**
 * Express middleware factory for one rate-limited endpoint.
 *
 * @param name  Namespaces the Firestore counter document per call site so different endpoints
 *              never share a counter even if two happen to key by the same identity.
 * @param config  Window length and max requests per window.
 * @param keyOf  Extracts the abuse-relevant identity from the request — the authenticated uid for
 *               endpoints mounted after `authenticate`, or the client IP for the public route.
 *
 * Fails OPEN on limiter infrastructure errors (e.g. a transient Firestore hiccup): a broken rate
 * limiter must never be able to take the whole API down for legitimate traffic. The failure is
 * still logged so it's visible in observability.
 */
export function rateLimit(name: string, config: RateLimitConfig, keyOf: (req: Request) => string | undefined) {
  return async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const identity = keyOf(req);
    if (!identity) return next();
    try {
      const decision = await checkRateLimit(`${name}:${identity}`, config);
      if (!decision.allow) {
        res.setHeader("Retry-After", String(decision.retryAfterSeconds));
        operationalLog("warning", "rate_limit.exceeded", { limiter: name, identity: identityFingerprint(identity), retryAfterSeconds: decision.retryAfterSeconds });
        return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests. Please wait a moment and try again.", retryAfterSeconds: decision.retryAfterSeconds } });
      }
      return next();
    } catch (error) {
      operationalLog("error", "rate_limit.check_failed", { limiter: name, errorType: safeErrorName(error) });
      return next();
    }
  };
}

/** Key by the authenticated Firebase uid. Only valid for endpoints mounted after `authenticate`. */
export function uidKey(req: Request) {
  return (req as AuthenticatedRequest).user?.uid;
}

/**
 * Key by client IP. Use ONLY for public, unauthenticated routes (there is no uid to key by).
 *
 * Requires `app.set("trust proxy", 1)` in api.ts. Cloud Functions 2nd-gen (Cloud Run under the
 * hood) always sits behind exactly one trusted hop — Google's Front End (GFE) — which appends the
 * real client IP to `X-Forwarded-For` before the request ever reaches the container; a caller
 * outside Google's network cannot forge that final hop. Without `trust proxy` configured,
 * Express's default `req.ip` falls back to the raw socket peer address, which under Cloud Run is
 * an internal Google address shared by many unrelated callers — not the actual client.
 */
export function clientIpKey(req: Request) {
  return req.ip;
}
