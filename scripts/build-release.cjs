const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const site = path.join(root, 'dist', 'site');
const desktop = path.join(root, 'dist', 'desktop-app');
const publicFiles = ['index.html', 'app.html', 'manifest.webmanifest', 'sw.js', 'assets', 'data'];
const digest = crypto.createHash('sha256');
let originalBytes = 0;
let minifiedBytes = 0;

async function copy(source, destination, relative, hash = true) {
  if (relative.endsWith('.map')) return;
  const stat = await fs.stat(source);
  if (stat.isDirectory()) {
    await fs.mkdir(destination, { recursive: true });
    for (const name of (await fs.readdir(source)).sort()) {
      await copy(path.join(source, name), path.join(destination, name), `${relative}/${name}`);
    }
    return;
  }
  let content = await fs.readFile(source);
  const extension = path.extname(source);
  if (['.js', '.cjs', '.css'].includes(extension)) {
    originalBytes += content.length;
    const result = await esbuild.transform(content.toString('utf8'), {
      loader: extension === '.css' ? 'css' : 'js',
      minify: true,
      sourcemap: false,
      legalComments: 'none',
      // These are classic scripts sharing globals, so do not bundle or set a module format.
      sourcefile: relative,
    });
    content = Buffer.from(result.code);
    minifiedBytes += content.length;
  }
  if (hash) digest.update(relative).update(content);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, content);
}

async function verify(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await verify(file);
    else if (entry.name.endsWith('.map')) throw new Error(`Source map in release: ${file}`);
    else if (/\.(?:js|cjs|css|html)$/.test(entry.name)) {
      if (/sourceMappingURL\s*=/.test(await fs.readFile(file, 'utf8'))) {
        throw new Error(`Source map reference in release: ${file}`);
      }
    }
  }
}

async function main() {
  // Only remove these fixed, generated directories inside this repository's dist folder.
  await fs.rm(site, { recursive: true, force: true });
  await fs.rm(desktop, { recursive: true, force: true });
  await fs.mkdir(site, { recursive: true });
  for (const file of publicFiles) await copy(path.join(root, file), path.join(site, file), file);

  // A content-based cache name also updates existing installations when release files change.
  const swPath = path.join(site, 'sw.js');
  const worker = await fs.readFile(swPath, 'utf8');
  await fs.writeFile(swPath, worker.replace(/hls-pwa-v\d+/, `hls-pwa-release-${digest.digest('hex').slice(0, 16)}`));
  await fs.cp(site, desktop, { recursive: true });
  await fs.rm(path.join(desktop, 'index.html'));
  await copy(path.join(root, 'desktop/main.cjs'), path.join(desktop, 'desktop/main.cjs'), 'desktop/main.cjs', false);
  const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const runtime = Object.fromEntries(['name', 'version', 'description', 'author', 'main'].map(key => [key, metadata[key]]));
  await fs.writeFile(path.join(desktop, 'package.json'), JSON.stringify(runtime, null, 2) + '\n');
  await verify(site);
  await verify(desktop);
  console.log(`Release JS/CSS: ${originalBytes.toLocaleString()} → ${minifiedBytes.toLocaleString()} bytes. No source maps.`);
  console.log('Website: dist/site; installer app: dist/desktop-app');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
