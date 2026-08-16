import { z } from "zod";

export const businessRulesSchema = z.object({
  version: z.number().int().positive(),
  effectiveAt: z.string().datetime(),
  project: z.object({
    includedRevisionRounds: z.number().int().min(0).max(20),
    inactivityDaysBeforeStalled: z.number().int().min(1).max(90),
    questionnaireDueDays: z.number().int().min(1).max(60),
    approvalDueDays: z.number().int().min(1).max(30),
  }),
  commercial: z.object({
    maximumDiscountPercentWithoutOwnerApproval: z.number().min(0).max(100),
    minimumTargetGrossMarginPercent: z.number().min(0).max(100),
    defaultCurrency: z.string().length(3),
  }),
  support: z.object({
    criticalResponseMinutes: z.number().int().positive(),
    highResponseHours: z.number().int().positive(),
    normalResponseHours: z.number().int().positive(),
  }),
  hosting: z.object({
    backupRetentionDays: z.number().int().min(7).max(3650),
    recoveryPointHours: z.number().int().min(1).max(168),
    recoveryTimeHours: z.number().int().min(1).max(168),
    domainExpiryWarningDays: z.number().int().min(1).max(365),
    sslExpiryWarningDays: z.number().int().min(1).max(365),
  }),
  lifecycle: z.object({
    customerInactivityWarningDays: z.number().int().min(1).max(365),
    maintenanceRenewalWarningDays: z.number().int().min(1).max(365),
    offboardingRetentionDays: z.number().int().min(1).max(3650),
  }),
}).superRefine((rules, context) => {
  if (rules.commercial.maximumDiscountPercentWithoutOwnerApproval > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["commercial", "maximumDiscountPercentWithoutOwnerApproval"],
      message: "All launch discounts require owner approval",
    });
  }
  if (rules.hosting.recoveryTimeHours < rules.hosting.recoveryPointHours / 6) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["hosting", "recoveryTimeHours"],
      message: "Recovery time target is unrealistically lower than the recovery point policy",
    });
  }
});

export type BusinessRules = z.infer<typeof businessRulesSchema>;

export const launchBusinessRules: BusinessRules = businessRulesSchema.parse({
  version: 1,
  effectiveAt: "2026-08-16T00:00:00.000Z",
  project: {
    includedRevisionRounds: 2,
    inactivityDaysBeforeStalled: 5,
    questionnaireDueDays: 7,
    approvalDueDays: 5,
  },
  commercial: {
    maximumDiscountPercentWithoutOwnerApproval: 0,
    minimumTargetGrossMarginPercent: 60,
    defaultCurrency: "ILS",
  },
  support: {
    criticalResponseMinutes: 60,
    highResponseHours: 4,
    normalResponseHours: 24,
  },
  hosting: {
    backupRetentionDays: 90,
    recoveryPointHours: 24,
    recoveryTimeHours: 4,
    domainExpiryWarningDays: 30,
    sslExpiryWarningDays: 21,
  },
  lifecycle: {
    customerInactivityWarningDays: 30,
    maintenanceRenewalWarningDays: 30,
    offboardingRetentionDays: 90,
  },
});

export function validateBusinessRules(value: unknown): BusinessRules {
  return businessRulesSchema.parse(value);
}
