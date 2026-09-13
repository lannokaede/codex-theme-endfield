const SUPPORTED_METHODS = new Set(['turn/started', 'turn/completed']);
const MAX_ID_LENGTH = 200;

function safeId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH ? value : null;
}

function findNotification(value, depth = 0) {
  if (depth > 3 || value == null || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.method === 'string' && SUPPORTED_METHODS.has(value.method)) return value;
  for (const key of ['notification', 'payload', 'event', 'message', 'data']) {
    const nested = value[key];
    if (nested && typeof nested === 'object') {
      const found = findNotification(nested, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function decodeCodexNotification(value) {
  const notification = findNotification(value);
  if (!notification || !notification.params || typeof notification.params !== 'object') return null;

  const params = notification.params;
  const turn = params.turn && typeof params.turn === 'object' ? params.turn : params;
  const threadId = safeId(params.threadId ?? params.thread_id);
  const turnId = safeId(turn.id ?? turn.turnId ?? turn.turn_id);
  const status = typeof turn.status === 'string' && turn.status.length <= 32 ? turn.status : null;
  if (!threadId || !turnId || !status) return null;

  return {
    method: notification.method,
    threadId,
    turnId,
    status,
  };
}

export function createTurnEdgeDetector() {
  const turns = new Map();
  let hasBaseline = false;

  return {
    observe(event) {
      if (!event || !SUPPORTED_METHODS.has(event.method) || !event.turnId) return null;
      const previous = turns.get(event.turnId);
      if (event.method === 'turn/started') {
        if (previous?.started) return null;
        turns.set(event.turnId, { started: true, terminal: previous?.terminal ?? false });
        if (!hasBaseline) {
          hasBaseline = true;
          return null;
        }
        return 'started';
      }

      if (previous?.terminal) return null;
      turns.set(event.turnId, { started: previous?.started ?? false, terminal: true });
      if (!hasBaseline) {
        hasBaseline = true;
        return null;
      }
      return event.status === 'completed' || event.status === 'failed' || event.status === 'interrupted'
        ? event.status
        : null;
    },
  };
}
