"""Unit tests for FRLL database bootstrap tooling.

Tests fail-closed behavior on missing credentials, static invariant checks,
and alignment with canonical migration and fixture registries without needing real database.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from database.migrate import discover_migrations
from scripts.apply_frll_seed import (
    LEARNER_DERIVED_TABLES as SEED_LEARNER_TABLES,
)
from scripts.verify_frll_database import (
    EXPECTED_MIGRATIONS,
)
from scripts.verify_frll_database import (
    LEARNER_DERIVED_TABLES as VERIFY_LEARNER_TABLES,
)

CANONICAL_LEARNER_DERIVED_TABLES = (
    "users",
    "learner_profiles",
    "user_languages",
    "user_saved_concepts",
    "user_saved_content",
    "user_saved_sentences",
    "concept_save_intents",
    "user_concept_states",
    "user_skill_states",
    "user_language_projection_heads",
    "learning_events",
    "exposure_events",
    "review_items",
    "fsrs_states",
    "review_events",
    "today_plans",
    "today_plan_activities",
    "today_activity_review_items",
    "profile_mutation_results",
    "assessment_attempts",
    "assessment_responses",
    "assessment_results",
)

ROOT = Path(__file__).resolve().parents[3]
APPLY_SEED_SCRIPT = ROOT / "scripts" / "apply_frll_seed.py"
VERIFY_DB_SCRIPT = ROOT / "scripts" / "verify_frll_database.py"
BOOTSTRAP_PS1 = ROOT / "scripts" / "bootstrap-frll-database.ps1"


def test_expected_migrations_match_disk_registry() -> None:
    """Ensure verify_frll_database tracks the exact set of discovered migrations."""
    discovered = discover_migrations()
    discovered_names = [f"{m.version}_{m.name}" for m in discovered]
    assert list(EXPECTED_MIGRATIONS) == discovered_names, (
        "EXPECTED_MIGRATIONS in verify_frll_database.py must match "
        "discovered migrations in database/migrations/"
    )


def test_learner_derived_tables_are_consistently_defined() -> None:
    """Ensure all tools enforce the exact same set of learner-derived tables."""
    assert set(SEED_LEARNER_TABLES) == set(CANONICAL_LEARNER_DERIVED_TABLES)
    assert set(VERIFY_LEARNER_TABLES) == set(CANONICAL_LEARNER_DERIVED_TABLES)


def test_apply_frll_seed_fails_closed_when_database_url_missing() -> None:
    """Ensure apply_frll_seed exits 1 and reports failure when DATABASE_URL is not set."""
    env = dict(os.environ)
    env.pop("DATABASE_URL", None)

    proc = subprocess.run(
        [sys.executable, str(APPLY_SEED_SCRIPT)],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 1
    assert "DATABASE_URL is missing or empty" in proc.stderr
    assert "password" not in proc.stderr.lower()


def test_verify_frll_database_fails_closed_when_database_url_missing() -> None:
    """Ensure verify_frll_database exits 1 and reports failure when DATABASE_URL is not set."""
    env = dict(os.environ)
    env.pop("DATABASE_URL", None)

    proc = subprocess.run(
        [sys.executable, str(VERIFY_DB_SCRIPT)],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 1
    assert "DATABASE_URL is missing or empty" in proc.stderr
    assert "password" not in proc.stderr.lower()


def test_bootstrap_ps1_fails_closed_when_database_url_missing() -> None:
    """Ensure bootstrap-frll-database.ps1 exits 1 when DATABASE_URL is absent."""
    env = dict(os.environ)
    env.pop("DATABASE_URL", None)

    proc = subprocess.run(
        ["powershell", "-NoProfile", "-File", str(BOOTSTRAP_PS1)],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 1
    assert "DATABASE_URL is missing or empty" in proc.stdout
    assert "password" not in proc.stdout.lower()
