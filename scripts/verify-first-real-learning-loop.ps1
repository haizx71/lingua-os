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
    [switch]$PreflightOnly,
    [switch]$PhaseB,
    [switch]$PhaseC,
    [switch]$PhaseD,
    [switch]$PhaseE,
    [string]$RecoverOrphan = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $ProjectRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "LINGUA OS - FIRST REAL LEARNING LOOP ORCHESTRATOR" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Workspace: $ProjectRoot"

# 1. Required environment variables: preferred modern names with backward-compatible legacy aliases
$FixedVars = @(
    "DATABASE_URL",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_API_BASE_URL",
    "REVIEW_CURSOR_SECRET"
)

$MissingVars = @()
foreach ($varName in $FixedVars) {
    $val = [System.Environment]::GetEnvironmentVariable($varName)
    if ([string]::IsNullOrWhiteSpace($val)) {
        $MissingVars += $varName
    }
}

# Publishable key (preferred: SUPABASE_PUBLISHABLE_KEY, fallback: SUPABASE_ANON_KEY)
$pubKey = [System.Environment]::GetEnvironmentVariable("SUPABASE_PUBLISHABLE_KEY")
if ([string]::IsNullOrWhiteSpace($pubKey)) {
    $pubKey = [System.Environment]::GetEnvironmentVariable("SUPABASE_ANON_KEY")
}
if ([string]::IsNullOrWhiteSpace($pubKey)) {
    $MissingVars += "SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)"
}

# Secret key (preferred: SUPABASE_SECRET_KEY, fallback: SUPABASE_SERVICE_ROLE_KEY)
$secKey = [System.Environment]::GetEnvironmentVariable("SUPABASE_SECRET_KEY")
if ([string]::IsNullOrWhiteSpace($secKey)) {
    $secKey = [System.Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")
}
if ([string]::IsNullOrWhiteSpace($secKey)) {
    $MissingVars += "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)"
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

if (-not [string]::IsNullOrWhiteSpace($RecoverOrphan)) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "RECOVERING ORPHANED LEARNER STATE: $RecoverOrphan" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan

    python tests/acceptance/support/postgres_probe.py --recover-orphan $RecoverOrphan
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] Orphan recovery failed." -ForegroundColor Red
        exit $LASTEXITCODE
    }

    Write-Host "Verifying cleanup of recovered learner..." -ForegroundColor Cyan
    python tests/acceptance/support/postgres_probe.py --verify-cleanup $RecoverOrphan
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] Cleanup verification after orphan recovery failed." -ForegroundColor Red
        exit $LASTEXITCODE
    }

    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "[OK] Orphaned learner state purged and verified." -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
    exit 0
}

