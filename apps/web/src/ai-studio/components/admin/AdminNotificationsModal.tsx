import React from 'react';
import {
  Bell,
  X,
  Clock,
  User,
  CheckCircle2,
  FileText,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import { ClientFirestoreDoc, AuditLogEntry } from '../../types';

interface AdminNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: ClientFirestoreDoc[];
  onSelectClient: (client: ClientFirestoreDoc) => void;
}

export const AdminNotificationsModal: React.FC<AdminNotificationsModalProps> = ({
  isOpen,
  onClose,
  clients,
  onSelectClient,
}) => {
  if (!isOpen) return null;

  // Aggregate all events from all clients
  const allEvents: {
    client: ClientFirestoreDoc;
    event: {
      id: string;
      title: string;
      description: string;
      timestamp: string;
      type: string;
    };
  }[] = [];

  clients.forEach((c) => {
    (c.timeline || []).forEach((t) => {
      allEvents.push({
        client: c,
        event: t,
      });
    });
    (c.auditLog || []).forEach((a) => {
      allEvents.push({
        client: c,
        event: {
          id: a.id,
          title: a.details,
          description: `בוצע ע״י: ${a.performedByName || a.performedBy}`,
          timestamp: a.timestamp,
          type: a.action,
        },
      });
    });
  });

  // Unique and slice top 30
  const uniqueEvents = Array.from(
    new Map(allEvents.map((item) => [item.event.id + item.client.projectId, item])).values()
  ).slice(0, 30);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
      dir="rtl"
      id="admin-notifications-modal"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-2xs border border-rose-100">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                מרכז התראות ופעילות מערכת בזמן אמת
              </h3>
              <p className="text-xs text-slate-500">
                אירועי אפיון, העלאות קבצים, והגשות של לקוחות
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-100">
          {uniqueEvents.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              אין התראות חדשות כעת.
            </div>
          ) : (
            uniqueEvents.map((item, idx) => (
              <div
                key={idx}
                className="pt-2.5 first:pt-0 flex items-start justify-between gap-3 group hover:bg-slate-50 p-2.5 rounded-xl transition"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 mt-2 shrink-0" />
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">
                        {item.event.title}
                      </span>
                      <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded">
                        {item.client.businessName || 'עסק'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {item.event.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.event.timestamp}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectClient(item.client);
                      onClose();
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer opacity-80 group-hover:opacity-100"
                  >
                    <span>פתח</span>
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
