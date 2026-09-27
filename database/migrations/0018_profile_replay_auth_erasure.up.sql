-- Migration 0018: permit replay cleanup only as part of Auth identity erasure.
-- Active identities retain immutable language-profile create replay snapshots.

SET LOCAL search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.enforce_profile_mutation_result_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND pg_catalog.pg_trigger_depth() > 1
       AND NOT EXISTS (
           SELECT 1
           FROM auth.users AS auth_user
           WHERE auth_user.id = OLD.user_id
       )
    THEN
        RETURN OLD;
    END IF;

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
        ON DELETE CASCADE;

COMMENT ON TABLE public.profile_mutation_results IS
    'Immutable create replay authority while its Auth identity exists; removed only by Auth erasure cascade.';
