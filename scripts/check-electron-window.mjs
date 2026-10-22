import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'khatwa-runtime-'));
app.setPath('userData', profile);
const timeout = setTimeout(() => { console.error('Desktop did not load'); app.exit(1); }, 30000);
app.on('will-quit', () => {
  clearTimeout(timeout);
  fs.rmSync(profile, { recursive: true, force: true });
});
process.on('uncaughtException', (error) => { console.error(error); app.exit(1); });
process.on('unhandledRejection', (error) => { console.error(error); app.exit(1); });
app.on('web-contents-created', (_event, contents) => {
  contents.on('render-process-gone', (_event, details) => { console.error(details); app.exit(1); });
  contents.on('did-fail-load', (_event, code, description) => { console.error(code, description); app.exit(1); });
  contents.once('did-finish-load', async () => {
    try {
      const state = await contents.executeJavaScript('({ text: document.body.innerText, electron: window.khatwa?.isElectron, node: typeof require })');
      assert.match(state.text, /Khatwa/);
      assert.equal(state.electron, true, 'The isolated preload bridge must be available');
      assert.equal(state.node, 'undefined', 'Node must stay unavailable to the renderer');
      assert.equal(contents.getLastWebPreferences().sandbox, true);
      console.log('Static desktop renderer, isolated preload and sandbox loaded successfully');
      app.quit();
    } catch (error) { console.error(error); app.exit(1); }
  });
});
await import('../dist-electron/main.js');
