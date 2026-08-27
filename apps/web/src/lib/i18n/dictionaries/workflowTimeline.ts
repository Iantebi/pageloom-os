const stagesHe: Record<string, string> = {
  lead: "ליד", phone_call: "שיחת טלפון", closed_won: "עסקה נסגרה", onboarding: "קליטת לקוח",
  questionnaire: "שאלון", assets: "איסוף חומרים", research: "מחקר", brand_strategy: "אסטרטגיית מותג",
  design_system: "מערכת עיצוב", sitemap: "מפת אתר", ux_planning: "תכנון חוויית משתמש",
  ui_generation: "יצירת ממשק", copywriting: "כתיבה", seo_optimization: "קידום אורגני",
  development: "פיתוח", deployment_preparation: "הכנה לפריסה", qa: "בדיקות איכות",
  ceo_approval: "אישור מנכ\"ל", production_deployment: "פריסה לייצור", customer_review: "בדיקת הלקוח",
  revision: "שינויים", final_deployment: "פריסה סופית", completed: "הושלם",
};

const stagesEn: Record<string, string> = {
  lead: "Lead", phone_call: "Phone call", closed_won: "Closed won", onboarding: "Onboarding",
  questionnaire: "Questionnaire", assets: "Asset collection", research: "Research", brand_strategy: "Brand strategy",
  design_system: "Design system", sitemap: "Sitemap", ux_planning: "UX planning",
  ui_generation: "UI generation", copywriting: "Copywriting", seo_optimization: "SEO optimization",
  development: "Development", deployment_preparation: "Deployment preparation", qa: "QA",
  ceo_approval: "CEO approval", production_deployment: "Production deployment", customer_review: "Customer review",
  revision: "Revision", final_deployment: "Final deployment", completed: "Completed",
};

export const workflowTimeline = {
  he: {
    stages: stagesHe,
    stageLabel: (stage: string) => stagesHe[stage] ?? stage.replaceAll("_", " "),
    eyebrow: "תהליך העבודה בחברה",
    nextPrefix: "הבא: ",
    complete: "הושלם",
    blockedTitle: "תהליך העבודה חסום",
    responsibleAgent: "סוכן אחראי",
    awaitingAssignment: "ממתין לשיוך",
    estimatedCompletion: "מועד סיום משוער",
    notCalculated: "טרם חושב",
    currentStage: "שלב נוכחי",
    stageProgress: (position: number, total: number) => `${position} מתוך ${total}`,
  },
  en: {
    stages: stagesEn,
    stageLabel: (stage: string) => stagesEn[stage] ?? stage.replaceAll("_", " "),
    eyebrow: "Company workflow",
    nextPrefix: "Next: ",
    complete: "Complete",
    blockedTitle: "Workflow blocked",
    responsibleAgent: "Responsible agent",
    awaitingAssignment: "Awaiting assignment",
    estimatedCompletion: "Estimated completion",
    notCalculated: "Not calculated",
    currentStage: "Current stage",
    stageProgress: (position: number, total: number) => `${position} of ${total}`,
  },
} as const;
