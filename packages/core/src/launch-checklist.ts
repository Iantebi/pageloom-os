// Pre-publish launch checklist — mirrors the existing onboardingChecklist() pattern in
// closing-system.ts (same {id,label,required,complete} shape) so it reuses the same UI/API
// idioms rather than inventing a new checklist model. This is a visibility/readiness aid for
// the Owner ahead of the existing CEO-approval publish gates (ceo_approval / final_deployment) —
// it does not itself authorize a deployment; the existing approval workflow still does that.
export interface LaunchChecklistItem { id: string; label: string; required: boolean; complete: boolean }

export function launchChecklist(): LaunchChecklistItem[] {
  return [
    { id: "domain", label: "Domain connected", required: true, complete: false },
    { id: "ssl", label: "SSL certificate active", required: true, complete: false },
    { id: "forms", label: "Forms tested and delivering", required: true, complete: false },
    { id: "phone", label: "Phone number correct and clickable", required: true, complete: false },
    { id: "whatsapp", label: "WhatsApp link working", required: false, complete: false },
    { id: "email", label: "Contact email correct", required: true, complete: false },
    { id: "mobile", label: "Reviewed on mobile", required: true, complete: false },
    { id: "desktop", label: "Reviewed on desktop", required: true, complete: false },
    { id: "favicon", label: "Favicon set", required: false, complete: false },
    { id: "seo", label: "Basic SEO (titles, descriptions) set", required: true, complete: false },
    { id: "analytics", label: "Analytics installed (if included)", required: false, complete: false },
    { id: "privacy", label: "Privacy / cookie notice in place (if applicable)", required: false, complete: false },
    { id: "accessibility", label: "Basic accessibility checklist reviewed", required: true, complete: false },
  ];
}
