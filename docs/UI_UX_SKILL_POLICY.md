# LINGUA OS — UI/UX Skill Policy

Version: 2.0  
Primary consumer: frontend/product UI workstream

External UI/UX skills may provide design intelligence, pattern research, stack guidance and pre-delivery UX checks. They do not define the product.

## Allowed influence

- visual hierarchy
- layout and information density
- typography
- semantic color roles
- spacing, radius, elevation and motion systems
- accessible interaction patterns
- responsive adaptation
- component composition
- loading/empty/error presentation
- required progress visualization
- stack-specific frontend implementation guidance
- UI/UX anti-pattern detection

## Not allowed to change

- target user
- MVP feature set
- route ownership
- API contracts
- backend schemas or business rules
- Language Brain behavior
- FSRS behavior
- Today Engine logic
- product metrics
- post-MVP feature gates

## Workflow

For a new page or major component family:

1. read the product and UI specification
2. read `design-system/MASTER.md`
3. read the matching page override if present
4. use external design intelligence only where it adds value
5. compare recommendations with LINGUA OS constraints
6. reject conflicting recommendations
7. implement from semantic tokens and shared components
8. verify mobile, tablet and desktop behavior
9. verify keyboard, focus, semantics, contrast and reduced motion
10. run a final anti-pattern review

## Design-system persistence

- `design-system/DESIGN_BRIEF.md` — product design intent
- `design-system/MASTER.md` — approved global design system
- `design-system/pages/*.md` — intentional page-specific deviations

## Visual guardrails

- calm and focused before playful
- premium and modern without becoming corporate or sterile
- learning evidence before decoration
- no game-heavy metaphors or attention-seeking motion
- no color-only learning states
- dense learning data must remain scannable on small screens
- Vietnamese diacritics must render cleanly
- future multilingual content must fit without redesigning the base system
