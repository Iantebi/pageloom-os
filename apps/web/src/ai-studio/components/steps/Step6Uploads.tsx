import React, { useState, useRef } from 'react';
import { UploadCloud, Trash2, RefreshCw, CheckCircle2, FileText, AlertCircle, Eye, ExternalLink, Download, X } from 'lucide-react';
import { DiscoveryData, UploadedFile } from '../../types';
import { firebaseDiscoveryService } from '../../services/firebaseDiscoveryService';
import { ImageThumbnail } from '../common/ImageThumbnail';
import { ImageModalPreview } from '../common/ImageModalPreview';

interface Step6Props {
  data: DiscoveryData;
  onChange: (updates: Partial<DiscoveryData>) => void;
}

const CATEGORIES: { id: UploadedFile['category']; label: string; icon: string }[] = [
  { id: 'logo', label: 'לוגו העסק', icon: '🎨' },
  { id: 'owner_photo', label: 'תמונת בעל/ת העסק / צוות', icon: '👤' },
  { id: 'business_photos', label: 'תמונות מהעסק / קליניקה / עבודות', icon: '🏢' },
  { id: 'products', label: 'תמונות מוצרים', icon: '📦' },
  { id: 'services', label: 'תמונות שירותים', icon: '🛠️' },
  { id: 'certificates', label: 'תעודות והסמכות', icon: '📜' },
  { id: 'recommendations', label: 'המלצות וביקורות לקוחות', icon: '⭐' },
  { id: 'price_list', label: 'מחירון / קטלוג / תפריט', icon: '📑' },
  { id: 'docs', label: 'מסמכים כלליים (PDF/DOC)', icon: '📁' },
];

