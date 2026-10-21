import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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
  const rawInstallerFile = sigFile.replace(/\.sig$/, '');
  // GitHub Releases action sanitizes spaces to dots in asset filenames
  const gitHubReleaseFile = rawInstallerFile.replace(/\s+/g, '.');

  let version = '0.0.6';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    version = pkg.version || version;
  }

  const tag = process.env.GITHUB_REF_NAME || `v${version}`;

  // Automatically determine release notes / changelog
  let notes = process.env.RELEASE_NOTES || '';
  if (!notes) {
    const notesFile = path.join(projectRoot, 'RELEASE_NOTES.md');
    if (fs.existsSync(notesFile)) {
      notes = fs.readFileSync(notesFile, 'utf8').trim();
    }
  }

  if (!notes) {
    try {
      const allTags = execSync('git tag --sort=-creatordate', { encoding: 'utf8' })
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);
      const prevTag = allTags.find((t) => t !== tag);
      if (prevTag) {
        const log = execSync(`git log ${prevTag}..HEAD --no-merges --pretty=format:"• %s"`, { encoding: 'utf8' }).trim();
        if (log) {
          notes = log;
        }
      } else {
        const log = execSync('git log -n 5 --no-merges --pretty=format:"• %s"', { encoding: 'utf8' }).trim();
        if (log) {
          notes = log;
        }
      }
    } catch {
      // Fallback if git is not available or shallow clone
    }
  }

  if (!notes) {
    notes = `GTFO Companion App Release ${tag}`;
  }

  const manifest = {
    version: version,
    notes: notes,
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature: sigContent,
        url: `https://github.com/pschilly/gtfo-companion-app/releases/download/${tag}/${gitHubReleaseFile}`,
      },
    },
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[updater-json] Successfully generated ${outputPath} for version ${version} (${gitHubReleaseFile})`);
} catch (err) {
  console.warn('[updater-json] Notice:', err.message);
}
