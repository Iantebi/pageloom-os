import React from 'react';
import { Palette, Check, Sparkles, Image, ExternalLink } from 'lucide-react';
import { DiscoveryData } from '../../types';
import { BRAND_STYLE_PRESETS, COLOR_PALETTES, PERSONALITY_TRAITS } from '../../data/initialData';

interface Step5Props {
  data: DiscoveryData;
  onChange: (updates: Partial<DiscoveryData>) => void;
}

export const Step5Brand: React.FC<Step5Props> = ({ data, onChange }) => {
  const togglePersonality = (trait: string) => {
    const current = data.brandPersonality || [];
    if (current.includes(trait)) {
      onChange({ brandPersonality: current.filter((t) => t !== trait) });
    } else {
      if (current.length >= 4) return; // limit to 4 key traits
      onChange({ brandPersonality: [...current, trait] });
    }
  };

  const selectPalette = (palette: typeof COLOR_PALETTES[0]) => {
    onChange({
      brandColors: {
        primary: palette.primary,
        secondary: palette.secondary,
        primaryName: palette.primaryName,
        secondaryName: palette.secondaryName,
      },
    });
  };

  return (
    <div className="space-y-8 text-right">
      
      {/* Step Header */}
      <div className="border-b border-slate-100 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2.5">
          <Palette className="w-3.5 h-3.5" />
          <span>שלב 5 מתוך 9</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          שפה מיתוגית ועיצוב ויזואלי
        </h2>
        <p className="text-slate-600 text-sm sm:text-base mt-1.5 leading-relaxed">
          נתאים את הנראות המדויקת של האתר שלכם: סגנון עיצובי, בדיוק שני צבעי מותג מובילים, אופי ופונטים.
        </p>
      </div>

      {/* 1. Preferred Style Cards */}
      <div className="space-y-3.5">
        <label className="block text-sm font-bold text-slate-900">
          1. איזה סגנון עיצובי מייצג את העסק שלכם בצורה הטובה ביותר? <span className="text-rose-500">*</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {BRAND_STYLE_PRESETS.map((preset) => {
            const isSelected = data.brandStyle === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange({ brandStyle: preset.id })}
                className={`rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden group ${
                  isSelected
                    ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                {/* Visual Style Mockup Image Header */}
                <div className="w-full h-28 bg-slate-100 relative overflow-hidden">
                  <img
                    src={preset.imageUrl}
                    alt={preset.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                  {/* Badges on top of Image */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white shadow-xs"
                      style={{ backgroundColor: preset.primaryPreview }}
                      title="צבע ראשי"
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white shadow-xs"
                      style={{ backgroundColor: preset.secondaryPreview }}
                      title="צבע הדגשה"
                    />
                  </div>

                  {isSelected && (
                    <span className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shadow-md">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}

                  <div className="absolute bottom-2 right-3 left-3">
                    <h4 className="font-bold text-white text-sm drop-shadow-sm truncate">{preset.title}</h4>
                  </div>
                </div>

                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{preset.subtitle}</p>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span className="truncate">אווירה: {preset.vibe}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Choose EXACTLY TWO Brand Colors */}
      <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-bold text-slate-900">
              2. בחירת 2 צבעי מותג מובילים <span className="text-rose-500">*</span>
            </label>
            <span className="text-xs text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full font-bold border border-indigo-100">
              בדיוק 2 צבעים להרמוניה מושלמת
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            בחרו פלטה מוכנה מהרשימה או הגדירו צבעים מותאמים אישית (ראשי ומשני).
          </p>
        </div>

        {/* Preset Palettes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {COLOR_PALETTES.map((pal) => {
            const isSelected =
              data.brandColors.primary === pal.primary && data.brandColors.secondary === pal.secondary;
            return (
              <button
                key={pal.name}
                type="button"
                onClick={() => selectPalette(pal)}
                className={`p-3 rounded-xl border text-right transition flex items-center gap-3 cursor-pointer ${
                  isSelected
                    ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex -space-x-2 space-x-reverse shrink-0">
                  <span
                    className="w-6 h-6 rounded-full border-2 border-white shadow-xs"
                    style={{ backgroundColor: pal.primary }}
                  />
                  <span
                    className="w-6 h-6 rounded-full border-2 border-white shadow-xs"
                    style={{ backgroundColor: pal.secondary }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{pal.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {pal.primaryName} + {pal.secondaryName}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Color Pickers */}
        <div className="pt-3 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">צבע ראשי (Primary)</span>
              <span className="text-[11px] font-mono text-slate-400 uppercase">
                {data.brandColors.primary}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="color"
                value={data.brandColors.primary}
                onChange={(e) =>
                  onChange({
                    brandColors: { ...data.brandColors, primary: e.target.value },
                  })
                }
                className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">צבע משני להדגשות (Secondary)</span>
              <span className="text-[11px] font-mono text-slate-400 uppercase">
                {data.brandColors.secondary}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="color"
                value={data.brandColors.secondary}
                onChange={(e) =>
                  onChange({
                    brandColors: { ...data.brandColors, secondary: e.target.value },
                  })
                }
                className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
            </div>
          </div>

        </div>
      </div>

      {/* 3. Logo Status */}
      <div className="space-y-3">
        <label className="block text-sm font-bold text-slate-900">
          3. מה המצב הנוכחי של לוגו העסק שלכם? <span className="text-rose-500">*</span>
        </label>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'has_logo', label: 'יש לי לוגו קיים', desc: 'אעלה אותו בשלב הקבצים הבא' },
            { id: 'needs_refresh', label: 'יש לוגו אבל אשמח לשדרוג', desc: 'צריך ריענון עיצובי קל' },
            { id: 'needs_new_logo', label: 'אין לי לוגו כלל', desc: 'רוצה ש-PageLoom ייצרו לוגו טיפוגרפי' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange({ logoStatus: item.id as any })}
              className={`p-3.5 rounded-xl border text-right transition cursor-pointer ${
                data.logoStatus === item.id
                  ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-bold text-slate-900">{item.label}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Brand Personality Tags */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-bold text-slate-900">
            4. אופי ואישיות המותג (בחרו 2-4 תכונות)
          </label>
          <span className="text-xs text-slate-500">
            נבחרו: {data.brandPersonality.length}/4
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {PERSONALITY_TRAITS.map((trait) => {
            const isSelected = data.brandPersonality.includes(trait);
            return (
              <button
                key={trait}
                type="button"
                onClick={() => togglePersonality(trait)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isSelected && <Check className="w-3 h-3" />}
                <span>{trait}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Inspiration Websites & Fonts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
        
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-900">
            סגנון פונטים וטקסט
          </label>
          <select
            value={data.fontStyle}
            onChange={(e) => onChange({ fontStyle: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs cursor-pointer"
          >
            <option value="נקי וקריא (סנס-סריף מודרני)">נקי, הייטקיסטי וקריא (סנס-סריף מודרני)</option>
            <option value="יוקרתי ומסורתי (סריף אלגנטי)">יוקרתי, קלאסי ומסורתי (סריף אלגנטי)</option>
            <option value="בולט ועוצמתי (גופנים עבים ונועזים)">בולט ועוצמתי (גופנים עבים ונועזים)</option>
            <option value="חם, מעוגל וידידותי">חם, מעוגל וידידותי</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-900">
            אתרים להשראה ודוגמאות שאהבתם (רשות)
          </label>
          <input
            type="text"
            value={data.inspirationWebsites}
            onChange={(e) => onChange({ inspirationWebsites: e.target.value })}
            placeholder="קישורים לאתרים: apple.com, stripe.com, אתר של מתחרה..."
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
          />
        </div>

      </div>

    </div>
  );
};
