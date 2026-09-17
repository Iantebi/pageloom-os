import React from 'react';
import { Globe, Clock, MapPin, Mail, Instagram, Facebook, HelpCircle, CheckCircle2 } from 'lucide-react';
import { DiscoveryData } from '../../types';
import { FieldError } from '../common/FieldValidation';

interface Step7Props {
  data: DiscoveryData;
  onChange: (updates: Partial<DiscoveryData>) => void;
  missingFields?: Set<keyof DiscoveryData>;
  showErrors?: boolean;
}

export const Step7Technical: React.FC<Step7Props> = ({ data, onChange, missingFields, showErrors = false }) => {
  const domainMissing = showErrors && (missingFields?.has('hasExistingDomain') ?? false);
  return (
    <div className="space-y-8 text-right">
      
      {/* Step Header */}
      <div className="border-b border-slate-100 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2.5">
          <Globe className="w-3.5 h-3.5" />
          <span>שלב 7 מתוך 9</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          נוכחות דיגיטלית ופרטים טכניים
        </h2>
        <p className="text-slate-600 text-sm sm:text-base mt-1.5 leading-relaxed">
          חיבור כתובת האתר (דומיין), הרשתות החברתיות, שעות הפעילות והמיקום במפות – כדי שהלקוחות יוכלו להגיע אליכם בקלות.
        </p>
      </div>

      <div className="space-y-6">
        
        {/* Domain Section */}
        <div className={`bg-slate-50/70 border rounded-2xl p-5 sm:p-6 space-y-4 ${domainMissing ? 'border-rose-400 ring-2 ring-rose-400/40' : 'border-slate-200/80'}`}>
          <label className="block text-sm font-bold text-slate-900">
            1. האם יש לכם כבר כתובת אתר (דומיין)? <span className="text-rose-500" aria-hidden="true">*</span>
          </label>
          <FieldError show={domainMissing} message="בחרו אחת מהאפשרויות" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChange({ hasExistingDomain: true, needsDomainHelp: false })}
              className={`p-4 rounded-xl border text-right transition cursor-pointer ${
                data.hasExistingDomain === true
                  ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-sm font-bold text-slate-900">כן, יש לי דומיין קיים</div>
              <div className="text-xs text-slate-500 mt-1">אזין את הכתובת ואחבר אותה לאתר החדש</div>
            </button>

            <button
              type="button"
              onClick={() => onChange({ hasExistingDomain: false, needsDomainHelp: true })}
              className={`p-4 rounded-xl border text-right transition cursor-pointer ${
                data.hasExistingDomain === false
                  ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-sm font-bold text-slate-900">אין לי עדיין / צריך עזרה בבחירה</div>
              <div className="text-xs text-slate-500 mt-1">צוות PageLoom ימליץ על דומיין מעולה ומותאם</div>
            </button>
          </div>

          {data.hasExistingDomain && (
            <div className="pt-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                כתובת הדומיין שלכם:
              </label>
              <input
                type="text"
                dir="ltr"
                value={data.existingDomain}
                onChange={(e) => onChange({ existingDomain: e.target.value })}
                placeholder="www.mybusiness.co.il"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm text-left focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
              />
            </div>
          )}
        </div>

        {/* Social Networks & Business Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Facebook */}
          <div className="space-y-1.5">
            <label htmlFor="facebookUrl" className="block text-sm font-bold text-slate-900 flex items-center gap-1.5 cursor-pointer">
              <Facebook className="w-4 h-4 text-blue-600" />
              <span>דף פייסבוק עסקי</span>
            </label>
            <input
              id="facebookUrl"
              name="facebookUrl"
              type="text"
              dir="ltr"
              value={data.facebookUrl || ''}
              onChange={(e) => onChange({ facebookUrl: e.target.value })}
              placeholder="https://facebook.com/your-business"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm text-left placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
            />
          </div>

          {/* Instagram */}
          <div className="space-y-1.5">
            <label htmlFor="instagramUrl" className="block text-sm font-bold text-slate-900 flex items-center gap-1.5 cursor-pointer">
              <Instagram className="w-4 h-4 text-pink-600" />
              <span>אינסטגרם עסקי</span>
            </label>
            <input
              id="instagramUrl"
              name="instagramUrl"
              type="text"
              dir="ltr"
              value={data.instagramUrl || ''}
              onChange={(e) => onChange({ instagramUrl: e.target.value })}
              placeholder="https://instagram.com/your-business"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm text-left placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
            />
          </div>

          {/* Business Email */}
          <div className="space-y-1.5">
            <label htmlFor="businessEmail" className="block text-sm font-bold text-slate-900 flex items-center gap-1.5 cursor-pointer">
              <Mail className="w-4 h-4 text-slate-600" />
              <span>אימייל עסקי שיוצג באתר</span>
            </label>
            <input
              id="businessEmail"
              name="businessEmail"
              type="email"
              dir="ltr"
              value={data.businessEmail || data.email || ''}
              onChange={(e) => onChange({ businessEmail: e.target.value })}
              placeholder="info@business.co.il"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm text-left placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
            />
          </div>

          {/* Opening Hours */}
          <div className="space-y-1.5">
            <label htmlFor="openingHours" className="block text-sm font-bold text-slate-900 flex items-center gap-1.5 cursor-pointer">
              <Clock className="w-4 h-4 text-slate-600" />
              <span>שעות פעילות וקבלת קהל</span>
            </label>
            <input
              id="openingHours"
              name="openingHours"
              type="text"
              value={data.openingHours || ''}
              onChange={(e) => onChange({ openingHours: e.target.value })}
              placeholder="א׳-ה׳: 08:30 - 18:00, ו׳: 08:30 - 13:00 / 24 שעות"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
            />
          </div>

          {/* Physical Address */}
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="physicalAddress" className="block text-sm font-bold text-slate-900 flex items-center gap-1.5 cursor-pointer">
              <MapPin className="w-4 h-4 text-rose-500" />
              <span>כתובת פיזית מדויקת של העסק / הקליניקה</span>
            </label>
            <input
              id="physicalAddress"
              name="physicalAddress"
              type="text"
              value={data.physicalAddress || ''}
              onChange={(e) => onChange({ physicalAddress: e.target.value })}
              placeholder="לדוגמה: רחוב ויצמן 45, קומה 3, תל אביב (או: ׳שירות עד בית הלקוח׳)"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
            />
          </div>

          {/* Google Maps Link */}
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="googleMapsUrl" className="block text-sm font-bold text-slate-900 cursor-pointer">
              קישור למיקום בגוגל מפות (Google Maps)
            </label>
            <input
              id="googleMapsUrl"
              name="googleMapsUrl"
              type="text"
              dir="ltr"
              value={data.googleMapsUrl || ''}
              onChange={(e) => onChange({ googleMapsUrl: e.target.value })}
              placeholder="https://maps.google.com/?q=your-business"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm text-left placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
            />
          </div>

        </div>

      </div>

    </div>
  );
};
