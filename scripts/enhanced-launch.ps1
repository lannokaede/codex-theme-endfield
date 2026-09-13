$ErrorActionPreference = 'Stop'

$installRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$ownerPath = Join-Path $installRoot '.owner'
if (-not (Test-Path -LiteralPath $ownerPath) -or (Get-Content -Raw -LiteralPath $ownerPath).Trim() -ne 'codex-theme-endfield') {
  $localBase = if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { $env:TEMP } else { $env:LOCALAPPDATA }
  $installedRoot = [IO.Path]::GetFullPath((Join-Path $localBase 'codex-theme-endfield'))
  $installedLaunch = Join-Path $installedRoot 'enhanced-launch.ps1'
  $installedOwner = Join-Path $installedRoot '.owner'
  if ((Test-Path -LiteralPath $installedLaunch) -and (Test-Path -LiteralPath $installedOwner) -and (Get-Content -Raw -LiteralPath $installedOwner).Trim() -eq 'codex-theme-endfield') {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installedLaunch
    exit $LASTEXITCODE
  }
  throw "Enhanced mode is not installed. Run npm run enhanced:install first."
}

$existing = @(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue)
if ($existing.Count -gt 0) {
  Write-Error 'Codex is already running. Close every Codex window, then launch Codex Endfield again.'
  exit 2
}

$package = Get-AppxPackage -Name OpenAI.Codex | Sort-Object { [version]$_.Version } | Select-Object -Last 1
if (-not $package) { throw 'OpenAI.Codex MSIX package was not found.' }
$codexExe = Join-Path $package.InstallLocation 'app\ChatGPT.exe'
if (-not (Test-Path -LiteralPath $codexExe)) { throw "Codex executable was not found: $codexExe" }

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'), 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()

$codex = Start-Process -FilePath $codexExe -ArgumentList @(
  "--remote-debugging-address=127.0.0.1",
  "--remote-debugging-port=$port",
  '--remote-allow-origins=http://127.0.0.1'
) -PassThru

try {
  & node (Join-Path $installRoot 'enhanced-host.mjs') "--port=$port" "--pid=$($codex.Id)" "--install-dir=$installRoot"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  if (-not $codex.HasExited) {
    Write-Host 'Endfield host stopped; Codex remains open without the enhancement layer.'
  }
}
