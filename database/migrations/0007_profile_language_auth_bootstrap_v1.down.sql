-- TASK-006E protected rollback for databases without Profile lifecycle writes.

SET LOCAL search_path = public, pg_catalog;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM profile_mutation_results) THEN
        RAISE EXCEPTION 'Refusing lossy TASK-006E rollback after Profile create replay exists';
    END IF;
    IF EXISTS (SELECT 1 FROM learner_profiles WHERE revision <> 1) THEN
        RAISE EXCEPTION 'Refusing lossy TASK-006E rollback after learner revision changes';
    END IF;
    IF EXISTS (SELECT 1 FROM user_languages WHERE revision <> 1) THEN
        RAISE EXCEPTION 'Refusing lossy TASK-006E rollback after language revision changes';
    END IF;
    IF EXISTS (SELECT 1 FROM learner_profiles WHERE time_zone IS NULL) THEN
        RAISE EXCEPTION 'Refusing TASK-006E rollback because a timezone cannot be invented';
    END IF;
    IF EXISTS (
        SELECT 1 FROM user_languages
        WHERE interface_language_code IS NULL
           OR interface_language_code <> native_language_code
    ) THEN
        RAISE EXCEPTION 'Refusing TASK-006E rollback because native language cannot be collapsed';
    END IF;
END
$$;

DROP POLICY profile_mutation_results_select_own ON profile_mutation_results;
REVOKE ALL ON profile_mutation_results FROM authenticated, anon;
DROP TRIGGER profile_mutation_results_append_only ON profile_mutation_results;
DROP TABLE profile_mutation_results;
DROP FUNCTION enforce_profile_mutation_result_append_only();

ALTER TABLE user_languages
    DROP CONSTRAINT user_languages_goal_check,
    ADD CONSTRAINT user_languages_goal_check CHECK (btrim(goal) <> ''),
    DROP CONSTRAINT user_languages_revision_check,
    DROP COLUMN revision,
    ALTER COLUMN interface_language_code SET NOT NULL,
    DROP CONSTRAINT user_languages_native_language_code_fkey,
    DROP COLUMN native_language_code;

ALTER TABLE learner_profiles
    DROP CONSTRAINT learner_profiles_revision_check,
    DROP COLUMN revision,
    ALTER COLUMN time_zone SET NOT NULL,
    ALTER COLUMN time_zone SET DEFAULT 'Asia/Ho_Chi_Minh';
