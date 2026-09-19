import React, { useState } from 'react';
import {
  ArrowLeft,
  LayoutDashboard,
  ShieldCheck,
  FolderOpen,
  Clock,
  Activity,
  Sparkles,
  Lock,
  Unlock,
  Eye,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Copy,
  Check,
  Send,
  Trash2,
  RotateCcw,
  ExternalLink,
  FileText,
  Building2,
  User,
  Phone,
  Mail,
  Palette,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { ClientFirestoreDoc, DiscoveryData, ProjectStatus, UploadedFile, StepKey } from '../../types';
import { firebaseDiscoveryService } from '../../services/firebaseDiscoveryService';
import { generateAiAssets, AiGeneratedAssets } from '../../services/aiGenerator';

interface AdminProjectViewProps {
  client: ClientFirestoreDoc;
  onBackToTable: () => void;
  onEditInPortal: (data: DiscoveryData) => void;
  onStatusChange: (newStatus: ProjectStatus) => Promise<void>;
  onToggleLock: () => Promise<void>;
  onPublishUpdate: (title: string, desc: string) => Promise<void>;
  onSoftDeleteFile: (file: UploadedFile) => Promise<void>;
  onRestoreFile: (file: UploadedFile) => Promise<void>;
  onPermanentDeleteFile: (file: UploadedFile) => Promise<void>;
  notificationMsg: string | null;
}

export const AdminProjectView: React.FC<AdminProjectViewProps> = ({
  client,
  onBackToTable,
  onEditInPortal,
  onStatusChange,
  onToggleLock,
  onPublishUpdate,
  onSoftDeleteFile,
  onRestoreFile,
  onPermanentDeleteFile,
  notificationMsg,
}) => {
  const [activeTab, setActiveTab] = useState<
    'discovery_answers' | 'status_control' | 'files' | 'timeline' | 'audit_log' | 'ai_assets'
  >('discovery_answers');

  const [updateTitle, setUpdateTitle] = useState('');
  const [updateDesc, setUpdateDesc] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const stats = firebaseDiscoveryService.calculateDiscoveryStats(client.data);
  const aiAssets: AiGeneratedAssets = generateAiAssets(client.data);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateTitle.trim() || !updateDesc.trim()) return;
    setIsPublishing(true);
    await onPublishUpdate(updateTitle.trim(), updateDesc.trim());
    setUpdateTitle('');
    setUpdateDesc('');
    setIsPublishing(false);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6" id="admin-project-view">
      {/* Top Breadcrumb & Action Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            id="admin-back-to-table-btn"
            onClick={onBackToTable}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>חזרה לטבלת הלקוחות</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">
                {client.businessName?.trim() || 'לא הוזן'}
              </h2>
              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-lg">
                #{client.projectId}
              </span>
              {client.isLocked ? (
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <Lock className="w-3 h-3" /> נעול
                </span>
              ) : (
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <Unlock className="w-3 h-3" /> פתוח לעריכה
                </span>
              )}
            </div>

            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
              <span>איש קשר: <strong className="text-slate-800">{client.customerName?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</strong></span>
              {client.phone && <span>טלפון: <strong className="text-slate-800 font-mono">{client.phone}</strong></span>}
              {client.email && <span>אימייל: <strong className="text-slate-800 font-mono">{client.email}</strong></span>}
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                {stats.progressPercentage}% הושלם
              </span>
            </div>
          </div>
        </div>

        {/* Action Button: Edit in Client Portal */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            id="admin-edit-in-portal-btn"
            onClick={() => onEditInPortal(client.data)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>פתח שאלון לקוח בפורטל</span>
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {notificationMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* Tabs Navigation for Selected Project */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3" id="admin-project-tabs">
        <button
          type="button"
          id="tab-discovery-answers"
          onClick={() => setActiveTab('discovery_answers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'discovery_answers'
              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/90 shadow-2xs'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>תשובות שאלון האפיון המלאות (9 שלבים)</span>
        </button>

        <button
          type="button"
          id="tab-status-control"
          onClick={() => setActiveTab('status_control')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'status_control'
              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/90 shadow-2xs'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>ניהול סטטוס, נעילה ועדכון לקוח</span>
        </button>

        <button
          type="button"
          id="tab-files"
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'files'
              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/90 shadow-2xs'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>קבצי Storage וסל מיחזור ({(client.uploadedFiles?.length || 0) + (client.trashFiles?.length || 0)})</span>
        </button>

        <button
          type="button"
          id="tab-timeline"
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'timeline'
              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/90 shadow-2xs'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>ציר זמן לפרויקט (Timeline)</span>
        </button>

        <button
          type="button"
          id="tab-audit-log"
          onClick={() => setActiveTab('audit_log')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'audit_log'
              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/90 shadow-2xs'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-cyan-600" />
          <span>יומן ביקורת (Audit Log) ({client.auditLog?.length || 0})</span>
        </button>

        <button
          type="button"
          id="tab-ai-assets"
          onClick={() => setActiveTab('ai_assets')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'ai_assets'
              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/90 shadow-2xs'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>תוצרי AI וקופירייטינג</span>
        </button>
      </div>

      {/* TAB 1: FULL DISCOVERY ANSWERS (All 9 steps inspection) */}
      {activeTab === 'discovery_answers' && (
        <div className="space-y-6">
          {/* Summary Banner & Missing Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 space-y-2.5">
              <div className="text-xs font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>שאלות חסרות באפיון ({stats.missingAnswers.length}):</span>
              </div>
              {stats.missingAnswers.length === 0 ? (
                <div className="text-xs text-emerald-800 font-bold bg-white/80 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  כל שאלות האפיון מולאו במלואן על ידי הלקוח! 🎉
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                  {stats.missingAnswers.map((m, i) => (
                    <span
                      key={i}
                      className="text-[11px] bg-white text-amber-950 border border-amber-200 font-semibold px-2.5 py-1 rounded-lg shadow-2xs"
                    >
                      שלב {m.step}: {m.labelHebrew}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-2.5">
              <div className="text-xs font-bold text-indigo-950 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-indigo-600" />
                <span>קבצי ענן וגרפיקה ({client.uploadedFiles?.length || 0} קבצים ב-Storage):</span>
              </div>
              {stats.missingFiles.length === 0 ? (
                <div className="text-xs text-emerald-800 font-bold bg-white/80 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  הועלו לוגו ותמונות עסק בהצלחה.
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs text-slate-600 font-medium">קבצים שעדיין חסרים להשלמת האתר:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.missingFiles.map((f, i) => (
                      <span
                        key={i}
                        className="text-[11px] bg-white text-rose-800 border border-rose-200 font-bold px-2.5 py-1 rounded-lg shadow-2xs"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 9 Steps Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Step 1: Business Identity */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-extrabold flex items-center justify-center">1</span>
                  <span>זהות העסק (Business Identity)</span>
                </h4>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">שם העסק:</span>{' '}
                  <strong className="text-slate-900">{client.data.businessName?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">שם בעל/ת העסק:</span>{' '}
                  <strong className="text-slate-900">{client.data.ownerName?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">אימייל ראשי:</span>{' '}
                  <span className="font-mono text-slate-800">{client.data.email?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 font-medium">טלפון ראשי:</span>{' '}
                    <span className="font-mono text-slate-800">{client.data.phone?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">וואטסאפ:</span>{' '}
                    <span className="font-mono text-slate-800">{client.data.whatsapp?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">תחום עיסוק וקטגוריה:</span>{' '}
                  <strong className="text-slate-900">{client.data.businessCategory?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</strong>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 font-medium">ותק ושנות פעילות:</span>{' '}
                    <span className="text-slate-800">{client.data.yearsInBusiness?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">מיקום גיאוגרפי:</span>{' '}
                    <span className="text-slate-800">{client.data.location?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">משפט מפתח או סלוגן (Tagline):</span>{' '}
                  <span className="text-indigo-900 font-semibold">{client.data.tagline?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div className="pt-1.5 border-t border-slate-100">
                  <span className="text-slate-500 block font-medium mb-1">הסיפור של העסק והחזון:</span>
                  <div className="bg-slate-50 p-2.5 rounded-xl text-slate-800 leading-relaxed border border-slate-200/70">
                    {client.data.businessStory?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Customers & Pain Points */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-extrabold flex items-center justify-center">2</span>
                  <span>קהל יעד, כאבים ורצונות</span>
                </h4>
              </div>
              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block mb-0.5">1. מי הלקוח האידיאלי:</span>
                  <div className="bg-slate-50 p-2 rounded-lg text-slate-900 border border-slate-200/60 font-medium">
                    {client.data.idealCustomer?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block mb-0.5">2. הבעיה או הכאב הדחוף:</span>
                  <div className="bg-slate-50 p-2 rounded-lg text-slate-800 border border-slate-200/60">
                    {client.data.customerProblem?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block mb-0.5">3. התוצאה המושלמת והרצון:</span>
                  <div className="bg-slate-50 p-2 rounded-lg text-slate-800 border border-slate-200/60">
                    {client.data.customerDesire?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 font-medium block mb-0.5">4. ממה הם חוששים:</span>
                    <div className="bg-slate-50 p-2 rounded-lg text-slate-800 border border-slate-200/60">
                      {client.data.customerFears?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block mb-0.5">5. מה עוצר אותם מלקנות:</span>
                    <div className="bg-slate-50 p-2 rounded-lg text-slate-800 border border-slate-200/60">
                      {client.data.customerObstacles?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Services & Products */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-extrabold flex items-center justify-center">3</span>
                  <span>השירותים והמוצרים ({client.data.services?.filter((s) => s.name?.trim()).length || 0})</span>
                </h4>
              </div>
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {(!client.data.services || client.data.services.filter((s) => s.name?.trim()).length === 0) ? (
                  <p className="text-xs text-slate-400 py-2">לא הוזן</p>
                ) : (
                  client.data.services
                    .filter((svc) => svc.name?.trim() || svc.problemSolved?.trim())
                    .map((svc, idx) => (
                      <div key={svc.id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <div className="font-bold text-slate-900 flex items-center justify-between">
                          <span>#{idx + 1}. {svc.name?.trim() || 'שירות ללא שם'}</span>
                          {svc.priceEstimate?.trim() && (
                            <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              {svc.priceEstimate}
                            </span>
                          )}
                        </div>
                        <div><strong className="text-slate-600 font-medium">הבעיה שנפתרת:</strong> <span className="text-slate-800">{svc.problemSolved?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span></div>
                        <div><strong className="text-slate-600 font-medium">תוצאה וערך:</strong> <span className="text-slate-800">{svc.resultReceived?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span></div>
                        {svc.whyValuable?.trim() && (
                          <div><strong className="text-slate-600 font-medium">למה זה כדאי:</strong> <span className="text-slate-800">{svc.whyValuable}</span></div>
                        )}
                        {svc.targetAudience?.trim() && (
                          <div><strong className="text-slate-600 font-medium">קהל יעד:</strong> <span className="text-slate-800">{svc.targetAudience}</span></div>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Step 4: Competitive Advantage */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-extrabold flex items-center justify-center">4</span>
                  <span>היתרון התחרותי והייחודיות</span>
                </h4>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">1. למה לבחור דווקא בכם:</span>{' '}
                  <span className="text-slate-800">{client.data.whyChooseYou?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">2. הבידול הייחודי מהמתחרים:</span>{' '}
                  <span className="text-slate-800">{client.data.uniqueDifferentiator?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">3. הבטחות ללקוח:</span>{' '}
                  <span className="text-slate-800">{client.data.corePromises?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">4. הוכחה חברתית ומוניטין:</span>{' '}
                  <span className="text-slate-800">{client.data.socialProof?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">5. אחריות ובטחונות:</span>{' '}
                  <span className="text-slate-800">{client.data.guarantees?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">6. ניסיון ורקע מקצועי:</span>{' '}
                  <span className="text-slate-800">{client.data.experienceSummary?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">7. פרסים ותעודות הצטיינות:</span>{' '}
                  <span className="text-slate-800">{client.data.awardsAndCertifications?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
              </div>
            </div>

            {/* Step 5: Brand Style & Visuals */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-extrabold flex items-center justify-center">5</span>
                  <span>שפה מיתוגית ועיצוב ויזואלי</span>
                </h4>
              </div>
              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">סגנון עיצובי נבחר:</span>{' '}
                  <strong className="text-slate-900">{client.data.brandStyle?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</strong>
                </div>
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="text-slate-500 font-medium">2 צבעי מותג מובילים:</span>
                  {client.data.brandColors?.primary || client.data.brandColors?.secondary ? (
                    <div className="flex items-center gap-2">
                      {client.data.brandColors?.primary && (
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs inline-block"
                            style={{ backgroundColor: client.data.brandColors.primary }}
                          />
                          <span className="font-mono text-[11px] font-bold text-slate-800">{client.data.brandColors.primary}</span>
                        </div>
                      )}
                      {client.data.brandColors?.secondary && (
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs inline-block"
                            style={{ backgroundColor: client.data.brandColors.secondary }}
                          />
                          <span className="font-mono text-[11px] font-bold text-slate-800">{client.data.brandColors.secondary}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 font-normal">לא הוזן</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 font-medium">סטטוס לוגו:</span>{' '}
                  <span className="text-slate-800 font-semibold">
                    {client.data.logoStatus === 'has_logo'
                      ? 'יש לוגו קיים (מועלה בשלב הקבצים)'
                      : client.data.logoStatus === 'needs_refresh'
                      ? 'יש לוגו אבל דרוש שדרוג וריענון'
                      : client.data.logoStatus === 'needs_new_logo'
                      ? 'אין לוגו כלל (דרוש עיצוב חדש)'
                      : <span className="text-slate-400 font-normal">לא הוזן</span>}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block mb-1">אופי ואישיות המותג:</span>
                  {client.data.brandPersonality && client.data.brandPersonality.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {client.data.brandPersonality.map((trait) => (
                        <span key={trait} className="px-2.5 py-0.5 bg-slate-100 text-slate-800 font-semibold rounded-lg text-[11px] border border-slate-200">
                          {trait}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 font-normal">לא הוזן</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-500 font-medium block">סגנון פונטים:</span>
                    <span className="text-slate-800">{client.data.fontStyle?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">אתרים להשראה:</span>
                    <span className="text-slate-800">{client.data.inspirationWebsites?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 6: Uploaded Files */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-extrabold flex items-center justify-center">6</span>
                  <span>העלאת קבצים וחומרי גלם ({client.uploadedFiles?.length || 0}/10)</span>
                </h4>
              </div>
              <div className="space-y-2 text-xs">
                {(!client.uploadedFiles || client.uploadedFiles.length === 0) ? (
                  <p className="text-xs text-slate-400 py-2">לא הוזן</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {client.uploadedFiles.map((f) => (
                      <div key={f.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-100 shrink-0">
                            {f.categoryLabelHebrew || f.category}
                          </span>
                          <span className="truncate text-slate-800 font-medium" title={f.name}>{f.name}</span>
                        </div>
                        {f.downloadUrl ? (
                          <a
                            href={f.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold shrink-0 flex items-center gap-0.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>פתח</span>
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Step 7: Digital Presence & Technical */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3 shadow-xs md:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-extrabold flex items-center justify-center">7</span>
                  <span>נוכחות דיגיטלית ופרטים טכניים</span>
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block">סטטוס דומיין:</span>
                  <strong className="text-slate-900 font-mono">
                    {client.data.hasExistingDomain === true
                      ? `דומיין קיים: ${client.data.existingDomain?.trim() || 'לא הוזן שם הדומיין'}`
                      : client.data.hasExistingDomain === false
                      ? 'אין דומיין (דרושה עזרה ברישום)'
                      : <span className="text-slate-400 font-normal">לא הוזן</span>}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">אימייל עסקי לתצוגה באתר:</span>
                  <span className="font-mono text-slate-800">{client.data.businessEmail?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">שעות פעילות:</span>
                  <span className="text-slate-800">{client.data.openingHours?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">דף פייסבוק עסקי:</span>
                  <span className="font-mono text-slate-800">{client.data.facebookUrl?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">אינסטגרם עסקי:</span>
                  <span className="font-mono text-slate-800">{client.data.instagramUrl?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">טיקטוק / לינקדאין:</span>
                  <span className="font-mono text-slate-800">{client.data.tiktokOrLinkedIn?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 font-medium block">כתובת פיזית מלאה:</span>
                  <span className="text-slate-800">{client.data.physicalAddress?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">קישור לגוגל מפות:</span>
                  <span className="font-mono text-slate-800 truncate block">{client.data.googleMapsUrl?.trim() || <span className="text-slate-400 font-normal">לא הוזן</span>}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STATUS MANAGEMENT & LOCK */}
      {activeTab === 'status_control' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>ניהול סטטוס פרויקט ונעילת שאלון</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                עדכון סטטוס מקפיץ את שלב הפרויקט בזמן אמת עבור הלקוח ב-Workspace.
              </p>
            </div>

            <button
              type="button"
              id="admin-lock-toggle-btn"
              onClick={onToggleLock}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs ${
                client.isLocked
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              {client.isLocked ? (
                <>
                  <Lock className="w-4 h-4 text-white" />
                  <span>פרויקט נעול לעריכה (לחץ לשחרור)</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4 text-emerald-600" />
                  <span>פרויקט פתוח לעריכה (לחץ לנעילה)</span>
                </>
              )}
            </button>
          </div>

          {/* Status Selection Buttons */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-800 block">
              שלבי מחזור החיים של הפרויקט (Project Stages):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { id: 'in_discovery', title: '1. אפיון פעיל', desc: 'הלקוח ממלא שאלות' },
                { id: 'discovery_completed', title: '2. אפיון הושלם', desc: 'הועבר לצוות פייג׳לום' },
                { id: 'content_writing', title: '3. כתיבת תוכן', desc: 'קופירייטינג שיווקי' },
                { id: 'design', title: '4. עיצוב ממשק', desc: 'סקיצות ו-UI/UX' },
                { id: 'development', title: '5. פיתוח ובנייה', desc: 'קידוד והקמת אתר' },
                { id: 'testing', title: '6. בדיקות QA', desc: 'איכות ואבטחה' },
                { id: 'approved', title: '7. אושר ע״י לקוח', desc: 'אישור גרסה סופית' },
                { id: 'live', title: '8. האתר באוויר 🚀', desc: 'פרויקט פעיל והושלם' },
              ].map((stage) => {
                const isCurrent = (client.status || 'in_discovery') === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => onStatusChange(stage.id as ProjectStatus)}
                    className={`p-3.5 rounded-xl text-right border transition cursor-pointer flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-indigo-50/90 border-indigo-500 text-indigo-950 ring-2 ring-indigo-200 shadow-2xs font-bold'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{stage.title}</span>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block font-normal">
                      {stage.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Publish Project Update directly to Client Timeline */}
          <div className="pt-5 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-indigo-600" />
              <span>פרסום עדכון לפרויקט ישירות ל-Timeline של הלקוח</span>
            </h4>
            <form onSubmit={handlePublish} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  placeholder="כותרת העדכון (לדוגמה: הסתיימה כתיבת התוכן לאתר)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <input
                  type="text"
                  value={updateDesc}
                  onChange={(e) => setUpdateDesc(e.target.value)}
                  placeholder="פירוט קצר עבור הלקוח"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isPublishing || !updateTitle.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPublishing ? 'מפרסם...' : 'פרסם עדכון ללקוח'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: STORAGE FILES & TRASH BIN */}
      {activeTab === 'files' && (
        <div className="space-y-6">
          {/* Active Files Section */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-indigo-600" />
                  <span>קבצי Cloud Storage פעילים: clients/{client.projectId}/</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  קבצים שהועלו על ידי הלקוח וזמינים לפרויקט. מחיקה מכאן מבצעת Soft Delete לסל המיחזור.
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-50 text-slate-700 font-semibold px-3 py-1.5 rounded-lg border border-slate-200">
                {client.uploadedFiles?.length || 0} קבצים פעילים
              </span>
            </div>

            {(!client.uploadedFiles || client.uploadedFiles.length === 0) ? (
              <div className="text-center py-10 text-slate-400 space-y-2">
                <FolderOpen className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
                <div className="text-sm font-bold text-slate-600">אין קבצים פעילים בתיקיית הלקוח</div>
                <div className="text-xs text-slate-400">כאשר הלקוח יעלה קבצים, הם יופיעו כאן בזמן אמת.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {client.uploadedFiles.map((file) => {
                  const isImage = file.type?.startsWith('image/') || file.name.match(/\.(png|jpe?g|webp|gif|svg)$/i);
                  return (
                    <div
                      key={file.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                          {isImage && (file.thumbnailUrl || file.previewUrl || file.downloadUrl) ? (
                            <img
                              src={file.thumbnailUrl || file.previewUrl || file.downloadUrl}
                              alt={file.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <FileText className="w-6 h-6 text-indigo-600" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate" title={file.name}>
                            {file.name}
                          </h4>
                          <span className="inline-block text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded mt-1 border border-indigo-100">
                            {file.categoryLabelHebrew || file.category}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-1 font-mono">
                            {formatFileSize(file.size)} • {file.uploadedAt}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        {file.downloadUrl ? (
                          <a
                            href={file.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>פתח קובץ</span>
                          </a>
                        ) : <span />}

                        <button
                          type="button"
                          onClick={() => onSoftDeleteFile(file)}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
                          title="העבר לסל המיחזור (Soft Delete)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>העבר לאשפה</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trash Bin Section */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-500" />
                <h4 className="font-bold text-sm text-slate-900">סל מיחזור (Trash Bin - Soft Deleted Files)</h4>
              </div>
              <span className="text-xs font-mono text-slate-500 font-semibold">
                {client.trashFiles?.length || 0} קבצים בסל המיחזור
              </span>
            </div>

            {(!client.trashFiles || client.trashFiles.length === 0) ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                סל המיחזור ריק. שום קובץ לא נמחק.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {client.trashFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-white border border-rose-200 rounded-xl p-3 flex flex-col justify-between space-y-2 shadow-2xs"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                        {file.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        נמחק ב: {file.deletedAt || file.uploadedAt} • {formatFileSize(file.size)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <button
                        type="button"
                        onClick={() => onRestoreFile(file)}
                        className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>שחזר</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onPermanentDeleteFile(file)}
                        className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>מחק לצמיתות</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                <span>ציר זמן ויומן פעילות הלקוח (Timeline)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                תיעוד כרונולוגי של שלבי הפרויקט ועדכוני סטטוס
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono font-semibold">
              פעילות אחרונה: {client.lastActive || 'עכשיו'}
            </span>
          </div>

          <div className="relative pr-6 border-r-2 border-slate-200 space-y-6 pt-2">
            {(client.timeline || []).map((entry, idx) => (
              <div key={entry.id || idx} className="relative group">
                <div className="absolute -right-[31px] top-1 w-4 h-4 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{entry.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{entry.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{entry.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOG */}
      {activeTab === 'audit_log' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-600" />
                <span>יומן ביקורת מאובטח (Audit Log)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                תיעוד אוטומטי של אירועים קריטיים: שינוי סטטוס, העלאת קבצים, מחיקות ושחזורים
              </p>
            </div>
            <span className="text-xs font-mono bg-cyan-50 text-cyan-800 font-bold px-3 py-1.5 rounded-lg border border-cyan-200">
              {client.auditLog?.length || 0} רשומות
            </span>
          </div>

          {(!client.auditLog || client.auditLog.length === 0) ? (
            <div className="text-center py-10 text-slate-400">
              אין רשומות ביקורת עדיין עבור פרויקט זה.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {client.auditLog.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{log.description}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-white text-cyan-700 border border-cyan-200 font-bold">
                        {log.action}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      בוצע ע״י: <strong className="text-slate-800">{log.performedByName || log.performedBy}</strong>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-mono shrink-0">
                    {log.timestamp}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: AI ASSETS & BLUEPRINTS */}
      {activeTab === 'ai_assets' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-white border border-indigo-200/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>PageLoom AI Blueprint Engine</span>
              </div>
              <h3 className="text-lg font-black text-slate-900">
                תוצרי AI מוכנים לבניית אתר, דף נחיתה וקופירייטינג
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                כל הנתונים מומרים לפרומפטים מדויקים, כותרות ממירות וקוד סכמה – מבלי לשאול את הלקוח שוב!
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleCopy(aiAssets.landingPagePrompt, 'all_prompt')}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              {copiedKey === 'all_prompt' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>העתק פרומפט ראשי ל-Gemini</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Block 1 */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="font-bold text-sm text-slate-900">כותרות וקופירייטינג מוביל (Hero & Value Props)</h4>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `כותרת ראשית: ${aiAssets.heroHeadline}\nכותרת משנה: ${aiAssets.heroSubheadline}\nהנעה לפעולה: ${aiAssets.heroCta}`,
                      'hero'
                    )
                  }
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'hero' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>העתק</span>
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 block font-medium">כותרת ראשית (Hero Headline):</span>
                  <div className="bg-slate-50 p-2.5 rounded-lg text-indigo-900 font-bold mt-1 text-sm border border-slate-200">
                    {aiAssets.heroHeadline}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">כותרת משנה (Subheadline):</span>
                  <div className="bg-slate-50 p-2.5 rounded-lg text-slate-700 mt-1 leading-relaxed border border-slate-200">
                    {aiAssets.heroSubheadline}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">כפתור הנעה לפעולה (CTA):</span>
                  <div className="bg-slate-50 p-2 rounded-lg text-emerald-700 font-bold mt-1 border border-slate-200">
                    {aiAssets.heroCta}
                  </div>
                </div>
              </div>
            </div>

            {/* Block 2 */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="font-bold text-sm text-slate-900">חבילת SEO ותגיות מטא</h4>
                <button
                  type="button"
                  onClick={() => handleCopy(aiAssets.seoPackage.schemaJson, 'schema')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'schema' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>העתק Schema JSON</span>
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 block">Meta Title:</span>
                  <div className="bg-slate-50 p-2 rounded-lg text-slate-800 font-mono text-[11px] mt-1 truncate border border-slate-200">
                    {aiAssets.seoPackage.metaTitle}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block">Meta Description:</span>
                  <div className="bg-slate-50 p-2 rounded-lg text-slate-700 mt-1 leading-relaxed border border-slate-200">
                    {aiAssets.seoPackage.metaDescription}
                  </div>
                </div>
              </div>
            </div>

            {/* Block 3 */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3 lg:col-span-2 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="font-bold text-sm text-slate-900">תקציר אפיון מנהלים מלא (Executive Summary)</h4>
                <button
                  type="button"
                  onClick={() => handleCopy(aiAssets.businessSummary, 'exec')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'exec' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>העתק הכל</span>
                </button>
              </div>

              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto border border-slate-800">
                {aiAssets.businessSummary}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
