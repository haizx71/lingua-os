# LINGUA OS — Design Brief

Status: authoritative product design intent  
Consumer: frontend/product UI workstream and approved design-intelligence tools

## Product feeling

LINGUA OS should feel like an intelligent personal learning workspace, not a children's game and not a generic enterprise dashboard.

Desired qualities:

- calm
- focused
- modern
- premium
- clear
- encouraging without being noisy
- data-informed without feeling clinical

## User

Primary user: Vietnamese beginner/intermediate English learner, approximately A0 to B1, usually learning in 20–30 minute sessions on a phone.

The interface must reduce the need to decide what to study next. Today is the default action surface.

## MVP navigation

- Today
- Read
- Review
- Brain
- Progress

Do not add AI Tutor, Speak Lab, leaderboards, stores, social feeds or other unapproved primary routes.

## Visual priorities

1. Current learning action.
2. Memory/review urgency.
3. Comprehension and mastery evidence.
4. Progress over time.
5. Exploration.

## Language Brain states

The design must support at least:

- new/discovered
- learning
- familiar
- weak
- mastered
- due/needs review

State meaning must not rely on color alone. Pair color with label, icon, shape, position or another accessible cue.

## Typography

- Excellent Vietnamese diacritic rendering is mandatory.
- Body text must be comfortable for reading passages on mobile.
- Learning content and UI chrome need distinct hierarchy.
- The system should remain compatible with future multilingual content.

## Motion

Motion communicates state change and continuity. It must not distract from reading or review. Respect reduced-motion preferences.

## Avoid

- childish mascot-first styling
- loud arcade gamification
- excessive gradients/glows
- glass effects that reduce readability
- decorative charts without decisions attached
- tiny text used only to fit more dashboard data
- color-only learning states
- arbitrary icon styles
- overly dense desktop dashboards copied onto mobile

## Design-system output

The approved global system lives in `design-system/MASTER.md` and should define:

- visual direction and rationale
- primitive and semantic tokens
- typography and spacing scales
- radius/elevation/motion rules
- focus/accessibility rules
- layout/grid rules
- core component families
- learning-state presentation
- theme behavior
- forbidden magic values/patterns

Page-specific deviations belong under `design-system/pages/`.
