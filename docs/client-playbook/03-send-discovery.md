# 03 — Send Discovery

## Goal

Get the customer their Discovery link, with a warm, ready-to-send message — the Owner
should only ever have to press Copy.

## Owner Tasks

1. On the "Customer Created Successfully" screen, choose one:
   - **Copy Link** — copies the bare Discovery URL.
   - **Open Discovery** — opens it yourself, e.g. to preview what the customer will see.
   - **Copy WhatsApp Message** — copies a complete, friendly message (business name, contact name, and the link already filled in). This is the fastest path: copy, paste into WhatsApp, send.
2. Send the message (or link) to the customer over WhatsApp, email, or however you normally reach them.

## Customer Tasks

- Open the link when it's convenient — no account, password, or sign-up required.

## Checklist

- [ ] The customer has received the link through a channel they actually check.
- [ ] You did not edit or reconstruct the link — it was copied exactly as generated.

## Security notes (why this is safe to send over WhatsApp/email in plain text)

- The link's token is a 192-bit cryptographically random value — not guessable, not sequential.
- Opening the link only ever grants access to **that one customer's** Discovery — never another customer's, and never any other part of PageLoom OS.
- The link never exposes a customer ID, project ID, or organization ID, in the URL or anywhere else the customer can see.

## Exit Criteria

The customer has the link in hand. Move to [04 Discovery Completed](./04-discovery-completed.md) once they open it and start answering.
