import { execSync } from "node:child_process";
import type { NextConfig } from "next";

// Production builds ship as a static export (see firebase.json: hosting.public = apps/web/out),
// with Firebase Hosting rewriting /api/** to the Cloud Function named "api". A static export has
// no server, so that rewrite can't run here — `next dev` must proxy /api/** to a local Functions
// emulator itself, or every fetch("/api/...") 404s against Next's own router with no explanation.
// `output: "export"` also disallows `rewrites()` outright, so both must be conditioned on env.
const isProduction = process.env.NODE_ENV === "production";
const functionsEmulatorOrigin = process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_ORIGIN ?? "http://127.0.0.1:5001/pageloom-os-production/europe-west1/api";

// Next embeds a random build ID (Next's own `generateBuildId` default) into every page's inline
// RSC flight-payload <script> tag. scripts/sync-csp.mjs hashes that literal script content into
// firebase.json's CSP allowlist, so a random per-build ID means re-running `next build` — even with
// zero source changes — changes that hash for every route and invalidates the previously-synced
// CSP, which is exactly what caused the CSP-blocked-script / hydration-failure incident. Pinning
// the build ID to the current git commit (Next's own documented fix for this class of problem,
// see generateBuildId.md) makes the static export byte-for-byte reproducible across rebuilds of
// the same commit.
function resolveBuildId(): string {
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return "local";
  }
}

const config: NextConfig = {
  ...(isProduction ? { output: "export", generateBuildId: () => resolveBuildId() } : {}),
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isProduction ? {} : { async rewrites() { return [{ source: "/api/:path*", destination: `${functionsEmulatorOrigin}/api/:path*` }]; } }),
};
export default config;
