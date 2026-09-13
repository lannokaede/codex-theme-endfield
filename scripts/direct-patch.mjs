import path from 'node:path';
import process from 'node:process';

import {
  applyDirectPatch,
  assertChatGptClosed,
  inspectDirectPatch,
  resolveChatGptPackage,
  restoreDirectPatch,
} from '../src/direct-patch.mjs';

const command = process.argv[2] ?? 'doctor';
const confirm = process.argv.includes('--apply');

function printPackage(packageInfo) {
  console.log(`ChatGPT ${packageInfo.Version}`);
  console.log(`  package: ${packageInfo.InstallLocation}`);
  console.log(`  app.asar: ${packageInfo.asarPath}`);
}

try {
  const packageInfo = resolveChatGptPackage();
  printPackage(packageInfo);
  if (command === 'doctor' || command === 'status') {
    const status = await inspectDirectPatch(packageInfo);
    console.log(`  current SHA-256: ${status.currentSha256}`);
    if (status.state?.status === 'applied') console.log(`  state: applied (patched SHA-256 ${status.state.patchedSha256})`);
    else if (status.state?.status === 'restored') console.log(`  state: restored (${status.state.restoredAt})`);
    else console.log('  state: not applied');
    if (command === 'doctor') console.log('Direct patch doctor completed. No files were changed.');
  } else if (command === 'apply') {
    if (!confirm) {
      console.log('Dry run only. This experimental mode rewrites ChatGPT app.asar and may be undone by updates.');
      console.log('To create a verified backup and apply the preload patch, run: npm run direct:apply -- --apply');
      process.exitCode = 2;
    } else {
      assertChatGptClosed();
      const result = await applyDirectPatch(packageInfo, { runtimePath: path.resolve('dist/enhanced-runtime.js'), confirm: true });
      console.log(result.changed ? `Direct patch applied. Backup: ${result.backupPath}` : 'Direct patch is already applied; no files changed.');
      console.log('Start ChatGPT normally to load the enhancement. Updates may replace this patch; use direct:restore before troubleshooting.');
    }
  } else if (command === 'restore') {
    assertChatGptClosed();
    const result = await restoreDirectPatch(packageInfo);
    console.log(`Direct patch restored. Original SHA-256: ${result.originalSha256}`);
  } else {
    throw new Error(`Unknown direct command: ${command}`);
  }
} catch (error) {
  console.error(`Direct mode: ${error.message}`);
  process.exitCode = 1;
}
