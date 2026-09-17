import React from 'react';
import { Sparkles, Award, ShieldCheck, Trophy, CheckCircle, ThumbsUp, Star } from 'lucide-react';
import { DiscoveryData } from '../../types';

interface Step4Props {
  data: DiscoveryData;
  onChange: (updates: Partial<DiscoveryData>) => void;
}

export const Step4Advantage: React.FC<Step4Props> = ({ data, onChange }) => {
  return (
    <div className="space-y-8 text-right">
      
      {/* Step Header */}
      <div className="border-b border-slate-100 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>שלב 4 מתוך 9</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          היתרון התחרותי והייחודיות שלכם
        </h2>
        <p className="text-slate-600 text-sm sm:text-base mt-1.5 leading-relaxed">
          למה שלקוח יבחר דווקא בכם ולא במתחרה? נגדיר את נקודות החוזק, ההבטחות הבלתי מתפשרות וההוכחות שמבססות אמון מיידי.
        </p>
      </div>

      <div className="space-y-6">
        
        {/* Why Choose You */}
        <div className="space-y-1.5">
          <label htmlFor="whyChooseYou" className="block text-sm font-bold text-slate-900 cursor-pointer">
            1. למה שלקוחות יבחרו דווקא בכם? <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="whyChooseYou"
            name="whyChooseYou"
            rows={3}
            value={data.whyChooseYou || ''}
            onChange={(e) => onChange({ whyChooseYou: e.target.value })}
            placeholder="מה הדבר הראשון שלקוח מרוצה אומר עליכם? (לדוגמה: יחס אישי וזמינות שיא, מקצועיות בלי פשרות, ציוד ייחודי שאין לאחרים...)"
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs leading-relaxed"
          />
        </div>

        {/* Unique Differentiator */}
        <div className="space-y-1.5">
          <label htmlFor="uniqueDifferentiator" className="block text-sm font-bold text-slate-900 cursor-pointer">
            2. מה הדבר שמבדל אתכם מהמתחרים בענף? <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="uniqueDifferentiator"
            name="uniqueDifferentiator"
            rows={3}
            value={data.uniqueDifferentiator || ''}
            onChange={(e) => onChange({ uniqueDifferentiator: e.target.value })}
            placeholder="במה שיטת העבודה, השירות או הגישה שלכם שונה מכל שאר בעלי המקצוע בתחום?"
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs leading-relaxed"
          />
        </div>

        {/* Core Promises */}
        <div className="space-y-1.5">
          <label htmlFor="corePromises" className="block text-sm font-bold text-slate-900 cursor-pointer">
            3. מהן ההבטחות שלכם ללקוח? <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="corePromises"
            name="corePromises"
            rows={2}
            value={data.corePromises || ''}
            onChange={(e) => onChange({ corePromises: e.target.value })}
            placeholder="לדוגמה: עמידה מדויקת בלוח זמנים, שקיפות במחיר ללא הפתעות, עבודה נקייה ומסודרת, מענה תוך שעתיים..."
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs leading-relaxed"
          />
        </div>

        {/* Social Proof & Guarantees in 2 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          
          {/* Social Proof */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              <label htmlFor="socialProof" className="block text-sm font-bold text-slate-900 cursor-pointer">
                הוכחה חברתית ומוניטין
              </label>
            </div>
            <textarea
              id="socialProof"
              name="socialProof"
              rows={3}
              value={data.socialProof || ''}
              onChange={(e) => onChange({ socialProof: e.target.value })}
              placeholder="לדוגמה: מעל 500 לקוחות מרוצים, דירוג 4.9 בגוגל, ביקורות מפרגנות בפייסבוק, כתבות בתקשורת..."
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
            />
          </div>

          {/* Guarantees */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <label htmlFor="guarantees" className="block text-sm font-bold text-slate-900 cursor-pointer">
                אחריות ובטחונות ללקוח
              </label>
            </div>
            <textarea
              id="guarantees"
              name="guarantees"
              rows={3}
              value={data.guarantees || ''}
              onChange={(e) => onChange({ guarantees: e.target.value })}
              placeholder="לדוגמה: אחריות מלאה עד 3 שנים, התחייבות לתוצאה או החזר כספי, ליווי עד לשביעות רצון מלאה..."
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
            />
          </div>

          {/* Experience Summary */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-blue-600" />
              <label htmlFor="experienceSummary" className="block text-sm font-bold text-slate-900 cursor-pointer">
                ניסיון ורקע מקצועי
              </label>
            </div>
            <textarea
              id="experienceSummary"
              name="experienceSummary"
              rows={3}
              value={data.experienceSummary || ''}
              onChange={(e) => onChange({ experienceSummary: e.target.value })}
              placeholder="רקע לימודי, הסמכות בכירות, פרויקטים מורכבים שביצעתם בעבר..."
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
            />
          </div>

          {/* Awards & Certifications */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-indigo-600" />
              <label htmlFor="awardsAndCertifications" className="block text-sm font-bold text-slate-900 cursor-pointer">
                פרסים, תעודות הצטיינות ותקנים
              </label>
            </div>
            <textarea
              id="awardsAndCertifications"
              name="awardsAndCertifications"
              rows={3}
              value={data.awardsAndCertifications || ''}
              onChange={(e) => onChange({ awardsAndCertifications: e.target.value })}
              placeholder="תו אמון הציבור, תעודת אומן, חבר בלשכת המקצוע, זכייה בתחרויות..."
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
            />
          </div>

        </div>

      </div>

    </div>
  );
};
