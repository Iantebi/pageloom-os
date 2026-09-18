import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Sparkles,
  ArrowLeft,
  Search,
  HardDrive,
  Activity,
  CheckCircle2,
  Bell,
  RefreshCw,
  Plus,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { ClientFirestoreDoc, DiscoveryData, ProjectStatus, UploadedFile } from '../types';
import { firebaseDiscoveryService } from '../services/firebaseDiscoveryService';
import { PageLoomLogo } from './PageLoomLogo';
import { AdminStatsCards, AdminStatsData } from './admin/AdminStatsCards';
import { AdminClientTable } from './admin/AdminClientTable';
import { AdminProjectView } from './admin/AdminProjectView';
import { AdminNotificationsModal } from './admin/AdminNotificationsModal';

interface AdminMasterProps {
  currentProject: DiscoveryData;
  onSelectProjectToEdit: (data: DiscoveryData) => void;
  onCloseAdmin: () => void;
}

export const AdminMaster: React.FC<AdminMasterProps> = ({
  currentProject,
  onSelectProjectToEdit,
  onCloseAdmin,
}) => {
  const [clients, setClients] = useState<ClientFirestoreDoc[]>([]);
  // The Admin landing page must NOT open a customer's questionnaire.
  // It starts on 'dashboard' (Main Clients Table + Stats).
  const [viewMode, setViewMode] = useState<'dashboard' | 'project_details'>('dashboard');
  const [selectedClient, setSelectedClient] = useState<ClientFirestoreDoc | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Subscribe to real-time Firestore clients collection
  useEffect(() => {
    const unsubscribe = firebaseDiscoveryService.subscribeAllClients((list) => {
      setClients(list);
    });

    return () => unsubscribe();
  }, []);

  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  // Compute 6 KPI Stats
  const statsData: AdminStatsData = useMemo(() => {
    const totalClients = clients.length;
    const activeProjects = clients.filter(
      (c) => c.status !== 'live'
    ).length;

    const waitingForClient = clients.filter(
      (c) =>
        c.status === 'in_discovery' ||
        c.status === 'approved' ||
        (c.missingAnswersCount !== undefined && c.missingAnswersCount > 0)
    ).length;

    const waitingForPageLoom = clients.filter(
      (c) =>
        c.status === 'discovery_completed' ||
        c.status === 'content_writing' ||
        c.status === 'design' ||
        c.status === 'development' ||
        c.status === 'testing' ||
        c.status === 'domain_setup'
    ).length;

    const projectsCompleted = clients.filter(
      (c) => c.status === 'live' || !!c.data?.isCompleted
    ).length;

    // Count recent timeline/audit logs as new notifications count
    let totalLogs = 0;
    clients.forEach((c) => {
      totalLogs += (c.auditLog?.length || 0) + (c.timeline?.length || 0);
    });
    const newNotifications = Math.min(24, totalLogs || clients.length);

    return {
      totalClients,
      activeProjects,
      waitingForClient,
      waitingForPageLoom,
      projectsCompleted,
      newNotifications,
    };
  }, [clients]);

  // When Admin clicks "Open Project" on a row
  const handleOpenProject = (client: ClientFirestoreDoc) => {
    setSelectedClient(client);
    setViewMode('project_details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle Status Change for Selected Project
  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (!selectedClient) return;
    await firebaseDiscoveryService.updateProjectStatus(selectedClient.projectId, newStatus);
    
    // Update local copy
    setSelectedClient((prev) => (prev ? { ...prev, status: newStatus } : null));
    showNotification(`סטטוס הפרויקט עודכן בהצלחה ל: ${newStatus}`);
  };

  // Toggle Lock
  const handleToggleLock = async () => {
    if (!selectedClient) return;
    const nextLocked = !selectedClient.isLocked;
    await firebaseDiscoveryService.setProjectLock(selectedClient.projectId, nextLocked);
    setSelectedClient((prev) => (prev ? { ...prev, isLocked: nextLocked } : null));
    showNotification(nextLocked ? 'הפרויקט ננעל בהצלחה לעריכת לקוח' : 'הפרויקט שוחרר לעריכה');
  };

  const handleTableToggleLock = async (projectId: string, currentLock: boolean) => {
    const nextLocked = !currentLock;
    await firebaseDiscoveryService.setProjectLock(projectId, nextLocked);
    showNotification(nextLocked ? 'הפרויקט ננעל לעריכה' : 'הפרויקט שוחרר לעריכה');
  };

  // Publish Update
  const handlePublishUpdate = async (title: string, desc: string) => {
    if (!selectedClient) return;
    await firebaseDiscoveryService.publishProjectUpdate(selectedClient.projectId, title, desc);
    showNotification('עדכון הפרויקט פורסם בהצלחה ללקוח');
  };

  // File Operations
  const handleSoftDelete = async (file: UploadedFile) => {
    if (!selectedClient) return;
    if (!window.confirm(`האם להעביר את הקובץ "${file.name}" לסל המיחזור (Soft Delete)?`)) return;
    await firebaseDiscoveryService.softDeleteFile(selectedClient.projectId, file.id, 'admin', 'צוות PageLoom');
    showNotification(`הקובץ "${file.name}" הועבר לסל המיחזור`);
  };

  const handleRestoreFile = async (file: UploadedFile) => {
    if (!selectedClient) return;
    await firebaseDiscoveryService.restoreFile(selectedClient.projectId, file.id, 'admin', 'צוות PageLoom');
    showNotification(`הקובץ "${file.name}" שוחזר בהצלחה`);
  };

  const handlePermanentDelete = async (file: UploadedFile) => {
    if (!selectedClient) return;
    if (!window.confirm(`אזהרה: האם למחוק לצמיתות את הקובץ "${file.name}" מסל המיחזור? פעולה זו בלתי הפיכה.`)) return;
    await firebaseDiscoveryService.permanentlyDeleteFile(selectedClient.projectId, file.id);
    showNotification(`הקובץ "${file.name}" נמחק לצמיתות`);
  };

  return (
    <div
      className="min-h-screen bg-[#f8fafc] bg-[radial-gradient(ellipse_80%_80%_at_50%_-15%,rgba(224,231,255,0.45),rgba(255,255,255,0))] text-slate-900 text-right pb-16 font-sans selection:bg-indigo-600 selection:text-white antialiased"
      dir="rtl"
      id="admin-master-root"
    >
      {/* Top Admin Management Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-xs" id="admin-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand & Mode */}
          <div className="flex items-center gap-3">
            <PageLoomLogo size={34} />
            <div>
              <div className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <span>PageLoom Admin Management System</span>
                <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2.5 py-0.5 rounded-full font-bold">
                  ADMIN CONSOLE
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                <span>מערכת ניהול ובקרת פרויקטים, אפיון לקוחות ו-AI</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Firestore Live
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Exit to Portal */}
          <div className="flex items-center gap-2.5">
            {/* Notifications Button */}
            <button
              type="button"
              id="admin-notifications-btn"
              onClick={() => setIsNotificationsOpen(true)}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition relative cursor-pointer shadow-2xs"
              title="התראות מערכת"
            >
              <Bell className="w-4 h-4" />
              {statsData.newNotifications > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {statsData.newNotifications > 9 ? '9+' : statsData.newNotifications}
                </span>
              )}
            </button>

            {/* Storage Info */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-mono text-[11px]">Storage: clients/</span>
            </div>

            {/* Back to Client Discovery Portal */}
            <button
              type="button"
              id="admin-exit-portal-btn"
              onClick={onCloseAdmin}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer active:scale-98"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>חזרה לפורטל הלקוח</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Workspace Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* VIEW 1: ADMIN HOME / DASHBOARD (Default Landing Page) */}
        {viewMode === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in" id="admin-dashboard-view">
            
            {/* Top 6 KPI Metric Cards */}
            <section aria-labelledby="kpi-heading">
              <h2 id="kpi-heading" className="sr-only">מדדי פעילות מרכזיים</h2>
              <AdminStatsCards
                stats={statsData}
                activeFilter={activeFilter}
                onSelectFilter={(filterKey) => setActiveFilter(filterKey)}
                onOpenNotifications={() => setIsNotificationsOpen(true)}
              />
            </section>

            {/* Main Section: Clients Table */}
            <section aria-labelledby="clients-table-heading">
              <h2 id="clients-table-heading" className="sr-only">טבלת כל הלקוחות</h2>
              <AdminClientTable
                clients={clients}
                activeFilter={activeFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSelectFilter={setActiveFilter}
                onOpenProject={handleOpenProject}
                onToggleLock={handleTableToggleLock}
                onRefresh={() => {
                  firebaseDiscoveryService.subscribeAllClients((list) => {
                    setClients(list);
                    showNotification('נתוני הלקוחות רועננו בהצלחה מ-Firestore');
                  });
                }}
              />
            </section>

          </div>
        )}

        {/* VIEW 2: SINGLE PROJECT MANAGEMENT WORKSPACE (When "Open Project" is clicked) */}
        {viewMode === 'project_details' && selectedClient && (
          <div className="animate-in fade-in" id="admin-project-detail-view">
            <AdminProjectView
              client={selectedClient}
              onBackToTable={() => setViewMode('dashboard')}
              onEditInPortal={(clientData) => {
                onSelectProjectToEdit(clientData);
                onCloseAdmin();
              }}
              onStatusChange={handleStatusChange}
              onToggleLock={handleToggleLock}
              onPublishUpdate={handlePublishUpdate}
              onSoftDeleteFile={handleSoftDelete}
              onRestoreFile={handleRestoreFile}
              onPermanentDeleteFile={handlePermanentDelete}
              notificationMsg={actionSuccessMsg}
            />
          </div>
        )}

      </main>

      {/* Notifications Modal */}
      <AdminNotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        clients={clients}
        onSelectClient={(c) => {
          handleOpenProject(c);
        }}
      />
    </div>
  );
};
