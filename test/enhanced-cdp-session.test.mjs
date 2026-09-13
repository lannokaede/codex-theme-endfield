import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocketServer } from 'ws';

import { CdpPageSession, listCdpTargets } from '../src/enhanced-cdp.mjs';

test('CDP session attaches only to the advertised loopback target and injects before evaluation', async () => {
  const methods = [];
  const server = http.createServer((request, response) => {
    if (request.url !== '/json/list') {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify([{
      id: 'fixture-page',
      type: 'page',
      title: 'Codex fixture',
      url: 'app://codex/webview/index.html',
      webSocketDebuggerUrl: `ws://127.0.0.1:${server.address()?.port ?? 0}/devtools/page/fixture-page`,
    }]));
  });
  const sockets = new WebSocketServer({ server });
  sockets.on('connection', (socket) => {
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      methods.push(message.method);
      socket.send(JSON.stringify({ id: message.id, result: {} }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const targets = await listCdpTargets(port);
    assert.equal(targets.length, 1);
    const session = new CdpPageSession(targets[0]);
    await session.connect();
    await session.inject('globalThis.__fixtureInjected=true;');
    session.close();
    assert.deepEqual(methods.slice(0, 3), ['Runtime.enable', 'Page.enable', 'Runtime.addBinding']);
    assert.equal(methods.includes('Page.addScriptToEvaluateOnNewDocument'), true);
    assert.equal(methods.includes('Runtime.evaluate'), true);
  } finally {
    sockets.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
