import React from 'react';
import { Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { STEPS_CONFIG } from '../data/initialData';
import { StepKey } from '../types';

interface ProgressBarProps {
  currentStep: StepKey;
  completedSteps: number[];
  onSelectStep: (step: StepKey) => void;
  progressPercentage: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentStep,
  completedSteps,
  onSelectStep,
  progressPercentage,
}) => {
  const currentStepMeta = STEPS_CONFIG.find((s) => s.number === currentStep) || STEPS_CONFIG[0];

  return (
    <div className="bg-white border-b border-slate-200/80 shadow-xs">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        
        {/* Desktop 9-Step Bar */}
        <div className="hidden md:block">
          <div className="relative flex items-center justify-between">
            
            {/* Connecting background track */}
            <div className="absolute top-1/2 right-0 left-0 -translate-y-1/2 h-[3px] bg-slate-200 z-0 mx-6 rounded-full" />
            
            {/* Active filled line based on progress */}
            <div
              className="absolute top-1/2 right-0 -translate-y-1/2 h-[3px] bg-indigo-600 transition-all duration-500 z-0 mx-6 rounded-full"
              style={{
                width: `${((currentStep - 1) / (STEPS_CONFIG.length - 1)) * 100}%`,
              }}
            />

            {STEPS_CONFIG.map((step) => {
              const isCompleted = completedSteps.includes(step.number);
              const isCurrent = currentStep === step.number;
              const isAccessible = isCompleted || step.number <= currentStep || step.number === 1;

              return (
                <button
                  key={step.number}
                  disabled={!isAccessible}
                  onClick={() => onSelectStep(step.number as StepKey)}
                  className={`group relative z-10 flex flex-col items-center focus:outline-hidden transition-all ${
                    !isAccessible ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  }`}
                >
                  {/* Step Bubble */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                      isCompleted && !isCurrent
                        ? 'bg-emerald-500 text-white shadow-xs ring-4 ring-white'
                        : isCurrent
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-4 ring-indigo-100 scale-110'
                        : 'bg-white border-2 border-slate-300 text-slate-500 group-hover:border-slate-400'
                    }`}
                  >
                    {isCompleted && !isCurrent ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <span>{step.number}</span>
                    )}
                  </div>

                  {/* Step Title */}
                  <span
                    className={`mt-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                      isCurrent
                        ? 'text-indigo-600 font-bold'
                        : isCompleted
                        ? 'text-slate-800'
                        : 'text-slate-600'
                    }`}
                  >
                    {step.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile / Compact Bar */}
        <div className="md:hidden flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                {currentStep}
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {currentStepMeta.title}
                </h3>
                <p className="text-[11px] text-slate-500">
                  שלב {currentStep} מתוך 9 • {currentStepMeta.subtitle}
                </p>
              </div>
            </div>

            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
              {progressPercentage}% הושלם
            </span>
          </div>

          {/* Progress track */}
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(5, (currentStep / 9) * 100)}%` }}
            />
          </div>
        </div>

      </div>
    </div>
  );
};
