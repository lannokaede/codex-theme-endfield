import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { DEFAULT_ENHANCED_CONFIG, normalizeEnhancedConfig } from './enhanced-config.mjs';

const OWNER_MARKER = 'codex-theme-endfield\n';
const OWNER_FILE = '.owner';
const MAX_CONFIG_BYTES = 64 * 1024;

async function assertOwnedDirectory(directory) {
  const stat = await fs.lstat(directory).catch(() => null);
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Refusing to use directory without owner marker: ${directory}`);
  }
  const marker = await fs.readFile(path.join(directory, OWNER_FILE), 'utf8').catch(() => '');
  if (marker !== OWNER_MARKER) {
    throw new Error(`Refusing to use directory without owner marker: ${directory}`);
  }
}

export async function ensureOwnedInstallDirectory(directory) {
  const existing = await fs.lstat(directory).catch(() => null);
  if (existing?.isSymbolicLink() || (existing && !existing.isDirectory())) {
    throw new Error(`Refusing to initialize an unsafe install directory: ${directory}`);
  }
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, OWNER_FILE), OWNER_MARKER, { encoding: 'utf8', flag: 'wx' }).catch(async (error) => {
    if (error.code !== 'EEXIST') throw error;
    await assertOwnedDirectory(directory);
  });
  await assertOwnedDirectory(directory);
}

export async function readEnhancedConfig(configPath) {
  const directory = path.dirname(configPath);
  await assertOwnedDirectory(directory);
  const raw = await fs.readFile(configPath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (raw == null) return normalizeEnhancedConfig(DEFAULT_ENHANCED_CONFIG);
  if (Buffer.byteLength(raw, 'utf8') > MAX_CONFIG_BYTES) {
    throw new Error('Enhanced theme config is too large');
  }
  try {
    return normalizeEnhancedConfig(JSON.parse(raw));
  } catch (error) {
    throw new Error(`Enhanced theme config is invalid: ${error.message}`);
  }
}

export async function writeEnhancedConfig(configPath, input) {
  const directory = path.dirname(configPath);
  await assertOwnedDirectory(directory);
  const config = normalizeEnhancedConfig(input);
  const payload = `${JSON.stringify(config, null, 2)}\n`;
  const tempPath = path.join(directory, `.tmp-${crypto.randomBytes(8).toString('hex')}.json`);
  const handle = await fs.open(tempPath, 'wx');
  try {
    await handle.writeFile(payload, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(tempPath, configPath);
  } catch (error) {
    if (error.code !== 'EEXIST' && error.code !== 'EPERM') throw error;
    await fs.rm(configPath, { force: true });
    await fs.rename(tempPath, configPath);
  }
}

export { OWNER_FILE, OWNER_MARKER };
