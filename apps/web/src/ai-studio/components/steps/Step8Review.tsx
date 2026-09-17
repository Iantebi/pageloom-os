import React from 'react';
import { CheckCircle2, Edit3, Building2, Users, Layers, Sparkles, Palette, UploadCloud, Globe, AlertTriangle, ArrowLeft, FileText } from 'lucide-react';
import { DiscoveryData, StepKey } from '../../types';
import { storageService } from '../../services/storageService';
import { ImageThumbnail } from '../common/ImageThumbnail';

interface Step8Props {
  data: DiscoveryData;
  onEditStep: (step: StepKey) => void;
  onProceedToCompletion: () => void;
}

export const Step8Review: React.FC<Step8Props> = ({
  data,
  onEditStep,
  onProceedToCompletion,
}) => {
  const stats = storageService.calculateDiscoveryStats(data);

  return (
    <div className="space-y-8 text-right">
      
      {/* Step Header */}
      <div className="border-b border-slate-100 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>שלב 8 מתוך 9</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            סקירת נתוני האפיון שלכם
          </h2>
          <p className="text-slate-600 text-sm sm:text-base mt-1.5 leading-relaxed">
            עברו על הכרטיסים המרוכזים. תוכלו לערוך כל חלק בלחיצה פשוטה לפני האישור הסופי והעברה לצוות הבנייה.
          </p>
        </div>

        {/* Status completion pill */}
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-2xl flex items-center gap-2 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold">{stats.progressPercentage}% מכלל הנתונים הוזנו</span>
        </div>
      </div>

      {/* Missing Items Alert if any */}
      {stats.missingAnswers.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 sm:p-5 text-right flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-900">
              ישנם כמה פרטים מומלצים שטרם מולאו ({stats.missingAnswers.length}):
            </h4>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {stats.missingAnswers.map((item, i) => (
                <button
                  key={i}
                  onClick={() => onEditStep(item.step as StepKey)}
                  className="text-xs bg-white text-amber-800 border border-amber-300 px-2.5 py-1 rounded-lg font-medium hover:bg-amber-100 transition cursor-pointer"
                >
                  שלב {item.step}: {item.labelHebrew} ✎
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Review Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Card 1: Business Identity */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-base">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>1. זהות העסק</span>
              </div>
              <button
                type="button"
                onClick={() => onEditStep(1)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-lg"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>ערוך</span>
              </button>
            </div>

            <div className="pt-3 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 font-medium">שם העסק: </span>
                <span className="font-bold text-slate-900">{data.businessName || 'לא צוין'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">בעלים: </span>
                <span className="font-semibold text-slate-800">{data.ownerName || 'לא צוין'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">טלפון / אימייל: </span>
                <span className="font-semibold text-slate-800">{data.phone} | {data.email}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">תחום: </span>
                <span className="font-semibold text-slate-800">{data.businessCategory || 'לא צוין'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">מיקום וותק: </span>
                <span className="font-semibold text-slate-800">{data.location || 'מרכז'} ({data.yearsInBusiness || 'שנים רבות'})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Customers */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-base">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>2. קהל היעד והצרכים</span>
              </div>
              <button
                type="button"
                onClick={() => onEditStep(2)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-lg"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>ערוך</span>
              </button>
            </div>

            <div className="pt-3 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 font-medium">הלקוח האידיאלי: </span>
                <span className="font-semibold text-slate-800 line-clamp-2">{data.idealCustomer || 'לא צוין'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">הבעיה המרכזית: </span>
                <span className="font-semibold text-slate-800 line-clamp-2">{data.customerProblem || 'לא צוין'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">התוצאה הרצויה: </span>
                <span className="font-semibold text-slate-800 line-clamp-2">{data.customerDesire || 'לא צוין'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Services */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-base">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>3. שירותים ומוצרים ({data.services.filter((s) => s.name).length})</span>
              </div>
              <button
                type="button"
                onClick={() => onEditStep(3)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-lg"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>ערוך</span>
              </button>
            </div>

            <div className="pt-3 space-y-2 text-xs">
              {data.services.filter((s) => s.name).map((s, idx) => (
                <div key={s.id} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="font-bold text-slate-900">{idx + 1}. {s.name}</div>
                  <div className="text-slate-500 text-[11px] truncate">{s.resultReceived || s.problemSolved}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 4: Advantages & Promises */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-base">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>4. יתרון תחרותי והבטחות</span>
              </div>
              <button
                type="button"
                onClick={() => onEditStep(4)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-lg"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>ערוך</span>
              </button>
            </div>

            <div className="pt-3 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 font-medium">למה לבחור בכם: </span>
                <span className="font-semibold text-slate-800 line-clamp-2">{data.whyChooseYou || 'לא צוין'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">בידול ייחודי: </span>
                <span className="font-semibold text-slate-800 line-clamp-2">{data.uniqueDifferentiator || 'לא צוין'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">הבטחה ראשית: </span>
                <span className="font-semibold text-slate-800 line-clamp-2">{data.corePromises || 'לא צוין'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Brand & Colors */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-base">
                <Palette className="w-4 h-4 text-indigo-600" />
                <span>5. שפה מיתוגית</span>
              </div>
              <button
                type="button"
                onClick={() => onEditStep(5)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-lg"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>ערוך</span>
              </button>
            </div>

            <div className="pt-3 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">צבעי מותג: </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-4 rounded-full border border-slate-300"
                    style={{ backgroundColor: data.brandColors.primary }}
                  />
                  <span
                    className="w-4 h-4 rounded-full border border-slate-300"
                    style={{ backgroundColor: data.brandColors.secondary }}
                  />
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">סגנון: </span>
                <span className="font-semibold text-slate-800">{data.brandStyle}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">אישיות: </span>
                <span className="font-semibold text-slate-800">{data.brandPersonality.join(', ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 6: Uploads & Technical */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-base">
                <UploadCloud className="w-4 h-4 text-indigo-600" />
                <span>6+7. קבצים וטכני</span>
              </div>
              <button
                type="button"
                onClick={() => onEditStep(6)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-lg"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>ערוך</span>
              </button>
            </div>

            <div className="pt-3 space-y-2.5 text-xs">
              <div>
                <span className="text-slate-400 font-medium">קבצים שהועלו: </span>
                <span className="font-bold text-slate-900">{data.uploadedFiles.length} קבצים שמורים בענן</span>
              </div>

              {/* Visual thumbnails preview */}
              {data.uploadedFiles.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {data.uploadedFiles.map((file) => (
                    <ImageThumbnail
                      key={file.id}
                      file={file}
                      className="w-9 h-9 rounded-lg"
                      showOverlayIcon={false}
                    />
                  ))}
                </div>
              )}

              <div>
                <span className="text-slate-400 font-medium">דומיין: </span>
                <span className="font-semibold text-slate-800">
                  {data.hasExistingDomain ? data.existingDomain || 'יש דומיין קיים' : 'דרוש סיוע בבחירת דומיין'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">כתובת: </span>
                <span className="font-semibold text-slate-800">{data.physicalAddress || 'לפי תיאום'}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Final Submit CTA */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl shadow-indigo-200">
        <div className="space-y-1.5 text-center sm:text-right">
          <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
            הכל מוכן לסיום והעברה לצוות PageLoom!
          </h3>
          <p className="text-indigo-100 text-xs sm:text-sm leading-relaxed">
            לאחר הלחיצה, הנתונים יועברו ישירות למחלקת הפיתוח והעיצוב שלנו להתחלת בניית הפרויקט.
          </p>
        </div>

        <button
          type="button"
          onClick={onProceedToCompletion}
          className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-indigo-900 font-extrabold text-base rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2 shrink-0"
        >
          <span>אישור סופי וסיום האפיון 🎉</span>
          <ArrowLeft className="w-5 h-5 text-indigo-600" />
        </button>
      </div>

    </div>
  );
};
