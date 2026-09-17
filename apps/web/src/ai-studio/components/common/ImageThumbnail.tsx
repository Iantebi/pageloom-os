import React, { useState, useEffect } from 'react';
import { UploadedFile } from '../../types';
import { fileStorageService } from '../../services/fileStorageService';
import { ImageIcon, Eye, FileText } from 'lucide-react';

interface ImageThumbnailProps {
  file: UploadedFile;
  className?: string;
  onClick?: () => void;
  showOverlayIcon?: boolean;
}

export const ImageThumbnail: React.FC<ImageThumbnailProps> = ({
  file,
  className = 'w-14 h-14 rounded-xl',
  onClick,
  showOverlayIcon = true,
}) => {
  const isImage =
    file.type?.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg|bmp|avif|ico)$/i.test(file.name) ||
    Boolean(
      (file.previewUrl && (file.previewUrl.startsWith('data:image/') || file.previewUrl.includes('image'))) ||
      (file.thumbnailUrl && file.thumbnailUrl.startsWith('data:image/'))
    );

  const [src, setSrc] = useState<string>(
    file.previewUrl || file.thumbnailUrl || file.downloadUrl || ''
  );
  const [hasError, setHasError] = useState(false);
  const [triedLocal, setTriedLocal] = useState(false);

  useEffect(() => {
    // Deferred via .then() rather than called directly — this only needs to catch the case where
    // React reuses this component instance for a different `file` (e.g. list reordering); the
    // initial render already has the right value via useState's own initializer above.
    const initialSrc = file.previewUrl || file.thumbnailUrl || file.downloadUrl || '';
    Promise.resolve().then(() => { setSrc(initialSrc); setHasError(false); setTriedLocal(false); });
  }, [file.id, file.previewUrl, file.thumbnailUrl, file.downloadUrl]);

  const handleError = async () => {
    if (!triedLocal) {
      setTriedLocal(true);
      try {
        const localRec = await fileStorageService.getFileLocally(file.id);
        if (localRec?.dataUrl) {
          setSrc(localRec.dataUrl);
          setHasError(false);
          return;
        }
        if (localRec?.thumbnailUrl) {
          setSrc(localRec.thumbnailUrl);
          setHasError(false);
          return;
        }
      } catch (err) {
        console.warn('Local recovery notice:', err);
      }
    }
    setHasError(true);
  };

  const ext = file.name.split('.').pop()?.toUpperCase() || 'IMG';

  if (!isImage) {
    return (
      <div
        className={`${className} bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center relative`}
      >
        <FileText className="w-5 h-5 text-slate-500" />
      </div>
    );
  }

  if (hasError || !src) {
    return (
      <div
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        className={`${className} bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200/80 overflow-hidden shrink-0 flex flex-col items-center justify-center relative select-none ${
          onClick ? 'cursor-pointer hover:border-indigo-400 hover:shadow-xs transition' : ''
        }`}
        title={`${file.name} - ${file.categoryLabelHebrew}`}
      >
        <ImageIcon className="w-5 h-5 text-indigo-500 mb-0.5" />
        <span className="text-[9px] font-extrabold text-indigo-700 bg-indigo-100/90 px-1 py-0.2 rounded leading-none">
          {ext}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`${className} bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center relative group/thumb ${
        onClick ? 'cursor-pointer ring-1 ring-slate-200 hover:ring-indigo-400 transition' : ''
      }`}
      title={onClick ? 'לחצו להגדלה ותצוגה מקדימה' : file.name}
    >
      <img
        src={src}
        alt={file.name}
        className="w-full h-full object-cover group-hover/thumb:scale-105 transition duration-200"
        referrerPolicy="no-referrer"
        onError={handleError}
      />
      {showOverlayIcon && (
        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center text-white pointer-events-none">
          <Eye className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};
