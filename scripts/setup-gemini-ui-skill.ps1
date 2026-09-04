$ErrorActionPreference = "Stop"

Write-Host "LINGUA OS - UI UX Pro Max setup for Gemini" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is required. Install Node.js first, then rerun this script."
}
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    throw "npx is required. Install a current Node.js/npm distribution first."
}

$pythonOk = $false
foreach ($cmd in @("python", "python3", "py")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        try {
            & $cmd --version
            $pythonOk = $true
            break
        } catch {}
    }
}
if (-not $pythonOk) {
    Write-Warning "Python 3.x was not detected. The skill can be installed, but its search/design-system script requires Python 3.x."
}

Write-Host "Installing/updating project-local Gemini skill files using the official CLI..." -ForegroundColor Yellow
& npx --yes ui-ux-pro-max-cli@latest init --ai gemini
if ($LASTEXITCODE -ne 0) { throw "UI UX Pro Max CLI failed with exit code $LASTEXITCODE." }

Write-Host "Done. Reopen/reload the Gemini workspace if the skill is not detected immediately." -ForegroundColor Green
Write-Host "Next: send GEMINI_START_PROMPT.md to Gemini." -ForegroundColor Green