export const Step6Uploads: React.FC<Step6Props> = ({ data, onChange }) => {
  const [selectedCategory, setSelectedCategory] = useState<UploadedFile['category']>('business_photos');
  const [isDragging, setIsDragging] = useState(false);
  const [isSimulatingUpload, setIsSimulatingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFilename, setUploadingFilename] = useState('');
  const [previewModalFile, setPreviewModalFile] = useState<UploadedFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (data.uploadedFiles.length + files.length > 10) {
      alert('ניתן להעלות עד 10 קבצים סה״כ. אם יש לכם קבצים נוספים, תוכלו להעביר אותם ישירות בוואטסאפ בהמשך.');
    }

    setIsSimulatingUpload(true);
    setUploadProgress(15);

    const filesToProcess = Array.from(files).slice(0, 10 - data.uploadedFiles.length);
    const newUploadedFiles: UploadedFile[] = [];

    const catObj = CATEGORIES.find((c) => c.id === selectedCategory);
    const categoryLabel = catObj ? catObj.label : 'קובץ כללי';

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      setUploadingFilename(file.name);
      setUploadProgress(Math.round(((i + 0.3) / filesToProcess.length) * 100));

      try {
        const uploaded = await firebaseDiscoveryService.uploadClientFile(
          data.projectId,
          file,
          selectedCategory,
          categoryLabel
        );
        newUploadedFiles.push(uploaded);
      } catch (err) {
        console.warn('Upload error:', err);
      }

      setUploadProgress(Math.round(((i + 1) / filesToProcess.length) * 100));
    }

    const updatedFileList = [...data.uploadedFiles, ...newUploadedFiles];
    onChange({
      uploadedFiles: updatedFileList,
    });

    // Add timeline log & save to Firestore
    firebaseDiscoveryService.saveDiscovery(
      {
        ...data,
        uploadedFiles: updatedFileList,
      },
      true,
      {
        id: `evt-${Date.now()}`,
        type: 'file_uploaded',
        title: `הועלו ${newUploadedFiles.length} קבצים ל-Cloud Storage`,
        description: `תיקיית אחסון מבודדת: clients/${data.projectId}/`,
        timestamp: new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }),
      }
    );

    setIsSimulatingUpload(false);
    setUploadProgress(0);
    setUploadingFilename('');
  };

  const handleDelete = (id: string) => {
    onChange({
      uploadedFiles: data.uploadedFiles.filter((f) => f.id !== id),
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 text-right">
      
      {/* Step Header */}
      <div className="border-b border-slate-100 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2.5">
            <UploadCloud className="w-3.5 h-3.5" />
            <span>שלב 6 מתוך 9</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            העלאת קבצים וחומרי גלם
          </h2>
          <p className="text-slate-600 text-sm sm:text-base mt-1.5 leading-relaxed">
            תמונות אמיתיות מהעסק שלכם הן הבסיס הטוב ביותר לאתר שמרגיש אישי ואמין. העלו כאן לוגו, תמונות, תעודות, מסמכים או המלצות — הכול נשמר בענן מאובטח ומשולב ישירות בעיצוב האתר.
          </p>
        </div>

        <div className="text-left sm:text-left">
          <span className="text-xs font-bold px-3.5 py-1.5 rounded-full bg-white text-indigo-800 border border-indigo-100 shadow-2xs">
            {data.uploadedFiles.length} / 10 קבצים
          </span>
        </div>
      </div>

      {/* Category selector before drop */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-slate-900">
          איזה סוג קובץ ברצונכם להעלות כעת?
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/90 shadow-2xs hover:border-indigo-200'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer relative overflow-hidden ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/70 scale-[1.01]'
            : 'border-indigo-200/80 hover:border-indigo-400 bg-gradient-to-b from-white via-indigo-50/15 to-white hover:bg-indigo-50/30 shadow-xs'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            if (e.target) e.target.value = '';
          }}
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 mx-auto flex items-center justify-center shadow-xs">
            <UploadCloud className="w-7 h-7" />
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            גררו לכאן קבצים או לחצו לבחירה
          </h3>

          <p className="text-xs sm:text-sm text-slate-500">
            תמיכה בתמונות (PNG, JPG, WEBP), מסמכי PDF, DOC, DOCX עד 20MB לקובץ.
          </p>

          <div className="inline-flex items-center gap-1.5 text-xs text-indigo-700 font-bold bg-white px-3.5 py-1.5 rounded-full border border-indigo-100 shadow-2xs">
            <span>מיועד לקטגוריה:</span>
            <span>{CATEGORIES.find((c) => c.id === selectedCategory)?.label}</span>
          </div>
        </div>

        {/* Upload Progress Overlay */}
        {isSimulatingUpload && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-10">
            <div className="w-full max-w-xs space-y-3 text-center">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <div className="text-sm font-bold text-slate-900">
                מעלה {uploadingFilename || 'קבצים'} ל-Firebase Cloud Storage...
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="text-xs text-slate-500 font-mono">{uploadProgress}% הושלמו</div>
            </div>
          </div>
        )}
      </div>

      {/* Uploaded Files Grid */}
      {data.uploadedFiles.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>קבצים שהועלו ל-Firebase Storage ({data.uploadedFiles.length})</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {data.uploadedFiles.map((file) => {
              const isImage =
                file.type?.startsWith('image/') ||
                /\.(png|jpe?g|webp|gif|svg|bmp|avif|ico)$/i.test(file.name) ||
                Boolean(file.previewUrl || file.thumbnailUrl);

              return (
                <div
                  key={file.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs hover:border-indigo-300 hover:shadow-md transition group"
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail or Icon */}
                    <ImageThumbnail
                      file={file}
                      className="w-14 h-14 rounded-xl"
                      onClick={() => setPreviewModalFile(file)}
                    />

                    {/* File Info */}
                    <div className="min-w-0 flex-1">
                      <h4
                        onClick={() => setPreviewModalFile(file)}
                        className="text-xs font-bold text-slate-900 truncate cursor-pointer hover:text-indigo-600 transition"
                        title={file.name}
                      >
                        {file.name}
                      </h4>
                      <span className="inline-block text-[10px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md mt-1">
                        {file.categoryLabelHebrew}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {formatFileSize(file.size)} • {file.uploadedAt}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setPreviewModalFile(file)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer bg-indigo-50/70 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>תצוגה מקדימה</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(file.id)}
                      className="text-[11px] text-rose-500 hover:text-rose-700 font-medium flex items-center gap-1 mr-auto cursor-pointer p-1 rounded-lg hover:bg-rose-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>מחק</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Helpful reassurance note — the customer must never feel blocked from continuing here,
          whether they simply don't have files ready yet, or they have none at all. */}
      <div className="bg-amber-50/70 border border-amber-200/70 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1.5 leading-relaxed">
          <p>
            <span className="font-bold">אין לכם תמונות מתאימות של העסק? </span>
            אין שום בעיה — תוכלו להמשיך בביטחון. PageLoom יכול להשתמש בתמונות מקצועיות שנוצרו על ידי AI או בתמונות סטוק ברישוי, המתאימות לתחום העסק שלכם.
          </p>
          <p>
            <span className="font-bold">אין לכם את כל הקבצים עכשיו? </span>
            גם זה בסדר מוחלט. תוכלו להמשיך הלאה, ואנו נבקש מכם תמונות או חומרים משלימים בוואטסאפ בהמשך תהליך הבנייה.
          </p>
        </div>
      </div>

      {/* Image Preview Modal */}
      <ImageModalPreview
        file={previewModalFile}
        onClose={() => setPreviewModalFile(null)}
      />

    </div>
  );
};
