import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createTurnEdgeDetector,
  decodeCodexNotification,
} from '../src/enhanced-events.mjs';

test('decodes direct and wrapped turn notifications without reading message content', () => {
  const direct = decodeCodexNotification({
    method: 'turn/completed',
    params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } },
  });
  const wrapped = decodeCodexNotification({
    type: 'codex-app-server-notification',
    notification: {
      method: 'turn/started',
      params: { threadId: 'thread-1', turn: { id: 'turn-2', status: 'inProgress' } },
    },
  });

  assert.deepEqual(direct, {
    method: 'turn/completed',
    threadId: 'thread-1',
    turnId: 'turn-1',
    status: 'completed',
  });
  assert.deepEqual(wrapped, {
    method: 'turn/started',
    threadId: 'thread-1',
    turnId: 'turn-2',
    status: 'inProgress',
  });
});

test('rejects unsupported methods and malformed notification payloads', () => {
  assert.equal(decodeCodexNotification({ method: 'item/agentMessage/delta', params: {} }), null);
  assert.equal(decodeCodexNotification({ method: 'turn/completed', params: {} }), null);
  assert.equal(decodeCodexNotification({ type: 'codex-app-server-notification', notification: { method: 'turn/started' } }), null);
  assert.equal(decodeCodexNotification('turn/completed'), null);
});

test('edge detector establishes a silent baseline and deduplicates terminal events', () => {
  const detector = createTurnEdgeDetector();

  assert.equal(detector.observe({ method: 'turn/started', threadId: 'thread-1', turnId: 'turn-1', status: 'inProgress' }), null);
  assert.equal(detector.observe({ method: 'turn/started', threadId: 'thread-1', turnId: 'turn-1', status: 'inProgress' }), null);
  assert.equal(detector.observe({ method: 'turn/completed', threadId: 'thread-1', turnId: 'turn-1', status: 'completed' }), 'completed');
  assert.equal(detector.observe({ method: 'turn/completed', threadId: 'thread-1', turnId: 'turn-1', status: 'completed' }), null);
  assert.equal(detector.observe({ method: 'turn/started', threadId: 'thread-1', turnId: 'turn-2', status: 'inProgress' }), 'started');
  assert.equal(detector.observe({ method: 'turn/completed', threadId: 'thread-1', turnId: 'turn-2', status: 'failed' }), 'failed');
});
