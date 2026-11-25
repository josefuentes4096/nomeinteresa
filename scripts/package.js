// Builds the Chrome Web Store upload: dist/nomeinteresa-<version>.zip with
// the contents of extension/ at the root of the archive (manifest.json first).
// No dependencies: writes a standard ZIP (deflate) with Node's zlib.
//
// Usage: npm run package
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const extensionDir = join(root, 'extension');
const distDir = join(root, 'dist');

/** Files that must never ship, even if they end up in extension/ by accident. */
const EXCLUDED = /(^|\/)(\.DS_Store|Thumbs\.db|\..*\.swp)$/;

const manifest = JSON.parse(await readFile(join(extensionDir, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (manifest.version !== pkg.version) {
  throw new Error(`Version mismatch: manifest.json ${manifest.version}, package.json ${pkg.version}`);
}

/** @param {string} dir @returns {Promise<string[]>} */
async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)])),
  );
  return files.flat();
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** @param {Buffer} data */
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Fixed timestamp (2026-01-01 00:00) so the same sources give the same archive. */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const paths = (await listFiles(extensionDir))
  .map((file) => relative(extensionDir, file).split(sep).join('/'))
  .filter((path) => !EXCLUDED.test(path))
  .sort((a, b) => (a === 'manifest.json' ? -1 : b === 'manifest.json' ? 1 : a.localeCompare(b)));

const localParts = [];
const centralParts = [];
let offset = 0;
for (const path of paths) {
  const data = await readFile(join(extensionDir, path));
  const compressed = deflateRawSync(data, { level: 9 });
  const name = Buffer.from(path, 'utf8');
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); // local file header signature
  local.writeUInt16LE(20, 4); // version needed to extract
  local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
  local.writeUInt16LE(8, 8); // method: deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28); // extra field length
  localParts.push(local, name, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); // central directory header signature
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed to extract
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42); // offset of the local header
  centralParts.push(central, name);

  offset += local.length + name.length + compressed.length;
}

const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
end.writeUInt16LE(paths.length, 8);
end.writeUInt16LE(paths.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

await mkdir(distDir, { recursive: true });
const zipPath = join(distDir, `nomeinteresa-${manifest.version}.zip`);
await writeFile(zipPath, Buffer.concat([...localParts, ...centralParts, end]));
console.log(`${relative(root, zipPath)}: ${paths.length} files, ${(offset + centralSize + 22) / 1000} kB`);
