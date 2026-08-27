import type { NextConfig } from "next";

// Production builds ship as a static export (see firebase.json: hosting.public = apps/web/out),
// with Firebase Hosting rewriting /api/** to the Cloud Function named "api". A static export has
// no server, so that rewrite can't run here — `next dev` must proxy /api/** to a local Functions
// emulator itself, or every fetch("/api/...") 404s against Next's own router with no explanation.
// `output: "export"` also disallows `rewrites()` outright, so both must be conditioned on env.
const isProduction = process.env.NODE_ENV === "production";
const functionsEmulatorOrigin = process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_ORIGIN ?? "http://127.0.0.1:5001/pageloom-os-production/europe-west1/api";

const config: NextConfig = {
  ...(isProduction ? { output: "export" } : {}),
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isProduction ? {} : { async rewrites() { return [{ source: "/api/:path*", destination: `${functionsEmulatorOrigin}/api/:path*` }]; } }),
};
export default config;
