"""Credential delivery stays one-secret-only and fails closed before mutation."""

from __future__ import annotations

from io import StringIO
from types import SimpleNamespace

from scripts import k2_configure_staging_reader as configure


def test_rejects_invalid_password_before_proof_or_secret_update(monkeypatch, capsys) -> None:
    monkeypatch.setattr(configure.sys, "stdin", StringIO("short\n"))
    monkeypatch.setattr(configure.k2_readonly_privilege_probe, "main", lambda: (_ for _ in ()).throw(AssertionError()))
    assert configure.main() == 2
    assert "short" not in capsys.readouterr().err


def test_proof_precedes_one_secret_update_and_output_is_redacted(monkeypatch, capsys) -> None:
    password = "a" * 64
    monkeypatch.setattr(configure.sys, "stdin", StringIO(password + "\n"))
    events = []

    def prove() -> int:
        events.append("proof")
        return 0

    def deliver(argv, **kwargs):
        events.append("secret")
        assert argv == ["gh", "secret", "set", "K2_STAGING_READONLY_DATABASE_URL", "-R", "haizx71/lingua-os"]
        assert kwargs["input"].startswith("postgresql://k2_hosted_acceptance_reader.bdmtdvvnbicgkfririjo:")
        assert kwargs["input"].endswith("@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=verify-full")
        assert "K2_STAGING_READONLY_DATABASE_URL" not in kwargs["env"]
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(configure.k2_readonly_privilege_probe, "main", prove)
    monkeypatch.setattr(configure.subprocess, "run", deliver)
    assert configure.main() == 0
    assert events == ["proof", "secret"]
    output = capsys.readouterr()
    assert password not in output.out + output.err
    assert "K2_STAGING_READONLY_DATABASE_URL" not in configure.os.environ


def test_failed_proof_does_not_update_secret(monkeypatch) -> None:
    monkeypatch.setattr(configure.sys, "stdin", StringIO("b" * 64 + "\n"))
    monkeypatch.setattr(configure.k2_readonly_privilege_probe, "main", lambda: 2)
    monkeypatch.setattr(configure.subprocess, "run", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError()))
    assert configure.main() == 2
