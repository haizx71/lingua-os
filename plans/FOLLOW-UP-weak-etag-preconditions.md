# Follow-up — Weak ETag Preconditions Through Render

Status: RECORDED / DEFERRED  
Discovered during: K2-04 hosted acceptance  
Blocks K2-05: NO

## Finding

The API emits a strong entity tag, but the hosted Render path rewrites it to a weak validator
(`W/"..."`). The current write precondition parser intentionally rejects weak `If-Match` values, so
a client that round-trips the hosted response validator cannot use it for an authoritative mutation.

## Required follow-up

- Reproduce the behavior at the direct application boundary and through Render.
- Identify whether rewriting is performed by application middleware, compression, or the hosting
  proxy.
- Preserve strong validators end to end, or define and contract a separate strong version token for
  mutation preconditions.
- Add hosted coverage proving a validator obtained from a GET can be used unchanged in `If-Match`
  and that stale validators still return `412 PRECONDITION_FAILED`.

## Promotion rule

This issue remains separate from K2-05 because K2-05 adds no public HTTP mutation or ETag
acceptance criterion. It becomes blocking before any later wave whose authoritative acceptance
requires hosted validator round-tripping or conditional writes.
