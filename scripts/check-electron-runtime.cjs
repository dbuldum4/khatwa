const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

if (!process.versions.electron) {
  const electron = require('electron');
  const result = spawnSync(electron, [__filename], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Electron runtime probe failed');
} else {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(process.versions.electron, pkg.devDependencies.electron);
  if (pkg.build?.electronVersion) {
    assert.equal(process.versions.electron, pkg.build.electronVersion);
  }
  const zlib = require('node:zlib');
  const input = Buffer.from(Array.from({ length: 131072 }, (_, i) => i % 251));
  assert.deepEqual(zlib.brotliDecompressSync(zlib.brotliCompressSync(input)), input);
  assert.throws(() => zlib.brotliDecompressSync(Buffer.from([255])));
  const tls = require('node:tls');
  const cert = { subjectaltname: 'DNS:expected.test, IP Address:127.0.0.1' };
  assert.equal(tls.checkServerIdentity('expected.test', cert), undefined);
  assert.equal(tls.checkServerIdentity('127.0.0.1', cert), undefined);
  assert.ok(tls.checkServerIdentity('other.test', cert) instanceof Error);
  console.log(JSON.stringify({
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    brotli: 'valid roundtrip and malformed input rejected',
    tls: 'canonical DNS/IP checks passed',
  }));
}
