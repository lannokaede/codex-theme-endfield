$ErrorActionPreference = 'Stop'

$localBase = if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { $env:TEMP } else { $env:LOCALAPPDATA }
$installRoot = [IO.Path]::GetFullPath((Join-Path $localBase 'codex-theme-endfield'))
$repoOwner = Join-Path $PSScriptRoot '.owner'
if (-not (Test-Path -LiteralPath $repoOwner)) {
  $installedUninstall = Join-Path $installRoot 'enhanced-uninstall.ps1'
  if (Test-Path -LiteralPath $installedUninstall) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installedUninstall
    exit $LASTEXITCODE
  }
}
$marker = Join-Path $installRoot '.owner'
if (-not (Test-Path -LiteralPath $marker) -or (Get-Content -Raw -LiteralPath $marker).Trim() -ne 'codex-theme-endfield') {
  throw "Refusing to remove an unowned directory: $installRoot"
}
$installItem = Get-Item -LiteralPath $installRoot -Force
if (($installItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
  throw "Refusing to remove a reparse-point directory: $installRoot"
}

$shortcutRoot = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$shell = New-Object -ComObject WScript.Shell
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$launchPath = [IO.Path]::GetFullPath((Join-Path $installRoot 'enhanced-launch.ps1'))
function Remove-OwnedShortcut($shortcutPath) {
  if (-not (Test-Path -LiteralPath $shortcutPath)) { return }
  try {
    $candidate = $shell.CreateShortcut($shortcutPath)
    $owned = [IO.Path]::GetFullPath($candidate.TargetPath) -eq [IO.Path]::GetFullPath($powershellPath) -and [string]$candidate.Arguments -like "*$launchPath*"
    if ($owned) { Remove-Item -LiteralPath $shortcutPath -Force }
  } catch { }
}
Remove-OwnedShortcut (Join-Path $shortcutRoot 'ChatGPT Endfield.lnk')
Remove-OwnedShortcut (Join-Path $shortcutRoot 'Codex Endfield.lnk')
Remove-Item -LiteralPath $installRoot -Recurse -Force
Write-Host 'ChatGPT Endfield enhancement removed. ChatGPT itself and ~/.codex/config.toml were not changed.'
