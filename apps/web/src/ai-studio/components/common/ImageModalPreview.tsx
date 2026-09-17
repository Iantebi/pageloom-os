import React, { useState, useEffect } from 'react';
import { UploadedFile } from '../../types';
import { fileStorageService } from '../../services/fileStorageService';
import { X, ExternalLink, Download, ImageIcon, FileText } from 'lucide-react';

interface ImageModalPreviewProps {
  file: UploadedFile | null;
  onClose: () => void;
}

export const ImageModalPreview: React.FC<ImageModalPreviewProps> = ({ file, onClose }) => {
  const [src, setSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);

  const fileId = file?.id;
  const filePreview = file?.previewUrl;
  const fileThumb = file?.thumbnailUrl;
  const fileDownload = file?.downloadUrl;

  useEffect(() => {
    // Deferred (via .then()) rather than a direct synchronous call, so resetting local state to
    // match the new `file` prop happens as a reaction to it, not as a side effect the render
    // itself triggers — same reasoning as App.tsx's data-loading effects.
    if (!file) {
      Promise.resolve().then(() => { setSrc(''); setHasError(false); });
      return;
    }
    const initialSrc = file.previewUrl || file.thumbnailUrl || file.downloadUrl || '';
    Promise.resolve().then(() => { setSrc(initialSrc); setHasError(false); });

    // Also check local IndexedDB for full-res version
    fileStorageService.getFileLocally(file.id).then((rec) => {
      if (rec?.dataUrl) {
        setSrc(rec.dataUrl);
      }
    });
  }, [fileId, filePreview, fileThumb, fileDownload]);

  if (!file) return null;

  const isImage =
    file.type?.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg|bmp|avif|ico)$/i.test(file.name) ||
    Boolean(
      (src && (src.startsWith('data:image/') || src.includes('image'))) ||
      (file.thumbnailUrl && file.thumbnailUrl.startsWith('data:image/'))
    );

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = () => {
    if (src) {
      const a = document.createElement('a');
      a.href = src;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-5 overflow-hidden space-y-4 shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="min-w-0 flex-1 pr-2">
            <span className="font-bold text-sm sm:text-base text-slate-900 block truncate">
              {file.name}
            </span>
            <span className="text-[11px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded">
              {file.categoryLabelHebrew || 'קובץ'} • {formatFileSize(file.size)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition cursor-pointer shrink-0"
            title="סגור"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Image Display */}
        <div className="max-h-[65vh] min-h-[240px] overflow-auto flex items-center justify-center bg-slate-950/5 rounded-2xl p-3 border border-slate-100">
          {isImage && !hasError && src ? (
            <img
              src={src}
              alt={file.name}
              className="max-h-[58vh] max-w-full rounded-xl object-contain shadow-xs"
              referrerPolicy="no-referrer"
              onError={() => setHasError(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                {isImage ? <ImageIcon className="w-8 h-8" /> : <FileText className="w-8 h-8" />}
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">{file.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {file.categoryLabelHebrew} • {formatFileSize(file.size)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
          <span className="text-slate-400 text-[11px]">
            הועלה בתאריך {file.uploadedAt}
          </span>

          <div className="flex items-center gap-2">
            {src && (
              <>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>הורדה</span>
                </button>
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>פתח בכרטיסייה חדשה</span>
                </a>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition cursor-pointer"
            >
              סגור
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