if ($PhaseB) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "EXECUTING FRLL PHASE B: REAL AUTH + PROFILE + SAVE/LEARN" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan

    # 1. Ensure FastAPI backend is running on port 8000
    $apiRunning = $false
    try {
        $healthRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($healthRes.status -eq "ok") {
            $apiRunning = $true
        }
    } catch {}

    $apiProcess = $null
    if (-not $apiRunning) {
        Write-Host "Starting FastAPI backend server on port 8000..." -ForegroundColor Cyan
        $apiProcess = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "--app-dir", "services/api/src", "lingua_api.main:app", "--port", "8000" -PassThru
        $retries = 30
        while ($retries -gt 0) {
            Start-Sleep -Milliseconds 500
            try {
                $healthRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($healthRes.status -eq "ok") {
                    $apiRunning = $true
                    break
                }
            } catch {}
            $retries--
        }
        if (-not $apiRunning) {
            Write-Host "[FAIL] FastAPI server failed to start on port 8000 within timeout." -ForegroundColor Red
            if ($apiProcess) { Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue }
            exit 1
        }
        Write-Host "[OK] FastAPI server started and healthy on port 8000." -ForegroundColor Green
    } else {
        Write-Host "[OK] Existing FastAPI server detected on port 8000." -ForegroundColor Green
    }

    try {
        Write-Host "Running Phase B end-to-end acceptance scenario..." -ForegroundColor Cyan
        pnpm test tests/acceptance/phase_b.test.ts
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[FAIL] Phase B acceptance test failed." -ForegroundColor Red
            exit $LASTEXITCODE
        }

        Write-Host ""
        Write-Host "========================================================" -ForegroundColor Green
        Write-Host "FRLL PHASE B: PASS" -ForegroundColor Green
        Write-Host "========================================================" -ForegroundColor Green
        exit 0
    } finally {
        if ($apiProcess) {
            Write-Host "Stopping background FastAPI server..." -ForegroundColor Cyan
            Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

if ($PhaseC) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "EXECUTING FRLL PHASE C: REAL MEMORY LINEAGE -> TODAY TARGET" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan

    # 1. Ensure FastAPI backend is running on port 8000
    $apiRunning = $false
    try {
        $healthRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($healthRes.status -eq "ok") {
            $apiRunning = $true
        }
    } catch {}

    $apiProcess = $null
    if (-not $apiRunning) {
        Write-Host "Starting FastAPI backend server on port 8000..." -ForegroundColor Cyan
        $apiProcess = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "--app-dir", "services/api/src", "lingua_api.main:app", "--port", "8000" -PassThru
        $retries = 30
        while ($retries -gt 0) {
            Start-Sleep -Milliseconds 500
            try {
                $healthRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($healthRes.status -eq "ok") {
                    $apiRunning = $true
                    break
                }
            } catch {}
            $retries--
        }
        if (-not $apiRunning) {
            Write-Host "[FAIL] FastAPI server failed to start on port 8000 within timeout." -ForegroundColor Red
            if ($apiProcess) { Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue }
            exit 1
        }
        Write-Host "[OK] FastAPI server started and healthy on port 8000." -ForegroundColor Green
    } else {
        Write-Host "[OK] Existing FastAPI server detected on port 8000." -ForegroundColor Green
    }

    try {
        Write-Host "Running Phase C end-to-end acceptance scenario..." -ForegroundColor Cyan
        pnpm test tests/acceptance/phase_c.test.ts
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[FAIL] Phase C acceptance test failed." -ForegroundColor Red
            exit $LASTEXITCODE
        }

        Write-Host ""
        Write-Host "========================================================" -ForegroundColor Green
        Write-Host "FRLL PHASE C: PASS" -ForegroundColor Green
        Write-Host "========================================================" -ForegroundColor Green
        exit 0
    } finally {
        if ($apiProcess) {
            Write-Host "Stopping background FastAPI server..." -ForegroundColor Cyan
            Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

if ($PhaseD) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "EXECUTING FRLL PHASE D: REAL TODAY TARGET -> REAL REVIEW ANSWER -> ATOMIC TRANSITION" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan

    # 1. Ensure FastAPI backend is running on port 8000
    $apiRunning = $false
    try {
        $healthRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($healthRes.status -eq "ok") {
            $apiRunning = $true
        }
    } catch {}

    $apiProcess = $null
    if (-not $apiRunning) {
        Write-Host "Starting FastAPI backend server on port 8000..." -ForegroundColor Cyan
        $apiProcess = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "--app-dir", "services/api/src", "lingua_api.main:app", "--port", "8000" -PassThru
        $retries = 30
        while ($retries -gt 0) {
            Start-Sleep -Milliseconds 500
            try {
                $healthRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($healthRes.status -eq "ok") {
                    $apiRunning = $true
                    break
                }
            } catch {}
            $retries--
        }
        if (-not $apiRunning) {
            Write-Host "[FAIL] FastAPI server failed to start on port 8000 within timeout." -ForegroundColor Red
            if ($apiProcess) { Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue }
            exit 1
        }
        Write-Host "[OK] FastAPI server started and healthy on port 8000." -ForegroundColor Green
    } else {
        Write-Host "[OK] Existing FastAPI server detected on port 8000." -ForegroundColor Green
    }

    try {
        Write-Host "Running Phase D end-to-end acceptance scenario..." -ForegroundColor Cyan
        pnpm test tests/acceptance/phase_d.test.ts
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[FAIL] Phase D acceptance test failed." -ForegroundColor Red
            exit $LASTEXITCODE
        }

        Write-Host ""
        Write-Host "========================================================" -ForegroundColor Green
        Write-Host "FRLL PHASE D: PASS" -ForegroundColor Green
        Write-Host "========================================================" -ForegroundColor Green
        exit 0
    } finally {
        if ($apiProcess) {
            Write-Host "Stopping background FastAPI server..." -ForegroundColor Cyan
            Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

if ($PhaseE) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "EXECUTING FRLL PHASE E: REAL REVIEW COMPETENCE -> BRAIN READ-ONLY PROJECTION (FRLL-12)" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan

    # 1. Ensure FastAPI backend is running on port 8000
    $apiRunning = $false
    try {
        $healthRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($healthRes.status -eq "ok") {
            $apiRunning = $true
        }
    } catch {}

    $apiProcess = $null
    if (-not $apiRunning) {
        Write-Host "Starting FastAPI backend server on port 8000..." -ForegroundColor Cyan
        $apiProcess = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "--app-dir", "services/api/src", "lingua_api.main:app", "--port", "8000" -PassThru
        $retries = 30
        while ($retries -gt 0) {
            Start-Sleep -Milliseconds 500
            try {
                $healthRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($healthRes.status -eq "ok") {
                    $apiRunning = $true
                    break
                }
            } catch {}
            $retries--
        }
        if (-not $apiRunning) {
            Write-Host "[FAIL] FastAPI server failed to start on port 8000 within timeout." -ForegroundColor Red
            if ($apiProcess) { Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue }
            exit 1
        }
        Write-Host "[OK] FastAPI server started and healthy on port 8000." -ForegroundColor Green
    } else {
        Write-Host "[OK] Existing FastAPI server detected on port 8000." -ForegroundColor Green
    }

    try {
        Write-Host "Running Phase E end-to-end acceptance scenario..." -ForegroundColor Cyan
        pnpm test tests/acceptance/phase_e.test.ts
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[FAIL] Phase E acceptance test failed." -ForegroundColor Red
            exit $LASTEXITCODE
        }

        Write-Host ""
        Write-Host "========================================================" -ForegroundColor Green
        Write-Host "FRLL PHASE E: PASS" -ForegroundColor Green
        Write-Host "========================================================" -ForegroundColor Green
        exit 0
    } finally {
        if ($apiProcess) {
            Write-Host "Stopping background FastAPI server..." -ForegroundColor Cyan
            Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
        }
    }
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
