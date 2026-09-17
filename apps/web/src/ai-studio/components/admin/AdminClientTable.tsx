import React, { useState, useMemo } from 'react';
import {
  Search,
  Copy,
  Check,
  FolderOpen,
  Lock,
  Unlock,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  Building2,
  User,
  Phone,
  Mail,
  FileCheck,
  AlertCircle,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { ClientFirestoreDoc, ProjectStatus, DiscoveryData } from '../../types';

interface AdminClientTableProps {
  clients: ClientFirestoreDoc[];
  activeFilter: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectFilter: (f: string) => void;
  onOpenProject: (client: ClientFirestoreDoc) => void;
  onToggleLock: (projectId: string, currentLock: boolean) => Promise<void>;
  onQuickStatusChange?: (projectId: string, newStatus: ProjectStatus) => Promise<void>;
  onRefresh?: () => void;
}

export const AdminClientTable: React.FC<AdminClientTableProps> = ({
  clients,
  activeFilter,
  searchQuery,
  onSearchChange,
  onSelectFilter,
  onOpenProject,
  onToggleLock,
  onQuickStatusChange,
  onRefresh,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'businessName' | 'progress' | 'lastActive'>('lastActive');
  const [sortAsc, setSortAsc] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status?: ProjectStatus) => {
    switch (status) {
      case 'in_discovery':
        return {
          label: '1. אפיון בתהליך מילוי',
          className: 'bg-amber-50 text-amber-900 border-amber-200/90',
          dotClass: 'bg-amber-500',
        };
      case 'discovery_completed':
        return {
          label: '2. אפיון הושלם בהצלחה',
          className: 'bg-indigo-50 text-indigo-900 border-indigo-200/90',
          dotClass: 'bg-indigo-600',
        };
      case 'content_writing':
        return {
          label: '3. כתיבת תוכן שיווקי',
          className: 'bg-purple-50 text-purple-900 border-purple-200/90',
          dotClass: 'bg-purple-600',
        };
      case 'design':
        return {
          label: '4. עיצוב ממשק (UI/UX)',
          className: 'bg-blue-50 text-blue-900 border-blue-200/90',
          dotClass: 'bg-blue-600',
        };
      case 'development':
        return {
          label: '5. פיתוח ובניית אתר',
          className: 'bg-cyan-50 text-cyan-900 border-cyan-200/90',
          dotClass: 'bg-cyan-600',
        };
      case 'testing':
        return {
          label: '6. בדיקות איכות (QA)',
          className: 'bg-orange-50 text-orange-900 border-orange-200/90',
          dotClass: 'bg-orange-500',
        };
      case 'approved':
        return {
          label: '7. ממתין לאישור לקוח',
          className: 'bg-teal-50 text-teal-900 border-teal-200/90',
          dotClass: 'bg-teal-600',
        };
      case 'domain_setup':
        return {
          label: '8. חיבור דומיין ו-SSL',
          className: 'bg-sky-50 text-sky-900 border-sky-200/90',
          dotClass: 'bg-sky-600',
        };
      case 'live':
        return {
          label: '9. האתר באוויר 🚀',
          className: 'bg-emerald-50 text-emerald-900 border-emerald-200/90',
          dotClass: 'bg-emerald-600',
        };
      default:
        return {
          label: 'אפיון פעיל',
          className: 'bg-slate-100 text-slate-800 border-slate-200',
          dotClass: 'bg-slate-500',
        };
    }
  };

  // Filter clients based on search query & active category filter
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (c.businessName || '').toLowerCase().includes(q) ||
        (c.customerName || '').toLowerCase().includes(q) ||
        (c.projectId || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.data?.businessCategory || '').toLowerCase().includes(q);

      let matchesFilter = true;
      if (activeFilter === 'active') {
        matchesFilter = c.status !== 'live';
      } else if (activeFilter === 'waiting_client') {
        matchesFilter =
          c.status === 'in_discovery' ||
          c.status === 'approved' ||
          (c.missingAnswersCount !== undefined && c.missingAnswersCount > 0);
      } else if (activeFilter === 'waiting_pageloom') {
        matchesFilter =
          c.status === 'discovery_completed' ||
          c.status === 'content_writing' ||
          c.status === 'design' ||
          c.status === 'development' ||
          c.status === 'testing' ||
          c.status === 'domain_setup';
      } else if (activeFilter === 'completed') {
        matchesFilter = c.status === 'live' || !!c.data?.isCompleted;
      }

      return matchesSearch && matchesFilter;
    });
  }, [clients, searchQuery, activeFilter]);

  // Sort
  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      if (sortField === 'businessName') {
        const nameA = a.businessName || '';
        const nameB = b.businessName || '';
        return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      if (sortField === 'progress') {
        const pA = a.progressPercentage || 0;
        const pB = b.progressPercentage || 0;
        return sortAsc ? pA - pB : pB - pA;
      }
      // default: lastActive or updatedAt
      const dateA = new Date(a.updatedAt || 0).getTime();
      const dateB = new Date(b.updatedAt || 0).getTime();
      return sortAsc ? dateA - dateB : dateB - dateA;
    });
  }, [filteredClients, sortField, sortAsc]);

  const toggleSort = (field: 'businessName' | 'progress' | 'lastActive') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden" id="admin-clients-table-container">
      {/* Table Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 bg-slate-50/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0 shadow-2xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <span>טבלת ניהול כל הלקוחות והפרויקטים</span>
              <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200/70">
                {sortedClients.length} לקוחות
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              צפייה מרוכזת בכל מסמכי האפיון והפרויקטים ב-Firestore בזמן אמת
            </p>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="admin-clients-search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="חיפוש לפי עסק, שם, #ID, טלפון..."
              className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs transition"
            />
          </div>

          {/* Quick Filter Select */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <select
              id="admin-filter-select"
              value={activeFilter}
              onChange={(e) => onSelectFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-bold py-2 px-3 shadow-2xs focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">כל הלקוחות ({clients.length})</option>
              <option value="active">פרויקטים פעילים</option>
              <option value="waiting_client">ממתין ללקוח</option>
              <option value="waiting_pageloom">ממתין לפייג׳לום</option>
              <option value="completed">פרויקטים שהושלמו</option>
            </select>

            {onRefresh && (
              <button
                type="button"
                id="admin-table-refresh-btn"
                onClick={onRefresh}
                title="רענן נתונים"
                className="p-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition shadow-2xs cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs" id="admin-clients-table">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              {/* Column 1: Business Name */}
              <th
                scope="col"
                className="py-3.5 px-4 sm:px-6 cursor-pointer hover:text-indigo-600 transition"
                onClick={() => toggleSort('businessName')}
              >
                <div className="flex items-center gap-1.5">
                  <span>שם העסק ואיש קשר</span>
                  <span className="text-[10px] text-slate-400 font-normal font-mono">(Business Name)</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                </div>
              </th>

              {/* Column 2: Project ID */}
              <th scope="col" className="py-3.5 px-4">
                <div className="flex items-center gap-1.5">
                  <span>מזהה פרויקט</span>
                  <span className="text-[10px] text-slate-400 font-normal font-mono">(Project ID)</span>
                </div>
              </th>

              {/* Column 3: Current Status */}
              <th scope="col" className="py-3.5 px-4">
                <div className="flex items-center gap-1.5">
                  <span>סטטוס נוכחי</span>
                  <span className="text-[10px] text-slate-400 font-normal font-mono">(Current Status)</span>
                </div>
              </th>

              {/* Column 4: Progress */}
              <th
                scope="col"
                className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition"
                onClick={() => toggleSort('progress')}
              >
                <div className="flex items-center gap-1.5">
                  <span>התקדמות אפיון</span>
                  <span className="text-[10px] text-slate-400 font-normal font-mono">(Progress)</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                </div>
              </th>

              {/* Column 5: Last Activity */}
              <th
                scope="col"
                className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition"
                onClick={() => toggleSort('lastActive')}
              >
                <div className="flex items-center gap-1.5">
                  <span>פעילות אחרונה</span>
                  <span className="text-[10px] text-slate-400 font-normal font-mono">(Last Activity)</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                </div>
              </th>

              {/* Column 6: Action */}
              <th scope="col" className="py-3.5 px-4 sm:px-6 text-center">
                <span>פעולה</span>
                <span className="text-[10px] text-slate-400 font-normal font-mono block">(Open Project)</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {sortedClients.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="max-w-sm mx-auto space-y-3">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                    <div className="font-bold text-slate-600 text-sm">
                      לא נמצאו לקוחות התואמים לחיפוש
                    </div>
                    <p className="text-xs text-slate-400">
                      נסה לשנות את מונח החיפוש או לבחור בסינון "כל הלקוחות".
                    </p>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => onSearchChange('')}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold rounded-lg text-xs cursor-pointer hover:bg-indigo-100 transition"
                      >
                        איפוס חיפוש
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              sortedClients.map((client) => {
                const statusInfo = getStatusBadge(client.status);
                const progressPct = client.progressPercentage || 0;
                const currentStepNum = client.currentStep || (client.completedSteps?.length ? Math.max(...client.completedSteps) : 1);
                const isLocked = !!client.isLocked;

                return (
                  <tr
                    key={client.projectId}
                    id={`client-row-${client.projectId}`}
                    className="hover:bg-indigo-50/30 transition duration-150 group"
                  >
                    {/* Column 1: Business Name */}
                    <td className="py-4 px-4 sm:px-6">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition">
                          {((client.businessName || client.data?.businessName || 'ע')[0]).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm truncate">
                              {(client.businessName || client.data?.businessName)?.trim() || 'עסק חדש'}
                            </span>
                            {isLocked && (
                              <span
                                title="הפרויקט נעול לעריכת לקוח"
                                className="inline-flex items-center text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded text-[10px] font-bold"
                              >
                                <Lock className="w-3 h-3 ml-0.5" />
                                נעול
                              </span>
                            )}
                          </div>

                          <div className="text-slate-500 text-[11px] mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <User className="w-3 h-3 text-slate-400" />
                              {(client.customerName || client.data?.ownerName)?.trim() || 'לא הוזן'}
                            </span>
                            {(client.phone || client.email || client.data?.phone || client.data?.email) && (
                              <span className="flex items-center gap-1 text-slate-500 font-mono text-[10px]">
                                {client.phone || client.data?.phone ? (
                                  <>
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    {client.phone || client.data?.phone}
                                  </>
                                ) : (
                                  <>
                                    <Mail className="w-3 h-3 text-slate-400" />
                                    {client.email || client.data?.email}
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Project ID */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50/70 border border-indigo-200/80 px-2.5 py-1 rounded-lg">
                          #{client.projectId}
                        </span>
                        <button
                          type="button"
                          id={`copy-id-${client.projectId}`}
                          onClick={() => handleCopy(client.projectId, client.projectId)}
                          title="העתק מזהה פרויקט"
                          className="p-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                        >
                          {copiedId === client.projectId ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Column 3: Current Status */}
                    <td className="py-4 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs">
                        <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                        <span className={statusInfo.className.split(' ')[1] || 'text-slate-800'}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </td>

                    {/* Column 4: Progress */}
                    <td className="py-4 px-4 min-w-[150px]">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span
                            className={
                              progressPct === 100
                                ? 'text-emerald-700'
                                : progressPct >= 60
                                ? 'text-indigo-700'
                                : 'text-amber-800'
                            }
                          >
                            {progressPct}% הושלם
                          </span>
                          <span className="text-slate-400 text-[10px] font-mono">
                            שלב {currentStepNum}/9
                          </span>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/80">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              progressPct === 100
                                ? 'bg-emerald-500'
                                : progressPct >= 60
                                ? 'bg-indigo-600'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.max(5, progressPct)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Column 5: Last Activity */}
                    <td className="py-4 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{client.lastActive || 'עכשיו'}</span>
                        </div>
                        {client.uploadedFiles && client.uploadedFiles.length > 0 && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            {client.uploadedFiles.length} קבצים ב-Storage
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Column 6: Open Project Button */}
                    <td className="py-4 px-4 sm:px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          id={`btn-open-project-${client.projectId}`}
                          onClick={() => onOpenProject(client)}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-98"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>פתח פרויקט</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-2 font-medium">
          <span>מציג {sortedClients.length} מתוך {clients.length} לקוחות רשומים</span>
          <span className="text-slate-300">•</span>
          <span className="text-emerald-700 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            סנכרון רציף עם Cloud Firestore
          </span>
        </div>

        <div className="text-slate-400 text-[11px]">
          לחיצה על <strong>״פתח פרויקט״</strong> תטען את כל נתוני האפיון, השאלות והקבצים עבור אותו לקוח.
        </div>
      </div>
    </div>
  );
};
