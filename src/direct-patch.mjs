import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createPackage, extractAll } from '@electron/asar';

import { ensureOwnedInstallDirectory } from './enhanced-storage.mjs';

export const DIRECT_SCHEMA_VERSION = 1;
export const DIRECT_MARKER = '/* codex-theme-endfield:direct-preload-v1 */';
export const SUPPORTED_DIRECT_VERSIONS = Object.freeze({
  '26.903.9818.0': Object.freeze({ internalVersion: '26.903.71938', preloadPath: '.vite/build/preload.js' }),
});

const PACKAGE_NAME = 'OpenAI.Codex';
const PACKAGE_FAMILY = '2p2nqsd0c76g0';

function hashBytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export async function sha256(filePath) {
  return hashBytes(await fs.readFile(filePath));
}

function normalizeAsarPath(value) {
  return String(value).replaceAll('\\', '/').replace(/^\/+/, '');
}

export function buildDirectPreloadPatch(preloadSource, runtimeSource) {
  if (preloadSource.includes(DIRECT_MARKER)) return { source: preloadSource, changed: false };
  const bootstrap = `\n${DIRECT_MARKER}\n(()=>{\n  try {\n    const fs = require('node:fs');\n    const path = require('node:path');\n    let config = {};\n    const localAppData = process.env.LOCALAPPDATA;\n    if (localAppData) {\n      try {\n        const configPath = path.join(localAppData, 'codex-theme-endfield', 'config.json');\n        config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\\uFEFF/, ''));\n      } catch {}\n    }\n    globalThis.__codexEndfieldInitialConfig = config;\n    (${runtimeSource})();\n  } catch (error) {\n    console.warn('[Endfield direct preload] enhancement disabled:', error?.message ?? error);\n  }\n})();\n`;
  return { source: `${preloadSource}${bootstrap}`, changed: true };
}

export function isSupportedDirectVersion(packageVersion) {
  return Object.hasOwn(SUPPORTED_DIRECT_VERSIONS, String(packageVersion));
}

