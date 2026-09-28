"""Staging reader preflight. No actor creation, secret output, or persistent writes."""

from __future__ import annotations

import sys

import psycopg

from tests.acceptance.support import k2_hosted_probe as probe


EXPECTED_FUNCTIONS = {
    "reader_content_passes_publication_gate(uuid)",
    "reader_source_record_is_allowed(uuid)",
    "utf16_code_unit_length(text)",
}


def _require_denied(connection: psycopg.Connection, statement: str, sqlstate: str = "42501") -> None:
    connection.execute("SAVEPOINT k2_denied_attempt")
    denied = False
    try:
        connection.execute(statement)
    except psycopg.Error as error:
        denied = error.sqlstate == sqlstate
    finally:
        connection.execute("ROLLBACK TO SAVEPOINT k2_denied_attempt")
        connection.execute("RELEASE SAVEPOINT k2_denied_attempt")
    if not denied:
        raise probe.ProbeError


def _prove_permissions(connection: psycopg.Connection) -> None:
    effective_writes = connection.execute(
        """SELECT count(*)
           FROM pg_class AS relation
           JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace
           WHERE schema.nspname NOT LIKE 'pg_%'
             AND schema.nspname <> 'information_schema'
             AND relation.relkind IN ('r', 'p', 'v', 'm')
             AND (has_table_privilege(current_user, relation.oid, 'INSERT')
               OR has_table_privilege(current_user, relation.oid, 'UPDATE')
               OR has_table_privilege(current_user, relation.oid, 'DELETE')
               OR has_table_privilege(current_user, relation.oid, 'TRUNCATE')
               OR has_table_privilege(current_user, relation.oid, 'TRIGGER')
               OR has_table_privilege(current_user, relation.oid, 'REFERENCES')
               OR has_table_privilege(current_user, relation.oid, 'MAINTAIN'))"""
    ).fetchone()
    creatable_schemas = connection.execute(
        """SELECT count(*) FROM pg_namespace AS schema
           WHERE schema.nspname NOT LIKE 'pg_%'
             AND schema.nspname <> 'information_schema'
             AND has_schema_privilege(current_user, schema.oid, 'CREATE')"""
    ).fetchone()
    sequence_grants = connection.execute(
        """SELECT count(*) FROM pg_class AS relation
           JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace
           WHERE relation.relkind = 'S'
             AND schema.nspname NOT LIKE 'pg_%'
             AND schema.nspname <> 'information_schema'
             AND (has_sequence_privilege(current_user, relation.oid, 'USAGE')
               OR has_sequence_privilege(current_user, relation.oid, 'SELECT')
               OR has_sequence_privilege(current_user, relation.oid, 'UPDATE'))"""
    ).fetchone()
    if effective_writes != (0,) or creatable_schemas != (0,) or sequence_grants != (0,):
        raise probe.ProbeError

    explicit_grants = connection.execute(
        """WITH target AS (SELECT oid FROM pg_roles WHERE rolname = current_user),
           grants AS (
             SELECT 'database' AS kind, database.datname AS identity, acl.privilege_type
               FROM pg_database AS database
               CROSS JOIN LATERAL aclexplode(database.datacl) AS acl
               JOIN target ON target.oid = acl.grantee
             UNION ALL
             SELECT 'schema', schema.nspname, acl.privilege_type
               FROM pg_namespace AS schema
               CROSS JOIN LATERAL aclexplode(schema.nspacl) AS acl
               JOIN target ON target.oid = acl.grantee
             UNION ALL
             SELECT 'table', schema.nspname || '.' || relation.relname, acl.privilege_type
               FROM pg_class AS relation
               JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace
               CROSS JOIN LATERAL aclexplode(relation.relacl) AS acl
               JOIN target ON target.oid = acl.grantee
             UNION ALL
             SELECT 'column', schema.nspname || '.' || relation.relname || '.' || attribute.attname,
                    acl.privilege_type
               FROM pg_attribute AS attribute
               JOIN pg_class AS relation ON relation.oid = attribute.attrelid
               JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace
               CROSS JOIN LATERAL aclexplode(attribute.attacl) AS acl
               JOIN target ON target.oid = acl.grantee
             UNION ALL
             SELECT 'function', schema.nspname || '.' || routine.oid::regprocedure::text,
                    acl.privilege_type
               FROM pg_proc AS routine
               JOIN pg_namespace AS schema ON schema.oid = routine.pronamespace
               CROSS JOIN LATERAL aclexplode(routine.proacl) AS acl
               JOIN target ON target.oid = acl.grantee
           ) SELECT kind, identity, privilege_type FROM grants"""
    ).fetchall()
    expected_grants = {
        ("database", "postgres", "CONNECT"),
        ("schema", "public", "USAGE"),
        ("schema", "supabase_migrations", "USAGE"),
        ("column", "supabase_migrations.schema_migrations.version", "SELECT"),
        ("column", "supabase_migrations.schema_migrations.name", "SELECT"),
        *(("table", f"public.{name}", "SELECT")
          for name in (*probe.EXPECTED_LEARNER_TABLES, *probe.EXPECTED_CATALOG_TABLES)),
        *(("function", f"public.{signature}", "EXECUTE") for signature in EXPECTED_FUNCTIONS),
    }
    if len(explicit_grants) != len(expected_grants) or set(explicit_grants) != expected_grants:
        raise probe.ProbeError

    functions = connection.execute(
        """SELECT routine.oid::regprocedure::text,
                  has_function_privilege(current_user, routine.oid, 'EXECUTE')
           FROM pg_proc AS routine
           JOIN pg_namespace AS schema ON schema.oid = routine.pronamespace
           WHERE schema.nspname = 'public'"""
    ).fetchall()
    executable = {name for name, permitted in functions if permitted}
    if executable != EXPECTED_FUNCTIONS:
        raise probe.ProbeError

    _require_denied(connection, "CREATE TEMP TABLE k2_denied_temporary_table (id integer)", "25006")
    connection.commit()
    connection.execute("SET TRANSACTION READ WRITE")
    for statement in (
        "INSERT INTO public.schema_migrations (version, name) VALUES ('9999', 'k2_denied')",
        "UPDATE public.schema_migrations SET name = name WHERE false",
        "DELETE FROM public.schema_migrations WHERE false",
        "TRUNCATE public.schema_migrations",
        "CREATE TABLE public.k2_denied_table (id integer)",
        "ALTER TABLE public.schema_migrations ADD COLUMN k2_denied integer",
        "CREATE ROLE k2_denied_role",
        "ALTER ROLE postgres NOCREATEDB",
        "SET ROLE postgres",
        "GRANT SELECT ON public.schema_migrations TO PUBLIC",
        "UPDATE supabase_migrations.schema_migrations SET name = name WHERE false",
    ):
        _require_denied(connection, statement)
    connection.rollback()


def main() -> int:
    try:
        with probe._connection() as connection:
            probe._table_inventory(connection)
            probe._migration_head(connection)
            probe._snapshot(connection, None)
            _prove_permissions(connection)
        sys.stdout.write("K2 staging reader connectivity, snapshot, and privilege proof passed.\n")
        return 0
    except Exception:
        sys.stderr.write("K2 staging reader privilege preflight failed closed.\n")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
