"""One-time staging reader proof and GitHub secret delivery; password arrives on stdin."""

from __future__ import annotations

import os
import re
import subprocess
import sys

from tests.acceptance.support import k2_readonly_privilege_probe


def main() -> int:
    password = sys.stdin.readline().strip()
    if re.fullmatch(r"[a-f0-9]{64}", password) is None:
        sys.stderr.write("K2 staging reader credential format failed closed.\n")
        return 2

    database_url = (
        "postgresql://k2_hosted_acceptance_reader.bdmtdvvnbicgkfririjo:"
        + password
        + "@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=verify-full"
    )
    os.environ["K2_STAGING_READONLY_DATABASE_URL"] = database_url
    try:
        if k2_readonly_privilege_probe.main() != 0:
            return 2
        os.environ.pop("K2_STAGING_READONLY_DATABASE_URL", None)
        result = subprocess.run(
            ["gh", "secret", "set", "K2_STAGING_READONLY_DATABASE_URL", "-R", "haizx71/lingua-os"],
            input=database_url,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=os.environ.copy(),
            check=False,
            timeout=30,
        )
        if result.returncode != 0:
            sys.stderr.write("K2 staging reader GitHub secret delivery failed closed.\n")
            return 2
        sys.stdout.write("K2 staging reader GitHub secret configured.\n")
        return 0
    except Exception:
        sys.stderr.write("K2 staging reader delivery failed closed.\n")
        return 2
    finally:
        os.environ.pop("K2_STAGING_READONLY_DATABASE_URL", None)


if __name__ == "__main__":
    raise SystemExit(main())
