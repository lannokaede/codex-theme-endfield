$ErrorActionPreference = 'Stop'

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localBase = if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { $env:TEMP } else { $env:LOCALAPPDATA }
$installRoot = [IO.Path]::GetFullPath((Join-Path $localBase 'codex-theme-endfield'))
$marker = Join-Path $installRoot '.owner'

if (Test-Path -LiteralPath $installRoot) {
  if (-not (Test-Path -LiteralPath $marker) -or (Get-Content -Raw -LiteralPath $marker).Trim() -ne 'codex-theme-endfield') {
    throw "Refusing to overwrite an unowned directory: $installRoot"
  }
} else {
  New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
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
  if ($relative -like 'scripts\*') { $destination = Join-Path $installRoot ([IO.Path]::GetFileName($relative)) }
  if ($relative -like 'dist\*') { $destination = Join-Path $installRoot ([IO.Path]::GetFileName($relative)) }
  $parent = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Force
}

if (-not (Test-Path -LiteralPath (Join-Path $installRoot 'config.json'))) {
  @'
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
'@ | Set-Content -LiteralPath (Join-Path $installRoot 'config.json') -Encoding utf8
}

& npm install --prefix $installRoot --omit=dev --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Installing the enhanced runtime dependency failed.' }

$shortcutRoot = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$shortcutPath = Join-Path $shortcutRoot 'Codex Endfield.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $installRoot 'enhanced-launch.ps1')`""
$shortcut.WorkingDirectory = $installRoot
$shortcut.Description = 'Launch Codex with the Endfield interactive enhancement layer'
$shortcut.Save()

Write-Host "Installed Codex Endfield enhancement to $installRoot"
Write-Host "Start Menu shortcut: $shortcutPath"
