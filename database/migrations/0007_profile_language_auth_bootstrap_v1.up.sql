-- TASK-006E: application profile lifecycle, optimistic concurrency and create replay authority.

SET LOCAL search_path = public, pg_catalog;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM users AS app_user
        LEFT JOIN auth.users AS auth_user ON auth_user.id = app_user.id
        WHERE auth_user.id IS NULL
    ) THEN
        RAISE EXCEPTION 'TASK-006E preflight found an application user without auth identity';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM learner_profiles AS profile
        WHERE profile.time_zone IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM pg_timezone_names AS zone WHERE zone.name = profile.time_zone
          )
    ) THEN
        RAISE EXCEPTION 'TASK-006E preflight found an invalid legacy IANA timezone';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM user_languages
        WHERE language_code <> 'en' OR interface_language_code <> 'vi'
    ) THEN
        RAISE EXCEPTION 'TASK-006E preflight found an ambiguous legacy language pair';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM user_languages
        WHERE goal NOT IN ('communication', 'work', 'travel', 'basics', 'academic')
    ) THEN
        RAISE EXCEPTION 'TASK-006E preflight found a goal outside the approved registry';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM user_languages
        GROUP BY user_id, language_code
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'TASK-006E preflight found duplicate lifetime target profiles';
    END IF;
END
$$;

ALTER TABLE learner_profiles
    ALTER COLUMN time_zone DROP DEFAULT,
    ALTER COLUMN time_zone DROP NOT NULL,
    ADD COLUMN revision bigint NOT NULL DEFAULT 1,
    ADD CONSTRAINT learner_profiles_revision_check CHECK (revision >= 1);

ALTER TABLE user_languages
    ADD COLUMN native_language_code text;

UPDATE user_languages
SET native_language_code = 'vi'
WHERE language_code = 'en' AND interface_language_code = 'vi';

ALTER TABLE user_languages
    ALTER COLUMN native_language_code SET NOT NULL,
    ADD CONSTRAINT user_languages_native_language_code_fkey
        FOREIGN KEY (native_language_code) REFERENCES languages(code) ON DELETE RESTRICT,
    ALTER COLUMN interface_language_code DROP NOT NULL,
    ADD COLUMN revision bigint NOT NULL DEFAULT 1,
    ADD CONSTRAINT user_languages_revision_check CHECK (revision >= 1),
    DROP CONSTRAINT user_languages_goal_check,
    ADD CONSTRAINT user_languages_goal_check
        CHECK (goal IN ('communication', 'work', 'travel', 'basics', 'academic'));

CREATE TABLE profile_mutation_results (
    user_id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    operation_type text NOT NULL CHECK (operation_type = 'create-language-profile-v1'),
    schema_version smallint NOT NULL CHECK (schema_version = 1),
    request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
    language_profile_id uuid NOT NULL,
    http_status smallint NOT NULL CHECK (http_status = 201),
    result_data_snapshot jsonb NOT NULL CHECK (jsonb_typeof(result_data_snapshot) = 'object'),
    result_etag text NOT NULL CHECK (result_etag ~ '^"[^\"]+"$'),
    completed_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, idempotency_key),
    FOREIGN KEY (user_id, language_profile_id)
        REFERENCES user_languages(user_id, id) ON DELETE RESTRICT,
    CHECK (completed_at >= created_at)
);

CREATE FUNCTION enforce_profile_mutation_result_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'Profile create replay results are append-only'
        USING ERRCODE = '23514';
END
$$;

CREATE TRIGGER profile_mutation_results_append_only
BEFORE UPDATE OR DELETE ON profile_mutation_results
FOR EACH ROW EXECUTE FUNCTION enforce_profile_mutation_result_append_only();

ALTER TABLE profile_mutation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_mutation_results_select_own
    ON profile_mutation_results FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON profile_mutation_results TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON profile_mutation_results FROM authenticated;
REVOKE ALL ON profile_mutation_results FROM anon;

COMMENT ON COLUMN user_languages.interface_language_code IS
    'Deprecated profile-local interface/support snapshot; not native-language authority.';
COMMENT ON COLUMN user_languages.native_language_code IS
    'Authoritative native/support language for the owned Language Profile.';
COMMENT ON TABLE profile_mutation_results IS
    'Exact immutable replay authority for TASK-006E Language Profile creation only.';
