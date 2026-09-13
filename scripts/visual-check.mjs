import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { CdpPageSession, listCdpTargets } from '../src/enhanced-cdp.mjs';

const chromePath = process.env.ENDFIELD_CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'endfield-visual-'));
const output = path.join(profile, 'captures');
await fs.mkdir(output);
const server = net.createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
const browser = spawn(chromePath, ['--headless=new', '--no-first-run', '--disable-extensions', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', '--remote-allow-origins=http://127.0.0.1', pathToFileURL(path.resolve('preview/enhanced.html')).href], {windowsHide:true, stdio:'ignore'});
let session;
try {
  for (let i=0; i<80; i++) {
    const targets = await listCdpTargets(port).catch(()=>[]);
    if (targets.length) { session = new CdpPageSession(targets[0]); break; }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(session, 'Chromium must start');
  await session.connect();
  await session.send('Runtime.enable');
  for (const [width,height] of [[1280,800],[520,900],[2560,1440]]) {
    await session.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    for (const theme of ['light','dark']) {
      await session.send('Runtime.evaluate',{expression:`document.documentElement.dataset.theme=${JSON.stringify(theme)}`});
      await new Promise(resolve=>setTimeout(resolve,250));
      const result = await session.send('Runtime.evaluate',{expression:`({overflow:document.documentElement.scrollWidth>innerWidth,watermark:!!document.querySelector('main #codex-endfield-watermark svg'),edge:getComputedStyle(document.querySelector('#codex-endfield-settings').shadowRoot.querySelector('#tab')).display})`,returnByValue:true});
      assert.deepEqual(result.result.value,{overflow:false,watermark:true,edge:'none'});
      const capture = await session.send('Page.captureScreenshot',{format:'png'});
      await fs.writeFile(path.join(output,`${theme}-${width}.png`),Buffer.from(capture.data,'base64'));
    }
  }
  console.log(`Visual checks passed. Screenshots: ${output}`);
} finally {
  session?.close();
  browser.kill();
}
