import React, { useState } from 'react';
import { MessageCircle, Phone, Clock, X, Send, ShieldCheck, HeartHandshake } from 'lucide-react';

interface WhatsAppHelpButtonProps {
  projectId: string;
  businessName: string;
  isOpen: boolean;
  onToggle: () => void;
}

export const WhatsAppHelpButton: React.FC<WhatsAppHelpButtonProps> = ({
  projectId,
  businessName,
  isOpen,
  onToggle,
}) => {
  const [customQuestion, setCustomQuestion] = useState('');

  const sendWhatsApp = () => {
    const text = encodeURIComponent(
      `שלום PageLoom, אני צריך/ה עזרה באפיון פרויקט #${projectId} (${businessName || 'עסק חדש'}). ${customQuestion ? `שאלה: ${customQuestion}` : ''}`
    );
    window.open(`https://wa.me/972501234567?text=${text}`, '_blank');
  };

  return (
    <>
      {/* Floating Action Trigger Button */}
      <button
        onClick={onToggle}
        className="fixed bottom-6 left-6 z-40 bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 sm:px-4 sm:py-3 rounded-full shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all transform hover:scale-105 cursor-pointer"
        title="צריך עזרה? דבר עם צוות PageLoom"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline text-xs font-bold">צריך עזרה?</span>
      </button>

      {/* Slide-in Help Modal Drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-50 flex items-end sm:items-center justify-center sm:justify-start sm:p-6 backdrop-blur-2xs"
          onClick={onToggle}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 text-right shadow-2xl border border-slate-200 space-y-5 animate-in slide-in-from-bottom-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  <HeartHandshake className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">צוות התמיכה של PageLoom</h3>
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    זמינים עבורכם ב-WhatsApp ובטלפון
                  </span>
                </div>
              </div>

              <button
                onClick={onToggle}
                className="text-slate-400 hover:text-slate-700 text-sm p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              נתקעתם בשאלה מסוימת? לא בטוחים איך לנסח שירות או איזה קובץ להעלות? אנחנו כאן כדי ללוות אתכם שלב אחרי שלב.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                שאלה או בקשה מיוחדת לצוות:
              </label>
              <textarea
                rows={2}
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder="למשל: איך כדאי לתמחר את השירות? או: מתי נוכל לראות סקיצה?"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={sendWhatsApp}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>פתיחת צ׳אט מהיר בוואטסאפ</span>
              </button>

              <a
                href="tel:0501234567"
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>התקשר למוקד השירות: 050-1234567</span>
              </a>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>ימים א׳-ה׳ 08:30-18:00</span>
              </span>
              <span>פרויקט #{projectId}</span>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
