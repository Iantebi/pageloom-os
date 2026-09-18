import type { DiscoverySectionId, DiscoverySectionDocument } from "@pageloom/core";
import { discoverySectionOrder } from "@pageloom/core";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase";
import { api } from "@/lib/api";
import { saveDiscoverySection, submitDiscovery, type DiscoveryState } from "@/lib/discovery";
import type { ClientFirestoreDoc, DiscoveryData, ProjectStatus, TimelineEntry, UploadedFile } from "../types";
import { INITIAL_DISCOVERY_DATA } from "../data/initialData";
import { applyRealSectionResponses, toRealSectionResponses } from "./discoveryMapping";
import { allMissingWithSteps } from "../utils/discoveryValidation";

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

  // PATCH /discovery/sections/:id is rate-limited (180 requests / 5 minutes per user —
  // discovery-api.ts's autosaveLimit). Sending all 7-9 sections on every debounced keystroke
  // burns through that budget in well under a minute of normal typing, surfacing as a false
  // "Synchronization Error" that has nothing to do with the actual data. lastSent caches each
  // section's last-sent JSON so only sections whose content actually changed get PATCHed.
  private lastSent = new Map<DiscoverySectionId, string>();

  saveDiscovery(data: DiscoveryData, immediate = false, _timelineEvent?: TimelineEntry): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    const doSave = async () => {
      if (!this.isOnline) { this.notify("offline"); return; }
      if (!this.organizationId || !data.projectId) return;
      const bySection = toRealSectionResponses(data);
      const changed = (Object.entries(bySection) as [DiscoverySectionId, Record<string, unknown>][])
        .filter(([sectionId, responses]) => {
          const serialized = JSON.stringify(responses);
          if (this.lastSent.get(sectionId) === serialized) return false;
          this.lastSent.set(sectionId, serialized);
          return true;
        });
      if (changed.length === 0) return;
      this.notify("saving");
      try {
        await Promise.all(changed.map(([sectionId, responses]) => saveDiscoverySection(this.organizationId, data.projectId, sectionId, responses)));
        this.notify("saved");
        setTimeout(() => this.notify("idle"), 1800);
      } catch (err) {
        console.warn("[Discovery] save error:", err);
        // Let a failed section be retried on the next save attempt instead of being considered
        // "sent" — otherwise a transient failure would silently stop that section from ever
        // being retried until its content changes again.
        for (const [sectionId] of changed) this.lastSent.delete(sectionId);
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
    // missingAnswers now reflects the REAL, non-bypassable required-field rules from
    // packages/core (via utils/discoveryValidation.ts) — every required question, regardless of
    // which step answers it. Consumed both here (Step8Review's summary/final-submit gate) and by
    // the Admin console (AdminProjectView's "missing questions" panel), which was previously
    // always empty for the same reason (this used to be a hardcoded []).
    const missingAnswers = allMissingWithSteps(data).map(({ step, labelHebrew }) => ({ step, labelHebrew }));
    return { progressPercentage, missingAnswers, missingFiles: [] as string[], isReadyForReview: answered >= totalKeyChecks - 2 };
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
    const now = new Date();
    return {
      id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type || "application/octet-stream",
      category, categoryLabelHebrew, downloadUrl, previewUrl: isImage ? downloadUrl : undefined, thumbnailUrl: isImage ? downloadUrl : undefined,
      // uploadedAt stays a localized display string (Step6Uploads.tsx renders it directly) —
      // discoveryMapping.ts's toRealFile() needs a real ISO 8601 datetime for the backend's
      // discoveryFileRecordSchema (`.datetime()`), which a "17.9.2026, 18:53"-style string
      // fails, so that value travels separately in realUploadedAtIso instead of overloading
      // the display field.
      uploadedAt: now.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }), progress: 100, isDeleted: false,
      ...({ realPath: path, realUploadedAtIso: now.toISOString() } as Record<string, unknown>),
    } as UploadedFile;
  }

  // AdminMaster (the AI Studio admin console, re-enabled 2026-09-17 at Isaac's explicit request —
  // "use the existing /admin page, don't create another one") needs a list of every Discovery and,
  // per project, its full answer set. Both now come from the real backend
  // (/discovery/management/sessions and /projects/:id/discovery) reshaped into the
  // ClientFirestoreDoc shape AdminMaster/AdminClientTable/AdminProjectView already expect — no
  // flat `clients`/`customers` collection, no second Firestore database.
  private toProjectStatus(status: string): ProjectStatus {
    if (status === "submitted" || status === "reviewed") return "discovery_completed";
    return "in_discovery"; // not_started | in_progress | reopened
  }

  subscribeAllClients(callback: (clients: ClientFirestoreDoc[]) => void) {
    if (!this.organizationId) { callback([]); return () => undefined; }
    type ManagementSession = { id: string; customerId: string | null; projectName: string; businessName: string; ownerName: string | null; status: string; percentComplete: number; submittedAt: string | null; lastActivityAt: string };
    api<ManagementSession[]>(`/discovery/management/sessions?organizationId=${encodeURIComponent(this.organizationId)}`)
      .then(sessions => callback(sessions.map((session): ClientFirestoreDoc => ({
        id: session.id, projectId: session.id, userId: "", customerName: session.ownerName || "", businessName: session.businessName,
        phone: "", email: "", status: this.toProjectStatus(session.status), currentStep: 0, completedSteps: [],
        progressPercentage: session.percentComplete, missingAnswersCount: 0, missingFilesCount: 0,
        uploadedFiles: [], storageFolder: `organizations/${this.organizationId}/discovery/${session.id}/`, timeline: [],
        data: { ...INITIAL_DISCOVERY_DATA, projectId: session.id, customerId: session.customerId ?? session.id, businessName: session.businessName, ownerName: session.ownerName ?? "" },
        lastActive: session.lastActivityAt, createdAt: session.lastActivityAt, updatedAt: session.lastActivityAt,
      }))))
      .catch(err => { console.warn("[Discovery] admin list error:", err); callback([]); });
    return () => undefined;
  }

  subscribeClientDoc(projectId: string, callback: (data: ClientFirestoreDoc | null) => void) {
    if (!this.organizationId) { callback(null); return () => undefined; }
    this.loadClientDiscovery(projectId)
      .then(data => callback({
        id: projectId, projectId, userId: "", customerName: data.ownerName || "", businessName: data.businessName,
        phone: data.phone || "", email: data.email || "", status: data.isCompleted ? "discovery_completed" : "in_discovery",
        currentStep: data.currentStep, completedSteps: data.completedSteps, progressPercentage: data.completionPercentage ?? 0,
        missingAnswersCount: 0, missingFilesCount: 0, isLocked: data.isLocked, uploadedFiles: data.uploadedFiles ?? [],
        storageFolder: `organizations/${this.organizationId}/discovery/${projectId}/`, timeline: [],
        data, lastActive: data.lastUpdated ?? "", createdAt: data.lastUpdated ?? "", updatedAt: data.lastUpdated ?? "",
      }))
      .catch(err => { console.warn("[Discovery] admin detail error:", err); callback(null); });
    return () => undefined;
  }

  // Status workflow, file trash, timeline, and audit-log management below are AI Studio's own
  // concepts with no real backend counterpart (pageloom-os's actual workflow engine, in
  // packages/core/src/workflow.ts, is a separate, CRM-adjacent system Discovery deliberately does
  // not depend on). They stay inert no-ops rather than silently pretending to do something real —
  // AdminProjectView's discovery-answers tab (the part backed by real data) is what matters here.
  async recordAuditLog(..._args: unknown[]) { return undefined; }
  async softDeleteFile(..._args: unknown[]) { return undefined; }
  async restoreFile(..._args: unknown[]) { return undefined; }
  async permanentlyDeleteFile(..._args: unknown[]) { return undefined; }
  async updateProjectStatus(..._args: [string, ProjectStatus, ...unknown[]]) { return undefined; }
  async setProjectLock(..._args: unknown[]) { return undefined; }
  async publishProjectUpdate(..._args: unknown[]) { return undefined; }
}

export const firebaseDiscoveryService = new FirebaseDiscoveryService();
