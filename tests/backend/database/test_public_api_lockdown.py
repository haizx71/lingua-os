from __future__ import annotations

import uuid

import psycopg
import pytest


def test_browser_roles_have_no_public_function_execute_privileges(
    migrated_postgres_url: str,
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        # Schema USAGE alone is harmless and intentionally retained for normal
        # PostgreSQL/PostgREST name resolution. Object capabilities are what must
        # remain closed to browser roles.
        schema_privileges = connection.execute(
            """
            SELECT role_name,
                   has_schema_privilege(role_name, 'public', 'USAGE')
            FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name)
            ORDER BY role_name
            """
        ).fetchall()
        assert schema_privileges == [
            ("anon", True),
            ("authenticated", True),
        ]

        browser_executable_functions = connection.execute(
            """
            SELECT p.proname
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND (
                    has_function_privilege('anon', p.oid, 'EXECUTE')
                 OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
              )
            ORDER BY p.proname
            """
        ).fetchall()
        assert browser_executable_functions == []


def test_new_public_functions_do_not_reopen_browser_execute_by_default(
    migrated_postgres_url: str,
) -> None:
    function_name = f"lockdown_probe_{uuid.uuid4().hex}"
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            f"CREATE FUNCTION public.{function_name}() RETURNS integer "
            "LANGUAGE sql AS $$ SELECT 1 $$"
        )
        row = connection.execute(
            """
            SELECT has_function_privilege('anon', p.oid, 'EXECUTE'),
                   has_function_privilege('authenticated', p.oid, 'EXECUTE')
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = %s
            """,
            (function_name,),
        ).fetchone()
        assert row == (False, False)

        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            connection.execute("SET LOCAL ROLE authenticated")
            connection.execute(f"SELECT public.{function_name}()")
