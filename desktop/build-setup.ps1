param([string]$Compiler = $env:INNO_SETUP_COMPILER)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot

if (-not $Compiler) {
    $command = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($command) { $Compiler = $command.Source }
    foreach ($candidate in @((Join-Path $projectRoot '.tooling/inno/compiler/tools/ISCC.exe'), "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe", "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe")) {
        if (-not $Compiler -and (Test-Path -LiteralPath $candidate)) { $Compiler = $candidate }
    }
}
if (-not $Compiler -or -not (Test-Path -LiteralPath $Compiler)) {
    throw 'Inno Setup 6.7 or newer is required. Install it or set INNO_SETUP_COMPILER to the full path of ISCC.exe.'
}

$version = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
& node 'scripts/build-release.cjs'
if ($LASTEXITCODE -ne 0) { throw 'Release minification failed.' }
& node 'node_modules/electron-builder/cli.js' --win --dir --x64 --publish never
if ($LASTEXITCODE -ne 0) { throw 'Desktop packaging failed.' }

& (Join-Path $PSScriptRoot 'prepare-installer-artwork.ps1')

& $Compiler "/DAppVersion=$version" (Join-Path $PSScriptRoot 'setup.iss')
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup compilation failed.' }
Write-Host "Created dist/Hoop-League-Studio-$version-x64-Setup.exe"
