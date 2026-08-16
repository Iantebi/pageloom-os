# Sprint Epsilon — Customer Experience Report

Date: August 16, 2026 · Scope: Customer #1 launch path

## Journey result

The deterministic Golden Customer simulation passes from lead creation through phone close, onboarding, questionnaire, assets, website production, QA, CEO approval, customer review, final deployment and completion. All seven launch timing spans are complete in the measurement test. No automatic AI provider is required.

## Customer improvements

- A customer with one project now lands directly in it; the redundant project selector is hidden.
- The portal combines progress, secure assets, live preview, comments, revision request and approval in one screen.
- Preview opens in a separate secure tab and returns the customer to the same decision context.
- Upload, comment and approval failures preserve customer work and explain the next action in Hebrew.
- Loading, success and error messages use appropriate status/alert semantics.
- Progress exposes numeric assistive-technology metadata; file input remains keyboard accessible.
- Customer legal documents now provide explicit loading/failure states and readable Hebrew version metadata.
- Shared Hebrew statuses are corrected and expanded for approval/publishing states.
- HTML documents use responsive A4 presentation; PDFs use embedded Hebrew fonts, consistent margins, header rules, and page numbers.

## Workflow timing

The application now calculates actual elapsed time from immutable workflow event timestamps for Lead, Proposal, Questionnaire, Website, Review, Deployment and Delivery. Missing checkpoints return `incomplete`; PageLoom never invents a duration.

| Segment | Planning baseline | Measurement boundary |
|---|---:|---|
| Lead | 120 min active work | LeadCreated → LeadWon |
| Proposal | Not separately estimated | PhoneCallCompleted → LeadWon |
| Questionnaire | 240 min customer work | OnboardingCompleted → QuestionnaireCompleted |
| Website | 6,000 min active production | AssetsValidated → QACompleted |
| Review | 1,440 min allowance | ProductionDeploymentCompleted → CustomerApproved |
| Deployment | 360 min across releases | CEOApproved → FinalDeploymentCompleted |
| Delivery | 30 min | FinalDeploymentCompleted → ProjectCompleted |

Planning baselines are workflow estimates, not service promises or rehearsal actuals. Production reporting must use the new event-based measurements.

## Remaining friction

1. The questionnaire is still operated from the shared project screen rather than a dedicated Hebrew-first portal step. It works, but requires clearer customer navigation before scaling beyond Customer #1.
2. Signature collection still uses browser prompts. It is functional and version-bound, but a reviewed inline consent screen would be clearer after legal approval defines the ceremony.
3. Manual AI execution and deployment are intentionally operator-controlled and remain the largest internal time cost.
4. Legal wording cannot be polished beyond presentation until counsel approves exact Hebrew text.

## Satisfaction estimate

Estimated Customer #1 satisfaction: **4.3/5 (86%)**, confidence: medium-low. The estimate reflects Hebrew-first delivery, visible progress, one-screen review, recoverable errors and professional documents; it is reduced for the shared questionnaire screen, manual coordination and unvalidated legal/signature wording. Replace this estimate with actual post-delivery CSAT and qualitative feedback.
