# LINGUA OS Knowledge System V2 — Security and Isolation Specification

**Status**: Approved Master Specification
**Baseline Commit**: `c2db86387e0879f56817cd748899e80f46b5d79a`
**Classification**: `PROPOSAL` (V2 Architecture) / `FACT` (Repository Alignment)
**Target Subsystems**: `services/api/src/lingua_api/core/auth.py`, `database/migrations/`

---

## 1. Executive Summary & Zero-Trust Posture

LINGUA OS operates under a **Zero-Trust Client** security architecture. The frontend browser application is strictly an untrusted rendering layer.

```
+---------------------------------------------------------------------------------------+
|                              THREE-TIER SECURITY POSTURE                              |
+---------------------------------------------------------------------------------------+
| 1. SERVER-SIDE ACTOR AUTHORITY: All user_id resolution comes from verified JWT claims |
| 2. ROW LEVEL SECURITY (RLS): PostgreSQL defense-in-depth barrier on all tables        |
| 3. PUBLIC POSTGREST LOCKDOWN: Direct browser access to Postgres is 100% revoked       |
|    - Migrations 0010-0012: Tables & Schema USAGE revoked from anon & authenticated    |
|    - Migration 0013: Future function EXECUTE revoked by default from PUBLIC           |
+---------------------------------------------------------------------------------------+
```

---

## 2. Server-Side Actor Resolution & Anti-IDOR Discipline

### 2.1 The Anti-IDOR Rule
> **Never trust a client-provided `user_id`.**
> Endpoints must never accept `user_id` as a route parameter, query argument, or request body field. The authenticated learner's identity is resolved exclusively on the server via cryptographic verification of the Supabase Auth JWT token.

### 2.2 FastAPI Authentication Dependency Pattern
```python
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

async def get_current_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> AuthenticatedUser:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            key=SETTINGS.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
        return AuthenticatedUser(id=UUID(user_id), email=payload.get("email"))
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
```

All repository query functions explicitly inject `user_id = current_user.id` into SQL query parameters, making IDOR logically impossible at the route layer.

---

## 3. PostgreSQL Privilege Boundary & Migration 0013 Alignment

### 3.1 Function Execution Invariant (`FACT`)
Migration `0013_supabase_public_function_default_execute_lockdown_v1.up.sql` enforces:
```sql
ALTER DEFAULT PRIVILEGES
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
```
Verified by `tests/backend/database/test_public_api_lockdown.py`:
- `anon` and `authenticated` roles do not have `USAGE` on schema `public`.
- `anon` and `authenticated` roles do not have `EXECUTE` on any function in `public`.
- Creating a new function in `public` does **not** grant execute to browser roles.

### 3.2 V2 Function Security Guidelines
For any new PostgreSQL function in Knowledge System V2 (e.g. `fn_check_concept_edges_acyclic`):
1. **Search Path Pinning**: Always declare `SET search_path = public, pg_temp` to eliminate search-path injection vulnerabilities.
2. **Invoker Rights**: Use `SECURITY INVOKER` so the function runs with the calling backend session's privileges.
3. **No Public Grants**: Never issue `GRANT EXECUTE ON FUNCTION ... TO PUBLIC` or `TO anon, authenticated`.

---

## 4. PostgreSQL Row Level Security (RLS) Policies

### 4.1 Canonical Catalog Tables (Read-Only to All, Write to Service Role)
```sql
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_senses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_senses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_concepts_read ON public.concepts
    FOR SELECT TO authenticated USING (status = 'published');

CREATE POLICY p_lexemes_read ON public.lexemes
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY p_word_senses_read ON public.word_senses
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY p_concept_senses_read ON public.concept_senses
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY p_grammar_specs_read ON public.grammar_specifications
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY p_concept_edges_read ON public.concept_edges
    FOR SELECT TO authenticated USING (TRUE);
```

### 4.2 Learner State Tables (Strict Multi-Tenant Isolation)
```sql
ALTER TABLE public.user_concept_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsrs_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.today_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_user_concept_states_isolation ON public.user_concept_states
    FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY p_review_items_isolation ON public.review_items
    FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY p_fsrs_states_isolation ON public.fsrs_states
    FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY p_learning_events_isolation ON public.learning_events
    FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

---

## 5. Account Deletion Cascade & Catalog Preservation Proof

### 5.1 Theoretical Guarantee
Under GDPR, CCPA, and enterprise privacy standards, when a learner requests account deletion:
1. 100% of personal data, learning history, review states, competence profiles, and saved bookmarks must be permanently and irreversibly purged.
2. 100% of canonical catalog knowledge must remain completely unaffected.

### 5.2 Relational Cascade Proof
- `users(id)` is the root parent for all learner tables:
  - `user_profiles.user_id` $\to$ `ON DELETE CASCADE`
  - `user_concept_states.user_id` $\to$ `ON DELETE CASCADE`
  - `user_saved_concepts.user_id` $\to$ `ON DELETE CASCADE`
  - `review_items.user_id` $\to$ `ON DELETE CASCADE`
  - `fsrs_states.user_id` $\to$ `ON DELETE CASCADE`
  - `learning_events.user_id` $\to$ `ON DELETE CASCADE`
  - `exposure_events.user_id` $\to$ `ON DELETE CASCADE`
  - `today_plans.user_id` $\to$ `ON DELETE CASCADE`
- Conversely, canonical tables (`concepts`, `lexemes`, `word_senses`, `concept_senses`, `grammar_specifications`, `concept_edges`, `licenses`, `data_sources`) have **zero foreign keys pointing to `users(id)`**.
- Therefore, executing:
  ```sql
  DELETE FROM public.users WHERE id = :target_user_id;
  ```
  executes an atomic, clean cascade deleting all learner data in a single transaction, leaving zero orphaned records, while preserving every canonical catalog row.
