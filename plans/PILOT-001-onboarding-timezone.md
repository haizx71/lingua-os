# PILOT-001 — Remove the fresh-signup timezone confirmation step

## Scope

Implement the owner-authorized P2 pilot UX exception for a fresh learner whose `/v1/me` profile
has no valid timezone. Reuse the browser's resolved IANA timezone and persist it only when the
learner submits the existing language-profile setup action.

This changes onboarding presentation and sequencing only. The backend remains the timezone
authority for Today planning; ADR-019's requirement to persist a valid timezone before language
creation remains in force. No hosted actor, migration, public contract, or accepted K2 gate is
part of this task.

## Behavior

- Keep an existing valid timezone from `/v1/me` unchanged and skip its PATCH.
- For a missing timezone, accept `Intl.DateTimeFormat().resolvedOptions().timeZone` only when it
  passes the existing IANA validator.
- On the ordinary “Tạo hồ sơ tiếng Anh” action, PATCH `/v1/me` with the detected timezone and
  current strong `If-Match`; validate the server response, then create the Language Profile.
- Do not issue a new timezone PATCH or language-profile POST on mount, from background effects, or before the explicit setup CTA. Preserve the existing authenticated GET `/v1/me` bootstrap, which may create only `public.users` and `learner_profiles` for a new identity. Do not request GPS, location permission, or use IP geolocation.
- When browser detection is unavailable, invalid, or throws, show a manual IANA selector and retry
  action inside setup. An invalid or missing value blocks both the PATCH and language creation.
- Keep optional display name, active/paused/archived profile handling, idempotency, duplicate-click
  suppression, actor epoch guards, and 412 refetch without automatic mutation retry.

## Acceptance checks

- Fresh flow has no standalone timezone confirmation card.
- HTTP UI proof shows no new timezone PATCH or language-profile POST before the setup CTA; the existing `/v1/me` bootstrap may create only `public.users` and `learner_profiles` for a new identity. After the CTA, verify valid timezone PATCH with strong ETag before language POST.
- Existing valid server timezone causes no PATCH.
- Invalid/throwing detection falls back to manual selection; PATCH failure blocks language POST.
- A 412 triggers fresh bootstrap reads and no second PATCH or POST until a later explicit action.
- Late Actor A responses do not advance Actor B or trigger Actor A's following language write.
