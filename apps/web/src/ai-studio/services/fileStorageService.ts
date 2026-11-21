/**
 * File Storage Service
 * Handles client-side IndexedDB persistence for uploaded images/documents
 * Generates compact (<15KB) base64 thumbnails for Firestore sync
 */

const DB_NAME = 'pageloom_files_v1';
const STORE_NAME = 'files';

interface StoredFileRecord {
  id: string;
  projectId: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  thumbnailUrl: string;
  updatedAt: number;
}

class FileStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
          reject(new Error('IndexedDB not supported'));
          return;
        }

        const request = window.indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  /**
   * Generates a compact base64 thumbnail (< 20KB) from an image file
   */
  public async createCompactThumbnail(file: File, maxDim = 300, quality = 0.75): Promise<string> {
    return new Promise((resolve) => {
      if (!file.type?.startsWith('image/')) {
        resolve('');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(width, 1);
            canvas.height = Math.max(height, 1);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve((e.target?.result as string) || '');
              return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            const thumbData = canvas.toDataURL('image/jpeg', quality);
            resolve(thumbData);
          } catch {
            resolve((e.target?.result as string) || '');
          }
        };
        img.onerror = () => resolve('');
        img.src = (e.target?.result as string) || '';
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert File to full DataURL
   */
  public async readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  /**
   * Store file in IndexedDB
   */
  public async saveFileLocally(
    id: string,
    projectId: string,
    file: File,
    dataUrl: string,
    thumbnailUrl: string
  ): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: StoredFileRecord = {
        id,
        projectId,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl,
        thumbnailUrl: thumbnailUrl || dataUrl,
        updatedAt: Date.now(),
      };

      store.put(record);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('IndexedDB save notice:', err);
    }
  }

  /**
   * Retrieve file data URL from IndexedDB
   */
  public async getFileLocally(id: string): Promise<StoredFileRecord | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      return new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Retrieve all files for a project from IndexedDB
   */
  public async getAllProjectFiles(projectId: string): Promise<Record<string, StoredFileRecord>> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      return new Promise((resolve) => {
        req.onsuccess = () => {
          const list: StoredFileRecord[] = req.result || [];
          const map: Record<string, StoredFileRecord> = {};
          list.forEach((rec) => {
            if (rec.projectId === projectId || !rec.projectId) {
              map[rec.id] = rec;
            }
          });
          resolve(map);
        };
        req.onerror = () => resolve({});
      });
    } catch {
      return {};
    }
  }
}

export const fileStorageService = new FileStorageService();
