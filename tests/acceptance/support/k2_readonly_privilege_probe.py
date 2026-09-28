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
               OR has_table_privilege(current_user, relation.oid, 'TRIGGER'))"""
    ).fetchone()
    creatable_schemas = connection.execute(
        """SELECT count(*) FROM pg_namespace AS schema
           WHERE schema.nspname NOT LIKE 'pg_%'
             AND schema.nspname <> 'information_schema'
             AND has_schema_privilege(current_user, schema.oid, 'CREATE')"""
    ).fetchone()
    if effective_writes != (0,) or creatable_schemas != (0,):
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
