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
    brotli: 'valid roundtrip and malformed input rejected',
    tls: 'canonical DNS/IP checks passed',
  }));
}
