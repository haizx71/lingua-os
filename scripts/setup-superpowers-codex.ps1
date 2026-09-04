$ErrorActionPreference = "Stop"
$target = Join-Path $env:USERPROFILE ".codex\superpowers"
$skillsDir = Join-Path $env:USERPROFILE ".agents\skills"
$link = Join-Path $skillsDir "superpowers"

if (Test-Path (Join-Path $target ".git")) {
  git -C $target pull --ff-only
} else {
  git clone https://github.com/obra/superpowers.git $target
}

New-Item -ItemType Directory -Force -Path $skillsDir | Out-Null
if (Test-Path $link) {
  Remove-Item -Recurse -Force $link
}
cmd /c mklink /J "$link" "$target\skills"
Write-Host "Superpowers installed for Codex. Restart Codex before use."
