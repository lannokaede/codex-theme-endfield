import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { CdpPageSession, listCdpTargets } from '../src/enhanced-cdp.mjs';

const chromePath = process.env.ENDFIELD_CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForTargets(port) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const targets = await listCdpTargets(port);
      if (targets.length) return targets;
    } catch { /* Chrome is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for isolated Chromium target');
}

test('runtime renders its interactive surfaces and responds to turn completion events', { timeout: 30000 }, async () => {
  if (!(await fs.stat(chromePath).catch(() => null))) {
    assert.ok(true, 'Chrome is not installed; isolated browser fixture skipped');
    return;
  }
  const cdpPort = await freePort();
  const httpServer = http.createServer((request, response) => {
    response.setHeader('content-type', 'text/html');
    response.end(`<!doctype html><html><head><title>Codex fixture</title></head><body><main id="root"><button>Run</button></main><script>
      setTimeout(() => {
        window.postMessage({ method: 'turn/started', params: { threadId: 'fixture', turn: { id: 'one', status: 'inProgress' } } }, '*');
        window.dispatchEvent(new CustomEvent('codex:notification', { detail: { method: 'turn/completed', params: { threadId: 'fixture', turn: { id: 'one', status: 'completed' } } } }));
        window.postMessage({ method: 'turn/started', params: { threadId: 'fixture', turn: { id: 'two', status: 'inProgress' } } }, '*');
        window.postMessage({ method: 'turn/completed', params: { threadId: 'fixture', turn: { id: 'two', status: 'completed' } } }, '*');
      }, 250);
    </script></body></html>`);
  });
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const pagePort = httpServer.address().port;
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'endfield-chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${cdpPort}`, '--remote-allow-origins=http://127.0.0.1',
    `--user-data-dir=${profile}`, `http://127.0.0.1:${pagePort}/conversation/fixture`,
  ], { windowsHide: true, stdio: 'ignore' });
  let session;
  try {
    const targets = await waitForTargets(cdpPort);
    session = new CdpPageSession(targets[0]);
    await session.connect();
    const runtime = await fs.readFile(new URL('../runtime/enhanced-runtime.js', import.meta.url), 'utf8');
    const config = {
      schemaVersion: 1, enabled: true, palette: 'wuling-cyan', corner: 'square', interactions: true,
      contour: { enabled: true, animated: false, fps: 24, speed: 1, pauseOnScroll: true },
      watermark: { enabled: true, persistent: true }, loader: { mode: 'always' },
      taskPlate: { start: false, complete: true, animation: false, durationMs: 3000 },
    };
    await session.inject(`globalThis.__codexEndfieldInitialConfig=${JSON.stringify(config)};${runtime}`);
    await session.send('Page.navigate', { url: `http://127.0.0.1:${pagePort}/conversation/fixture` });
    await new Promise((resolve) => setTimeout(resolve, 600));
    const surfaces = await session.send('Runtime.evaluate', { expression: `({
      canvas: Boolean(document.querySelector('#codex-endfield-canvas')),
      watermark: document.querySelector('#codex-endfield-watermark svg title')?.textContent,
      panel: Boolean(document.querySelector('#codex-endfield-settings')?.shadowRoot?.querySelector('#tab')),
      loader: Boolean(document.querySelector('#codex-endfield-loader')),
      accent: getComputedStyle(document.documentElement).getPropertyValue('--codex-base-accent').trim(),
    })`, returnByValue: true });
    assert.deepEqual(surfaces.result.value, { canvas: true, watermark: 'ENDFIELD INDUSTRIES', panel: true, loader: true, accent: '#14d0d0' });

    const plate = await session.send('Runtime.evaluate', { expression: 'document.querySelector("#codex-endfield-task-plate")?.textContent ?? null', returnByValue: true });
    assert.equal(plate.result.value, '任务完成');

    const bounds = await session.send('Runtime.evaluate', { expression: `({
      contained: document.querySelector('main').contains(document.querySelector('#codex-endfield-watermark')),
      tabHidden: getComputedStyle(document.querySelector('#codex-endfield-settings').shadowRoot.querySelector('#tab')).display === 'none',
      overflow: document.documentElement.scrollWidth > innerWidth
    })`, returnByValue: true });
    assert.deepEqual(bounds.result.value, { contained: true, tabHidden: true, overflow: false });
    await session.send('Page.navigate', { url: `http://127.0.0.1:${pagePort}/pet-overlay` });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const auxiliary = await session.send('Runtime.evaluate', { expression: 'Boolean(document.querySelector("#codex-endfield-style, #codex-endfield-settings"))', returnByValue: true });
    assert.equal(auxiliary.result.value, false, 'auxiliary window must not receive theme surfaces');
  } finally {
    session?.close();
    if (chrome.exitCode == null) chrome.kill();
    if (chrome.exitCode == null) await new Promise((resolve) => chrome.once('exit', resolve));
    await new Promise((resolve) => httpServer.close(resolve));
    await fs.rm(profile, { recursive: true, force: true }).catch(() => undefined);
  }
});
