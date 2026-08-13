# Website Release Acceptance Record

Complete one copy per release candidate and store it with the project history.

## Identity

- Organization:
- Customer:
- Project:
- Release candidate ID:
- Source revision:
- Preview URL:
- Production URL:
- Prepared by:
- Prepared at:

## Automated evidence

- Clean dependency installation: PASS / FAIL
- Production build: PASS / FAIL
- Unit and workflow tests: PASS / FAIL
- Link and route checks: PASS / FAIL
- Accessibility checks: PASS / FAIL
- Responsive visual checks: PASS / FAIL
- SEO checks: PASS / FAIL
- Security checks: PASS / FAIL
- Backup verification: PASS / FAIL
- Rollback verification: PASS / FAIL

Attach logs or immutable evidence IDs for every check. A failed or missing check blocks release.

## Human acceptance

- Scope matches the signed agreement: APPROVED / REJECTED
- Brand and visual design: APPROVED / REJECTED
- Copy and factual accuracy: APPROVED / REJECTED
- Legal/privacy/accessibility content: APPROVED / REJECTED
- Customer final review: APPROVED / REJECTED
- CEO production deployment: APPROVED / REJECTED

For each rejection, record the reason, responsible stage, revision owner, and required completion date.

## Deployment result

- Firebase release ID:
- Deployment time:
- Health check result:
- Previous stable release ID:
- Rollback target verified: YES / NO
- Customer notified with owner approval: YES / NO
- Final acceptance timestamp:

The project may be marked complete only when every automated check passes, all required approvals are recorded, production health is verified, and a rollback target exists.
