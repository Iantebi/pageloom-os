"use client";
import { useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase";

// Shared resumable-upload hook — Business Discovery is the first surface in this codebase that
// needs a real upload percentage and an image preview (every existing upload call site uses
// non-resumable uploadBytes with no progress and no getDownloadURL preview). See
// docs/customer-discovery-onboarding/PRD.md §14. Scoped to this feature only — existing upload
// call sites elsewhere are not retrofitted here (docs/customer-discovery-onboarding/IMPLEMENTATION-PLAN.md
// Phase 5's explicit out-of-scope note).

export type UploadState = { status: "idle" } | { status: "uploading"; percent: number } | { status: "done"; url: string } | { status: "error"; message: string };

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = /^(image\/(jpeg|png|webp)|application\/pdf)$/;

export function useFileUpload() {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  // Remembers the last attempted (path, file, metadata) so retry() can re-attempt the SAME file
  // without asking the customer to reselect it — see UX-FLOW.md §4.5's explicit requirement.
  const lastAttempt = useRef<{ path: string; file: File; metadata?: Record<string, string> }>(undefined);

  function precheck(file: File): string | undefined {
    if (file.size > MAX_BYTES) return "too_large";
    if (!ALLOWED_TYPES.test(file.type)) return "wrong_type";
    return undefined;
  }

  function upload(path: string, file: File, metadata?: Record<string, string>): Promise<{ path: string; fileName: string; sizeBytes: number; downloadUrl: string }> {
    lastAttempt.current = { path, file, metadata };
    return new Promise((resolve, reject) => {
      const precheckError = precheck(file);
      if (precheckError) { setState({ status: "error", message: precheckError }); reject(new Error(precheckError)); return; }
      setState({ status: "uploading", percent: 0 });
      const task = uploadBytesResumable(ref(firebaseStorage, path), file, { contentType: file.type, customMetadata: metadata });
      task.on("state_changed",
        snapshot => setState({ status: "uploading", percent: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) }),
        () => { setState({ status: "error", message: "upload_failed" }); reject(new Error("upload_failed")); },
        () => {
          void getDownloadURL(task.snapshot.ref).then(downloadUrl => {
            setState({ status: "done", url: downloadUrl });
            resolve({ path, fileName: file.name, sizeBytes: file.size, downloadUrl });
          });
        },
      );
    });
  }

  /** Re-attempts the exact same file/path/metadata as the last upload() call. Throws if nothing
   *  has been attempted yet (callers only show a retry control once an attempt has failed). */
  function retry() {
    if (!lastAttempt.current) return Promise.reject(new Error("nothing_to_retry"));
    const { path, file, metadata } = lastAttempt.current;
    return upload(path, file, metadata);
  }

  function reset() { setState({ status: "idle" }); }

  return { state, upload, retry, reset };
}
