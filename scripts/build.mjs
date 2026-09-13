import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeTheme, validateThemeDefinition } from '../src/theme-format.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'themes', 'source.json');
const runtimePath = path.join(root, 'runtime', 'enhanced-runtime.js');
const checkOnly = process.argv.includes('--check');

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
if (!Array.isArray(source.themes) || source.themes.length !== 4) {
  throw new Error('themes/source.json must contain exactly four themes');
}

const ids = new Set();
for (const definition of source.themes) {
  validateThemeDefinition(definition);
  if (ids.has(definition.id)) throw new Error(`duplicate theme id: ${definition.id}`);
  ids.add(definition.id);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function createSvg(definition) {
  const { accent, diffAdded, diffRemoved, ink, name, skill, surface, variant } = definition;
  const muted = variant === 'light' ? '#5f625d' : '#a8aaa3';
  const panel = variant === 'light' ? '#f4f4ef' : '#181a18';
  const border = variant === 'light' ? '#c7c9c2' : '#3b3f3a';
  const code = variant === 'light' ? '#202320' : '#d8dad3';
  const label = `${name} / ${variant === 'light' ? 'Light' : 'Dark'}`;
  const lines = Array.from({ length: 12 }, (_, index) => {
    const y = 154 + index * 29;
    const width = 130 + ((index * 71) % 260);
    const color = index % 4 === 0 ? accent : border;
    return `<line x1="74" y1="${y}" x2="${74 + width}" y2="${y}" stroke="${color}" stroke-width="${index % 4 === 0 ? 3 : 1}" opacity="${index % 4 === 0 ? 0.92 : 0.75}"/>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800" role="img" aria-labelledby="title desc">
  <title id="title">Endfield Codex theme preview — ${escapeXml(label)}</title>
  <desc id="desc">Abstract paper-and-industrial Codex preview using the ${escapeXml(name)} palette.</desc>
  <rect width="1280" height="800" fill="${surface}"/>
  <path d="M0 108H1280" stroke="${accent}" stroke-width="8"/>
  <path d="M0 116H1280" stroke="${ink}" stroke-width="1" opacity=".22"/>
  <g fill="none" stroke="${ink}" opacity=".13">
    <path d="M920 0L1280 360M1010 0L1280 270M1100 0L1280 180"/>
    <path d="M928 0V800M1012 0V800M1096 0V800"/>
  </g>
  <rect x="48" y="42" width="1184" height="698" rx="4" fill="${panel}" stroke="${border}"/>
  <rect x="48" y="42" width="254" height="698" fill="${ink}" opacity=".96"/>
  <text x="76" y="92" fill="${accent}" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="3">CODEX / ENDFIELD</text>
  <text x="76" y="132" fill="${variant === 'light' ? '#f4f4ef' : '#101110'}" font-family="Arial, sans-serif" font-size="28" font-weight="700">Theme presets</text>
  <text x="76" y="176" fill="${variant === 'light' ? '#c9cdc3' : '#b5bbb0'}" font-family="Arial, sans-serif" font-size="14">Official theme interface preview</text>
  <rect x="76" y="218" width="198" height="42" fill="${accent}"/>
  <text x="92" y="245" fill="${ink}" font-family="Arial, sans-serif" font-size="14" font-weight="700">${escapeXml(label)}</text>
  <text x="76" y="300" fill="${variant === 'light' ? '#c9cdc3' : '#b5bbb0'}" font-family="Arial, sans-serif" font-size="12" letter-spacing="1.5">SURFACE</text>
  <rect x="76" y="316" width="26" height="26" fill="${surface}" stroke="${variant === 'light' ? '#f4f4ef' : '#62675f'}"/>
  <text x="114" y="335" fill="${variant === 'light' ? '#f4f4ef' : '#d8dad3'}" font-family="monospace" font-size="13">${surface}</text>
  <text x="76" y="388" fill="${variant === 'light' ? '#c9cdc3' : '#b5bbb0'}" font-family="Arial, sans-serif" font-size="12" letter-spacing="1.5">ACCENT</text>
  <rect x="76" y="404" width="26" height="26" fill="${accent}"/>
  <text x="114" y="423" fill="${variant === 'light' ? '#f4f4ef' : '#d8dad3'}" font-family="monospace" font-size="13">${accent}</text>
  <text x="76" y="650" fill="${variant === 'light' ? '#c9cdc3' : '#b5bbb0'}" font-family="Arial, sans-serif" font-size="12">Arial UI / system code font</text>
  <g transform="translate(350 86)">
    <text x="0" y="0" fill="${ink}" font-family="Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="2">WORKSPACE / ACTIVE THREAD</text>
    <text x="0" y="52" fill="${ink}" font-family="Arial, sans-serif" font-size="31" font-weight="700">Industrial paper, readable signal.</text>
    <text x="0" y="86" fill="${muted}" font-family="Arial, sans-serif" font-size="16">A restrained Endfield-inspired palette for daily Codex work.</text>
    <rect x="0" y="124" width="804" height="1" fill="${border}"/>
    ${lines}
    <rect x="0" y="516" width="804" height="94" fill="${surface}" stroke="${border}"/>
    <text x="24" y="548" fill="${muted}" font-family="monospace" font-size="13">status</text>
    <circle cx="91" cy="543" r="6" fill="${diffAdded}"/>
    <text x="108" y="548" fill="${ink}" font-family="Arial, sans-serif" font-size="15">Added / verified</text>
    <circle cx="292" cy="543" r="6" fill="${diffRemoved}"/>
    <text x="309" y="548" fill="${ink}" font-family="Arial, sans-serif" font-size="15">Removed / reviewed</text>
    <text x="24" y="584" fill="${skill}" font-family="Arial, sans-serif" font-size="15" font-weight="700">Skill: ${escapeXml(name)} palette</text>
    <text x="0" y="672" fill="${muted}" font-family="monospace" font-size="12">codex-theme-v1:  •  opaque windows  •  contrast ${definition.contrast}</text>
  </g>
</svg>
`;
}

function createBrowserThemeScript() {
  const themes = Object.fromEntries(source.themes.map((definition) => [definition.id, {
    name: definition.name,
    variant: definition.variant,
    accent: definition.accent,
    surface: definition.surface,
    ink: definition.ink,
    skill: definition.skill,
    diffAdded: definition.diffAdded,
    diffRemoved: definition.diffRemoved,
    contrast: definition.contrast,
  }]));
  return `window.ENDFIELD_THEMES = Object.freeze(${JSON.stringify(themes, null, 2)});\n`;
}

const files = new Map();
for (const definition of source.themes) {
  files.set(path.join('dist', `${definition.id}.txt`), `${serializeTheme(definition)}\n`);
  files.set(path.join('preview', 'captures', `${definition.id}.svg`), createSvg(definition));
}
files.set(path.join('dist', 'themes.json'), `${JSON.stringify({
  schemaVersion: 1,
  presets: source.themes.map((definition) => ({
    id: definition.id,
    name: definition.name,
    variant: definition.variant,
    import: serializeTheme(definition),
  })),
}, null, 2)}\n`);
files.set(path.join('preview', 'themes.js'), createBrowserThemeScript());
files.set(path.join('dist', 'enhanced-runtime.js'), await readFile(runtimePath, 'utf8'));

if (checkOnly) {
  const drift = [];
  for (const [relativePath, expected] of files) {
    try {
      const actual = await readFile(path.join(root, relativePath), 'utf8');
      if (actual !== expected) drift.push(relativePath);
    } catch {
      drift.push(relativePath);
    }
  }
  if (drift.length > 0) throw new Error(`generated files are missing or stale:\n${drift.join('\n')}`);
  console.log(`Checked ${files.size} generated files; no drift detected.`);
} else {
  for (const [relativePath, content] of files) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');
  }
  console.log(`Generated ${files.size} theme and preview artifacts.`);
}