export function assertSafePackageRoot(packageRoot) {
  const resolved = path.resolve(packageRoot);
  const expected = new RegExp(`(?:^|[\\\\/])WindowsApps[\\\\/]OpenAI\\.Codex_[^\\\\/]+__${PACKAGE_FAMILY}$`, 'i');
  if (!expected.test(resolved)) {
    throw new Error(`Refusing an unexpected ChatGPT package location: ${resolved}`);
  }
  const stat = fssync.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Refusing a reparse-point package directory: ${resolved}`);
  return resolved;
}

export function directPaths(packageRoot) {
  const root = assertSafePackageRoot(packageRoot);
  const asarPath = path.join(root, 'app', 'resources', 'app.asar');
  return { packageRoot: root, asarPath, executable: path.join(root, 'app', 'ChatGPT.exe') };
}

function powershellJson(script) {
  const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8' }).trim();
  return output ? JSON.parse(output) : null;
}

export function resolveChatGptPackage() {
  if (process.platform !== 'win32') throw new Error('Direct patch mode is Windows-only.');
  const packageInfo = powershellJson("$p=Get-AppxPackage -Name OpenAI.Codex | Sort-Object {[version]$_.Version} | Select-Object -Last 1; if ($p) { $p | Select-Object Name,Version,InstallLocation,PackageFullName | ConvertTo-Json -Compress }");
  if (!packageInfo?.InstallLocation) throw new Error('ChatGPT MSIX package was not found.');
  const paths = directPaths(packageInfo.InstallLocation);
  if (!fssync.existsSync(paths.asarPath)) throw new Error(`ChatGPT app.asar was not found: ${paths.asarPath}`);
  return { ...packageInfo, ...paths };
}

export function assertChatGptClosed() {
  if (process.platform !== 'win32') return;
  const count = powershellJson("@(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue).Count");
  if (Number(count) > 0) throw new Error('ChatGPT is running. Fully quit it from the tray before applying or restoring an app.asar patch.');
}

export function assertSupportedPackage(packageInfo) {
  const supported = SUPPORTED_DIRECT_VERSIONS[String(packageInfo.Version)];
  if (!supported) {
    throw new Error(`Direct patch is not enabled for ChatGPT ${packageInfo.Version}. Supported versions: ${Object.keys(SUPPORTED_DIRECT_VERSIONS).join(', ')}.`);
  }
  return supported;
}

function backupRoot() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) throw new Error('LOCALAPPDATA is not available.');
  return path.join(localAppData, 'codex-theme-endfield', 'direct-backups');
}

async function atomicCopy(source, destination) {
  const temp = `${destination}.tmp-${crypto.randomBytes(8).toString('hex')}`;
  await fs.copyFile(source, temp);
  try {
    await fs.rename(temp, destination);
  } catch (error) {
    if (!['EEXIST', 'EPERM'].includes(error.code)) {
      await fs.rm(temp, { force: true });
      throw error;
    }
    // Windows cannot atomically rename over an existing MSIX file. The
    // original is already hash-backed; copyFile keeps the replacement scoped
    // to the exact target and the caller verifies the resulting hash.
    await fs.copyFile(temp, destination);
    await fs.rm(temp, { force: true });
  }
}

async function withExtractedArchive(archivePath, callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'endfield-asar-'));
  try {
    extractAll(archivePath, directory);
    return await callback(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readState(root) {
  try { return JSON.parse(await fs.readFile(path.join(root, 'state.json'), 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function inspectDirectPatch(packageInfo) {
  assertSupportedPackage(packageInfo);
  const currentSha256 = await sha256(packageInfo.asarPath);
  const root = backupRoot();
  const state = await readState(root);
  return { packageVersion: String(packageInfo.Version), asarPath: packageInfo.asarPath, currentSha256, state };
}

export async function applyDirectPatch(packageInfo, { runtimePath, confirm = false } = {}) {
  if (!confirm) throw new Error('This changes the installed ChatGPT app.asar. Re-run with --apply to confirm.');
  const supported = assertSupportedPackage(packageInfo);
  const installRoot = path.join(process.env.LOCALAPPDATA ?? '', 'codex-theme-endfield');
  await ensureOwnedInstallDirectory(installRoot);
  const backupBase = backupRoot();
  await fs.mkdir(backupBase, { recursive: true });
  const versionRoot = path.join(backupBase, String(packageInfo.Version));
  await fs.mkdir(versionRoot, { recursive: true });
  const statePath = path.join(backupBase, 'state.json');
  const originalSha256 = await sha256(packageInfo.asarPath);
  const previousState = await readState(backupBase);
  if (previousState?.status === 'applied' && previousState.patchedSha256 === originalSha256) return { ...previousState, changed: false };
  if (previousState?.status === 'applied' && previousState.originalSha256 !== originalSha256) {
    throw new Error('The installed app.asar no longer matches the last direct patch. Refusing to overwrite an unknown update or modification.');
  }
  const backupPath = path.join(versionRoot, 'app.asar.original');
  if (!fssync.existsSync(backupPath)) await fs.copyFile(packageInfo.asarPath, backupPath);
  else if (await sha256(backupPath) !== originalSha256) throw new Error('Existing direct backup hash does not match the current app.asar; refusing to continue.');
  const runtimeSource = await fs.readFile(runtimePath, 'utf8');
  const patchedArchive = path.join(versionRoot, 'app.asar.patched');
  await withExtractedArchive(packageInfo.asarPath, async (directory) => {
    const appPackage = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
    if (appPackage.version !== supported.internalVersion) {
      throw new Error(`Internal ChatGPT app version ${appPackage.version} does not match the verified ${supported.internalVersion}.`);
    }
    const preloadPath = path.join(directory, ...supported.preloadPath.split('/'));
    const preloadSource = await fs.readFile(preloadPath, 'utf8');
    const patched = buildDirectPreloadPatch(preloadSource, runtimeSource);
    if (patched.changed) await fs.writeFile(preloadPath, patched.source, 'utf8');
    if (fssync.existsSync(patchedArchive)) await fs.rm(patchedArchive, { force: true });
    await createPackage(directory, patchedArchive);
  });
  const patchedSha256 = await sha256(patchedArchive);
  const state = {
    schemaVersion: DIRECT_SCHEMA_VERSION,
    status: 'applied',
    packageName: PACKAGE_NAME,
    packageVersion: String(packageInfo.Version),
    internalVersion: supported.internalVersion,
    asarPath: packageInfo.asarPath,
    preloadPath: supported.preloadPath,
    originalSha256,
    patchedSha256,
    backupPath,
    appliedAt: new Date().toISOString(),
  };
  await atomicCopy(patchedArchive, packageInfo.asarPath);
  if (await sha256(packageInfo.asarPath) !== patchedSha256) throw new Error('Patched app.asar hash verification failed after replacement. Restore from the recorded backup before launching.');
  await writeJson(statePath, state);
  return { ...state, changed: true };
}

export async function restoreDirectPatch(packageInfo) {
  const root = backupRoot();
  const state = await readState(root);
  if (!state || state.status !== 'applied') throw new Error('No active Endfield direct patch was found.');
  if (path.resolve(state.asarPath) !== path.resolve(packageInfo.asarPath) || String(state.packageVersion) !== String(packageInfo.Version)) {
    throw new Error('The installed ChatGPT version or path changed; refusing to restore over a different app.');
  }
  const currentSha256 = await sha256(packageInfo.asarPath);
  if (currentSha256 !== state.patchedSha256) throw new Error('Current app.asar hash does not match the Endfield patch; refusing to overwrite an unknown file.');
  const backupSha256 = await sha256(state.backupPath);
  if (backupSha256 !== state.originalSha256) throw new Error('The Endfield backup hash is invalid; refusing to restore.');
  await atomicCopy(state.backupPath, packageInfo.asarPath);
  if (await sha256(packageInfo.asarPath) !== state.originalSha256) throw new Error('Restored app.asar hash verification failed.');
  const restored = { ...state, status: 'restored', restoredAt: new Date().toISOString(), currentSha256: state.originalSha256 };
  await writeJson(path.join(root, 'state.json'), restored);
  return restored;
}

export { normalizeAsarPath };
