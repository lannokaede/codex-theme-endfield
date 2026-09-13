import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function exists(relativePath) {
  return access(path.join(root, relativePath)).then(() => true, () => false);
}

test('published surface contains only the enhanced mode', async () => {
  const build = await readFile(path.join(root, 'scripts/build.mjs'), 'utf8');
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  assert.match(build, /dist.*enhanced-runtime\.js/);
  assert.doesNotMatch(build, /themes\/source|serializeTheme|validateThemeDefinition/);
  assert.doesNotMatch(readme, /官方主题模式|codex-theme-v1:|Valley Yellow · Light|Wuling Cyan · Dark/);
  assert.equal(await exists('dist/enhanced-runtime.js'), true);
  for (const file of [
    'themes/source.json', 'src/theme-format.mjs', 'test/theme-format.test.mjs',
    'dist/themes.json', 'dist/valley-yellow-light.txt', 'dist/valley-yellow-dark.txt',
    'dist/wuling-cyan-light.txt', 'dist/wuling-cyan-dark.txt', 'preview/index.html',
    'preview/styles.css', 'preview/themes.js', 'preview/captures/valley-yellow-light.svg',
  ]) assert.equal(await exists(file), false, `${file} should not be published`);
});

test('user-facing copy names the host application ChatGPT', async () => {
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  const preview = await readFile(path.join(root, 'preview/enhanced.html'), 'utf8');
  const packageJson = await readFile(path.join(root, 'package.json'), 'utf8');
  assert.match(readme, /ChatGPT 客户端/);
  assert.match(preview, /CHATGPT|ChatGPT/);
  assert.match(packageJson, /ChatGPT/);
});

test('README keeps revision details in NOTICE instead of user-facing copy', async () => {
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  const notice = await readFile(path.join(root, 'NOTICE.md'), 'utf8');
  const upstreamRevision = 'e6dd22a70bf78e5ffea5744c749f8e0065384ab7';

  assert.doesNotMatch(readme, /\b[0-9a-f]{40}\b/i);
  assert.match(readme, /NOTICE\.md/);
  assert.match(notice, new RegExp(upstreamRevision));
});
