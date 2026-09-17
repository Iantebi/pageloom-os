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
    // pb-[max(1rem,env(safe-area-inset-bottom))] keeps the bar (and its buttons) clear of the
    // home-indicator gesture area on notched iPhones — without it, the bottom padding here is
    // literally behind that OS chrome, and the whole bar sits closer to the edge than it looks.
    <div className="bg-white/95 backdrop-blur-md border-t border-slate-100 sticky bottom-0 z-30 pt-4 px-4 sm:px-6 shadow-xl shadow-slate-200/40" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
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

        {/* Next / Proceed Button — deliberately NOT given a native `disabled` attribute even
            when canProceed is false: a truly disabled button can't be clicked at all, which on
            mobile especially gives no feedback about why. It stays clickable and looks
            "disabled" only visually; onNext itself (see App.tsx's handleNext/attemptFinish)
            decides whether to advance or reveal the missing-field highlighting instead. */}
        <button
          type="button"
          onClick={onNext}
          aria-disabled={!canProceed}
          className={`inline-flex items-center gap-2 px-7 py-3 font-extrabold text-sm sm:text-base rounded-xl shadow-md transition-all cursor-pointer ${
            canProceed
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:-translate-y-0.5'
              : 'bg-slate-200 text-slate-500 border border-slate-300 hover:bg-slate-300'
          }`}
        >
          <span>
            {currentStep === 8 ? 'מעבר לסיום ואישור' : canProceed ? 'שמור והמשך לשלב הבא' : 'השלימו את השדות החובה'}
          </span>
          <ArrowLeft className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
};
