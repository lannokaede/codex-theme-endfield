(() => {
  'use strict';

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
    contourFrame: 0,
    contourTimer: 0,
    scrolling: false,
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
    if (!state.config.enabled) {
      clearProperties();
      return;
    }
    const colors = palette();
    setProperty('--codex-base-accent', colors.accent);
    setProperty('--color-background-primary', colors.background);
    setProperty('--color-background-surface', colors.background);
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
      html[data-codex-endfield] body { background: var(--color-background-primary) !important; color: var(--color-text-foreground) !important; }
      html[data-codex-endfield] #root { position: relative; z-index: 1; background: transparent !important; }
      html[data-codex-endfield] #codex-endfield-canvas, html[data-codex-endfield] #codex-endfield-watermark { position: fixed; inset: 0; pointer-events: none; }
      html[data-codex-endfield] #codex-endfield-canvas { z-index: 0; opacity: .26; }
      html[data-codex-endfield] #codex-endfield-watermark { z-index: 0; display: grid; place-items: center; overflow: hidden; }
      html[data-codex-endfield] #codex-endfield-watermark span { color: var(--codex-base-accent); font: 700 clamp(5rem, 18vw, 17rem)/.8 Arial, sans-serif; letter-spacing: .08em; opacity: ${state.dark ? '.085' : '.13'}; transform: rotate(-12deg); user-select: none; white-space: nowrap; }
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
      state.watermark.innerHTML = '<span>ENDFIELD</span>';
      document.body.prepend(state.watermark);
    }
    state.watermark.style.display = state.config.watermark.enabled ? 'grid' : 'none';
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
      state.detector.set(event.turnId, { started: true, terminal: false });
      if (previous || state.detector.size > 1) {
        if (state.config.taskPlate.start) showPlate('任务开始');
      }
      return;
    }
    if (previous?.terminal) return;
    const firstReadableEvent = state.detector.size === 0;
    state.detector.set(event.turnId, { started: previous?.started ?? false, terminal: true });
    if (firstReadableEvent) return;
    if (state.config.taskPlate.complete && ['completed', 'failed', 'interrupted'].includes(event.status)) {
      showPlate({ completed: '任务完成', failed: '任务失败', interrupted: '任务中止' }[event.status]);
    }
  }

  function sendConfig() {
    try { globalThis.codexEndfieldSave?.(JSON.stringify(state.config)); } catch { /* binding is optional outside the launcher */ }
  }

  function updatePanel() {
    const shadow = state.panel?.shadowRoot;
    if (!shadow) return;
    shadow.querySelector('[data-field="palette"]').value = state.config.palette;
    shadow.querySelector('[data-field="corner"]').value = state.config.corner;
    shadow.querySelector('[data-field="contour"]').checked = state.config.contour.enabled;
    shadow.querySelector('[data-field="watermark"]').checked = state.config.watermark.enabled;
    shadow.querySelector('[data-field="loader"]').value = state.config.loader.mode;
    shadow.querySelector('[data-field="taskPlate"]').checked = state.config.taskPlate.complete;
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
        :host { all: initial; font-family: Arial, sans-serif; color: #f5f5f0; }
        button, select, input { font: inherit; }
        #tab { position: fixed; right: 0; top: 48%; z-index: 2147482990; border: 1px solid #fff500; border-right: 0; background: #101110; color: #fff500; padding: 8px 6px; letter-spacing: .12em; cursor: pointer; writing-mode: vertical-rl; }
        #panel { position: fixed; right: 20px; top: 20px; z-index: 2147482991; width: min(340px, calc(100vw - 40px)); background: #151815; border: 1px solid #5c6459; box-shadow: 8px 8px 0 #000; padding: 18px; display: none; }
        #panel.open { display: block; }
        h2 { font-size: 16px; letter-spacing: .12em; margin: 0 0 14px; color: #fff500; }
        p { font-size: 12px; color: #bac0b4; margin: 0 0 14px; }
        label { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid #303630; padding: 10px 0; font-size: 13px; }
        select { background: #202520; color: #f5f5f0; border: 1px solid #687364; padding: 4px 6px; }
        input { accent-color: #fff500; }
        #close { margin-top: 14px; border: 1px solid #687364; background: transparent; color: #f5f5f0; padding: 7px 12px; cursor: pointer; }
        #close:focus-visible, #tab:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid #fff500; outline-offset: 2px; }
        @media (prefers-color-scheme: light) { #panel { background: #f2f2ed; color: #101110; } p { color: #4d514b; } select { background: #fff; color: #101110; } #close { color: #101110; } }
      </style>
      <button id="tab" type="button" aria-label="打开 Endfield 主题设置">EF</button>
      <section id="panel" role="dialog" aria-modal="false" aria-labelledby="title">
        <h2 id="title">ENDFIELD / THEME CONTROL</h2>
        <p>增强层设置保存在本机，不会修改 Codex 配置文件。</p>
        <label>配色<select data-field="palette"><option value="valley-yellow">Valley Yellow</option><option value="wuling-cyan">Wuling Cyan</option></select></label>
        <label>圆角<select data-field="corner"><option value="square">Square</option><option value="rounded">Rounded</option></select></label>
        <label>等高线<input data-field="contour" type="checkbox"></label>
        <label>持续水印<input data-field="watermark" type="checkbox"></label>
        <label>启动动画<select data-field="loader"><option value="off">关闭</option><option value="first-launch">首次启动</option><option value="always">每次启动</option></select></label>
        <label>任务状态大字<input data-field="taskPlate" type="checkbox"></label>
        <label>大字冲击动画<input data-field="animation" type="checkbox"></label>
        <button id="close" type="button">关闭设置</button>
      </section>`;
    document.body.append(state.panel);
    const tab = shadow.querySelector('#tab');
    const panel = shadow.querySelector('#panel');
    const toggle = () => { panel.classList.toggle('open'); if (panel.classList.contains('open')) shadow.querySelector('[data-field="palette"]').focus(); };
    tab.addEventListener('click', toggle);
    shadow.querySelector('#close').addEventListener('click', toggle);
    shadow.addEventListener('keydown', (event) => { if (event.key === 'Escape' && panel.classList.contains('open')) toggle(); });
    shadow.querySelector('[data-field="palette"]').addEventListener('change', (event) => setConfig({ palette: event.target.value }));
    shadow.querySelector('[data-field="corner"]').addEventListener('change', (event) => setConfig({ corner: event.target.value }));
    shadow.querySelector('[data-field="contour"]').addEventListener('change', (event) => setConfig({ contour: { enabled: event.target.checked } }));
    shadow.querySelector('[data-field="watermark"]').addEventListener('change', (event) => setConfig({ watermark: { enabled: event.target.checked } }));
    shadow.querySelector('[data-field="loader"]').addEventListener('change', (event) => setConfig({ loader: { mode: event.target.value } }));
    shadow.querySelector('[data-field="taskPlate"]').addEventListener('change', (event) => setConfig({ taskPlate: { complete: event.target.checked } }));
    shadow.querySelector('[data-field="animation"]').addEventListener('change', (event) => setConfig({ taskPlate: { animation: event.target.checked } }));
    updatePanel();
    document.addEventListener('keydown', (event) => { if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'e') { event.preventDefault(); toggle(); } });
  }

  function restartContour() {
    if (state.contourTimer) cancelAnimationFrame(state.contourTimer);
    state.contourTimer = 0;
    if (!state.config.enabled || !state.config.contour.enabled || !state.canvas) return;
    drawContour(0);
    if (state.config.contour.animated && !isReducedMotion()) state.contourTimer = requestAnimationFrame(contourFrame);
  }

  function drawContour(time) {
    const canvas = state.canvas;
    if (!canvas || !state.config.contour.enabled || !state.config.enabled) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, innerWidth);
    const height = Math.max(1, innerHeight);
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr); canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    }
    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = palette().accent;
    context.lineWidth = 1;
    const phase = (time / 1000) * state.config.contour.speed;
    const step = 52;
    for (let band = 0; band < 7; band += 1) {
      context.globalAlpha = .18 - band * .017;
      context.beginPath();
      for (let x = -step; x <= width + step; x += step) {
        const y = height * .46 + Math.sin(x / 115 + phase * .35 + band * .62) * (38 + band * 12) + band * 30;
        if (x === -step) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function contourFrame(time) {
    if (!state.config.contour.enabled || state.scrolling || document.visibilityState === 'hidden') {
      state.contourTimer = requestAnimationFrame(contourFrame);
      return;
    }
    const interval = 1000 / state.config.contour.fps;
    if (time - state.contourFrame >= interval) { state.contourFrame = time; drawContour(time); }
    state.contourTimer = requestAnimationFrame(contourFrame);
  }

  function refresh(nextConfig) {
    state.config = normalize(nextConfig ?? state.config);
    ensureStyle();
    applyTokens();
    ensureBackground();
    ensurePanel();
    restartContour();
  }

  globalThis.__codexEndfieldRuntime = { refresh };
  const start = () => {
    refresh(state.config);
    window.addEventListener('message', (event) => handleNotification(event.data));
    const observer = new MutationObserver(() => { const dark = detectDark(); if (dark !== state.dark) { applyTokens(); drawContour(0); } });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-color-mode'] });
    window.addEventListener('resize', () => drawContour(0), { passive: true });
    window.addEventListener('scroll', () => { state.scrolling = true; clearTimeout(state.scrollTimer); state.scrollTimer = setTimeout(() => { state.scrolling = false; }, 180); }, { passive: true, capture: true });
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', restartContour);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
