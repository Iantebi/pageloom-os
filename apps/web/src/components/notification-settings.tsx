"use client";
import { Bell, CheckCircle2, CircleDashed } from "lucide-react";
import { Card, CardHeader } from "./product-ui";
import { t } from "@/lib/i18n";

// Push readiness status only — does NOT attempt to call getMessaging()/getToken(). There is no
// VAPID key configured yet (NEXT_PUBLIC_FIREBASE_VAPID_KEY is unset in every .env file), so any
// attempt would fail every time with nothing useful to show for it. The backend seam this would
// plug into already exists (functions/src/notifications.ts's notify()/pushTokensRouter) — turning
// this from "not configured" to working is adding the client SDK call once the external setup
// below is done, not redesigning anything.
export function NotificationSettings() {
  const s = t("notificationSettings");
  return (
    <Card>
      <CardHeader icon={Bell} title={s.title} subtitle={s.subtitle} />
      <div className="space-y-3">
        <StatusRow done title={s.inAppTitle} description={s.inAppDescription} />
        <StatusRow done={false} title={s.pushTitle} description={s.pushDescription} />
      </div>
      <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-xs font-semibold text-[var(--text)]">{s.setupTitle}</p>
        <ol className="mt-2 list-decimal space-y-1.5 ps-4 text-[11px] leading-5 text-[var(--muted)]">
          <li>{s.setupStep1}</li>
          <li>{s.setupStep2}</li>
          <li>{s.setupStep3}</li>
          <li>{s.setupStep4}</li>
        </ol>
      </div>
    </Card>
  );
}

function StatusRow({ done, title, description }: { done: boolean; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
      {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />}
      <div>
        <b className="block text-xs">{title}</b>
        <p className="mt-0.5 text-[11px] leading-5 text-[var(--muted)]">{description}</p>
      </div>
    </div>
  );
}
