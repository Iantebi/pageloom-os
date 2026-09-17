import type { DiscoverySectionId, DiscoverySectionDocument } from "@pageloom/core";
import { discoverySectionOrder } from "@pageloom/core";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase";
import { api } from "@/lib/api";
import { saveDiscoverySection, submitDiscovery, type DiscoveryState } from "@/lib/discovery";
import type { ClientFirestoreDoc, DiscoveryData, ProjectStatus, TimelineEntry, UploadedFile } from "../types";
import { INITIAL_DISCOVERY_DATA } from "../data/initialData";
import { applyRealSectionResponses, toRealSectionResponses } from "./discoveryMapping";

// Real backend, real Firestore, real security — this file used to talk to Firestore directly
// (a separate `customers`/`clients` collection tree, a separate Firestore database, anonymous
// auth). It now does none of that: every read/write goes through the same
// functions/src/discovery-api.ts REST API and `organizations/{orgId}/projects/{projectId}/...`
// Firestore structure the rest of pageloom-os already uses — see discoveryMapping.ts for the
// field-level translation between this frontend's DiscoveryData and that real schema.
//
// App.tsx calls configure() once it knows the real organizationId + projectId (from
// useOrganization()/useSearchParams(), the same real routing every other pageloom-os route uses)
// — every method below then targets that project. There is no self-generated project ID, no
// anonymous auth, and no second Firebase Storage/Firestore init.

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "offline";

