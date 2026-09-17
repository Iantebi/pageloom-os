/**
 * PageLoom Business Discovery Types
 */

export interface ServiceItem {
  id: string;
  name: string;
  problemSolved: string;
  resultReceived: string;
  whyValuable: string;
  targetAudience?: string;
  priceEstimate?: string;
}

export type ProjectStatus =
  | 'in_discovery'
  | 'discovery_completed'
  | 'content_writing'
  | 'design'
  | 'development'
  | 'testing'
  | 'approved'
  | 'domain_setup'
  | 'live';

export interface AuditLogEntry {
  id: string;
  action:
    | 'discovery_started'
    | 'discovery_completed'
    | 'file_uploaded'
    | 'file_deleted'
    | 'file_restored'
    | 'file_permanently_deleted'
    | 'status_changed'
    | 'owner_update_published'
    | 'project_locked'
    | 'project_unlocked'
    | 'field_updated';
  performedBy: 'client' | 'admin' | 'system';
  performedByName?: string;
  details: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  category: 'logo' | 'owner_photo' | 'business_photos' | 'products' | 'services' | 'certificates' | 'recommendations' | 'price_list' | 'docs';
  categoryLabelHebrew: string;
  downloadUrl: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  progress?: number;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: 'client' | 'admin';
}

export interface BrandColors {
  primary: string;
  secondary: string;
  primaryName?: string;
  secondaryName?: string;
}

export interface DiscoveryData {
  // Step 1: Business Identity
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  whatsapp: string;
  businessCategory: string;
  businessStory: string;
  yearsInBusiness: string;
  location: string;
  tagline?: string;

  // Step 2: Customers
  idealCustomer: string;
  customerProblem: string;
  customerDesire: string;
  customerFears: string;
  customerObstacles: string;

  // Step 3: Services
  services: ServiceItem[];

  // Step 4: Competitive Advantage
  whyChooseYou: string;
  uniqueDifferentiator: string;
  corePromises: string;
  socialProof: string;
  experienceSummary: string;
  guarantees: string;
  awardsAndCertifications: string;

  // Step 5: Brand
  brandStyle: string; // e.g., 'modern_clean', 'luxury_elegant', 'warm_friendly', 'bold_tech', 'natural_organic', 'creative_playful'
  brandColors: BrandColors;
  logoStatus: 'has_logo' | 'needs_refresh' | 'needs_new_logo';
  fontStyle: string;
  inspirationWebsites: string;
  brandPersonality: string[];

  // Step 6: Uploads
  uploadedFiles: UploadedFile[];

  // Step 7: Technical
  hasExistingDomain: boolean | null;
  existingDomain: string;
  needsDomainHelp: boolean;
  facebookUrl: string;
  instagramUrl: string;
  businessEmail: string;
  openingHours: string;
  physicalAddress: string;
  googleMapsUrl: string;
  tiktokOrLinkedIn?: string;

  // Meta & Status
  currentStep: number; // 0 for landing, 1..9 for discovery steps
  completedSteps: number[];
  isCompleted: boolean;
  completedAt?: string;
  isLocked?: boolean;
  lockedAt?: string;
  lockedBy?: string;
  trashFiles?: UploadedFile[];
  auditLog?: AuditLogEntry[];
  lastUpdated: string;
  projectId: string;
  customerId: string;
  draftMode?: boolean;
  version?: number;
  completionPercentage?: number;
}

export interface ProjectTimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: 'completed' | 'in_progress' | 'pending';
  stepNumber?: number;
}

export interface ClientProject {
  id: string;
  projectId: string;
  customerName: string;
  businessName: string;
  phone: string;
  email: string;
  status: 'new' | 'in_discovery' | 'discovery_completed' | 'in_design' | 'in_development' | 'live';
  progressPercentage: number;
  lastActive: string;
  missingAnswersCount: number;
  missingFilesCount: number;
  data: DiscoveryData;
  notes?: string;
}

export interface TimelineEntry {
  id: string;
  type: 'step_started' | 'step_completed' | 'field_updated' | 'file_uploaded' | 'discovery_finished' | 'admin_note';
  title: string;
  description: string;
  timestamp: string;
}

export interface WorkspaceMessage {
  id: string;
  sender: 'client' | 'pageloom_team' | 'system';
  senderName: string;
  senderRoleHebrew?: string;
  text: string;
  createdAt: string;
  timestamp: number;
  read?: boolean;
}

export interface WorkspacePhase {
  id: string;
  number: number;
  titleHebrew: string;
  descriptionHebrew: string;
  status: 'completed' | 'current' | 'upcoming';
  estimatedDays?: string;
  badgeHebrew?: string;
}

export interface ClientFirestoreDoc {
  id: string;
  projectId: string;
  userId: string;
  customerName: string;
  businessName: string;
  phone: string;
  email: string;
  status: ProjectStatus;
  currentStep: number;
  completedSteps: number[];
  progressPercentage: number;
  missingAnswersCount: number;
  missingFilesCount: number;
  isLocked?: boolean;
  lockedAt?: string;
  uploadedFiles: UploadedFile[];
  trashFiles?: UploadedFile[];
  auditLog?: AuditLogEntry[];
  storageFolder: string;
  timeline: TimelineEntry[];
  data: DiscoveryData;
  lastActive: string;
  createdAt: string;
  updatedAt: string;
}

export type StepKey = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface StepMeta {
  number: StepKey;
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
  estimatedMinutes: number;
}
