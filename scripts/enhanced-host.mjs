import fs from 'node:fs/promises';
import process from 'node:process';

import { CdpPageSession, listCdpTargets } from '../src/enhanced-cdp.mjs';
import { ensureOwnedInstallDirectory, readEnhancedConfig, writeEnhancedConfig } from '../src/enhanced-storage.mjs';

function argument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value?.slice(prefix.length) ?? null;
}

function requiredNumber(name) {
  const value = Number(argument(name));
  if (!Number.isInteger(value)) throw new Error(`Missing or invalid --${name}`);
  return value;
}

function parentIsAlive(pid) {
  if (!pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

const port = requiredNumber('port');
const parentPid = Number(argument('pid')) || null;
const installDir = argument('install-dir');
if (!installDir) throw new Error('Missing --install-dir');

await ensureOwnedInstallDirectory(installDir);
const configPath = `${installDir}\\config.json`;
const runtimePath = `${installDir}\\enhanced-runtime.js`;
const config = await readEnhancedConfig(configPath);
const runtimeSource = `globalThis.__codexEndfieldInitialConfig=${JSON.stringify(config)};\n${await fs.readFile(runtimePath, 'utf8')}`;

const sessions = new Map();
let lastError = '';
let stopped = false;

async function saveConfig(payload) {
  if (typeof payload !== 'string' || payload.length > 64 * 1024) return;
  try {
    await writeEnhancedConfig(configPath, JSON.parse(payload));
  } catch (error) {
    console.warn(`Endfield settings were rejected: ${error.message}`);
  }
}

async function synchronizeTargets() {
  if (stopped || !parentIsAlive(parentPid)) {
    stop();
    return;
  }
  let targets;
  try {
    targets = await listCdpTargets(port);
    lastError = '';
  } catch (error) {
    if (lastError !== error.message) {
      lastError = error.message;
      console.warn(`Waiting for Codex CDP: ${error.message}`);
    }
    return;
  }

  const currentIds = new Set(targets.map((target) => target.id));
  for (const [id, session] of sessions) {
    if (!currentIds.has(id)) {
      session.close();
      sessions.delete(id);
    }
  }

  for (const target of targets) {
    if (sessions.has(target.id)) continue;
    const session = new CdpPageSession(target, { onBinding: saveConfig });
    try {
      await session.connect();
      await session.inject(runtimeSource);
      sessions.set(target.id, session);
      console.log(`Endfield enhancement attached to ${target.id}`);
    } catch (error) {
      session.close();
      console.warn(`Endfield enhancement could not attach: ${error.message}`);
    }
  }
}

let timer = setInterval(() => {
  synchronizeTargets().catch((error) => console.warn(`Endfield host error: ${error.message}`));
}, 1000);

function stop() {
  if (stopped) return;
  stopped = true;
  clearInterval(timer);
  for (const session of sessions.values()) session.close();
  sessions.clear();
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
await synchronizeTargets();

if (!parentPid) {
  await new Promise(() => {});
} else {
  await new Promise((resolve) => {
    const wait = setInterval(() => {
      if (stopped) {
        clearInterval(wait);
        resolve();
      }
    }, 250);
  });
}
