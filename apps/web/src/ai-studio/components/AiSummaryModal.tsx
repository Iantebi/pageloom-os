import React, { useState } from 'react';
import { Sparkles, X, Copy, Check, FileText, CheckCircle2 } from 'lucide-react';
import { DiscoveryData } from '../types';
import { generateAiAssets } from '../services/aiGenerator';

interface AiSummaryModalProps {
  data: DiscoveryData;
  isOpen: boolean;
  onClose: () => void;
}

export const AiSummaryModal: React.FC<AiSummaryModalProps> = ({
  data,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const assets = generateAiAssets(data);

  const handleCopy = () => {
    navigator.clipboard.writeText(assets.businessSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-right shadow-2xl border border-slate-200"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                פרופיל אפיון חכם (PageLoom AI Brief)
              </h3>
              <p className="text-xs text-slate-500">
                סיכום דינמי המופק ישירות מהתשובות שלכם עבור צוות הפיתוח והקריאייטיב
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          
          {/* AI Headline Preview */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 space-y-2">
            <div className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">
              הצעה לכותרת אתר ראשית (Hero Copy Concept):
            </div>
            <div className="text-base font-extrabold text-slate-900 leading-snug">
              {assets.heroHeadline}
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">
              {assets.heroSubheadline}
            </div>
          </div>

          {/* Business Summary Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">
                תקציר האפיון שנאסף:
              </span>
              <button
                onClick={handleCopy}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'הועתק!' : 'העתק פרופיל'}</span>
              </button>
            </div>

            <pre className="bg-slate-900 text-slate-200 p-4 rounded-2xl font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
              {assets.businessSummary}
            </pre>
          </div>

          {/* SEO Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
            <div className="font-bold text-slate-900 text-xs">תצוגת גוגל מותאמת (SEO Snippet):</div>
            <div className="text-blue-700 font-semibold text-sm truncate">{assets.seoPackage.metaTitle}</div>
            <div className="text-slate-600 text-xs line-clamp-2">{assets.seoPackage.metaDescription}</div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            הנתונים מתעדכנים בזמן אמת עם כל שינוי שאתם מבצעים בשלבים.
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
          >
            סגור
          </button>
        </div>

      </div>
    </div>
  );
};
