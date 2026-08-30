"use client";
import { Check, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { Button, Card, CardHeader, PageHeader, Status } from "@/components/product-ui";
import { t } from "@/lib/i18n";
import { useTheme, type Accent, type Background } from "@/lib/theme";

// Small, fixed swatch colors purely for the picker UI (dots/previews below) - the real palette
// lives in globals.css as CSS variables ([data-accent]/[data-bg] selectors). Kept in sync by hand
// since there are only a handful of curated options; if a value changes here, change it there too.
const ACCENT_SWATCHES: Record<Accent, string> = { violet: "#7357ff", blue: "#2f6fed", green: "#1c8557", amber: "#93600a", rose: "#bd3535", teal: "#0d7a73" };
const BACKGROUND_SWATCHES: Record<Background, string> = { white: "#ffffff", "light-gray": "#f3f4f1", "warm-gray": "#f6f3ef", "pageloom-soft": "#faf3e6", dark: "#101210" };
const ACCENTS: Accent[] = ["violet", "blue", "green", "amber", "rose", "teal"];
const LIGHT_BACKGROUNDS: Background[] = ["white", "light-gray", "warm-gray", "pageloom-soft"];

export default function SettingsPage() {
  const s = t("appearanceSettings");
  const { mode, resolvedMode, background, accent, highContrast, setMode, setBackground, setAccent, setHighContrast, reset } = useTheme();

  function handleReset() {
    if (window.confirm(s.resetConfirm)) reset();
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={s.eyebrow} title={s.title} description={s.description} />
      <Card>
        <CardHeader title={s.sectionTitle} subtitle={s.sectionDescription} />

        <div className="space-y-7">
          <section>
            <p className="mb-3 text-xs font-semibold text-[var(--text)]">{s.modeLabel}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <ModeOption active={mode === "light"} onClick={() => setMode("light")} icon={<Sun className="h-4 w-4" />} label={s.modeLight} />
              <ModeOption active={mode === "dark"} onClick={() => setMode("dark")} icon={<Moon className="h-4 w-4" />} label={s.modeDark} />
              <ModeOption active={mode === "system"} onClick={() => setMode("system")} icon={<Monitor className="h-4 w-4" />} label={s.modeSystem} />
            </div>
          </section>

          <section>
            <p className="mb-3 text-xs font-semibold text-[var(--text)]">{s.backgroundLabel}</p>
            {resolvedMode === "dark" ? (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <span className="h-6 w-6 shrink-0 rounded-full border border-[var(--border)]" style={{ background: BACKGROUND_SWATCHES.dark }} />
                <p className="text-[11px] leading-5 text-[var(--muted)]">{s.backgroundLockedNote}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {LIGHT_BACKGROUNDS.map(option => (
                  <SwatchOption key={option} active={background === option} onClick={() => setBackground(option)} color={BACKGROUND_SWATCHES[option]} label={s.backgroundOptions[option]} />
                ))}
              </div>
            )}
          </section>

          <section>
            <p className="mb-1 text-xs font-semibold text-[var(--text)]">{s.accentLabel}</p>
            <p className="mb-3 text-[10px] leading-5 text-[var(--muted)]">{s.accentDescription}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ACCENTS.map(option => (
                <SwatchOption key={option} active={accent === option} onClick={() => setAccent(option)} color={ACCENT_SWATCHES[option]} label={s.accentOptions[option]} />
              ))}
            </div>
          </section>

          <section className="flex items-start justify-between gap-4 border-t border-[var(--border)] pt-6">
            <div>
              <p className="text-xs font-semibold text-[var(--text)]">{s.highContrastLabel}</p>
              <p className="mt-1 max-w-md text-[10px] leading-5 text-[var(--muted)]">{s.highContrastDescription}</p>
            </div>
            <button
              role="switch"
              aria-checked={highContrast}
              aria-label={s.highContrastLabel}
              onClick={() => setHighContrast(!highContrast)}
              className="flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors"
              style={{ background: highContrast ? "var(--accent)" : "var(--border)", justifyContent: highContrast ? "flex-end" : "flex-start" }}
            >
              <span className="h-5 w-5 rounded-full bg-white shadow" />
            </button>
          </section>

          <section className="border-t border-[var(--border)] pt-6">
            <Button variant="secondary" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              {s.resetLabel}
            </Button>
          </section>
        </div>
      </Card>

      <Card>
        <CardHeader title={s.previewTitle} />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <b className="text-xs">{s.previewCard}</b>
            <p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">{s.sectionDescription}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button>{s.previewButton}</Button>
              <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent-on-soft)" }}>{s.previewBadge}</span>
              <Status value="active" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ModeOption({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-colors"
      style={{ borderColor: active ? "var(--accent)" : "var(--border)", background: active ? "var(--accent-soft)" : "var(--surface)", color: active ? "var(--accent-on-soft)" : "var(--text)" }}
    >
      {icon}
      {label}
      {active && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}

function SwatchOption({ active, onClick, color, label }: { active: boolean; onClick: () => void; color: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border p-3 text-center text-[10px] font-medium transition-colors"
      style={{ borderColor: active ? "var(--accent)" : "var(--border)", background: active ? "var(--accent-soft)" : "var(--surface)", color: active ? "var(--accent-on-soft)" : "var(--text)" }}
    >
      <span className="relative grid h-7 w-7 place-items-center rounded-full border border-[var(--border)]" style={{ background: color }}>
        {active && <Check className="h-3.5 w-3.5" style={{ color: "#fff", filter: "drop-shadow(0 0 1px rgba(0,0,0,.6))" }} />}
      </span>
      {label}
    </button>
  );
}
