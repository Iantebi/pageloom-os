# Versioned business rules

The executable policy contract is `packages/core/src/business-rules.ts`. It is deterministic, validated, exported by the shared core, and tested. Changes require a version increment, effective date, tests, documentation, and owner review when they affect pricing, customer commitments, retention, recovery, or approvals.

Launch policy v1 defines two included revision rounds; project inactivity after five days; questionnaire and approval targets; zero self-authorized discounts; 60% target gross margin; severity response targets; 90-day backup retention; 24-hour RPO; four-hour RTO; expiry warnings; customer inactivity; maintenance renewal; and offboarding retention.

Business rules provide defaults and escalation triggers. They do not override a signed agreement, law, privacy obligation, security control, or explicit owner decision. Contract-specific deviations must be stored on that customer/project with their approving identity and effective version.
