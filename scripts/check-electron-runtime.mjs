import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';
import zlib from 'node:zlib';
import tls from 'node:tls';
const filename = fileURLToPath(import.meta.url);
import { spawnSync } from 'node:child_process';

if (!process.versions.electron) {
  const result = spawnSync(electron, [filename], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Electron runtime probe failed');
} else {
  const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(filename), '..', 'package.json'), 'utf8'));
  assert.equal(process.versions.electron, pkg.devDependencies.electron);
  if (pkg.build?.electronVersion) {
    assert.equal(process.versions.electron, pkg.build.electronVersion);
  }
  // A Brotli round-trip is only a smoke test: it passes on runtimes that are still
  // exposed to CVE-2026-111497. Exposure is decided by the embedded Node version,
  // which Node fixed in 22.23.4, 24.22.1 and 26.12.1 on 2026-10-21.
  const patchedNode = { 22: [23, 4], 24: [22, 1], 26: [12, 1] };
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  const floor = patchedNode[major];
  const nodeHasOctoberFixes = Boolean(floor) && (minor > floor[0] || (minor === floor[0] && patch >= floor[1]));
  if (!nodeHasOctoberFixes) {
    // Warn instead of failing: no Electron release ships a patched Node yet.
    console.log(`::warning::Electron ${process.versions.electron} embeds Node ${process.versions.node}, which predates the 2026-10-21 Node security release (Brotli CVE-2026-111497, TLS hostname checks). Upgrade Electron once a release embeds Node 24.22.1 or later.`);
  }
  const input = Buffer.from(Array.from({ length: 131072 }, (_, i) => i % 251));
  assert.deepEqual(zlib.brotliDecompressSync(zlib.brotliCompressSync(input)), input);
  assert.throws(() => zlib.brotliDecompressSync(Buffer.from([255])));
  const cert = { subjectaltname: 'DNS:expected.test, IP Address:127.0.0.1' };
  assert.equal(tls.checkServerIdentity('expected.test', cert), undefined);
  assert.equal(tls.checkServerIdentity('127.0.0.1', cert), undefined);
  assert.ok(tls.checkServerIdentity('other.test', cert) instanceof Error);
  console.log(JSON.stringify({
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    nodeHasOctoberFixes,
    brotli: 'smoke test passed (does not detect CVE-2026-111497)',
    tls: 'basic DNS/IP identity checks passed (does not detect the October bypasses)',
  }));
}
