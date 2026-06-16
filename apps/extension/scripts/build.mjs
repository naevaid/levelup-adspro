import { build, context } from 'esbuild';
import { mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const packageJsonPath = path.join(rootDir, 'package.json');
const watchMode = process.argv.includes('--watch');
const cleanOnly = process.argv.includes('--clean');

const entryPoints = {
  background: path.join(srcDir, 'background.ts'),
  content: path.join(srcDir, 'content.ts'),
  popup: path.join(srcDir, 'popup.ts'),
};

async function cleanDist() {
  await rm(distDir, { recursive: true, force: true });
}

async function ensureDist() {
  await mkdir(distDir, { recursive: true });
}

async function writeManifest() {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const manifest = {
    manifest_version: 3,
    name: 'LevelUP adsPRO Collector',
    version: packageJson.version,
    description:
      'Chrome extension collector for LevelUP adsPRO with login, page detection, and manual sync.',
    permissions: ['storage', 'tabs', 'activeTab', 'alarms'],
    host_permissions: [
      'https://adspro.naeva.id/*',
      'http://localhost:3001/*',
      'https://shopee.co.id/*',
      'https://*.shopee.co.id/*',
      'https://seller.shopee.co.id/*',
      'https://ads.tiktok.com/*',
      'https://*.tiktok.com/*',
    ],
    action: {
      default_title: 'LevelUP adsPRO Collector',
      default_popup: 'popup.html',
    },
    background: {
      service_worker: 'background.js',
    },
    content_scripts: [
      {
        matches: [
          'https://shopee.co.id/*',
          'https://*.shopee.co.id/*',
          'https://seller.shopee.co.id/*',
          'https://ads.tiktok.com/*',
          'https://*.tiktok.com/*',
        ],
        js: ['content.js'],
        run_at: 'document_idle',
      },
    ],
  };

  await writeFile(
    path.join(distDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

async function copyStaticAssets() {
  await copyFile(path.join(srcDir, 'popup.html'), path.join(distDir, 'popup.html'));
  await copyFile(path.join(srcDir, 'popup.css'), path.join(distDir, 'popup.css'));
}

function getBuildOptions() {
  return {
    entryPoints,
    bundle: true,
    outdir: distDir,
    platform: 'browser',
    target: 'chrome120',
    format: 'iife',
    sourcemap: true,
    logLevel: 'info',
    legalComments: 'none',
  };
}

async function prepareDist() {
  await cleanDist();
  await ensureDist();
  await copyStaticAssets();
  await writeManifest();
}

async function main() {
  if (cleanOnly) {
    await cleanDist();
    return;
  }

  await prepareDist();

  if (watchMode) {
    const ctx = await context(getBuildOptions());
    await ctx.watch();
    console.log('Watching extension sources...');
    return;
  }

  await build(getBuildOptions());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
