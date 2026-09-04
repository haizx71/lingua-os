# LINGUA OS — UI/UX Skill Policy

Version: 1.0
Approved skill: UI UX Pro Max
Primary consumer: Gemini

## Purpose

The external UI/UX skill supplies design intelligence, pattern retrieval, stack guidance and pre-delivery UX checks. It does not define the product.

## What the skill is allowed to influence

- visual hierarchy
- layout and information density
- typography recommendations
- semantic color roles
- spacing, radius, elevation and motion systems
- accessible interaction patterns
- responsive adaptation
- component composition
- empty/loading/error presentation
- charts and progress visualization when required by the product spec
- Next.js, React, Tailwind and shadcn/ui implementation guidance
- UI/UX anti-pattern detection

## What the skill is not allowed to change

- target user
- MVP feature set
- route ownership
- API contracts
- backend schemas or business rules
- Language Brain behavior
- FSRS behavior
- Today Engine logic
- product metrics
- pricing or monetization
- post-MVP feature gates

## Mandatory workflow

For a new page or major component family:

1. Read the product and UI specification.
2. Read `design-system/MASTER.md` if present.
3. Read the matching page override if present.
4. Query/use the UI skill for the user goal and interaction problem first.
5. Query/use current stack guidance for Next.js/React/shadcn/ui when relevant.
6. Compare recommendations with LINGUA OS constraints.
7. Reject conflicting recommendations.
8. Implement from semantic tokens and shared components.
9. Validate mobile, tablet and desktop behavior.
10. Validate keyboard, focus, screen-reader semantics, contrast and reduced motion.
11. Run a final anti-pattern review.

## Design-system persistence

The project uses:

- `design-system/DESIGN_BRIEF.md` for immutable product design intent
- `design-system/MASTER.md` for the approved generated/global design system
- `design-system/pages/*.md` for intentional page-specific deviations

A page override must not duplicate the master. It only records differences.

## Token architecture

Use three levels:

1. Primitive tokens: raw scales and palette primitives.
2. Semantic tokens: meaning such as surface, text, action, focus, success, learning-new, learning-weak.
3. Component tokens: optional component-specific bindings when a reusable component needs them.

Page components must not depend directly on raw palette values.

## LINGUA OS visual guardrails

- Calm and focused before playful.
- Premium and modern without looking corporate or sterile.
- Learning evidence is more important than decoration.
- Avoid game-heavy metaphors, excessive gradients, decorative 3D, confetti and attention-seeking motion.
- Progress states need text/icon/shape support so color is never the only signal.
- Dense learning data should remain scannable on small screens.
- Vietnamese diacritics must render cleanly.
- Future English, Chinese and Japanese content must fit without redesigning the base typography/layout system.

## Review checklist

Before completing a UI task, verify:

- Is every visible element tied to a product requirement?
- Is hierarchy obvious within a few seconds?
- Does the layout work at narrow mobile width?
- Does it adapt deliberately to desktop?
- Are interactive targets and focus states clear?
- Are loading, empty, error and success states present?
- Is color being used as the only state signal anywhere?
- Are design tokens used instead of magic values?
- Did the external skill introduce an unapproved feature or pattern?
- Does the result still look like one coherent LINGUA OS product?
