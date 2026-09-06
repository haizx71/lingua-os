<#
.SYNOPSIS
  First Real Learning Loop (FRLL) - Acceptance Test Orchestrator

.DESCRIPTION
  Orchestrates the First Real Learning Loop acceptance tests across layers:
  - Validates preflight environment prerequisites without leaking secrets.
  - Ensures clean separation between test environment and production.
  - Executes deterministic catalog fixture validation.
  - Runs acceptance test suite.
#>

[CmdletBinding()]
param (
    [switch]$PreflightOnly
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $ProjectRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "LINGUA OS - FIRST REAL LEARNING LOOP ORCHESTRATOR" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Workspace: $ProjectRoot"

# 1. Required environment variables
$RequiredVars = @(
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_API_BASE_URL",
    "REVIEW_CURSOR_SECRET"
)

$MissingVars = @()
foreach ($varName in $RequiredVars) {
    $val = [System.Environment]::GetEnvironmentVariable($varName)
    if ([string]::IsNullOrWhiteSpace($val)) {
        $MissingVars += $varName
    }
}

if ($MissingVars.Count -gt 0) {
    Write-Host ""
    Write-Host "[BLOCKED] Missing required integration environment variables:" -ForegroundColor Red
    foreach ($missing in $MissingVars) {
        Write-Host "  - $missing" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "In accordance with frozen architecture plan (plans/FIRST-REAL-LEARNING-LOOP.md):" -ForegroundColor Cyan
    Write-Host "Real Supabase project credentials and PostgreSQL database connection must be injected" -ForegroundColor Cyan
    Write-Host "via environment variables. The repository contains zero hardcoded credentials." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "STATUS: FRLL PHASE A: EXTERNAL_PREREQUISITE_BLOCKED" -ForegroundColor Magenta
    exit 2
}

# 2. Safety validation: URL identity and production guard
$supabaseUrl = [System.Environment]::GetEnvironmentVariable("SUPABASE_URL").TrimEnd('/')
$nextPublicSupabaseUrl = [System.Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL").TrimEnd('/')

if ($supabaseUrl -ne $nextPublicSupabaseUrl) {
    Write-Host "[ERROR] SUPABASE_URL ($supabaseUrl) and NEXT_PUBLIC_SUPABASE_URL ($nextPublicSupabaseUrl) must match." -ForegroundColor Red
    exit 1
}

$apiBaseUrl = [System.Environment]::GetEnvironmentVariable("NEXT_PUBLIC_API_BASE_URL")
if ($apiBaseUrl -ne "/api") {
    Write-Host "[ERROR] NEXT_PUBLIC_API_BASE_URL must equal '/api' for same-origin reverse proxy bridging (got '$apiBaseUrl')." -ForegroundColor Red
    exit 1
}

$dbUrl = [System.Environment]::GetEnvironmentVariable("DATABASE_URL")
$allowProd = [System.Environment]::GetEnvironmentVariable("FRLL_ALLOW_PROD")
if (($supabaseUrl -match "prod|production" -or $dbUrl -match "prod|production") -and $allowProd -ne "true") {
    Write-Host "[ERROR] Safety guard: Target environment appears to be production. FRLL destructive user test is allowlisted only for disposable dev projects." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Preflight environment checks passed." -ForegroundColor Green

if ($PreflightOnly) {
    Write-Host "Preflight only requested. Exiting."
    exit 0
}

# 3. Static fixture & acceptance tests
Write-Host "Running deterministic catalog fixture tests..." -ForegroundColor Cyan
python -m pytest tests/backend/database/test_first_real_learning_loop_fixture.py tests/acceptance/support/test_postgres_probe.py -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Fixture validation tests failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Running Vitest acceptance support tests..." -ForegroundColor Cyan
pnpm test tests/acceptance/support
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Acceptance support tests failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Running Playwright acceptance suite..." -ForegroundColor Cyan
pnpm exec playwright test --config tests/acceptance/playwright.frll.config.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Playwright acceptance tests failed." -ForegroundColor Red
    Write-Host "Note: If Playwright browser binaries are missing on this machine, run canonical installer:" -ForegroundColor Yellow
    Write-Host "      pnpm test:frll:browser-install" -ForegroundColor Yellow
    Write-Host "      (or: pnpm exec playwright install chromium)" -ForegroundColor Yellow
    exit $LASTEXITCODE
}

Write-Host "========================================================" -ForegroundColor Green
Write-Host "FRLL PHASE A: READY_FOR_REVIEW" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
exit 0
