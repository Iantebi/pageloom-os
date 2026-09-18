import React from 'react';
import { Sparkles, Clock, ArrowLeft, ShieldCheck, CheckCircle2, HeartHandshake, Compass, Zap } from 'lucide-react';
import { STEPS_CONFIG } from '../data/initialData';
import { PageLoomLogo } from './PageLoomLogo';

interface LandingViewProps {
  onStart: () => void;
  ownerName?: string;
  businessName?: string;
  hasPreviousData?: boolean;
  onReset?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onStart,
  ownerName,
  businessName,
  hasPreviousData,
  onReset,
}) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-10 px-4 sm:px-6">
      <div className="max-w-3xl w-full">
        
        {/* Main Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100/80 p-6 sm:p-10 md:p-12 text-center relative overflow-hidden">
          
          {/* Subtle decorative background glow */}
          <div className="absolute top-0 right-1/2 translate-x-1/2 w-96 h-36 bg-gradient-to-b from-indigo-50/70 to-transparent rounded-full -z-0 blur-2xl pointer-events-none" />

          {/* PageLoom Official Logo */}
          <div className="flex justify-center mb-6">
            <PageLoomLogo size={64} showWordmark={true} />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>PageLoom Business Discovery</span>
          </div>

          {/* Main Title & Welcome */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
            שלום {ownerName || ''} 👋
          </h1>

          <p className="text-lg sm:text-xl font-semibold text-slate-800 mb-3">
            ברוכים הבאים לפרויקט שלכם ב-PageLoom
          </p>

          <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto leading-relaxed mb-8">
            אנו עומדים להכיר את העסק שלכם לעומק, כדי שנוכל לבנות עבורכם נוכחות דיגיטלית מדויקת שממירה ומושכת יותר לקוחות איכותיים.
          </p>

          {/* Time & Convenience Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-xl mx-auto mb-10 text-right">
            
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">זמן משוער</div>
                <div className="text-sm font-bold text-slate-900">10-15 דקות בלבד</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">שמירה בענן</div>
                <div className="text-sm font-bold text-slate-900">אוטומטית בכל רגע</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">החוויה</div>
                <div className="text-sm font-bold text-slate-900">ללא ידע טכני</div>
              </div>
            </div>

          </div>

          {/* Primary CTA Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onStart}
              className="w-full sm:w-auto min-w-[240px] px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-2xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3 cursor-pointer group"
            >
              <span>{hasPreviousData ? 'המשך באפיון העסק' : 'התחלת אפיון העסק'}</span>
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
          </div>

          {/* 9 Milestones Preview Accordion / Bar */}
          <div className="mt-12 pt-8 border-t border-slate-100 text-right">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>9 שלבי האפיון המובנים:</span>
              <span className="text-[11px] font-normal text-slate-500">נשמרים ומותאמים לעסק שלכם</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {STEPS_CONFIG.map((step) => (
                <div
                  key={step.number}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs font-medium text-slate-700 shadow-2xs"
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0">
                    {step.number}
                  </span>
                  <span className="truncate font-semibold">{step.title}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom philosophy quote */}
        <div className="text-center mt-6 text-xs text-slate-500 font-medium">
          העסק שלכם הוא המרכז. הטכנולוגיה של PageLoom היא הכלי שמעצים אותו.
        </div>

      </div>
    </div>
  );
};
