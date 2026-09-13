(() => {
  'use strict';

  // Auxiliary Electron windows (pet, voice, overlays) must retain transparency.
  if (window.top !== window || /(?:pet|companion|overlay|voice|mini)[-_/]?/i.test(location.pathname + location.search)) return;

  if (globalThis.__codexEndfieldRuntime) {
    globalThis.__codexEndfieldRuntime.refresh?.(globalThis.__codexEndfieldInitialConfig);
    return;
  }

  const defaults = {
    schemaVersion: 1,
    enabled: true,
    palette: 'valley-yellow',
    corner: 'square',
    interactions: true,
    contour: { enabled: true, animated: true, fps: 24, speed: 1, pauseOnScroll: true },
    watermark: { enabled: true, persistent: true },
    loader: { mode: 'first-launch' },
    taskPlate: { start: false, complete: true, animation: true, durationMs: 3000 },
  };

  const palettes = {
    'valley-yellow': {
      light: { accent: '#fff500', background: '#e8e8e2', foreground: '#101110', skill: '#6b5d00', added: '#1f7431', removed: '#c62016' },
      dark: { accent: '#fff500', background: '#101110', foreground: '#f5f5f0', skill: '#fff500', added: '#4fbf5c', removed: '#ff6b61' },
    },
    'wuling-cyan': {
      light: { accent: '#14d0d0', background: '#e8e8e2', foreground: '#101110', skill: '#006a6a', added: '#1f7431', removed: '#c62016' },
      dark: { accent: '#14d0d0', background: '#101110', foreground: '#f5f5f0', skill: '#14d0d0', added: '#4fbf5c', removed: '#ff6b61' },
    },
  };

  const state = {
    config: normalize(globalThis.__codexEndfieldInitialConfig),
    dark: false,
    style: null,
    canvas: null,
    watermark: null,
    panel: null,
    detector: new Map(),
    activePlate: null,
    plateDismiss: null,
    bound: false,
    loaderShown: false,
    contourFrame: 0,
    contourTimer: 0,
    scrolling: false,
    surface: null,
  };

  delete globalThis.__codexEndfieldInitialConfig;

  function normalize(input) {
    const source = input && typeof input === 'object' ? input : {};
    const contour = source.contour && typeof source.contour === 'object' ? source.contour : {};
    const watermark = source.watermark && typeof source.watermark === 'object' ? source.watermark : {};
    const loader = source.loader && typeof source.loader === 'object' ? source.loader : {};
    const taskPlate = source.taskPlate && typeof source.taskPlate === 'object' ? source.taskPlate : {};
    const bool = (value, fallback) => typeof value === 'boolean' ? value : fallback;
    const oneOf = (value, values, fallback) => values.includes(value) ? value : fallback;
    const number = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value)
      ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
    return {
      schemaVersion: 1,
      enabled: bool(source.enabled, defaults.enabled),
      palette: oneOf(source.palette, Object.keys(palettes), defaults.palette),
      corner: oneOf(source.corner, ['square', 'rounded'], defaults.corner),
      interactions: bool(source.interactions, defaults.interactions),
      contour: {
        enabled: bool(contour.enabled, defaults.contour.enabled),
        animated: bool(contour.animated, defaults.contour.animated),
        fps: number(contour.fps, defaults.contour.fps, 1, 60),
        speed: number(contour.speed, defaults.contour.speed, 1, 4),
        pauseOnScroll: bool(contour.pauseOnScroll, defaults.contour.pauseOnScroll),
      },
      watermark: {
        enabled: bool(watermark.enabled, defaults.watermark.enabled),
        persistent: bool(watermark.persistent, defaults.watermark.persistent),
      },
      loader: { mode: oneOf(loader.mode, ['off', 'first-launch', 'always'], defaults.loader.mode) },
      taskPlate: {
        start: bool(taskPlate.start, defaults.taskPlate.start),
        complete: bool(taskPlate.complete, defaults.taskPlate.complete),
        animation: bool(taskPlate.animation, defaults.taskPlate.animation),
        durationMs: number(taskPlate.durationMs, defaults.taskPlate.durationMs, 1000, 10000),
      },
    };
  }

  function isReducedMotion() {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  }

  function detectDark() {
    const root = document.documentElement;
    if (root.dataset.theme === 'dark' || root.dataset.colorMode === 'dark') return true;
    if (root.dataset.theme === 'light' || root.dataset.colorMode === 'light') return false;
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
  }

  function palette() {
    return palettes[state.config.palette][state.dark ? 'dark' : 'light'];
  }

  function setProperty(name, value) {
    document.documentElement.style.setProperty(name, value);
  }

  function clearProperties() {
    for (const name of [
      '--codex-base-accent', '--color-background-primary', '--color-background-surface', '--color-background-surface-under',
      '--color-background-secondary-soft', '--color-background-accent', '--color-background-accent-hover',
      '--color-background-text-selection', '--color-text-foreground', '--color-text-foreground-secondary',
      '--color-border', '--color-border-subtle', '--color-border-focus', '--color-icon-accent', '--color-codex-editor-cursor',
      '--color-codex-diff-added', '--color-codex-diff-deleted', '--color-editor-added', '--color-editor-deleted',
    ]) document.documentElement.style.removeProperty(name);
  }

  function applyTokens() {
    state.dark = detectDark();
    document.documentElement.dataset.codexEndfield = state.config.enabled ? state.config.palette : 'off';
    document.documentElement.dataset.codexEndfieldMode = state.dark ? 'dark' : 'light';
    document.documentElement.dataset.codexEndfieldInteractions = state.config.interactions ? 'on' : 'off';
    document.documentElement.dataset.codexEndfieldCorner = state.config.corner;
    if (!state.config.enabled) {
      clearProperties();
      return;
    }
    const colors = palette();
    setProperty('--codex-base-accent', colors.accent);
    setProperty('--color-background-primary', colors.background);
    setProperty('--color-background-surface', state.dark ? '#181a18' : '#f2f2ec');
    setProperty('--color-background-surface-under', colors.background);
    setProperty('--color-background-secondary-soft', state.dark ? '#171a17' : '#f0f0eb');
    setProperty('--color-background-accent', colors.accent);
    setProperty('--color-background-accent-hover', colors.accent);
    setProperty('--color-background-text-selection', `${colors.accent}66`);
    setProperty('--color-text-foreground', colors.foreground);
    setProperty('--color-text-foreground-secondary', state.dark ? '#c6c9c0' : '#4d514b');
    setProperty('--color-border', state.dark ? '#3c423b' : '#bfc2b8');
    setProperty('--color-border-subtle', state.dark ? '#2a2e2a' : '#d2d4cd');
    setProperty('--color-border-focus', colors.accent);
    setProperty('--color-icon-accent', colors.accent);
    setProperty('--color-codex-editor-cursor', colors.accent);
    setProperty('--color-codex-diff-added', colors.added);
    setProperty('--color-codex-diff-deleted', colors.removed);
    setProperty('--color-editor-added', colors.added);
    setProperty('--color-editor-deleted', colors.removed);
    setProperty('--codex-corner-radius-scale', state.config.corner === 'square' ? '0' : '1');
  }

  function ensureStyle() {
    if (state.style) return;
    state.style = document.createElement('style');
    state.style.id = 'codex-endfield-style';
    state.style.textContent = `
      html[data-codex-endfield]:not([data-codex-endfield="off"]) body { background: var(--color-background-primary) !important; color: var(--color-text-foreground) !important; }
      html[data-codex-endfield] [data-endfield-surface] { position: relative; isolation: isolate; }
      html[data-codex-endfield] #codex-endfield-canvas, html[data-codex-endfield] #codex-endfield-watermark { position: absolute; inset: 0; pointer-events: none; z-index: -1; max-width: 100%; max-height: 100%; overflow: clip; }
      html[data-codex-endfield] #codex-endfield-canvas { opacity: .32; mask-image: linear-gradient(100deg,#000,transparent 55%,#000); }
      html[data-codex-endfield] #codex-endfield-watermark { color: var(--color-text-foreground); user-select: none; }
      #codex-endfield-watermark svg { position: absolute; right: 5%; top: 6%; width: min(28%,240px); height: auto; opacity: .075; }
      #codex-endfield-watermark .ef-register { position: absolute; left: 28px; bottom: 24px; display: flex; align-items: center; gap: 12px; opacity: .28; font: 9px/1.5 monospace; letter-spacing: .15em; }
      #codex-endfield-watermark .ef-register::before { content: ''; width: 36px; height: 12px; background: repeating-linear-gradient(90deg,currentColor 0 2px,transparent 2px 4px,currentColor 4px 5px,transparent 5px 8px); }
      #codex-endfield-watermark .ef-corner { position: absolute; inset: 24px; border: 1px solid currentColor; opacity: .08; clip-path: polygon(0 0,20px 0,20px 1px,1px 1px,1px 20px,0 20px,0 0,100% 100%,calc(100% - 20px) 100%,calc(100% - 20px) calc(100% - 1px),calc(100% - 1px) calc(100% - 1px),calc(100% - 1px) calc(100% - 20px),100% calc(100% - 20px),100% 100%); }
      html[data-codex-endfield-corner="square"] :is(button,textarea,input:not([type=checkbox]):not([type=radio]),[role=menu],[role=dialog],pre,form) { border-radius: 0 !important; }
      html[data-codex-endfield] :is(textarea,[contenteditable=true]) { caret-color: var(--color-text-foreground); }
      html[data-codex-endfield] form:has(textarea), html[data-codex-endfield] form:has([contenteditable=true]) { background: var(--color-background-surface) !important; border: 1px solid var(--color-border) !important; border-top: 2px solid var(--color-text-foreground) !important; box-shadow: none !important; }
      html[data-codex-endfield] [class*="_ComposerLayoutRoot_"]:has([contenteditable=true][role=textbox]) { background: var(--color-background-surface) !important; border: 1px solid var(--color-border) !important; border-top: 2px solid var(--color-text-foreground) !important; box-shadow: none !important; }
      html[data-codex-endfield-corner="square"] [class*="_ComposerLayoutRoot_"]:has([contenteditable=true][role=textbox]) { border-radius: 0 !important; }
      html[data-codex-endfield] aside { background: var(--color-background-primary); border-right: 1px solid var(--color-border-subtle); }
      html[data-codex-endfield] [aria-current=page], html[data-codex-endfield] [aria-selected=true] { box-shadow: inset 3px 0 var(--codex-base-accent); background: var(--color-background-secondary-soft); }
      html[data-codex-endfield] button[type=submit] { background: var(--codex-base-accent) !important; color: #101110 !important; }
      html[data-codex-endfield] pre { border: 1px solid var(--color-border-subtle); background: var(--color-background-surface); }
      @media (max-width: 640px) { #codex-endfield-watermark svg { width: 32%; top: 8%; } #codex-endfield-watermark .ef-register { font-size: 8px; left: 16px; bottom: 12px; } }
      html[data-codex-endfield="off"] #codex-endfield-canvas, html[data-codex-endfield="off"] #codex-endfield-watermark { display: none; }
      html[data-codex-endfield-interactions="on"] button:not(:disabled), html[data-codex-endfield-interactions="on"] [role="button"]:not([aria-disabled="true"]), html[data-codex-endfield-interactions="on"] [role="menuitem"], html[data-codex-endfield-interactions="on"] [role="option"] { transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease !important; }
      html[data-codex-endfield-interactions="on"] button:not(:disabled):hover, html[data-codex-endfield-interactions="on"] [role="button"]:not([aria-disabled="true"]):hover, html[data-codex-endfield-interactions="on"] [role="menuitem"]:hover, html[data-codex-endfield-interactions="on"] [role="option"]:hover { border-color: var(--codex-base-accent) !important; box-shadow: inset 3px 0 0 var(--codex-base-accent) !important; transform: translateX(2px); }
      html[data-codex-endfield-interactions="on"] button:not(:disabled):active, html[data-codex-endfield-interactions="on"] [role="button"]:not([aria-disabled="true"]):active { transform: translate(1px, 1px) !important; }
      html[data-codex-endfield] :focus-visible { outline: 2px solid var(--codex-base-accent) !important; outline-offset: 2px !important; }
      html[data-codex-endfield] ::selection { background: var(--color-background-text-selection) !important; }
      html[data-codex-endfield] *::-webkit-scrollbar { width: 9px; height: 9px; }
      html[data-codex-endfield] *::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--codex-base-accent) 46%, transparent); border: 3px solid transparent; background-clip: padding-box; }
      html[data-codex-endfield] *::-webkit-scrollbar-thumb:hover { background: var(--codex-base-accent); background-clip: padding-box; }
    `;
    (document.head || document.documentElement).append(state.style);
  }

  function ensureBackground() {
    if (!document.body) return;
    if (!state.canvas) {
      state.canvas = document.createElement('canvas');
      state.canvas.id = 'codex-endfield-canvas';
      state.canvas.setAttribute('aria-hidden', 'true');
      document.body.prepend(state.canvas);
    }
    if (!state.watermark) {
      state.watermark = document.createElement('div');
      state.watermark.id = 'codex-endfield-watermark';
      state.watermark.setAttribute('aria-hidden', 'true');
      state.watermark.innerHTML = `<svg viewBox="0 0 320 360" fill="none" aria-hidden="true">
        <path d="M160 20 290 95v150l-130 75L30 245V95Z" stroke="currentColor"/>
        <path d="m160 50 104 60v120l-104 60-104-60V110Z" stroke="currentColor" stroke-dasharray="3 7"/>
        <path d="M160 0v42m0 256v42M10 170h42m216 0h42M160 82v176M76 170h168" stroke="currentColor"/>
        <path d="m94 209 66-114 66 114h-35l-31-54-31 54Zm35 14h62l-31 36Z" fill="currentColor"/>
        <path d="M48 282h48m128 0h48M48 278v8m224-8v8" stroke="currentColor"/>
        <text x="160" y="345" text-anchor="middle" fill="currentColor" font-family="Arial,sans-serif" font-size="13" letter-spacing="6">ENDFIELD</text>
        <text x="160" y="359" text-anchor="middle" fill="currentColor" font-family="monospace" font-size="6" letter-spacing="2">TALOS-II / FIELD SYSTEMS</text>
      </svg><div class="ef-corner"></div><div class="ef-register">EF / 02 &nbsp; — &nbsp; FRONTIER SYSTEMS</div>`;
      document.body.prepend(state.watermark);
    }
    state.surface.prepend(state.watermark, state.canvas);
    state.watermark.style.display = state.config.enabled && state.config.watermark.enabled && (state.config.watermark.persistent || !currentThreadId()) ? 'block' : 'none';
  }

  function currentThreadId() {
    const match = location.pathname.match(/[0-9a-f]{8,}(?:-[0-9a-f-]{4,})?/i);
    return match?.[0] ?? null;
  }

  function notificationFrom(value, depth = 0) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 3) return null;
    if (value.method === 'turn/started' || value.method === 'turn/completed') return value;
    for (const key of ['notification', 'payload', 'event', 'message', 'data']) {
      const found = notificationFrom(value[key], depth + 1);
      if (found) return found;
    }
    return null;
  }

  function decode(value) {
    const notification = notificationFrom(value);
    const params = notification?.params;
    const turn = params?.turn && typeof params.turn === 'object' ? params.turn : params;
    const threadId = params?.threadId ?? params?.thread_id;
    const turnId = turn?.id ?? turn?.turnId ?? turn?.turn_id;
    const status = turn?.status;
    if (typeof threadId !== 'string' || threadId.length > 200 || typeof turnId !== 'string' || turnId.length > 200 || typeof status !== 'string' || status.length > 32) return null;
    return { method: notification.method, threadId, turnId, status };
  }

  function rememberTurn(turnId, value) {
    state.detector.set(turnId, value);
    while (state.detector.size > 64) state.detector.delete(state.detector.keys().next().value);
  }

  function showPlate(text) {
    state.activePlate?.remove();
    state.plateDismiss?.();
    const plate = document.createElement('div');
    plate.id = 'codex-endfield-task-plate';
    plate.textContent = text;
    plate.setAttribute('aria-hidden', 'true');
    Object.assign(plate.style, {
      position: 'fixed', inset: '0', display: 'grid', placeItems: 'center', zIndex: '2147483000',
      pointerEvents: 'none', color: palette().foreground, font: '900 clamp(4rem, 14vw, 13rem)/.9 Arial, sans-serif',
      letterSpacing: '.03em', textAlign: 'center', textShadow: `0 0 0.08em ${palette().accent}`,
      userSelect: 'none', opacity: '0', transform: state.config.taskPlate.animation && !isReducedMotion() ? 'scale(2.4)' : 'scale(1)',
      transition: state.config.taskPlate.animation && !isReducedMotion() ? 'opacity 180ms ease, transform 420ms cubic-bezier(.2,.8,.2,1)' : 'none',
    });
    document.body.append(plate);
    requestAnimationFrame(() => { plate.style.opacity = '1'; plate.style.transform = 'scale(1)'; });
    const timer = setTimeout(() => plate.remove(), state.config.taskPlate.durationMs);
    const dismiss = () => { clearTimeout(timer); plate.remove(); document.removeEventListener('pointerdown', dismiss, true); state.plateDismiss = null; state.activePlate = null; };
    document.addEventListener('pointerdown', dismiss, true);
    state.plateDismiss = dismiss;
    state.activePlate = plate;
  }

  function handleNotification(value) {
    const event = decode(value);
    if (!event) return;
    const current = currentThreadId();
    if (current && event.threadId !== current) return;
    const previous = state.detector.get(event.turnId);
    if (event.method === 'turn/started') {
      if (previous?.started) return;
      rememberTurn(event.turnId, { started: true, terminal: false });
      if (previous || state.detector.size > 1) {
        if (state.config.taskPlate.start) showPlate('任务开始');
      }
      return;
    }
    if (previous?.terminal) return;
    const firstReadableEvent = state.detector.size === 0;
    rememberTurn(event.turnId, { started: previous?.started ?? false, terminal: true });
    if (firstReadableEvent) return;
    if (state.config.taskPlate.complete && ['completed', 'failed', 'interrupted'].includes(event.status)) {
      showPlate({ completed: '任务完成', failed: '任务失败', interrupted: '任务中止' }[event.status]);
    }
  }

  function inspectSocketPayload(value) {
    if (typeof value !== 'string' || value.length > 64 * 1024) return;
    try { handleNotification(JSON.parse(value)); } catch { /* Non-JSON frames are not Codex turn events. */ }
  }

  function installEventAdapters() {
    const eventNames = ['codex:notification', 'codex-notification', 'codex.notification'];
    for (const name of eventNames) window.addEventListener(name, (event) => handleNotification(event.detail));

    const Socket = globalThis.WebSocket;
    const prototype = Socket?.prototype;
    if (!prototype || prototype.__codexEndfieldObserved) return;
    const addEventListener = prototype.addEventListener;
    if (typeof addEventListener !== 'function') return;
    const observed = new WeakSet();
    const attach = (socket) => {
      if (observed.has(socket)) return;
      observed.add(socket);
      addEventListener.call(socket, 'message', (event) => inspectSocketPayload(event.data));
    };
    try {
      prototype.addEventListener = function patchedAddEventListener(type, listener, options) {
        if (type === 'message') attach(this);
        return addEventListener.call(this, type, listener, options);
      };
      const onMessage = Object.getOwnPropertyDescriptor(prototype, 'onmessage');
      if (onMessage?.set && onMessage.configurable) {
        Object.defineProperty(prototype, 'onmessage', {
          configurable: onMessage.configurable,
          enumerable: onMessage.enumerable,
          get: onMessage.get,
          set(value) { attach(this); onMessage.set.call(this, value); },
        });
      }
      Object.defineProperty(prototype, '__codexEndfieldObserved', { configurable: false, value: true });
    } catch { /* A hardened WebSocket prototype is a supported no-op fallback. */ }
  }

  function sendConfig() {
    try { globalThis.codexEndfieldSave?.(JSON.stringify(state.config)); } catch { /* binding is optional outside the launcher */ }
  }

  function updatePanel() {
    const shadow = state.panel?.shadowRoot;
    if (!shadow) return;
    state.panel.style.setProperty('--ef-accent', palette().accent);
    state.panel.style.setProperty('--ef-background', palette().background);
    state.panel.style.setProperty('--ef-foreground', palette().foreground);
    shadow.querySelector('[data-field="palette"]').value = state.config.palette;
    shadow.querySelector('[data-field="corner"]').value = state.config.corner;
    shadow.querySelector('[data-field="contour"]').checked = state.config.contour.enabled;
    shadow.querySelector('[data-field="watermark"]').checked = state.config.watermark.enabled;
    shadow.querySelector('[data-field="loader"]').value = state.config.loader.mode;
    shadow.querySelector('[data-field="taskPlate"]').checked = state.config.taskPlate.complete;
    shadow.querySelector('[data-field="taskStart"]').checked = state.config.taskPlate.start;
    shadow.querySelector('[data-field="animation"]').checked = state.config.taskPlate.animation;
  }

  function setConfig(patch) {
    state.config = normalize({ ...state.config, ...patch, contour: { ...state.config.contour, ...patch.contour }, watermark: { ...state.config.watermark, ...patch.watermark }, loader: { ...state.config.loader, ...patch.loader }, taskPlate: { ...state.config.taskPlate, ...patch.taskPlate } });
    applyTokens();
    ensureBackground();
    updatePanel();
    restartContour();
    sendConfig();
  }

  function ensurePanel() {
    if (state.panel || !document.body) return;
    state.panel = document.createElement('div');
    state.panel.id = 'codex-endfield-settings';
    const shadow = state.panel.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; --ef-accent: #fff500; --ef-background: #101110; --ef-foreground: #f5f5f0; font-family: Arial, sans-serif; color: var(--ef-foreground); }
        button, select, input { font: inherit; }
        #tab { display: none; }
        #panel { position: fixed; right: 20px; top: 20px; z-index: 2147482991; width: min(340px, calc(100vw - 40px)); background: var(--ef-background); border: 1px solid #5c6459; box-shadow: 8px 8px 0 #000; padding: 18px; display: none; }
        #panel.open { display: block; }
        h2 { font-size: 16px; letter-spacing: .12em; margin: 0 0 14px; color: var(--ef-accent); }
        p { font-size: 12px; color: #bac0b4; margin: 0 0 14px; }
        label { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid #303630; padding: 10px 0; font-size: 13px; }
        select { background: #202520; color: #f5f5f0; border: 1px solid #687364; padding: 4px 6px; }
        input { accent-color: var(--ef-accent); }
        #close { margin-top: 14px; border: 1px solid #687364; background: transparent; color: var(--ef-foreground); padding: 7px 12px; cursor: pointer; }
        #close:focus-visible, #tab:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--ef-accent); outline-offset: 2px; }
        @media (prefers-color-scheme: light) { #panel { background: var(--ef-background); color: var(--ef-foreground); } p { color: color-mix(in srgb, var(--ef-foreground) 72%, transparent); } select { background: color-mix(in srgb, var(--ef-background) 82%, white); color: var(--ef-foreground); } #close { color: var(--ef-foreground); } }
      </style>
      <button id="tab" type="button" aria-label="打开 Endfield 主题设置" aria-expanded="false" aria-controls="panel">EF</button>
      <section id="panel" role="dialog" aria-modal="false" aria-labelledby="title">
        <h2 id="title">ENDFIELD / THEME CONTROL</h2>
        <p>增强层设置保存在本机，不会修改 ChatGPT 配置文件。</p>
        <label>配色<select data-field="palette"><option value="valley-yellow">Valley Yellow</option><option value="wuling-cyan">Wuling Cyan</option></select></label>
        <label>圆角<select data-field="corner"><option value="square">Square</option><option value="rounded">Rounded</option></select></label>
        <label>等高线<input data-field="contour" type="checkbox"></label>
        <label>持续水印<input data-field="watermark" type="checkbox"></label>
        <label>启动动画<select data-field="loader"><option value="off">关闭</option><option value="first-launch">首次启动</option><option value="always">每次启动</option></select></label>
        <label>任务状态大字<input data-field="taskPlate" type="checkbox"></label>
        <label>任务开始大字<input data-field="taskStart" type="checkbox"></label>
        <label>大字冲击动画<input data-field="animation" type="checkbox"></label>
        <button id="close" type="button">关闭设置</button>
      </section>`;
    document.body.append(state.panel);
    const tab = shadow.querySelector('#tab');
    const panel = shadow.querySelector('#panel');
    let previousFocus;
    const toggle = () => {
      const open = !panel.classList.contains('open');
      if (open) previousFocus = document.activeElement;
      panel.classList.toggle('open', open);
      tab.setAttribute('aria-expanded', String(open));
      if (open) shadow.querySelector('[data-field="palette"]').focus(); else previousFocus?.focus();
    };
    tab.addEventListener('click', toggle);
    shadow.querySelector('#close').addEventListener('click', toggle);
    shadow.addEventListener('keydown', (event) => {
      if (!panel.classList.contains('open')) return;
      if (event.key === 'Escape') { event.preventDefault(); toggle(); }
      if (event.key === 'Tab') {
        const items = [...panel.querySelectorAll('select,input,button')];
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && shadow.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && shadow.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    shadow.querySelector('[data-field="palette"]').addEventListener('change', (event) => setConfig({ palette: event.target.value }));
    shadow.querySelector('[data-field="corner"]').addEventListener('change', (event) => setConfig({ corner: event.target.value }));
    shadow.querySelector('[data-field="contour"]').addEventListener('change', (event) => setConfig({ contour: { enabled: event.target.checked } }));
    shadow.querySelector('[data-field="watermark"]').addEventListener('change', (event) => setConfig({ watermark: { enabled: event.target.checked } }));
    shadow.querySelector('[data-field="loader"]').addEventListener('change', (event) => setConfig({ loader: { mode: event.target.value } }));
    shadow.querySelector('[data-field="taskPlate"]').addEventListener('change', (event) => setConfig({ taskPlate: { complete: event.target.checked } }));
    shadow.querySelector('[data-field="taskStart"]').addEventListener('change', (event) => setConfig({ taskPlate: { start: event.target.checked } }));
    shadow.querySelector('[data-field="animation"]').addEventListener('change', (event) => setConfig({ taskPlate: { animation: event.target.checked } }));
    updatePanel();
    document.addEventListener('keydown', (event) => { if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'e') { event.preventDefault(); toggle(); } });
  }

  function restartContour() {
    if (state.contourTimer) cancelAnimationFrame(state.contourTimer);
    state.contourTimer = 0;
    if (!state.canvas) return;
    state.canvas.style.display = state.config.enabled && state.config.contour.enabled ? 'block' : 'none';
    if (!state.config.enabled || !state.config.contour.enabled) return;
    drawContour(0);
    if (state.config.contour.animated && !isReducedMotion() && !state.scrolling && document.visibilityState !== 'hidden') {
      state.contourTimer = requestAnimationFrame(contourFrame);
    }
  }

  function drawContour(time) {
    const canvas = state.canvas;
    if (!canvas || !state.config.contour.enabled || !state.config.enabled) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, state.surface.clientWidth);
    const height = Math.max(1, state.surface.clientHeight);
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr); canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    }
    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = palette().foreground;
    context.lineWidth = 1;
    const phase = (time / 1000) * state.config.contour.speed;
    const step = 52;
    const columns = Math.ceil(width / step) + 1;
    const rows = Math.ceil(height / step) + 1;
    const field = (x, y) => Math.sin(x / 118 + phase * .32) + Math.cos(y / 92 - phase * .21) + Math.sin((x + y) / 175 + phase * .12) * .55;
    const point = (x, y) => ({ x: x * step, y: y * step });
    const interpolate = (a, b, level) => {
      const denominator = b.value - a.value;
      const ratio = denominator === 0 ? .5 : Math.max(0, Math.min(1, (level - a.value) / denominator));
      return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    };
    const cases = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 2], [0, 1]], [[0, 2]], [[3, 2]], [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]], [[1, 3]], [[0, 1]], [[3, 0]], []];
    const levels = [-.75, -.25, .25, .75];
    for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
      const level = levels[levelIndex];
      context.globalAlpha = .19 - levelIndex * .025;
      context.beginPath();
      for (let y = 0; y < rows - 1; y += 1) {
        for (let x = 0; x < columns - 1; x += 1) {
          const topLeft = { ...point(x, y), value: field(x * step, y * step) };
          const topRight = { ...point(x + 1, y), value: field((x + 1) * step, y * step) };
          const bottomRight = { ...point(x + 1, y + 1), value: field((x + 1) * step, (y + 1) * step) };
          const bottomLeft = { ...point(x, y + 1), value: field(x * step, (y + 1) * step) };
          const mask = (topLeft.value > level ? 1 : 0) | (topRight.value > level ? 2 : 0) | (bottomRight.value > level ? 4 : 0) | (bottomLeft.value > level ? 8 : 0);
          const edges = [
            interpolate(topLeft, topRight, level), interpolate(topRight, bottomRight, level),
            interpolate(bottomRight, bottomLeft, level), interpolate(bottomLeft, topLeft, level),
          ];
          for (const [from, to] of cases[mask]) {
            context.moveTo(edges[from].x, edges[from].y);
            context.lineTo(edges[to].x, edges[to].y);
          }
        }
      }
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function contourFrame(time) {
    if (!state.config.enabled || !state.config.contour.enabled || !state.config.contour.animated || isReducedMotion() || state.scrolling || document.visibilityState === 'hidden') {
      state.contourTimer = 0;
      return;
    }
    const interval = 1000 / state.config.contour.fps;
    if (time - state.contourFrame >= interval) { state.contourFrame = time; drawContour(time); }
    state.contourTimer = requestAnimationFrame(contourFrame);
  }

  function showLoader() {
    if (state.loaderShown || !document.body || state.config.loader.mode === 'off') return;
    if (state.config.loader.mode === 'first-launch') {
      try {
        if (sessionStorage.getItem('codex-endfield-loader-seen') === '1') return;
        sessionStorage.setItem('codex-endfield-loader-seen', '1');
      } catch { /* Some embedded contexts disable session storage. */ }
    }
    state.loaderShown = true;
    const loader = document.createElement('div');
    loader.id = 'codex-endfield-loader';
    loader.innerHTML = '<div data-brand>ENDFIELD // CHATGPT</div><div data-status>INITIALIZING SURFACE</div><div data-rail><i></i></div><strong data-percent>00</strong>';
    Object.assign(loader.style, {
      position: 'fixed', inset: '0', zIndex: '2147482999', background: '#070907', color: '#f5f5f0',
      display: 'grid', gridTemplateRows: 'auto auto 4px auto', alignContent: 'center', gap: '14px', padding: '12vw',
      fontFamily: 'Arial, sans-serif', letterSpacing: '.14em', transition: 'opacity 620ms ease, clip-path 520ms ease',
    });
    const brand = loader.querySelector('[data-brand]');
    const status = loader.querySelector('[data-status]');
    const rail = loader.querySelector('[data-rail]');
    const fill = document.createElement('i');
    Object.assign(rail.style, { display: 'block', height: '4px', background: '#2f352f', overflow: 'hidden' });
    Object.assign(fill.style, { display: 'block', height: '100%', width: '0%', background: palette().accent, transformOrigin: 'left center' });
    rail.append(fill);
    Object.assign(brand.style, { color: palette().accent, fontSize: 'clamp(18px, 3vw, 32px)', fontWeight: '800' });
    Object.assign(status.style, { color: '#aeb5aa', fontSize: '11px' });
    const percent = loader.querySelector('[data-percent]');
    Object.assign(percent.style, { fontSize: 'clamp(48px, 12vw, 144px)', fontWeight: '900', lineHeight: '.8', letterSpacing: '-.06em' });
    document.body.append(loader);
    const reduced = isReducedMotion();
    if (reduced) {
      percent.textContent = '100';
      fill.style.width = '100%';
      setTimeout(() => loader.remove(), 120);
      return;
    }
    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / 1750);
      const value = Math.round(progress * 100);
      percent.textContent = String(value).padStart(2, '0');
      fill.style.width = `${value}%`;
      status.textContent = progress < .62 ? 'INITIALIZING SURFACE' : progress < .9 ? 'CALIBRATING SIGNAL' : 'LINK READY';
      if (progress < 1) requestAnimationFrame(tick);
      else {
        loader.style.clipPath = 'inset(0 0 0 100%)';
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 620);
      }
    };
    requestAnimationFrame(tick);
  }

  function refresh(nextConfig) {
    const surface = document.querySelector('main, [role="main"]');
    if (!surface) return;
    state.surface = surface;
    surface.setAttribute('data-endfield-surface', '');
    state.config = normalize(nextConfig ?? state.config);
    ensureStyle();
    applyTokens();
    ensureBackground();
    ensurePanel();
    updatePanel();
    restartContour();
    bindRuntime();
  }

  globalThis.__codexEndfieldRuntime = { refresh };
  function bindRuntime() {
    if (state.bound || !document.body) return;
    state.bound = true;
    window.addEventListener('message', (event) => handleNotification(event.data));
    const observer = new MutationObserver(() => { const dark = detectDark(); if (dark !== state.dark) { applyTokens(); drawContour(0); } });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-color-mode'] });
    installEventAdapters();
    window.addEventListener('resize', () => drawContour(0), { passive: true });
    window.addEventListener('scroll', () => {
      state.scrolling = true;
      if (state.contourTimer) { cancelAnimationFrame(state.contourTimer); state.contourTimer = 0; }
      clearTimeout(state.scrollTimer);
      state.scrollTimer = setTimeout(() => { state.scrolling = false; restartContour(); }, 180);
    }, { passive: true, capture: true });
    document.addEventListener('visibilitychange', restartContour, { passive: true });
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', restartContour);
    showLoader();
  }
  const start = () => refresh(state.config);
  const mountObserver = new MutationObserver(() => {
    if (!state.surface?.isConnected) start();
  });
  mountObserver.observe(document, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
