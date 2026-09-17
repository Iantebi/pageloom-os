import React from 'react';
import { ShieldCheck, Cloud, Check, RefreshCw, LayoutDashboard, Sparkles, MessageCircle, WifiOff, AlertCircle } from 'lucide-react';
import { SaveStatus } from '../services/storageService';
import { PageLoomLogo } from './PageLoomLogo';

interface HeaderProps {
  businessName: string;
  ownerName: string;
  projectId: string;
  saveStatus: SaveStatus;
  isAdminView?: boolean;
  onToggleAdmin?: () => void;
  onOpenAiSummary: () => void;
  onOpenHelp: () => void;
  onNavigateToWorkspace?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  businessName,
  ownerName,
  projectId,
  saveStatus,
  isAdminView,
  onToggleAdmin,
  onOpenAiSummary,
  onOpenHelp,
  onNavigateToWorkspace,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-2xs transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Brand & Project Info */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2.5">
            <PageLoomLogo size={36} />
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 tracking-tight text-base flex items-center gap-1.5">
                PageLoom
                <span className="text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Discovery
                </span>
              </span>
              <span className="text-xs text-slate-500 font-medium truncate max-w-[130px] sm:max-w-none">
                {businessName || 'אפיון עסק חדש'}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 mr-2 border-r border-slate-200 pr-3">
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200/80">
              #{projectId}
            </span>
          </div>
        </div>

        {/* Center: Autosave Cloud Status */}
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-700 bg-white px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-2xs">
          {saveStatus === 'saving' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
              <span>שומר שינויים בענן...</span>
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" />
              <span className="text-emerald-700 font-semibold">כל השינויים נשמרו</span>
            </>
          ) : saveStatus === 'offline' ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-700 font-semibold">מצב לא מקוון (שמור מקומית)</span>
            </>
          ) : saveStatus === 'error' ? (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-rose-600 font-semibold">שגיאת סנכרון</span>
            </>
          ) : (
            <>
              <Cloud className="w-3.5 h-3.5 text-slate-400" />
              <span>שמירה אוטומטית פעילה</span>
            </>
          )}
        </div>

        {/* Left/Actions in RTL */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Workspace Button */}
          {onNavigateToWorkspace && (
            <button
              onClick={onNavigateToWorkspace}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 rounded-xl border border-indigo-200/80 transition shadow-2xs cursor-pointer"
              title="כניסה לאזור הפרויקט שלי"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600" />
              <span>הפרויקט שלי</span>
            </button>
          )}

          <button
            onClick={onOpenAiSummary}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-indigo-700 bg-white hover:bg-indigo-50/80 rounded-xl border border-slate-200/90 shadow-2xs transition"
            title="צפה בסיכום ה-AI והקופירייטינג שנוצר מהנתונים"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline font-semibold">פרופיל AI חכם</span>
          </button>

          {/* WhatsApp / Quick Help */}
          <button
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/90 shadow-2xs transition"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline font-semibold">סיוע PageLoom</span>
          </button>

          {/* Opens THIS route's own ?view=admin toggle (AI Studio's AdminMaster, a
              Discovery-specific console) — never the real Backend Master Control Center
              (/master), which is a deliberately separate application with its own shell
              (see docs/ARCHITECTURE.md's 2026-09-18 amendment). Labeled accordingly so staff
              never confuse the two. */}
          {onToggleAdmin && (
            <button
              onClick={onToggleAdmin}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition ${
                isAdminView
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/90 shadow-2xs'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>{isAdminView ? 'חזרה לפורטל לקוח' : 'מסוף ניהול אפיונים'}</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
