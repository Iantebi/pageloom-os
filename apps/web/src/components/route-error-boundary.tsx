"use client";
import { Component, type ReactNode } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { t } from "@/lib/i18n";

type Props = { children: ReactNode; variant?: "page" | "widget" };
type State = { failed: boolean };

// Shared by the class boundary below and by the app/**/error.tsx route boundaries Next.js calls
// directly with (error, reset) - one fallback look for every "something crashed here" case.
export function RouteErrorFallback({ variant = "page", reset }: { variant?: "page" | "widget"; reset: () => void }) {
  const s = t("errorBoundary");
  const isPage = variant !== "widget";
  return (
    <div className={isPage ? "grid min-h-96 place-items-center p-6 text-center" : "rounded-xl border border-[var(--border)] p-6 text-center"}>
      <div className="max-w-sm">
        <ShieldAlert className="mx-auto h-5 w-5 text-[var(--warn-text)]" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-[var(--text)]">{isPage ? s.pageTitle : s.widgetTitle}</p>
        <p className="mt-2 text-xs leading-6 text-[var(--muted)]">{isPage ? s.pageDescription : s.widgetDescription}</p>
        <button onClick={reset} className="button button-secondary mt-5">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />{s.retry}
        </button>
      </div>
    </div>
  );
}

// React error boundaries must be class components (no hook equivalent exists yet). This wraps
// RoleScopedExtras in product-shell.tsx - the dashboard/CRM/agents widgets that read raw Firestore
// documents outside of any single route's page.tsx - so one malformed record in one widget shows a
// contained fallback instead of taking down the whole authenticated shell (sidebar/nav included).
// Next's own app/**/error.tsx boundaries don't reach here: they wrap a segment's page.tsx, not the
// sibling content its layout.tsx renders alongside {children}.
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error(error); }
  reset = () => this.setState({ failed: false });
  render() {
    if (!this.state.failed) return this.props.children;
    return <RouteErrorFallback variant={this.props.variant} reset={this.reset} />;
  }
}
