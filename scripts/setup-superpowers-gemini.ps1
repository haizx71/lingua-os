$ErrorActionPreference = "Stop"

if (-not (Get-Command gemini -ErrorAction SilentlyContinue)) {
    throw "Gemini CLI is required. Install/configure Gemini CLI first."
}

& gemini extensions install https://github.com/obra/superpowers
if ($LASTEXITCODE -ne 0) {
    Write-Host "Install did not succeed. Trying to update an existing Superpowers extension..." -ForegroundColor Yellow
    & gemini extensions update superpowers
    if ($LASTEXITCODE -ne 0) {
        throw "Superpowers install/update failed."
    }
}

Write-Host "Superpowers is available to Gemini CLI. Restart the Gemini session if needed." -ForegroundColor Green
