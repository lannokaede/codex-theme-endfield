import { execFileSync } from 'node:child_process';
import net from 'node:net';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

function powershellJson(script) {
  const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8' }).trim();
  return output ? JSON.parse(output) : null;
}

const failures = [];
const warnings = [];
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 20) failures.push(`Node 20 or newer is required (found ${process.version})`);
else console.log(`✓ Node ${process.version}`);

if (process.platform !== 'win32') failures.push('Enhanced mode v1 is Windows-only');
else console.log('✓ Windows platform');

let packageInfo = null;
try {
  packageInfo = powershellJson("$p=Get-AppxPackage -Name OpenAI.Codex | Sort-Object {[version]$_.Version} | Select-Object -Last 1; if ($p) { $p | Select-Object Name,Version,InstallLocation,PackageFullName | ConvertTo-Json -Compress }");
} catch (error) {
  failures.push(`Could not query the ChatGPT MSIX package: ${error.message}`);
}

if (!packageInfo?.InstallLocation) {
  failures.push('ChatGPT MSIX package was not found');
} else {
  const executable = path.join(packageInfo.InstallLocation, 'app', 'ChatGPT.exe');
  if (!fs.existsSync(executable)) failures.push(`ChatGPT executable not found: ${executable}`);
  else console.log(`✓ ChatGPT ${packageInfo.Version} at ${executable}`);
}

try {
  const count = powershellJson("@(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue).Count");
  if (Number(count) > 0) warnings.push('ChatGPT is currently running; close it before using enhanced:launch');
} catch {
  warnings.push('Could not determine whether ChatGPT is currently running');
}

const server = net.createServer();
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const port = server.address().port;
server.close();
console.log(`✓ Loopback port allocation works (sample ${port})`);

const installDir = path.join(process.env.LOCALAPPDATA ?? '', 'codex-theme-endfield');
if (installDir && fs.existsSync(installDir)) console.log(`✓ Enhanced install directory exists: ${installDir}`);
else warnings.push(`Enhanced install directory is not installed yet: ${installDir}`);

for (const warning of warnings) console.warn(`! ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Endfield enhanced mode is ready for installation or launch.');
}
