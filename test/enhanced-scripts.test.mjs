import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('PowerShell entry points keep install ownership checks and repo delegation', async () => {
  const launch = await fs.readFile(new URL('../scripts/enhanced-launch.ps1', import.meta.url), 'utf8');
  const install = await fs.readFile(new URL('../scripts/enhanced-install.ps1', import.meta.url), 'utf8');
  const uninstall = await fs.readFile(new URL('../scripts/enhanced-uninstall.ps1', import.meta.url), 'utf8');
  const doctor = await fs.readFile(new URL('../scripts/enhanced-doctor.mjs', import.meta.url), 'utf8');

  assert.match(launch, /127\.0\.0\.1/);
  assert.match(launch, /remote-debugging-port/);
  assert.match(launch, /Enhanced mode is not installed/);
  assert.match(launch, /ReparsePoint/);
  assert.match(install, /codex-theme-endfield/);
  assert.match(install, /WriteAllText|NoNewline/);
  assert.match(install, /ReparsePoint/);
  assert.match(uninstall, /owner marker|unowned directory/i);
  assert.match(uninstall, /ReparsePoint/);
  assert.match(uninstall, /Recurse/);
  assert.match(install, /ChatGPT Endfield\.lnk/);
  assert.match(launch, /ChatGPT is already running/);
  assert.match(uninstall, /Codex Endfield\.lnk/);
  assert.match(uninstall, /ChatGPT Endfield\.lnk/);
  assert.match(doctor, /ChatGPT/);
});
