---
name: pageloom-web-prompt
description: Generate a professional, copy-ready prompt for Google AI Studio to build a business website, landing page, portfolio, or website redesign. Use when the user asks to create/draft/write an AI Studio prompt, website brief, or website build prompt for a business (Hebrew or English, RTL or LTR).
---

# PageLoom Web Prompt

Turn a business's inputs into one complete, copy-ready prompt for Google AI Studio to build their website.

## Step 1: Gather essential inputs

Ask only for what's missing and essential. Do not ask about anything else — assume the rest (see Step 2).

- Business name and industry
- Target audience
- Main website goal (e.g. leads, bookings, sales, brand credibility)
- Required pages/sections
- Preferred visual style and colors
- What's available: logo, text/copy, images, contact details
- Language: Hebrew or English

If the user already supplied some of these in their message, don't re-ask — only ask about what's genuinely missing. If the user provides screenshots or an existing site, ask what to keep vs. improve instead of re-deriving the basics from scratch.

## Step 2: Fill gaps with labeled assumptions

For anything non-critical that's still missing (tone of voice, exact section order, specific fonts, animation intensity, imagery style, etc.), make a reasonable professional assumption and list it explicitly under an **"Assumptions made"** section before the final prompt. Never silently guess — always surface the assumption.

Never invent: testimonials, certifications, prices, addresses, statistics, awards, or legal/regulatory claims. When these facts are missing, the generated prompt must instruct the AI Studio builder to insert a clearly marked placeholder (e.g. `[PLACEHOLDER: customer testimonial]`, `[PLACEHOLDER: business address]`) rather than fabricate content.

## Step 3: Generate the Google AI Studio prompt

Produce ONE complete, self-contained prompt block (in a code block, ready to copy) containing all of the following sections:

1. **Business context & conversion objective** — who the business is, what the site must achieve
2. **Target audience** — who they're designing for and what matters to them
3. **Distinctive visual direction** — a specific, non-generic art direction (not "modern and clean" — give it a point of view tied to the industry/brand)
4. **Color palette & typography** — concrete colors (with hex if the user gave brand colors, otherwise a reasoned palette) and font pairing
5. **Full website structure** — every page/section, in order, with what each contains
6. **Content & calls to action** — real copy where provided; clearly marked placeholders where not; CTA text and placement
7. **Mobile responsive behavior** — explicit breakpoint/layout behavior expectations
8. **Accessibility** — contrast, semantic HTML, alt text, keyboard navigation, focus states
9. **SEO** — titles, meta descriptions, heading structure, semantic markup
10. **Performance** — image optimization, lazy loading, minimal unnecessary JS
11. **Forms, navigation & interactions** — form fields/validation, nav behavior, purposeful micro-interactions only (no gratuitous animation)
12. **Image-generation guidance** — what images are needed and art-direction notes for generating/sourcing them
13. **Technical requirements** — stack/output format expectations, reusable component structure, file organization
14. **Final acceptance checklist** — a checklist the output must satisfy before being considered done

End the prompt by explicitly requiring the AI Studio build to deliver:
- A complete, working website (not a partial scaffold)
- Reusable components
- Tested buttons, forms, and navigation
- No unrelated file changes
- A summary of completed work and any remaining placeholders

### Hebrew-language requirement

If the site language is Hebrew, the prompt must explicitly require:
- Full RTL layout (not just RTL text with LTR layout artifacts)
- Natural, professional Israeli Hebrew copy (not translated-sounding phrasing)
- Correct RTL alignment of icons, forms, nav, and directional UI elements
- Excellent mobile behavior verified specifically in RTL

### Quality bar — explicitly instruct the builder to avoid

- Generic "AI-generated" design clichés
- Excessive or unmotivated gradients
- Random floating cards/blobs with no purpose
- Vague, filler text ("we are passionate about excellence...")
- Animation for its own sake
- Layouts that look like an unmodified template

### Redesigns / existing sites

If the user provides screenshots or a live site, instruct the builder to explicitly preserve what already works (specific elements named) and list exact, concrete improvements to make — not a full rebuild-from-scratch instruction.

## Step 4: Output format

Reply with:
1. A short "Assumptions made" list (only if any were needed)
2. The complete AI Studio prompt in a single copy-ready code block
