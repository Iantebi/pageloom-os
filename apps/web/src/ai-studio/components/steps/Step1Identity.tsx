import React from 'react';
import { Building2, User, Mail, Phone, MessageSquare, MapPin, Calendar, Sparkles, BookOpen } from 'lucide-react';
import { DiscoveryData } from '../../types';
import { BUSINESS_CATEGORIES } from '../../data/initialData';

interface Step1Props {
  data: DiscoveryData;
  onChange: (updates: Partial<DiscoveryData>) => void;
}

export const Step1Identity: React.FC<Step1Props> = ({ data, onChange }) => {
  return (
    <div className="space-y-8 text-right">
      
      {/* Step Header */}
      <div className="border-b border-slate-100 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2.5">
          <Building2 className="w-3.5 h-3.5" />
          <span>שלב 1 מתוך 9</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          זהות העסק שלכם
        </h2>
        <p className="text-slate-600 text-sm sm:text-base mt-1.5 leading-relaxed">
          בואו נתחיל מהיסודות: הפרטים הרשמיים, דרכי התקשורת והסיפור הייחודי שהביא להקמת העסק.
        </p>
      </div>

      {/* Form Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Business Name */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-900">
            שם העסק <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={data.businessName}
              onChange={(e) => onChange({ businessName: e.target.value })}
              placeholder="לדוגמה: יוסף שירותי אינסטלציה ושיפוצים"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
            />
          </div>
          <span className="text-[11px] text-slate-500">השם המוכר שיופיע בכותרת הראשית ובלוגו.</span>
        </div>

        {/* Owner Name */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-900">
            שם בעל/ת העסק <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={data.ownerName}
              onChange={(e) => onChange({ ownerName: e.target.value })}
              placeholder="לדוגמה: יוסף לוי"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
            />
          </div>
          <span className="text-[11px] text-slate-500">השם שאליו יפנו הלקוחות באופן אישי.</span>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-900">
            אימייל ליצירת קשר <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="email"
              dir="ltr"
              value={data.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="name@business.co.il"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs text-left"
            />
          </div>
        </div>

        {/* Phone & WhatsApp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-900">
              טלפון ראשי <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              dir="ltr"
              value={data.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder="050-1234567"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs text-left"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-900">
              מספר וואטסאפ
            </label>
            <input
              type="tel"
              dir="ltr"
              value={data.whatsapp || data.phone}
              onChange={(e) => onChange({ whatsapp: e.target.value })}
              placeholder="050-1234567"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs text-left"
            />
          </div>
        </div>

        {/* Business Category */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="block text-sm font-bold text-slate-900">
            תחום עיסוק וקטגוריה <span className="text-rose-500">*</span>
          </label>
          <select
            value={data.businessCategory}
            onChange={(e) => onChange({ businessCategory: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs cursor-pointer"
          >
            <option value="">בחר/י את תחום הפעילות המרכזי...</option>
            {BUSINESS_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Years in Business & Location */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-900">
            ותק ושנות פעילות בענף
          </label>
          <input
            type="text"
            value={data.yearsInBusiness}
            onChange={(e) => onChange({ yearsInBusiness: e.target.value })}
            placeholder="לדוגמה: 12 שנים (הוקם ב-2012)"
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-900">
            מיקום גיאוגרפי / אזורי מתן שירות
          </label>
          <input
            type="text"
            value={data.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="לדוגמה: גוש דן, השרון ומרכז הארץ / שירות בפריסה ארצית"
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
          />
        </div>

        {/* Business Story */}
        <div className="space-y-1.5 md:col-span-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-bold text-slate-900">
              הסיפור של העסק והחזון שלכם <span className="text-rose-500">*</span>
            </label>
            <span className="text-xs text-indigo-600 font-medium">מה הוביל אתכם להקים את העסק?</span>
          </div>
          <textarea
            rows={4}
            value={data.businessStory}
            onChange={(e) => onChange({ businessStory: e.target.value })}
            placeholder="ספרו במילים שלכם: איך הכל התחיל, מה הערכים שמובילים אתכם ביומיום, ולמה חשוב לכם שהלקוחות ירגישו בידיים טובות..."
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs leading-relaxed"
          />
          <div className="text-[11px] text-slate-500">
            💡 טיפ: אל תדאגו לגבי ניסוח מושלם – צוות הקופירייטינג של PageLoom ישדרג וילטש את זה לעמוד הראשי.
          </div>
        </div>

        {/* Optional Tagline */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="block text-sm font-bold text-slate-900">
            משפט מפתח או סלוגן (אם יש)
          </label>
          <input
            type="text"
            value={data.tagline || ''}
            onChange={(e) => onChange({ tagline: e.target.value })}
            placeholder="לדוגמה: שירות אמין, מהיר ומקצועי ללא פשרות"
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
          />
        </div>

      </div>

    </div>
  );
};
