import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Clock,
  Circle,
  Hourglass,
  FileText,
  UploadCloud,
  Download,
  Eye,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  Calendar,
  FolderOpen,
  Info,
  ExternalLink,
  X
} from 'lucide-react';
import { PageLoomLogo } from './PageLoomLogo';
import { DiscoveryData, ClientFirestoreDoc, UploadedFile, TimelineEntry } from '../types';
import { firebaseDiscoveryService } from '../services/firebaseDiscoveryService';
import { ImageThumbnail } from './common/ImageThumbnail';
import { ImageModalPreview } from './common/ImageModalPreview';

interface ClientWorkspaceProps {
  initialData?: DiscoveryData;
  onNavigateToDiscovery: () => void;
  onNavigateToAdmin?: () => void;
}

interface MilestoneStep {
  id: string;
  title: string;
  description?: string;
  status: 'completed' | 'in_progress' | 'upcoming';
}

export const ClientWorkspace: React.FC<ClientWorkspaceProps> = ({
  initialData,
  onNavigateToDiscovery,
  onNavigateToAdmin,
}) => {
  const [projectDoc, setProjectDoc] = useState<ClientFirestoreDoc | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectId =
    initialData?.projectId ||
    projectDoc?.projectId ||
    (typeof window !== 'undefined' ? localStorage.getItem('pageloom_active_project_id') || '' : '') ||
    '';

  // Real-time Firestore sync for the Client's Project Doc
  useEffect(() => {
    if (!projectId) return;
    const unsubscribeDoc = firebaseDiscoveryService.subscribeClientDoc(projectId, (docData) => {
      if (docData) {
        setProjectDoc(docData);
      }
    });

    return () => {
      unsubscribeDoc();
    };
  }, [projectId]);

  const clientData = projectDoc?.data || initialData;
  const businessName = clientData?.businessName || projectDoc?.businessName || 'העסק שלך';
  const uploadedFiles = projectDoc?.uploadedFiles || clientData?.uploadedFiles || [];
  const timeline = projectDoc?.timeline || [];

  // Discovery completion date
  const discoveryCompletedDate =
    clientData?.completedAt ||
    projectDoc?.updatedAt ||
    clientData?.lastUpdated ||
    '';

  // Last update timestamp
  const lastUpdateDate =
    projectDoc?.lastActive ||
    projectDoc?.updatedAt ||
    clientData?.lastUpdated ||
    '';

  // Missing files analysis for "Next Action"
  const missingFilesCount = projectDoc?.missingFilesCount ?? 0;
  const hasUploadedFiles = uploadedFiles.length > 0;
  const hasLogo = uploadedFiles.some((f) => f.category === 'logo');

  // Single next action determination:
  // If client needs to do something -> ONE clear action
  // If PageLoom is working -> "הפרויקט שלך נמצא בטיפול. כרגע אין צורך לבצע פעולה נוספת."
  let clientActionRequired: string | null = null;
  if (!hasLogo && uploadedFiles.length === 0) {
    clientActionRequired = 'נא להעלות לוגו או תמונות של העסק';
  } else if (!hasLogo) {
    clientActionRequired = 'נא להעלות לוגו של העסק';
  }

  // 9 Milestones calculation
  const projectStatus = projectDoc?.status || 'discovery_completed';
  
  // Status breakdown based on ProjectStatus enum
  const isStatusAtOrPast = (target: string) => {
    const order = [
      'in_discovery',
      'discovery_completed',
      'content_writing',
      'design',
      'development',
      'testing',
      'approved',
      'domain_setup',
      'live',
    ];
    const currentIndex = order.indexOf(projectStatus);
    const targetIndex = order.indexOf(target);
    if (currentIndex === -1 || targetIndex === -1) return false;
    return currentIndex >= targetIndex;
  };

  const isCurrentStatus = (target: string) => projectStatus === target;

  const milestoneSteps: MilestoneStep[] = [
    {
      id: 'step-1',
      title: 'אפיון הושלם',
      status: isStatusAtOrPast('discovery_completed') ? 'completed' : 'in_progress',
    },
    {
      id: 'step-2',
      title: 'מסמכים התקבלו',
      status: hasUploadedFiles || isStatusAtOrPast('content_writing') ? 'completed' : 'in_progress',
    },
    {
      id: 'step-3',
      title: 'כתיבת תוכן',
      status: isStatusAtOrPast('design')
        ? 'completed'
        : isCurrentStatus('content_writing')
        ? 'in_progress'
        : 'upcoming',
    },
    {
      id: 'step-4',
      title: 'עיצוב',
      status: isStatusAtOrPast('development')
        ? 'completed'
        : isCurrentStatus('design')
        ? 'in_progress'
        : 'upcoming',
    },
    {
      id: 'step-5',
      title: 'בניית האתר',
      status: isStatusAtOrPast('testing')
        ? 'completed'
        : isCurrentStatus('development')
        ? 'in_progress'
        : 'upcoming',
    },
    {
      id: 'step-6',
      title: 'בדיקות',
      status: isStatusAtOrPast('approved')
        ? 'completed'
        : isCurrentStatus('testing')
        ? 'in_progress'
        : 'upcoming',
    },
    {
      id: 'step-7',
      title: 'אישור סופי',
      status: isStatusAtOrPast('domain_setup')
        ? 'completed'
        : isCurrentStatus('approved')
        ? 'in_progress'
        : 'upcoming',
    },
    {
      id: 'step-8',
      title: 'חיבור דומיין',
      status: isStatusAtOrPast('live')
        ? 'completed'
        : isCurrentStatus('domain_setup')
        ? 'in_progress'
        : 'upcoming',
    },
    {
      id: 'step-9',
      title: 'האתר באוויר',
      status: projectStatus === 'live' ? 'completed' : 'upcoming',
    },
  ];

  // Calculate Overall Progress %
  const completedMilestonesCount = milestoneSteps.filter((s) => s.status === 'completed').length;
  const progressPercent = Math.min(100, Math.max(10, Math.round((completedMilestonesCount / milestoneSteps.length) * 100)));

  // Status badge label
  const getStatusLabel = () => {
    switch (projectStatus) {
      case 'in_discovery':
        return 'באפיון פעיל';
      case 'discovery_completed':
        return 'אפיון הושלם בהצלחה';
      case 'content_writing':
        return 'כתיבת תוכן שיווקי';
      case 'design':
        return 'עיצוב מסכים (UI/UX)';
      case 'development':
        return 'בנייה ופיתוח האתר';
      case 'testing':
        return 'בדיקות איכות (QA)';
      case 'approved':
        return 'אישור סופי של הלקוח';
      case 'domain_setup':
        return 'חיבור דומיין ו-SSL';
      case 'live':
        return 'האתר באוויר 🚀';
      default:
        return 'בטיפול ופיתוח';
    }
  };

  // Upload file in workspace
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingFile(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isLogo = file.name.toLowerCase().includes('logo') || file.name.toLowerCase().includes('לוגו');
        const uploaded = await firebaseDiscoveryService.uploadClientFile(
          projectId,
          file,
          isLogo ? 'logo' : 'business_photos',
          isLogo ? 'לוגו העסק' : 'תמונות וחומרים'
        );

        if (clientData) {
          const updatedFiles = [...uploadedFiles, uploaded];
          await firebaseDiscoveryService.saveDiscovery(
            {
              ...clientData,
              uploadedFiles: updatedFiles,
            },
            true,
            {
              id: `evt-${Date.now()}`,
              type: 'file_uploaded',
              title: `קובץ חדש הועלה: ${file.name}`,
              description: `נשמר במאגר הפרויקט`,
              timestamp: new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }),
            }
          );
        }
      }
    } catch (err) {
      console.warn('Workspace file upload err:', err);
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Filter project updates (read-only from PageLoom)
  const projectUpdates = timeline.filter((t) => t.type !== 'field_updated');

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 font-sans antialiased flex flex-col selection:bg-slate-200" dir="rtl">
      
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 min-w-0">
            <PageLoomLogo className="h-7 w-auto shrink-0" />
            <div className="h-4 w-[1px] bg-slate-200" />
            <div className="min-w-0">
              <span className="font-bold text-sm text-slate-900 block truncate">
                הפרויקט שלי • {businessName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onNavigateToDiscovery}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer border border-slate-200"
              title="צפייה בשאלון האפיון"
            >
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span>צפייה באפיון</span>
            </button>

            {onNavigateToAdmin && (
              <button
                onClick={onNavigateToAdmin}
                className="inline-flex items-center px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-medium transition cursor-pointer"
                title="ניהול"
              >
                <span>ניהול</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">

        {/* ========================================================================= */}
        {/* 1. הפרויקט שלי (Project Overview) */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                הפרויקט שלי
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                מעקב רציף אחר התקדמות הקמת האתר שלך
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{getStatusLabel()}</span>
            </div>
          </div>

          {/* Overview Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">מזהה פרויקט</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-slate-800 block truncate">
                {projectId}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">סטטוס נוכחי</span>
              <span className="text-xs sm:text-sm font-bold text-slate-800 block truncate">
                {getStatusLabel()}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">התקדמות כללית</span>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-slate-900">
                  {progressPercent}%
                </span>
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-900 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">עדכון אחרון</span>
              <span className="text-xs font-semibold text-slate-700 block truncate">
                {lastUpdateDate}
              </span>
            </div>

          </div>

          {/* Date Discovery Completed */}
          <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>תאריך סיום האפיון: <strong className="text-slate-700 font-semibold">{discoveryCompletedDate}</strong></span>
          </div>

          {/* Single Clear SLA Notice (Show this message only once inside Project Overview) */}
          <div className="p-4 rounded-xl bg-slate-100/90 border border-slate-200 text-slate-700 text-xs sm:text-sm leading-relaxed flex items-start gap-3">
            <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
            <div>
              משך העבודה על הפרויקט הוא <strong>עד 14 ימי עבודה</strong>, החל מהרגע שבו כל האפיון הושלם וכל הקבצים הנדרשים הועלו.
            </div>
          </div>

        </section>

        {/* ========================================================================= */}
        {/* 2. התקדמות הפרויקט (Project Progress) */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              התקדמות הפרויקט
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              שלבי הפיתוח מנקודת האפיון ועד לעליית האתר לאוויר
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {milestoneSteps.map((step, idx) => {
              const isCompleted = step.status === 'completed';
              const isInProgress = step.status === 'in_progress';

              return (
                <div
                  key={step.id}
                  className={`p-4 rounded-xl border transition-all flex items-center gap-3.5 ${
                    isCompleted
                      ? 'bg-emerald-50/40 border-emerald-200/80 text-emerald-950'
                      : isInProgress
                      ? 'bg-amber-50/50 border-amber-300 text-amber-950 ring-1 ring-amber-200'
                      : 'bg-slate-50/60 border-slate-200/70 text-slate-400'
                  }`}
                >
                  <div className="shrink-0 flex items-center justify-center">
                    {isCompleted ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : isInProgress ? (
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center animate-pulse">
                        <Hourglass className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center">
                        <Circle className="w-2.5 h-2.5 text-transparent fill-slate-300" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${
                        isCompleted ? 'text-slate-900' : isInProgress ? 'text-slate-900 font-extrabold' : 'text-slate-500'
                      }`}>
                        {step.title}
                      </span>
                      {isInProgress && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900">
                          בביצוע
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. הפעולה הבאה (Next Action) */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              הפעולה הבאה
            </h2>
          </div>

          {clientActionRequired ? (
            <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  נדרשת פעולה מצדך
                </div>
                <div className="text-sm sm:text-base font-extrabold text-amber-950">
                  {clientActionRequired}
                </div>
                <div className="text-xs text-amber-700">
                  העלאת הקובץ תאפשר לצוות להמשיך בשלבי העיצוב והבנייה.
                </div>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shadow-xs whitespace-nowrap"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>העלה עכשיו</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs sm:text-sm text-slate-700 leading-relaxed">
                <div className="font-bold text-slate-900">
                  הפרויקט שלך נמצא בטיפול.
                </div>
                <div className="text-slate-600">
                  כרגע אין צורך לבצע פעולה נוספת. צוות PageLoom עובד על השלבים המתוכננים ונעדכן כאן בכל התקדמות.
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* 4. הקבצים שלי (My Files) */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                הקבצים שלי
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                קבצים שהועלו על ידך וחומרים שהועברו מצוות הפרויקט
              </p>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingFile}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
              >
                <UploadCloud className="w-3.5 h-3.5 text-slate-600" />
                <span>העלאת קובץ</span>
              </button>
            </div>
          </div>

          {uploadedFiles.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs sm:text-sm space-y-1">
              <FolderOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="font-semibold text-slate-700">אין עדיין קבצים במאגר הפרויקט</div>
              <p className="text-slate-400 text-xs">ניתן להעלות לוגו, תמונות עסק ומסמכים בכל עת</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {uploadedFiles.map((file) => {
                return (
                  <div
                    key={file.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition flex flex-col justify-between group"
                  >
                    <div className="flex items-start gap-3">
                      <ImageThumbnail
                        file={file}
                        className="w-12 h-12 rounded-lg bg-white"
                        onClick={() => setPreviewFile(file)}
                      />

                      <div className="min-w-0 flex-1">
                        <div
                          onClick={() => setPreviewFile(file)}
                          className="text-xs font-bold text-slate-900 truncate cursor-pointer hover:text-indigo-600 transition"
                          title={file.name}
                        >
                          {file.name}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {file.categoryLabelHebrew || 'חומרי פרויקט'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          {file.uploadedAt}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => setPreviewFile(file)}
                        className="text-indigo-600 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer text-[11px] bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>הצג תמונה</span>
                      </button>

                      {file.downloadUrl && (
                        <a
                          href={file.previewUrl || file.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 text-[11px] mr-auto"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>הורדה / פתיחה</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* 5. עדכוני הפרויקט (Project Updates - Read Only) */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              עדכוני הפרויקט
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              עדכונים שוטפים שפורסמו על ידי צוות PageLoom
            </p>
          </div>

          {projectUpdates.length === 0 ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed">
                <div className="font-bold text-slate-900 mb-1">
                  האפיון נקלט בהצלחה והפרויקט נפתח
                </div>
                <div className="text-slate-600">
                  כל נתוני האפיון והעדפות המיתוג נקלטו במערכת. הצוות שוקד כעת על כתיבת התוכן וארכיטקטורת המבנה.
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-2">
                  {discoveryCompletedDate}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {projectUpdates.map((update, idx) => (
                <div
                  key={update.id || idx}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 text-xs sm:text-sm leading-relaxed"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-slate-900">
                      {update.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {update.timestamp}
                    </span>
                  </div>
                  <div className="text-slate-600">
                    {update.description}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Lightbox Preview Modal */}
      <ImageModalPreview
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      {/* Clean Minimal Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200 mt-auto">
        <div>
          PageLoom • מערכת מעקב פרויקט
        </div>
      </footer>

    </div>
  );
};
