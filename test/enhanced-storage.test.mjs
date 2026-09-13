import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  ensureOwnedInstallDirectory,
  readEnhancedConfig,
  writeEnhancedConfig,
} from '../src/enhanced-storage.mjs';

test('storage creates an owned directory and reads normalized defaults', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'endfield-storage-'));
  const installDir = path.join(root, 'codex-theme-endfield');
  await ensureOwnedInstallDirectory(installDir);
  const config = await readEnhancedConfig(path.join(installDir, 'config.json'));

  assert.equal(config.schemaVersion, 1);
  assert.equal(await fs.readFile(path.join(installDir, '.owner'), 'utf8'), 'codex-theme-endfield\n');
});

test('storage writes atomically and normalizes untrusted values', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'endfield-storage-'));
  const installDir = path.join(root, 'codex-theme-endfield');
  await ensureOwnedInstallDirectory(installDir);
  const configPath = path.join(installDir, 'config.json');
  await writeEnhancedConfig(configPath, { palette: 'wuling-cyan', contour: { fps: 999 } });
  const saved = JSON.parse(await fs.readFile(configPath, 'utf8'));

  assert.equal(saved.palette, 'wuling-cyan');
  assert.equal(saved.contour.fps, 60);
  assert.equal(await fs.readdir(installDir).then((files) => files.includes('config.json')), true);
  assert.equal((await fs.readdir(installDir)).some((file) => file.includes('.tmp-')), false);
});

test('storage accepts UTF-8 BOM configs created by Windows PowerShell', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'endfield-storage-'));
  const installDir = path.join(root, 'codex-theme-endfield');
  await ensureOwnedInstallDirectory(installDir);
  const configPath = path.join(installDir, 'config.json');
  await fs.writeFile(configPath, `\uFEFF${JSON.stringify({ palette: 'wuling-cyan' })}`, 'utf8');

  const config = await readEnhancedConfig(configPath);

  assert.equal(config.palette, 'wuling-cyan');
});

test('storage refuses to overwrite an unowned directory', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'endfield-storage-'));
  const installDir = path.join(root, 'unowned');
  await fs.mkdir(installDir);
  await assert.rejects(() => writeEnhancedConfig(path.join(installDir, 'config.json'), {}), /owner marker/i);
});
