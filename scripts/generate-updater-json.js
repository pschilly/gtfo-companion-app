import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const nsisDir = path.join(projectRoot, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const pkgPath = path.join(projectRoot, 'package.json');
const outputPath = path.join(projectRoot, 'src-tauri', 'target', 'release', 'latest.json');

try {
  if (!fs.existsSync(nsisDir)) {
    console.log('[updater-json] No nsis bundle directory found, skipping.');
    process.exit(0);
  }

  const files = fs.readdirSync(nsisDir);
  const sigFile = files.find((f) => f.endsWith('.sig'));

  if (!sigFile) {
    console.log('[updater-json] No .sig signature file found in bundle/nsis, skipping.');
    process.exit(0);
  }

  const sigContent = fs.readFileSync(path.join(nsisDir, sigFile), 'utf8').trim();
  const installerFile = sigFile.replace(/\.sig$/, '');

  let version = '0.0.3';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    version = pkg.version || version;
  }

  const tag = process.env.GITHUB_REF_NAME || `v${version}`;

  const manifest = {
    version: version,
    notes: `GTFO Companion App Release ${tag}`,
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature: sigContent,
        url: `https://github.com/pschilly/gtfo-companion-app/releases/download/${tag}/${installerFile}`,
      },
    },
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[updater-json] Successfully generated ${outputPath} for version ${version} (${installerFile})`);
} catch (err) {
  console.warn('[updater-json] Notice:', err.message);
}
