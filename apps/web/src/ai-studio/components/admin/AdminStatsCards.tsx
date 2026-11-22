import React from 'react';
import {
  Users,
  Activity,
  UserCheck,
  Briefcase,
  CheckCircle2,
  Bell,
  ArrowUpRight,
} from 'lucide-react';

export interface AdminStatsData {
  totalClients: number;
  activeProjects: number;
  waitingForClient: number;
  waitingForPageLoom: number;
  projectsCompleted: number;
  newNotifications: number;
}

interface AdminStatsCardsProps {
  stats: AdminStatsData;
  activeFilter: string;
  onSelectFilter: (filterKey: string) => void;
  onOpenNotifications?: () => void;
}

export const AdminStatsCards: React.FC<AdminStatsCardsProps> = ({
  stats,
  activeFilter,
  onSelectFilter,
  onOpenNotifications,
}) => {
  const cards = [
    {
      id: 'all',
      title: 'סה״כ לקוחות',
      titleEn: 'Total clients',
      count: stats.totalClients,
      subtitle: 'לקוחות רשומים במערכת',
      icon: Users,
      color: 'indigo',
      badge: 'Firestore DB',
      bgClass: 'hover:border-indigo-300',
      activeClass: 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/40',
      iconBg: 'bg-indigo-100 text-indigo-700',
    },
    {
      id: 'active',
      title: 'פרויקטים פעילים',
      titleEn: 'Active projects',
      count: stats.activeProjects,
      subtitle: 'בתהליך עבודה או אפיון',
      icon: Activity,
      color: 'blue',
      badge: 'בתהליך',
      bgClass: 'hover:border-blue-300',
      activeClass: 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/40',
      iconBg: 'bg-blue-100 text-blue-700',
    },
    {
      id: 'waiting_client',
      title: 'ממתין ללקוח',
      titleEn: 'Waiting for client',
      count: stats.waitingForClient,
      subtitle: 'מילוי שאלון / אישור גרסה',
      icon: UserCheck,
      color: 'amber',
      badge: 'דרוש מענה',
      bgClass: 'hover:border-amber-300',
      activeClass: 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/40',
      iconBg: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'waiting_pageloom',
      title: 'ממתין לפייג׳לום',
      titleEn: 'Waiting for PageLoom',
      count: stats.waitingForPageLoom,
      subtitle: 'קופירייטינג, עיצוב או פיתוח',
      icon: Briefcase,
      color: 'purple',
      badge: 'לטיפול הצוות',
      bgClass: 'hover:border-purple-300',
      activeClass: 'ring-2 ring-purple-500 border-purple-500 bg-purple-50/40',
      iconBg: 'bg-purple-100 text-purple-700',
    },
    {
      id: 'completed',
      title: 'פרויקטים שהושלמו',
      titleEn: 'Projects completed',
      count: stats.projectsCompleted,
      subtitle: 'אתרים באוויר ובסיום מלא',
      icon: CheckCircle2,
      color: 'emerald',
      badge: 'הושלמו 🚀',
      bgClass: 'hover:border-emerald-300',
      activeClass: 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/40',
      iconBg: 'bg-emerald-100 text-emerald-700',
    },
    {
      id: 'notifications',
      title: 'התראות חדשות',
      titleEn: 'New notifications',
      count: stats.newNotifications,
      subtitle: 'עדכונים ואירועים אחרונים',
      icon: Bell,
      color: 'rose',
      badge: 'חי בזמן אמת',
      bgClass: 'hover:border-rose-300',
      activeClass: 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/40',
      iconBg: 'bg-rose-100 text-rose-700',
      isAction: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5" id="admin-stats-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = activeFilter === card.id;

        return (
          <button
            key={card.id}
            id={`stat-card-${card.id}`}
            type="button"
            onClick={() => {
              if (card.isAction && onOpenNotifications) {
                onOpenNotifications();
              } else {
                onSelectFilter(card.id);
              }
            }}
            className={`text-right p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
              card.bgClass
            } ${isSelected ? card.activeClass : 'hover:shadow-xs'}`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-700 transition">
                  {card.title}
                </span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg} transition shadow-2xs`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {card.count}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 font-mono">
                  {card.titleEn}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
              <span className="text-slate-500 truncate">{card.subtitle}</span>
              <span className="font-semibold text-slate-400 group-hover:text-indigo-600 transition flex items-center">
                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
