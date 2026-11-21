# 02 — Create Client

## Goal

Turn a closed deal into a real customer, project, and Discovery session — automatically,
with zero manual Firestore work and zero hand-built URLs.

## Owner Tasks

1. Open Owner Workspace → **New Client** (`/clients/new`, also linked from the Dashboard).
2. Fill in the four required fields: Business Name, Contact Name, Email, Phone. Notes is optional.
3. Click **Create client**.

That single action:

1. Creates the customer record.
2. Creates the project record.
3. Initializes a Business Discovery session for that project.
4. Generates a cryptographically secure, single-use Discovery token.
5. Produces a clean Discovery URL (`https://<your-domain>/d/{token}`) that reveals no
   customer ID, project ID, or organization ID.

You never see or copy an ID at any point in this flow.

## Customer Tasks

- None yet — the customer isn't involved until [03 Send Discovery](./03-send-discovery.md).

## Checklist

- [ ] Business Name, Contact Name, Email, and Phone are all correct — this is what the customer sees on their WhatsApp message and what staff sees on the project going forward.
- [ ] The "Customer Created Successfully" screen shows a Discovery link.
- [ ] You did not manually create or edit any Firestore document, and you did not construct a URL by hand.

## Exit Criteria

A customer and project exist, a Discovery session is initialized, and a Discovery link is
ready on screen. Move to [03 Send Discovery](./03-send-discovery.md).
