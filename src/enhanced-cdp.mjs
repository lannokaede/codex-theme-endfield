import WebSocket from 'ws';

const LOOPBACK_HOST = '127.0.0.1';

function assertPort(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`Invalid CDP port: ${port}`);
  }
}

export function cdpHttpUrl(port, resource = '/json/list') {
  assertPort(port);
  if (!resource.startsWith('/')) throw new Error('CDP resource must be absolute');
  return `http://${LOOPBACK_HOST}:${port}${resource}`;
}

export async function listCdpTargets(port) {
  const response = await fetch(cdpHttpUrl(port), { redirect: 'error' });
  if (!response.ok) throw new Error(`CDP target listing failed with HTTP ${response.status}`);
  const targets = await response.json();
  if (!Array.isArray(targets)) throw new Error('CDP target listing was not an array');
  return targets.filter((target) => target && target.type === 'page' && isCodexTarget(target));
}

export function isCodexTarget(target) {
  if (!target || typeof target.webSocketDebuggerUrl !== 'string' || typeof target.url !== 'string') return false;
  try {
    const url = new URL(target.url);
    return url.protocol === 'app:' || url.protocol === 'file:' || url.hostname === LOOPBACK_HOST;
  } catch {
    return false;
  }
}

export class CdpPageSession {
  #socket;
  #nextId = 1;
  #pending = new Map();
  #onBinding;

  constructor(target, { onBinding } = {}) {
    if (!isCodexTarget(target)) throw new Error('Refusing to attach to a non-Codex target');
    this.target = target;
    this.#onBinding = onBinding;
  }

  async connect() {
    this.#socket = new WebSocket(this.target.webSocketDebuggerUrl, { origin: 'http://127.0.0.1' });
    this.#socket.on('message', (data) => this.#handleMessage(data));
    await new Promise((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = (error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        this.#socket.off('open', onOpen);
        this.#socket.off('error', onError);
      };
      this.#socket.once('open', onOpen);
      this.#socket.once('error', onError);
    });
  }

  async send(method, params = {}) {
    if (!this.#socket || this.#socket.readyState !== WebSocket.OPEN) {
      throw new Error('CDP page session is not connected');
    }
    const id = this.#nextId++;
    const message = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`CDP request timed out: ${method}`));
      }, 5000);
      this.#pending.set(id, { resolve, reject, timer });
      this.#socket.send(message, (error) => {
        if (!error) return;
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(error);
      });
    });
  }

  async inject(source) {
    await this.send('Runtime.enable');
    await this.send('Page.enable');
    await this.send('Runtime.addBinding', { name: 'codexEndfieldSave' });
    try {
      await this.send('Page.addScriptToEvaluateOnNewDocument', {
        source,
        runImmediately: true,
      });
    } catch (error) {
      if (!String(error.message).includes('runImmediately')) throw error;
      await this.send('Page.addScriptToEvaluateOnNewDocument', { source });
    }
    await this.send('Runtime.evaluate', { expression: source, awaitPromise: false });
  }

  close() {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('CDP page session closed'));
    }
    this.#pending.clear();
    this.#socket?.close();
  }

  #handleMessage(data) {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (message.method === 'Runtime.bindingCalled' && message.params?.name === 'codexEndfieldSave') {
      this.#onBinding?.(message.params.payload);
      return;
    }
    const pending = message.id == null ? null : this.#pending.get(message.id);
    if (!pending) return;
    this.#pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error(message.error.message ?? 'CDP request failed'));
    else pending.resolve(message.result);
  }
}

export { LOOPBACK_HOST };
