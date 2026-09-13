import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimePath = path.join(root, 'runtime', 'enhanced-runtime.js');
const outputPath = path.join(root, 'dist', 'enhanced-runtime.js');
const checkOnly = process.argv.includes('--check');
const expected = await readFile(runtimePath, 'utf8');

if (checkOnly) {
  let actual;
  try {
    actual = await readFile(outputPath, 'utf8');
  } catch {
    throw new Error('dist/enhanced-runtime.js is missing; run npm run build');
  }
  if (actual !== expected) throw new Error('generated files are missing or stale:\ndist/enhanced-runtime.js');
  console.log('Checked 1 generated artifact; no drift detected.');
} else {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, expected, 'utf8');
  console.log('Generated 1 enhanced runtime artifact.');
}
