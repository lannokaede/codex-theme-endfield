param([switch]$Shortcut)

$ErrorActionPreference = 'Stop'

function Show-LaunchMessage([string]$Message, [string]$Kind = 'Error') {
  [Console]::Error.WriteLine($Message)
  if (-not $Shortcut) { return }

  try {
    Add-Type -AssemblyName System.Windows.Forms
    $icon = if ($Kind -eq 'Information') {
      [System.Windows.Forms.MessageBoxIcon]::Information
    } else {
      [System.Windows.Forms.MessageBoxIcon]::Error
    }
    [System.Windows.Forms.MessageBox]::Show(
      $Message,
      'ChatGPT Endfield',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      $icon
    ) | Out-Null
  } catch {
    # The console message remains available for command-line launches.
  }
}

trap {
  Show-LaunchMessage $_.Exception.Message
  exit 1
}

$installRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$ownerPath = Join-Path $installRoot '.owner'
if (-not (Test-Path -LiteralPath $ownerPath) -or (Get-Content -Raw -LiteralPath $ownerPath).Trim() -ne 'codex-theme-endfield') {
  $localBase = if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { $env:TEMP } else { $env:LOCALAPPDATA }
  $installedRoot = [IO.Path]::GetFullPath((Join-Path $localBase 'codex-theme-endfield'))
  $installedLaunch = Join-Path $installedRoot 'enhanced-launch.ps1'
  $installedOwner = Join-Path $installedRoot '.owner'
  if ((Test-Path -LiteralPath $installedLaunch) -and (Test-Path -LiteralPath $installedOwner) -and (Get-Content -Raw -LiteralPath $installedOwner).Trim() -eq 'codex-theme-endfield') {
    $delegateArguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $installedLaunch)
    if ($Shortcut) { $delegateArguments += '-Shortcut' }
    & powershell.exe @delegateArguments
    exit $LASTEXITCODE
  }
  throw "Enhanced mode is not installed. Run npm run enhanced:install first."
}
$installItem = Get-Item -LiteralPath $installRoot -Force
if (($installItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
  throw "Refusing to launch from a reparse-point directory: $installRoot"
}

$existing = @(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue)
if ($existing.Count -gt 0) {
  Show-LaunchMessage 'ChatGPT is already running. Endfield cannot attach to an app that is already open. Fully quit ChatGPT from the system tray, confirm that no ChatGPT.exe process remains, then try this shortcut again.' 'Information'
  exit 2
}

$package = Get-AppxPackage -Name OpenAI.Codex | Sort-Object { [version]$_.Version } | Select-Object -Last 1
if (-not $package) { throw 'OpenAI.Codex MSIX package was not found.' }
$codexExe = Join-Path $package.InstallLocation 'app\ChatGPT.exe'
if (-not (Test-Path -LiteralPath $codexExe)) { throw "ChatGPT executable was not found: $codexExe" }

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
  & node (Join-Path $installRoot 'scripts\enhanced-host.mjs') "--port=$port" "--pid=$($codex.Id)" "--install-dir=$installRoot"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  if (-not $codex.HasExited) {
    Write-Host 'Endfield host stopped; ChatGPT remains open without the enhancement layer.'
  }
}
