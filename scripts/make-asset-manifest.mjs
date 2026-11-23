// Scans public/assets and writes public/assets/asset-manifest.json.
// The game reads this file so it only requests assets that really exist
// (no 404 noise in the console, clean fallbacks for anything missing).
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const assetsDir = join(publicDir, 'assets');
const SKIP = new Set(['asset-manifest.json', '.gitkeep', 'README.md']);

function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (!SKIP.has(name)) out.push(relative(publicDir, full).split(sep).join('/'));
  }
  return out;
}

const files = walk(assetsDir).sort();
writeFileSync(join(assetsDir, 'asset-manifest.json'), JSON.stringify({ generated: new Date().toISOString(), files }, null, 2));
console.log(`[assets] manifest written: ${files.length} file(s)`);
for (const f of files) console.log('  - ' + f);
