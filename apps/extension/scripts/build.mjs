import { ZipArchive } from 'archiver';
import { build, context } from 'esbuild';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const packageDir = path.join(rootDir, 'package');
const packageJsonPath = path.join(rootDir, 'package.json');
const assetsDir = path.join(srcDir, 'assets');
const watchMode = process.argv.includes('--watch');
const cleanOnly = process.argv.includes('--clean');
const iconSizes = [16, 32, 48, 128];

const entryPoints = {
  background: path.join(srcDir, 'background.ts'),
  content: path.join(srcDir, 'content.ts'),
  pageBridge: path.join(srcDir, 'page-bridge.ts'),
  popup: path.join(srcDir, 'popup.ts'),
};

async function cleanDist() {
  await rm(distDir, { recursive: true, force: true });
}

async function cleanPackage() {
  await rm(packageDir, { recursive: true, force: true });
}

async function ensureDist() {
  await mkdir(distDir, { recursive: true });
}

async function ensurePackageDir() {
  await mkdir(packageDir, { recursive: true });
}

function getIconMap() {
  return Object.fromEntries(iconSizes.map((size) => [size, `icons/icon-${size}.png`]));
}

async function writeManifest() {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const icons = getIconMap();
  const manifest = {
    manifest_version: 3,
    name: 'LevelUP adsPRO',
    version: packageJson.version,
    description:
      'Permudah riset pasar untuk membuat iklan yang lebih efektif.',
    permissions: ['storage', 'tabs', 'activeTab', 'alarms'],
    host_permissions: [
      'https://adspro.naeva.id/*',
      'http://localhost:3001/*',
      'https://shopee.co.id/*',
      'https://*.shopee.co.id/*',
      'https://seller.shopee.co.id/*',
      'https://shopee.co.th/*',
      'https://seller.shopee.co.th/*',
      'https://shopee.com.my/*',
      'https://seller.shopee.com.my/*',
      'https://shopee.ph/*',
      'https://seller.shopee.ph/*',
      'https://shopee.sg/*',
      'https://seller.shopee.sg/*',
      'https://shopee.vn/*',
      'https://seller.shopee.vn/*',
      'https://ads.tiktok.com/*',
      'https://*.tiktok.com/*',
    ],
    action: {
      default_title: 'LevelUP adsPRO',
      default_popup: 'popup.html',
      default_icon: icons,
    },
    background: {
      service_worker: 'background.js',
    },
    icons,
    content_scripts: [
      {
        matches: [
          'https://shopee.co.id/*',
          'https://*.shopee.co.id/*',
          'https://seller.shopee.co.id/*',
          'https://shopee.co.th/*',
          'https://seller.shopee.co.th/*',
          'https://shopee.com.my/*',
          'https://seller.shopee.com.my/*',
          'https://shopee.ph/*',
          'https://seller.shopee.ph/*',
          'https://shopee.sg/*',
          'https://seller.shopee.sg/*',
          'https://shopee.vn/*',
          'https://seller.shopee.vn/*',
          'https://ads.tiktok.com/*',
          'https://*.tiktok.com/*',
        ],
        js: ['content.js'],
        run_at: 'document_idle',
      },
    ],
    web_accessible_resources: [
      {
        resources: ['pageBridge.js', 'header-logo.png', 'powered-by.png'],
        matches: [
          'https://shopee.co.id/*',
          'https://*.shopee.co.id/*',
          'https://shopee.co.th/*',
          'https://shopee.com.my/*',
          'https://shopee.ph/*',
          'https://shopee.sg/*',
          'https://shopee.vn/*',
        ],
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

  const distIconsDir = path.join(distDir, 'icons');
  await mkdir(distIconsDir, { recursive: true });

  await Promise.all(
    iconSizes.map((size) =>
      copyFile(
        path.join(assetsDir, `icon-${size}.png`),
        path.join(distIconsDir, `icon-${size}.png`),
      ),
    ),
  );

  await copyFile(
    path.join(assetsDir, 'header-logo.png'),
    path.join(distDir, 'header-logo.png'),
  );
  await copyFile(
    path.join(assetsDir, 'powered-by.png'),
    path.join(distDir, 'powered-by.png'),
  );
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

async function createZipPackage() {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  await cleanPackage();
  await ensurePackageDir();

  const archivePath = path.join(
    packageDir,
    `levelup-adspro-collector-v${packageJson.version}.zip`,
  );

  await new Promise((resolve, reject) => {
    const output = createWriteStream(archivePath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(distDir, false);
    void archive.finalize();
  });

  return archivePath;
}

async function main() {
  if (cleanOnly) {
    await cleanDist();
    await cleanPackage();
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
  const archivePath = await createZipPackage();
  console.log(`Extension package ready: ${archivePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
