import React from 'react';
import { Users, HelpCircle, Heart, ShieldAlert, AlertTriangle, Target, Lightbulb } from 'lucide-react';
import { DiscoveryData } from '../../types';
import { RequiredMark, fieldClass, FieldError } from '../common/FieldValidation';

interface Step2Props {
  data: DiscoveryData;
  onChange: (updates: Partial<DiscoveryData>) => void;
  missingFields?: Set<keyof DiscoveryData>;
  showErrors?: boolean;
}

export const Step2Customers: React.FC<Step2Props> = ({ data, onChange, missingFields, showErrors = false }) => {
  const isMissing = (field: keyof DiscoveryData) => showErrors && (missingFields?.has(field) ?? false);
  return (
    <div className="space-y-8 text-right">
      
      {/* Step Header */}
      <div className="border-b border-slate-100 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2.5">
          <Users className="w-3.5 h-3.5" />
          <span>שלב 2 מתוך 9</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          הבנת קהל הלקוחות שלכם
        </h2>
        <p className="text-slate-600 text-sm sm:text-base mt-1.5 leading-relaxed">
          כדי שהאתר ימיר לקוחות, עלינו לדבר ישירות אל הלב שלהם: להבין מה כואב להם, ממה הם חוששים ומה יגרום להם לבחור בכם בביטחון.
        </p>
      </div>

      <div className="space-y-6">
        
        {/* Ideal Customer */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <label htmlFor="idealCustomer" className="block text-base font-bold text-slate-900 cursor-pointer">
                1. מי הלקוח האידיאלי שלכם? <RequiredMark />
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                איזה סוג לקוח אתם הכי נהנים לשרת? (לדוגמה: בעלי בתים פרטיים, מנהלי רכש, זוגות צעירים, נשים בגילאי 30-50...)
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4" />
            </div>
          </div>

          <textarea
            id="idealCustomer"
            name="idealCustomer"
            rows={3}
            value={data.idealCustomer || ''}
            onChange={(e) => onChange({ idealCustomer: e.target.value })}
            placeholder="תארו את הלקוח: מיהו, מה המאפיינים שלו, מה רמת התקציב או הסיטואציה שבה הוא פונה אליכם..."
            className={fieldClass('w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs leading-relaxed', isMissing('idealCustomer'))}
          />
          <FieldError show={isMissing('idealCustomer')} />
        </div>

        {/* The Problem */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <label htmlFor="customerProblem" className="block text-base font-bold text-slate-900 cursor-pointer">
                2. איזו בעיה או כאב דחוף יש ללקוחות כשהם פונים אליכם? <RequiredMark />
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                מה קרה אצלם שהכריח אותם לחפש פתרון? (למשל: תקלה דחופה, חוסר זמן, תסכול מספקים קודמים, חוסר ידע מקצועי)
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <textarea
            id="customerProblem"
            name="customerProblem"
            rows={3}
            value={data.customerProblem || ''}
            onChange={(e) => onChange({ customerProblem: e.target.value })}
            placeholder="מה האתגר שמטריד אותם ומדיר שינה מעיניהם..."
            className={fieldClass('w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs leading-relaxed', isMissing('customerProblem'))}
          />
          <FieldError show={isMissing('customerProblem')} />
        </div>

        {/* The Desire / Dream Outcome */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <label htmlFor="customerDesire" className="block text-base font-bold text-slate-900 cursor-pointer">
                3. מה התוצאה המושלמת שהם רוצים להשיג? <RequiredMark />
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                איך החיים או העסק שלהם ייראו אחרי שתסיימו את העבודה? מה התחושה והתוצאה הסופית?
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4" />
            </div>
          </div>

          <textarea
            id="customerDesire"
            name="customerDesire"
            rows={3}
            value={data.customerDesire || ''}
            onChange={(e) => onChange({ customerDesire: e.target.value })}
            placeholder="לדוגמה: בית נקי מנזילות ושקט נפשי, עלייה במכירות, מראה צעיר ורענן, פתרון משפטי מהיר..."
            className={fieldClass('w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs leading-relaxed', isMissing('customerDesire'))}
          />
          <FieldError show={isMissing('customerDesire')} />
        </div>

        {/* Customer Fears & Obstacles in 2 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Fears */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <label htmlFor="customerFears" className="block text-sm font-bold text-slate-900 cursor-pointer">
                  4. ממה הם הכי חוששים או נרתעים?
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  פחד מ״עקיצות״, מחירים מנופחים, עבודה מרושלת, חוסר מענה...
                </p>
              </div>
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            </div>

            <textarea
              id="customerFears"
              name="customerFears"
              rows={3}
              value={data.customerFears || ''}
              onChange={(e) => onChange({ customerFears: e.target.value })}
              placeholder="איזה פחד עלינו להפריך מיד באתר כדי שהם ירגישו בטוחים לפנות?"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs leading-relaxed"
            />
          </div>

          {/* Obstacles */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <label htmlFor="customerObstacles" className="block text-sm font-bold text-slate-900 cursor-pointer">
                  5. מה בדרך כלל עוצר אותם מלקנות?
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  מחיר? התלבטות בין מתחרים? חוסר הבנה של התהליך?
                </p>
              </div>
              <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            </div>

            <textarea
              id="customerObstacles"
              name="customerObstacles"
              rows={3}
              value={data.customerObstacles || ''}
              onChange={(e) => onChange({ customerObstacles: e.target.value })}
              placeholder="מה גורם להם להסס או לדחות את ההחלטה..."
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs leading-relaxed"
            />
          </div>

        </div>

      </div>

    </div>
  );
};
