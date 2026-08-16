# Company risk register

Scale: likelihood and impact 1–5. Score = likelihood × impact. Review critical/high risks monthly and after material change.

| ID | Risk | L | I | Score | Control / indicator | Owner | Residual action |
|---|---|---:|---:|---:|---|---|---|
| R1 | Israeli legal pack or signature process is invalid/incomplete | 4 | 5 | 20 | Publication gate; immutable version/signature evidence | CEO | Israeli counsel and owner approve exact Hebrew versions |
| R2 | Privacy/security breach across tenants | 2 | 5 | 10 | Auth validation, tenant rules/tests, least privilege, audit logs | CTO | Independent security review before material scale |
| R3 | Production deployment harms customer site | 3 | 5 | Approval, QA evidence, immutable release, rollback target | Operations | Rehearse every new deployment path |
| R4 | Backup exists but cannot restore | 3 | 5 | Managed exports, run records, isolated quarterly drill | CTO | Complete and evidence the next restore drill |
| R5 | Project scope/revisions destroy margin | 4 | 4 | Signed scope, rule limits, change requests, profitability view | CEO | Validate launch pricing after first three customers |
| R6 | Cash or tax reserve shortfall | 3 | 5 | 13-week cash forecast, receivables and tax-reserve review | CEO | Accountant-approved close and reserve policy |
| R7 | Founder/key-person concentration | 5 | 4 | Runbooks, audit trail, portable artifacts | CEO | Define emergency delegate and access escrow |
| R8 | External provider outage or lock-in | 3 | 3 | Manual AI mode, provider-neutral interfaces, Firebase rollback | CTO | Maintain tested manual operating path |
| R9 | Unapproved external communication/action | 2 | 5 | Tool policy and owner approval gates | CEO | Quarterly approval-policy test |
| R10 | Customer support expectations exceed contract | 3 | 4 | Severity model, support/maintenance scope, ticket history | Customer Success | Owner approves business hours and SLA wording |
| R11 | Inaccurate executive data drives decisions | 3 | 4 | Persisted ledgers, unavailable-not-zero rule, audit hashes | Finance | Reconciliation and data-quality exceptions per report |
| R12 | Accessibility failure harms users/customer | 3 | 4 | Design/QA standards and statement versioning | QA | Qualified accessibility/legal review |

Accepted risks require owner, rationale, expiry and review date. Critical risks cannot be silently accepted.
