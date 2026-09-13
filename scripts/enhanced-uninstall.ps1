$ErrorActionPreference = 'Stop'

$localBase = if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { $env:TEMP } else { $env:LOCALAPPDATA }
$installRoot = [IO.Path]::GetFullPath((Join-Path $localBase 'codex-theme-endfield'))
$marker = Join-Path $installRoot '.owner'
if (-not (Test-Path -LiteralPath $marker) -or (Get-Content -Raw -LiteralPath $marker).Trim() -ne 'codex-theme-endfield') {
  throw "Refusing to remove an unowned directory: $installRoot"
}

$shortcutPath = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Codex Endfield.lnk'
if (Test-Path -LiteralPath $shortcutPath) { Remove-Item -LiteralPath $shortcutPath -Force }
Remove-Item -LiteralPath $installRoot -Recurse -Force
Write-Host 'Codex Endfield enhancement removed. Codex itself and ~/.codex/config.toml were not changed.'
