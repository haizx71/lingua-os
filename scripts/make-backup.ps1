$ErrorActionPreference = "Stop"

Add-Type -AssemblyName "System.IO.Compression"
Add-Type -AssemblyName "System.IO.Compression.FileSystem"

$root = "d:\LINGUA_OS_PROJECT_STARTER"
$zipPath = Join-Path $root "LINGUA_OS_BACKUP.zip"

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

$excludeDirs = @('node_modules', '.next', '.git', '.pnpm-store', 'storybook-static', 'dist', '.turbo')
$excludeFiles = @('LINGUA_OS_BACKUP.zip')

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

$allFiles = Get-ChildItem -Path $root -Recurse -File

$count = 0
foreach ($file in $allFiles) {
    $relPath = $file.FullName.Substring($root.Length).TrimStart('\', '/')
    
    # Check if any path segment matches exclude dirs
    $segments = $relPath.Split([char[]]@('\', '/'))
    $skip = $false
    foreach ($seg in $segments) {
        if ($excludeDirs -contains $seg) {
            $skip = $true
            break
        }
    }
    if ($excludeFiles -contains $file.Name) {
        $skip = $true
    }

    if (-not $skip) {
        $entryName = $relPath.Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        $count++
    }
}

$zip.Dispose()

$zipItem = Get-Item $zipPath
$sizeMB = [math]::Round($zipItem.Length / 1MB, 2)
Write-Host "Success! Created backup with $count files."
Write-Host "File: $($zipItem.FullName) ($sizeMB MB)"
