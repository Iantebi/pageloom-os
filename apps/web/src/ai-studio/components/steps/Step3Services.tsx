import React from 'react';
import { Layers, Plus, Trash2, HelpCircle, AlertCircle } from 'lucide-react';
import { DiscoveryData, ServiceItem } from '../../types';
import { fieldClass } from '../common/FieldValidation';

interface Step3Props {
  data: DiscoveryData;
  onChange: (updates: Partial<DiscoveryData>) => void;
  missingFields?: Set<keyof DiscoveryData>;
  showErrors?: boolean;
}

export const Step3Services: React.FC<Step3Props> = ({ data, onChange, missingFields, showErrors = false }) => {
  const servicesMissing = showErrors && (missingFields?.has('services') ?? false);
  const services: ServiceItem[] =
    Array.isArray(data.services) && data.services.length > 0
      ? data.services
      : [
          {
            id: 'srv-1',
            name: '',
            problemSolved: '',
            resultReceived: '',
            whyValuable: '',
            priceEstimate: '',
          },
        ];

  const handleAddService = () => {
    const newService: ServiceItem = {
      id: `srv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: '',
      problemSolved: '',
      resultReceived: '',
      whyValuable: '',
      priceEstimate: '',
    };
    onChange({
      services: [...services, newService],
    });
  };

  const handleRemoveService = (id: string) => {
    if (services.length <= 1) {
      // Clear fields if it's the only one
      onChange({
        services: [
          {
            id: 'srv-1',
            name: '',
            problemSolved: '',
            resultReceived: '',
            whyValuable: '',
            priceEstimate: '',
          },
        ],
      });
      return;
    }
    onChange({
      services: services.filter((s) => s.id !== id),
    });
  };

  const handleUpdateService = (id: string, field: keyof ServiceItem, value: string) => {
    const updated = services.map((srv) => (srv.id === id ? { ...srv, [field]: value } : srv));
    onChange({
      services: updated,
    });
  };

  return (
    <div className="space-y-8 text-right">
      
      {/* Step Header */}
      <div className="border-b border-slate-100 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2.5">
            <Layers className="w-3.5 h-3.5" />
            <span>שלב 3 מתוך 9</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            השירותים והמוצרים שלכם
          </h2>
          <p className="text-slate-600 text-sm sm:text-base mt-1.5 leading-relaxed">
            הגדירו את השירותים המרכזיים שתרצו להציג באתר. נבנה לכל שירות כרטיס ערך שמציג תוצאות ולא רק מפרט יבש.
          </p>
        </div>

        <button
          id="btn-add-service-header"
          type="button"
          onClick={handleAddService}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>הוספת שירות נוסף</span>
        </button>
      </div>

      {servicesMissing && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 flex items-start gap-3" role="alert">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-rose-900">יש להוסיף שם לפחות לשירות אחד לפני שממשיכים.</p>
        </div>
      )}

      {/* Services List */}
      <div className="space-y-6">
        {services.map((service, index) => {
          const serviceNum = index + 1;
          const nameInputId = `srv-name-${service.id}`;
          const problemInputId = `srv-problem-${service.id}`;
          const resultInputId = `srv-result-${service.id}`;
          const valueInputId = `srv-valuable-${service.id}`;
          const priceInputId = `srv-price-${service.id}`;

          return (
            <div
              key={service.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 shadow-xs relative transition hover:border-slate-300 space-y-5"
            >
              {/* Card Header Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-100">
                    #{serviceNum}
                  </span>
                  <h3 className="font-bold text-slate-900 text-base">
                    {service.name && service.name.trim() ? service.name : `שירות מספר ${serviceNum}`}
                  </h3>
                </div>

                {services.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveService(service.id)}
                    className="text-xs font-medium text-slate-400 hover:text-rose-600 flex items-center gap-1 transition p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                    title="הסר שירות"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">הסר שירות</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">שירות ראשי</span>
                )}
              </div>

              {/* Service Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Service Name */}
                <div className="space-y-1.5 md:col-span-2">
                  <label htmlFor={nameInputId} className="block text-sm font-bold text-slate-900 cursor-pointer">
                    שם השירות / החבילה {index === 0 && <span className="text-rose-500" aria-hidden="true"> *</span>}
                  </label>
                  <input
                    id={nameInputId}
                    name={nameInputId}
                    type="text"
                    value={service.name || ''}
                    onChange={(e) => handleUpdateService(service.id, 'name', e.target.value)}
                    placeholder="לדוגמה: איתור נזילות במצלמה תרמית / ייעוץ משפטי להסכמי ממון / חבילת עיצוב פנים מלאה"
                    className={fieldClass('w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition', servicesMissing && !service.name?.trim())}
                  />
                </div>

                {/* Problem Solved */}
                <div className="space-y-1.5">
                  <label htmlFor={problemInputId} className="block text-sm font-bold text-slate-900 cursor-pointer">
                    איזו בעיה השירות פותר?
                  </label>
                  <textarea
                    id={problemInputId}
                    name={problemInputId}
                    rows={2}
                    value={service.problemSolved || ''}
                    onChange={(e) => handleUpdateService(service.id, 'problemSolved', e.target.value)}
                    placeholder="איזה אתגר ממוקד השירות הזה פותר ללקוח?"
                    className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
                  />
                </div>

                {/* Result Received */}
                <div className="space-y-1.5">
                  <label htmlFor={resultInputId} className="block text-sm font-bold text-slate-900 cursor-pointer">
                    איזו תוצאה הלקוח מקבל בסיום?
                  </label>
                  <textarea
                    id={resultInputId}
                    name={resultInputId}
                    rows={2}
                    value={service.resultReceived || ''}
                    onChange={(e) => handleUpdateService(service.id, 'resultReceived', e.target.value)}
                    placeholder="מה התוצר הממשי? (דו״ח הנדסי, תיקון מושלם, הסכם חתום...)"
                    className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
                  />
                </div>

                {/* Why Valuable */}
                <div className="space-y-1.5">
                  <label htmlFor={valueInputId} className="block text-sm font-bold text-slate-900 cursor-pointer">
                    למה השירות הזה בעל ערך משמעותי?
                  </label>
                  <textarea
                    id={valueInputId}
                    name={valueInputId}
                    rows={2}
                    value={service.whyValuable || ''}
                    onChange={(e) => handleUpdateService(service.id, 'whyValuable', e.target.value)}
                    placeholder="למה שווה ללקוח להשקיע בזה? כמה כסף/זמן/דאגות זה חוסך לו?"
                    className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
                  />
                </div>

                {/* Price Estimate (Optional) */}
                <div className="space-y-1.5">
                  <label htmlFor={priceInputId} className="block text-sm font-bold text-slate-900 cursor-pointer">
                    תמחור או טווח מחיר משוער (רשות)
                  </label>
                  <input
                    id={priceInputId}
                    name={priceInputId}
                    type="text"
                    value={service.priceEstimate || ''}
                    onChange={(e) => handleUpdateService(service.id, 'priceEstimate', e.target.value)}
                    placeholder="לדוגמה: החל מ-850 ₪ / לפי הצעת מחיר אישית"
                    className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs"
                  />
                </div>

              </div>

            </div>
          );
        })}
      </div>

      {/* Add more button footer */}
      <div className="text-center pt-2">
        <button
          id="btn-add-service-footer"
          type="button"
          onClick={handleAddService}
          className="inline-flex items-center gap-2 px-6 py-3.5 border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/60 hover:bg-indigo-100/70 active:scale-98 text-indigo-700 font-bold text-sm rounded-2xl transition cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>+ הוספת שירות נוסף לעסק</span>
        </button>
      </div>

    </div>
  );
};

