const signalLabelsHe: Record<string, string> = {
  failedTasks: "משימות שנכשלו",
  staleQueuedTasks: "משימות תקועות בתור",
  blockedWorkflows: "תהליכים חסומים",
  timedOutWorkflows: "תהליכים שפגו",
  overdueApprovals: "אישורים באיחור",
  unpricedUsage: "שימוש ללא תמחור",
};

const signalLabelsEn: Record<string, string> = {
  failedTasks: "Failed tasks",
  staleQueuedTasks: "Stale queued tasks",
  blockedWorkflows: "Blocked workflows",
  timedOutWorkflows: "Timed out workflows",
  overdueApprovals: "Overdue approvals",
  unpricedUsage: "Unpriced usage",
};

export const operationsHealthCard = {
  he: {
    ariaLabel: "מצב תפעולי",
    title: "מצב המערכת",
    subtitle: "אותות אמינות בזמן אמת מאספקה ומתפעול ה-AI",
    reliabilityScoreSuffix: "מתוך 100 בציון האמינות",
    signalLabel: (key: string) => signalLabelsHe[key] ?? key.replaceAll(/([A-Z])/g, " $1"),
    healthUnavailableTitle: "מידע על מצב המערכת אינו זמין",
    healthCheckFailed: "בדיקת התקינות נכשלה",
    waitingForFirstCheck: "ממתינים לבדיקת התקינות הראשונה.",
    recoveryQueueTitle: "תור שחזור",
    recoveryQueueSubtitle: "משימות שמיצו ניסיונות וממתינות לבדיקת הבעלים",
    openCount: (n: number) => `${n} פתוחות`,
    retrying: "מבצע ניסיון חוזר…",
    retry: "ניסיון חוזר",
    noDeadLettersTitle: "אין הודעות שנכשלו סופית",
    noDeadLettersDescription: "אין למנגנון השחזור האוטומטי משימות שמיצו ניסיונות ומחייבות התערבות.",
  },
  en: {
    ariaLabel: "Operational health",
    title: "Operational health",
    subtitle: "Live reliability signals across delivery and AI operations",
    reliabilityScoreSuffix: "/ 100 reliability score",
    signalLabel: (key: string) => signalLabelsEn[key] ?? key.replaceAll(/([A-Z])/g, " $1"),
    healthUnavailableTitle: "Health unavailable",
    healthCheckFailed: "Health check failed",
    waitingForFirstCheck: "Waiting for the first operational health check.",
    recoveryQueueTitle: "Recovery queue",
    recoveryQueueSubtitle: "Exhausted tasks requiring owner review",
    openCount: (n: number) => `${n} open`,
    retrying: "Retrying",
    retry: "Retry",
    noDeadLettersTitle: "No dead letters",
    noDeadLettersDescription: "Automatic recovery has no exhausted tasks requiring intervention.",
  },
} as const;