export function generateUniqueProjectId(): string {
  // Kept only so a stale import doesn't crash at build time; no longer used by App.tsx, which
  // sources the real projectId from routing instead of generating one.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `PL-${new Date().getFullYear()}-${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

class FirebaseDiscoveryService {
  private organizationId = "";
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<(status: SaveStatus) => void>();
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  configure(organizationId: string) {
    this.organizationId = organizationId;
  }

  private notify(status: SaveStatus) { this.listeners.forEach(listener => listener(status)); }
  subscribeStatus(listener: (status: SaveStatus) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }

  // Throws on failure rather than swallowing it into a blank form — App.tsx classifies the error
  // (classifyApiErrorKind) and shows the same distinct network/session-expired/permission-denied
  // messages the previous UI had, instead of silently rendering an empty questionnaire for a
  // customer who was actually denied access or has no connection.
  async loadClientDiscovery(projectId: string): Promise<DiscoveryData> {
    const base: DiscoveryData = { ...INITIAL_DISCOVERY_DATA, projectId, customerId: projectId };
    if (!this.organizationId || !projectId) return base;
    const result = await api<DiscoveryState>(`/projects/${projectId}/discovery?organizationId=${encodeURIComponent(this.organizationId)}`);
    const sections = Object.fromEntries(
      Object.entries(result.sections).map(([sectionId, doc]) => [sectionId, (doc as DiscoverySectionDocument).responses]),
    ) as Partial<Record<DiscoverySectionId, Record<string, unknown>>>;
    const merged = applyRealSectionResponses(base, sections);
    const progress = result.progress;
    return {
      ...merged,
      currentStep: progress?.currentSectionId ? discoverySectionOrder.indexOf(progress.currentSectionId) + 1 : merged.currentStep,
      completedSteps: (progress?.completedSectionIds ?? []).map(id => discoverySectionOrder.indexOf(id) + 1),
      isCompleted: progress?.status === "submitted" || progress?.status === "reviewed",
      isLocked: progress?.status === "submitted" || progress?.status === "reviewed",
      completedAt: progress?.submittedAt,
      completionPercentage: progress?.percentComplete ?? merged.completionPercentage,
    };
  }

  saveDiscovery(data: DiscoveryData, immediate = false, _timelineEvent?: TimelineEntry): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    const doSave = async () => {
      if (!this.isOnline) { this.notify("offline"); return; }
      if (!this.organizationId || !data.projectId) return;
      this.notify("saving");
      try {
        const bySection = toRealSectionResponses(data);
        await Promise.all(
          (Object.entries(bySection) as [DiscoverySectionId, Record<string, unknown>][])
            .map(([sectionId, responses]) => saveDiscoverySection(this.organizationId, data.projectId, sectionId, responses)),
        );
        this.notify("saved");
        setTimeout(() => this.notify("idle"), 1800);
      } catch (err) {
        console.warn("[Discovery] save error:", err);
        this.notify("error");
      }
    };
    if (immediate) void doSave(); else this.saveTimer = setTimeout(() => void doSave(), 700);
  }

  async completeDiscoveryTransaction(_customerId: string, data: DiscoveryData): Promise<boolean> {
    if (!this.organizationId || !data.projectId) return false;
    try {
      // Ensure the latest answers are persisted before asking the server to validate & submit —
      // /submit itself marks every section completed and re-validates every required question
      // server-side (discovery-api.ts), so there is no separate per-section "complete" step here.
      const bySection = toRealSectionResponses(data);
      await Promise.all(
        (Object.entries(bySection) as [DiscoverySectionId, Record<string, unknown>][])
          .map(([sectionId, responses]) => saveDiscoverySection(this.organizationId, data.projectId, sectionId, responses)),
      );
      await submitDiscovery(this.organizationId, data.projectId);
      this.notify("saved");
      return true;
    } catch (err) {
      console.warn("[Discovery] submit error:", err);
      this.notify("error");
      return false;
    }
  }

  calculateDiscoveryStats(data: DiscoveryData) {
    const fields = [data.businessName, data.idealCustomer, data.customerProblem, data.customerDesire, data.whyChooseYou, data.phone, data.email];
    const answered = fields.filter(value => String(value ?? "").trim()).length + (data.services ?? []).filter(service => service.name).length + ((data.brandColors?.primary && data.brandColors?.secondary) ? 1 : 0);
    const totalKeyChecks = fields.length + 2;
    const progressPercentage = Math.max(0, Math.min(100, Math.round((answered / totalKeyChecks) * 100)));
    return { progressPercentage, missingAnswers: [] as { step: number; labelHebrew: string }[], missingFiles: [] as string[], isReadyForReview: answered >= totalKeyChecks - 2 };
  }

  /** Uploads through the same real Storage path convention and security rules every other
   *  Discovery upload uses (see apps/web/src/components/discovery/DiscoveryQuestionField.tsx's
   *  uploadPath) — never AI Studio's own `clients/{projectId}/...` path. The returned UploadedFile
   *  carries `realPath` (the Storage object path) so discoveryMapping.ts can persist a proper
   *  FileRecord for it through the real backend on the next save. */
  async uploadClientFile(projectId: string, file: File, category: UploadedFile["category"], categoryLabelHebrew: string): Promise<UploadedFile> {
    const target = { logo: "branding", owner_photo: "materials", business_photos: "materials", products: "materials", services: "materials", certificates: "trust", recommendations: "trust", price_list: "materials", docs: "materials" }[category];
    const questionId = { logo: "branding.logo", owner_photo: "materials.ownerPhotos", business_photos: "materials.locationPhotos", products: "materials.productPhotos", services: "materials.productPhotos", certificates: "trust.certificationFiles", recommendations: "trust.testimonialFiles", price_list: "materials.priceListOrBrochure", docs: "materials.otherDocuments" }[category];
    const path = `organizations/${this.organizationId}/discovery/${projectId}/${target}/${questionId}/${crypto.randomUUID()}-${file.name}`;
    const task = uploadBytesResumable(ref(firebaseStorage, path), file, { contentType: file.type || "application/octet-stream", customMetadata: { projectId, category } });
    await new Promise<void>((resolve, reject) => task.on("state_changed", undefined, reject, () => resolve()));
    const downloadUrl = await getDownloadURL(task.snapshot.ref);
    const isImage = file.type?.startsWith("image/");
    return {
      id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type || "application/octet-stream",
      category, categoryLabelHebrew, downloadUrl, previewUrl: isImage ? downloadUrl : undefined, thumbnailUrl: isImage ? downloadUrl : undefined,
      uploadedAt: new Date().toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }), progress: 100, isDeleted: false,
      ...({ realPath: path } as Record<string, unknown>),
    } as UploadedFile;
  }

  // The methods below back AI Studio's own AdminMaster/ClientWorkspace views, which read/write a
  // flat `clients`/`customers` collection tree that has no real counterpart in pageloom-os. Those
  // views are intentionally not mounted from apps/web/src/app/discovery/page.tsx — the real Master
  // Panel (DiscoveryPanel, embedded in /master/customer, plus DiscoveryManagementList) and the real
  // customer Portal already cover this, on the real backend. These stay as harmless no-ops only so
  // the AdminMaster/ClientWorkspace component files still compile if ever imported directly.
  async recordAuditLog(..._args: unknown[]) { return undefined; }
  async softDeleteFile(..._args: unknown[]) { return undefined; }
  async restoreFile(..._args: unknown[]) { return undefined; }
  async permanentlyDeleteFile(..._args: unknown[]) { return undefined; }
  async updateProjectStatus(..._args: [string, ProjectStatus, ...unknown[]]) { return undefined; }
  async setProjectLock(..._args: unknown[]) { return undefined; }
  async publishProjectUpdate(..._args: unknown[]) { return undefined; }
  subscribeAllClients(callback: (clients: ClientFirestoreDoc[]) => void) { callback([]); return () => undefined; }
  subscribeClientDoc(_projectId: string, callback: (data: ClientFirestoreDoc | null) => void) { callback(null); return () => undefined; }
}

export const firebaseDiscoveryService = new FirebaseDiscoveryService();
