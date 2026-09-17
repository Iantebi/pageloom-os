import React from 'react';
import { ArrowLeft, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { StepKey } from '../types';

interface NavigationControlsProps {
  currentStep: StepKey;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  canProceed?: boolean;
}

export const NavigationControls: React.FC<NavigationControlsProps> = ({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  canProceed = true,
}) => {
  if (currentStep === 9) {
    return null; // Step 9 has its own completion actions
  }

  return (
    <div className="bg-white/95 backdrop-blur-md border-t border-slate-100 sticky bottom-0 z-30 py-4 px-4 sm:px-6 shadow-xl shadow-slate-200/40">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        
        {/* Previous Button */}
        {currentStep > 1 ? (
          <button
            type="button"
            onClick={onPrev}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl border border-slate-200/90 shadow-2xs transition cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>הקודם</span>
          </button>
        ) : (
          <div className="text-xs text-slate-400 font-medium hidden sm:block">
            התחלת תהליך האפיון
          </div>
        )}

        {/* Center: Autosave reminder */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50/70 px-3 py-1 rounded-full border border-slate-100">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>השינויים נשמרים בענן אוטומטית</span>
        </div>

        {/* Next / Proceed Button */}
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className={`inline-flex items-center gap-2 px-7 py-3 font-extrabold text-sm sm:text-base rounded-xl shadow-md transition-all cursor-pointer ${
            canProceed
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:-translate-y-0.5'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
          }`}
        >
          <span>
            {currentStep === 8 ? 'מעבר לסיום ואישור' : 'שמור והמשך לשלב הבא'}
          </span>
          <ArrowLeft className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
};
