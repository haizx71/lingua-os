-- Migration 0018 rollback: restore unconditional append-only retention.
-- Rows removed by a prior Auth identity erasure are intentionally not recoverable.

SET LOCAL search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.enforce_profile_mutation_result_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'Profile create replay results are append-only'
        USING ERRCODE = '23514';
END
$$;

ALTER TABLE public.profile_mutation_results
    DROP CONSTRAINT profile_mutation_results_user_id_language_profile_id_fkey;

ALTER TABLE public.profile_mutation_results
    ADD CONSTRAINT profile_mutation_results_user_id_language_profile_id_fkey
        FOREIGN KEY (user_id, language_profile_id)
        REFERENCES public.user_languages(user_id, id)
        ON DELETE RESTRICT;

COMMENT ON TABLE public.profile_mutation_results IS
    'Exact immutable replay authority for TASK-006E Language Profile creation only.';
