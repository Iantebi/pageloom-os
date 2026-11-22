import React from 'react';
import { AlertCircle } from 'lucide-react';

/** Red asterisk next to a label for an actually-required field (per packages/core's
 *  discoveryTemplate — never render this next to a field that isn't really required there). */
export const RequiredMark: React.FC = () => <span className="text-rose-500" aria-hidden="true"> *</span>;

/** Appends error-state classes to an input's base className when `show` is true — a single
 *  place so every step highlights missing fields the same way (red border/ring/background). */
export function fieldClass(base: string, show: boolean): string {
  return show ? `${base} border-rose-400 bg-rose-50/60 focus:ring-rose-400/40 focus:border-rose-500` : base;
}

/** Inline message shown directly under a missing required field, only once the user has tried
 *  to move on (`show`) — never on first render of a still-blank form. */
export const FieldError: React.FC<{ show: boolean; message?: string }> = ({ show, message = 'שדה זה הוא חובה' }) => {
  if (!show) return null;
  return (
    <p className="flex items-center gap-1 text-[11px] font-semibold text-rose-600" role="alert">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
};
