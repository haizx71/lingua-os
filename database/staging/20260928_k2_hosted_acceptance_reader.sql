-- Staging-only operation for Supabase project bdmtdvvnbicgkfririjo.
-- The password is deliberately absent. Activate only after role and pooler proofs.
-- Apply as a Supabase staging migration; it does not advance public.schema_migrations.

DO $k2$
DECLARE
    snapshot_tables text[] := ARRAY[
        'assessment_attempt_items', 'assessment_attempts',
        'assessment_idempotency_log', 'assessment_responses',
        'assessment_results', 'concept_save_intents', 'exposure_events',
        'fsrs_states', 'learner_profiles', 'learning_events',
        'profile_mutation_results', 'reader_exposure_concepts',
        'reader_mutation_results', 'review_events', 'review_items',
        'today_activity_review_items', 'today_plan_activities', 'today_plans',
        'user_concept_states', 'user_content_progress',
        'user_language_projection_heads', 'user_languages',
        'user_saved_concepts', 'user_saved_content', 'user_saved_sentences',
        'user_skill_states', 'users'
    ];
    direct_tables text[] := ARRAY[
        'schema_migrations', 'lexemes', 'word_senses',
        'phonetic_transcriptions', 'sentence_concepts', 'sentences',
        'content_segments', 'content_items'
    ];
    publication_gate_tables text[] := ARRAY[
        'proficiency_levels', 'content_versions', 'content_metrics',
        'audio_assets', 'sentence_audio', 'content_concepts', 'concepts',
        'sentence_translations', 'source_records', 'data_sources', 'licenses'
    ];
    readable_tables text[];
    relation_name text;
    relation_oid oid;
    has_rls boolean;
    policy_count integer := 0;
BEGIN
    IF current_user <> 'postgres' OR current_database() <> 'postgres'
       OR (SELECT version FROM public.schema_migrations ORDER BY version DESC LIMIT 1) <> '0017'
       OR (SELECT name FROM supabase_migrations.schema_migrations
           ORDER BY version DESC LIMIT 1) <> 'concept_save_intent_auth_erasure_0019'
       OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'k2_hosted_acceptance_reader')
    THEN
        RAISE EXCEPTION 'K2 staging reader precondition failed';
    END IF;

    readable_tables := snapshot_tables || direct_tables || publication_gate_tables;
    IF cardinality(snapshot_tables) <> 27 OR cardinality(readable_tables) <> 46
       OR (SELECT count(DISTINCT item.name) FROM unnest(readable_tables) AS item(name)) <> 46
    THEN
        RAISE EXCEPTION 'K2 staging reader allowlist is invalid';
    END IF;
    IF (SELECT count(*)
        FROM pg_proc AS routine JOIN pg_namespace AS schema ON schema.oid = routine.pronamespace
        WHERE schema.nspname = 'public' AND NOT routine.prosecdef
          AND routine.oid::regprocedure::text = ANY(ARRAY[
              'reader_content_passes_publication_gate(uuid)',
              'reader_source_record_is_allowed(uuid)',
              'utf16_code_unit_length(text)'
          ])) <> 3
    THEN
        RAISE EXCEPTION 'K2 staging reader function inventory changed';
    END IF;

    FOREACH relation_name IN ARRAY readable_tables LOOP
        SELECT relation.oid, relation.relrowsecurity
          INTO relation_oid, has_rls
          FROM pg_class AS relation
          JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace
         WHERE schema.nspname = 'public'
           AND relation.relname = relation_name
           AND relation.relkind IN ('r', 'p')
           AND pg_get_userbyid(relation.relowner) = 'postgres';
        IF relation_oid IS NULL THEN
            RAISE EXCEPTION 'K2 staging reader table inventory changed';
        END IF;
        IF relation_name = ANY(snapshot_tables) AND has_rls THEN
            policy_count := policy_count + 1;
        ELSIF relation_name = ANY(snapshot_tables)
          AND relation_name <> ALL(ARRAY['assessment_attempt_items', 'assessment_idempotency_log'])
        THEN
            RAISE EXCEPTION 'K2 staging reader RLS inventory changed';
        END IF;
    END LOOP;
    IF policy_count <> 25 THEN
        RAISE EXCEPTION 'K2 staging reader RLS count changed';
    END IF;

    EXECUTE 'CREATE ROLE k2_hosted_acceptance_reader LOGIN PASSWORD NULL '
         || 'NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION '
         || 'NOBYPASSRLS NOINHERIT CONNECTION LIMIT 5';
    EXECUTE 'ALTER ROLE k2_hosted_acceptance_reader SET default_transaction_read_only = on';
    EXECUTE 'ALTER ROLE k2_hosted_acceptance_reader SET search_path = pg_catalog, public';
    EXECUTE 'GRANT CONNECT ON DATABASE postgres TO k2_hosted_acceptance_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA public TO k2_hosted_acceptance_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA supabase_migrations TO k2_hosted_acceptance_reader';
    EXECUTE 'GRANT SELECT (version, name) ON supabase_migrations.schema_migrations '
         || 'TO k2_hosted_acceptance_reader';

    FOREACH relation_name IN ARRAY readable_tables LOOP
        EXECUTE format('GRANT SELECT ON TABLE public.%I TO k2_hosted_acceptance_reader', relation_name);
    END LOOP;
    FOREACH relation_name IN ARRAY snapshot_tables LOOP
        SELECT relation.relrowsecurity INTO has_rls
          FROM pg_class AS relation
          JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace
         WHERE schema.nspname = 'public' AND relation.relname = relation_name;
        IF has_rls THEN
            EXECUTE format(
                'CREATE POLICY k2_hosted_acceptance_reader_select_all ON public.%I '
                || 'AS PERMISSIVE FOR SELECT TO k2_hosted_acceptance_reader USING (true)',
                relation_name
            );
        END IF;
    END LOOP;

    EXECUTE 'GRANT EXECUTE ON FUNCTION public.reader_content_passes_publication_gate(uuid) '
         || 'TO k2_hosted_acceptance_reader';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.reader_source_record_is_allowed(uuid) '
         || 'TO k2_hosted_acceptance_reader';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.utf16_code_unit_length(text) '
         || 'TO k2_hosted_acceptance_reader';
END
$k2$;
