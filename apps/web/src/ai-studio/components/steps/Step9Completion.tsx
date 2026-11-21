import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Rocket, CheckCircle2, MessageCircle, FileText, Download, Clock, ArrowRight, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';
import { DiscoveryData, StepKey } from '../../types';

interface Step9Props {
  data: DiscoveryData;
  onNavigateToStep: (step: StepKey) => void;
  onOpenAiSummary: () => void;
  onNavigateToWorkspace?: () => void;
}

export const Step9Completion: React.FC<Step9Props> = ({
  data,
  onNavigateToStep,
  onOpenAiSummary,
  onNavigateToWorkspace,
}) => {
  useEffect(() => {
    // Launch celebratory confetti fireworks
    const duration = 2.5 * 1000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const handleDownloadSummary = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PageLoom-Discovery-${data.projectId || 'Project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const whatsappMessage = encodeURIComponent(
    `שלום צוות PageLoom! סיימתי כעת את אפיון העסק לפרויקט #${data.projectId} (${data.businessName || 'עסק חדש'}). אשמח לקבל עדכון לגבי תחילת העבודה!`
  );

  return (
    <div className="space-y-8 text-center sm:text-right max-w-3xl mx-auto">
      
      {/* Main Celebration Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 md:p-12 shadow-xl shadow-slate-100/90 relative overflow-hidden text-center">
        
        {/* Glow effect */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -z-0" />

        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-200 mb-6 relative z-10 animate-bounce">
          <Rocket className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold mb-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>אפיון העסק הושלם בהצלחה מרובה!</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight mb-3">
          תודה רבה {data.ownerName ? `${data.ownerName}` : ''}! 🎉
        </h1>

        <p className="text-base sm:text-lg font-bold text-indigo-700 mb-2">
          אפיון ה-Business Discovery עבור {data.businessName || 'העסק שלכם'} נשמר והועבר לצוות.
        </p>

        <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-8">
          הצוות המקצועי של PageLoom החל כעת לעבוד על גיבוש הקונספט, כתיבת התוכן הממיר ובניית האתר המושלם עבורכם.
        </p>

        {/* Next Steps Box */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 sm:p-6 text-right max-w-xl mx-auto mb-8 space-y-4">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>מה קורה עכשיו?</span>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-600">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                1
              </span>
              <span>
                <strong>ניתוח מעמיק:</strong> מנהל הפרויקט והארכיטקט הדיגיטלי סוקרים את כל התשובות והחומרים שהעליתם.
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                2
              </span>
              <span>
                <strong>קופירייטינג ועיצוב:</strong> נבנה עבורכם סקיצה מותאמת אישית עם 2 צבעי המותג שבחרתם.
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                3
              </span>
              <span>
                <strong>סקיצה ראשונה:</strong> ניצור איתכם קשר בוואטסאפ להצגת הגרסה הראשונית לקבלת משוב ואישור.
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-xl mx-auto">
          
          {onNavigateToWorkspace && (
            <button
              type="button"
              onClick={onNavigateToWorkspace}
              className="w-full sm:w-auto flex-1 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 cursor-pointer ring-2 ring-indigo-500/20"
            >
              <Rocket className="w-4 h-4" />
              <span>עבור לאזור הפרויקט שלי</span>
            </button>
          )}

          <a
            href={`https://wa.me/972501234567?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-200 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>וואטסאפ לצוות</span>
          </a>

          <button
            type="button"
            onClick={onOpenAiSummary}
            className="w-full sm:w-auto px-4 py-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-sm rounded-xl border border-indigo-200 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>פרופיל AI</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSummary}
            className="w-full sm:w-auto px-4 py-3.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl border border-slate-200 transition flex items-center justify-center gap-2 cursor-pointer"
            title="הורד קובץ גיבוי JSON"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>גיבוי</span>
          </button>

        </div>

        {/* Reassurance note */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-slate-400" />
          <span>
            תוכלו תמיד לחזור לעמוד זה, לעדכן פרטים או להוסיף קבצים בכל עת.
          </span>
        </div>

        <div className="mt-4">
          <button
            onClick={() => onNavigateToStep(8)}
            className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
          >
            ← חזרה לסקירת כל הפרטים ועריכה
          </button>
        </div>

      </div>

    </div>
  );
};
