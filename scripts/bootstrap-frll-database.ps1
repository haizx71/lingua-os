<#
.SYNOPSIS
  First Real Learning Loop (FRLL) - PostgreSQL Real Database Bootstrap

.DESCRIPTION
  Applies accepted migrations in canonical order to the real Supabase PostgreSQL database
  and seeds the deterministic static FRLL catalog fixture.
  - Consumes DATABASE_URL from process environment without logging secrets.
  - Applies migrations transactionally via canonical runner (database/migrate.py).
  - Seeds the idempotent catalog anchor concept (database/seeds/first_real_learning_loop.sql).
  - Enforces zero learner-derived rows prior to real learning loop execution.
  - Verifies post-bootstrap database state in read-only mode.

.PARAMETER VerifyOnly
  Skip migration and seed application; perform only read-only database verification.
#>

[CmdletBinding()]
param (
    [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $ProjectRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "LINGUA OS - FRLL REAL DATABASE BOOTSTRAP" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Workspace: $ProjectRoot"

# 1. Validate DATABASE_URL existence without printing credentials
$dbUrl = [System.Environment]::GetEnvironmentVariable("DATABASE_URL")
if ([string]::IsNullOrWhiteSpace($dbUrl)) {
    Write-Host ""
    Write-Host "[FAIL] DATABASE_URL is missing or empty in the current process environment." -ForegroundColor Red
    Write-Host "Ensure DATABASE_URL is configured in your active session before running this script." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# 2. Production safety guard
$allowProd = [System.Environment]::GetEnvironmentVariable("FRLL_ALLOW_PROD")
if ($dbUrl -match "prod|production" -and $allowProd -ne "true") {
    Write-Host ""
    Write-Host "[ERROR] Safety guard: Target environment appears to be production." -ForegroundColor Red
    Write-Host "FRLL database bootstrap is permitted only for disposable development databases." -ForegroundColor Red
    Write-Host ""
    exit 1
}

if (-not $VerifyOnly) {
    # 3. Canonical migrations application
    Write-Host ""
    Write-Host "Step 1/2: Applying migrations via canonical runner (database/migrate.py)..." -ForegroundColor Cyan
    python database/migrate.py up
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] Migration step failed with exit code $LASTEXITCODE. Halting bootstrap." -ForegroundColor Red
        exit $LASTEXITCODE
    }

    # 4. Deterministic catalog seed application
    Write-Host ""
    Write-Host "Step 2/2: Applying deterministic static catalog seed (database/seeds/first_real_learning_loop.sql)..." -ForegroundColor Cyan
    python scripts/apply_frll_seed.py
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] Seed application failed with exit code $LASTEXITCODE. Halting bootstrap." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

# 5. Read-only post-bootstrap verification
Write-Host ""
Write-Host "Step 3/3: Executing post-bootstrap observational verification..." -ForegroundColor Cyan
python scripts/verify_frll_database.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Post-bootstrap verification failed with exit code $LASTEXITCODE." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "FRLL REAL DATABASE BOOTSTRAP: COMPLETE" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
exit 0
