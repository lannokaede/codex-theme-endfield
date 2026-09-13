$ErrorActionPreference = 'Stop'

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localBase = if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { $env:TEMP } else { $env:LOCALAPPDATA }
$installRoot = [IO.Path]::GetFullPath((Join-Path $localBase 'codex-theme-endfield'))
$marker = Join-Path $installRoot '.owner'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (Test-Path -LiteralPath $installRoot) {
  $existingItem = Get-Item -LiteralPath $installRoot -Force
  if (($existingItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Refusing to use a reparse-point install directory: $installRoot"
  }
  if (-not (Test-Path -LiteralPath $marker) -or (Get-Content -Raw -LiteralPath $marker).Trim() -ne 'codex-theme-endfield') {
    throw "Refusing to overwrite an unowned directory: $installRoot"
  }
} else {
  New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
  [IO.File]::WriteAllText($marker, "codex-theme-endfield`n", $utf8NoBom)
}

$required = @(
  'dist\enhanced-runtime.js',
  'scripts\enhanced-host.mjs',
  'scripts\enhanced-launch.ps1',
  'scripts\enhanced-uninstall.ps1',
  'src\enhanced-cdp.mjs',
  'src\enhanced-config.mjs',
  'src\enhanced-events.mjs',
  'src\enhanced-storage.mjs',
  'package.json',
  'package-lock.json'
)
foreach ($relative in $required) {
  $source = Join-Path $repoRoot $relative
  if (-not (Test-Path -LiteralPath $source)) { throw "Build artifact is missing: $source" }
  $destination = Join-Path $installRoot ([IO.Path]::GetFileName($relative))
  if ($relative -like 'src\*') { $destination = Join-Path (Join-Path $installRoot 'src') ([IO.Path]::GetFileName($relative)) }
  if ($relative -eq 'scripts\enhanced-host.mjs') { $destination = Join-Path $installRoot $relative }
  $parent = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Force
}

$legacyHostPath = Join-Path $installRoot 'enhanced-host.mjs'
if (Test-Path -LiteralPath $legacyHostPath) { Remove-Item -LiteralPath $legacyHostPath -Force }

if (-not (Test-Path -LiteralPath (Join-Path $installRoot 'config.json'))) {
  $defaultConfig = @'
{
  "schemaVersion": 1,
  "enabled": true,
  "palette": "valley-yellow",
  "corner": "square",
  "interactions": true,
  "contour": { "enabled": true, "animated": true, "fps": 24, "speed": 1, "pauseOnScroll": true },
  "watermark": { "enabled": true, "persistent": true },
  "loader": { "mode": "first-launch" },
  "taskPlate": { "start": false, "complete": true, "animation": true, "durationMs": 3000 }
}
'@
  [IO.File]::WriteAllText((Join-Path $installRoot 'config.json'), "$defaultConfig`n", $utf8NoBom)
}

& npm install --prefix $installRoot --omit=dev --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Installing the enhanced runtime dependency failed.' }

$shortcutRoot = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
New-Item -ItemType Directory -Path $shortcutRoot -Force | Out-Null
$shell = New-Object -ComObject WScript.Shell
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$launchPath = [IO.Path]::GetFullPath((Join-Path $installRoot 'enhanced-launch.ps1'))

function Test-OwnedShortcut($shortcutPath) {
  if (-not (Test-Path -LiteralPath $shortcutPath)) { return $false }
  try {
    $candidate = $shell.CreateShortcut($shortcutPath)
    return ([IO.Path]::GetFullPath($candidate.TargetPath) -eq [IO.Path]::GetFullPath($powershellPath) -and [string]$candidate.Arguments -like "*$launchPath*")
  } catch {
    return $false
  }
}

function Write-OwnedShortcut($shortcutPath) {
  if ((Test-Path -LiteralPath $shortcutPath) -and -not (Test-OwnedShortcut $shortcutPath)) {
    throw "Refusing to overwrite an unowned shortcut: $shortcutPath"
  }
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $powershellPath
  $shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launchPath`" -Shortcut"
  $shortcut.WorkingDirectory = $installRoot
  $shortcut.Description = 'Launch ChatGPT with the Endfield interactive enhancement layer'
  $shortcut.Save()
}

$legacyShortcutPath = Join-Path $shortcutRoot 'Codex Endfield.lnk'
if (Test-OwnedShortcut $legacyShortcutPath) { Remove-Item -LiteralPath $legacyShortcutPath -Force }

$shortcutPath = Join-Path $shortcutRoot 'ChatGPT Endfield.lnk'
Write-OwnedShortcut $shortcutPath

$desktopRoot = [Environment]::GetFolderPath('Desktop')
$desktopShortcutPath = Join-Path $desktopRoot 'ChatGPT Endfield.lnk'
Write-OwnedShortcut $desktopShortcutPath

Write-Host "Installed ChatGPT Endfield enhancement to $installRoot"
Write-Host "Start Menu shortcut: $shortcutPath"
Write-Host "Desktop shortcut: $desktopShortcutPath"
