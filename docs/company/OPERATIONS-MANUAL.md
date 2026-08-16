# PageLoom operations manual

Owner: Operations · Review: monthly and after every incident

Each workflow records owner, customer/organization, status, timestamps, inputs, outputs, approvals, exceptions, and audit evidence. Work cannot skip an exit condition merely to meet a date.

| Workflow | Entry | Required work and control | Exit evidence |
|---|---|---|---|
| New lead | Legitimate inquiry received | Record source, contact, consent, need, owner and notes; no AI selling | Qualified, disqualified or follow-up date |
| Sales call | Qualified lead and scheduled call | Owner conducts call; record goals, budget range, authority, timeline and constraints | Explicit outcome and next action |
| Proposal | Fit confirmed | Generate scope, exclusions, deliverables, price, assumptions, validity and version | Owner-approved proposal delivered under send gate |
| Contract | Proposal accepted in principle | Use counsel-approved Hebrew template; capture exact-version signature evidence | Executed agreement and commercial terms |
| Closed Won | Owner manually changes status | Validate contract and commercial prerequisites; create customer/project atomically | Customer and project IDs with audit event |
| Questionnaire | Onboarding started | Required dynamic questions, saveable revisions, Hebrew UI, version history | Required answers complete and customer attestation |
| Asset collection | Asset request issued | Validate type, rights, quality and malware/size boundaries; record missing assets | Complete asset inventory or approved exception |
| Project creation | Closed Won prerequisites valid | Set scope, responsible owner, dates, locale, stages, revision allowance and budget | Active project with traceable workflow |
| Website production | Questionnaire/assets complete | Prepare research, brand, design, copy, SEO and development tasks; manually execute AI tasks at launch; validate every output | Required deliverables accepted per stage |
| Customer review | Internal QA and owner approval complete | Present version, collect consolidated comments against revision allowance | Approval or scoped revision request |
| Deployment | Deploy approval granted | Build/test/security checks, backup current release, deploy, smoke test, record release | Healthy URL, release ID and rollback target |
| Delivery | Final deployment accepted | Transfer documentation, access, asset inventory, support route and maintenance scope | Delivery document and acceptance evidence |
| Maintenance | Active agreement | Monitor health/expiry/backup/security; execute contracted work; report exceptions | Monthly service record or escalation |
| Support | Authenticated request | Triage severity, acknowledge, investigate, communicate, resolve and document | Customer-confirmed resolution or reasoned closure |
| Incident response | Monitoring/customer signal | Assign commander; contain; preserve evidence; recover; communicate only with approval | Service restored, timeline and post-incident review |
| Offboarding | Authorized termination | Confirm balance/legal retention; export portable assets; revoke access; preserve required records; schedule deletion approval | Signed handover and access inventory |

## Exception and escalation standard

Blocked work records the reason, responsible owner, customer impact, next action and estimated resolution. Safety, legal, privacy, payment, production deployment and destructive actions escalate immediately to the owner. Incidents follow `../OPERATIONS.md`; first-customer execution follows `../FIRST-CUSTOMER-RUNBOOK.md`; support severity follows `../SUPPORT-PLAYBOOK.md`.

## Definition of done

A workflow is done only when required deliverables exist, automated checks pass, approvals are bound to the reviewed version, customer communication is recorded, costs/time are captured, and the next accountable owner is explicit.
