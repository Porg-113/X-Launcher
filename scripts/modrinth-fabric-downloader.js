#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');

let fetchImpl = globalThis.fetch;
if (!fetchImpl) {
  try {
    fetchImpl = require('node-fetch');
  } catch (_error) {
    fetchImpl = null;
  }
}

const API_BASE_URL = 'https://api.modrinth.com/v2';
const LOADER = 'fabric';
const MANIFEST_FILENAME = '.modrinth-downloads.json';
const USER_AGENT = 'XClient/1.1.9 (Fabric Modrinth Downloader)';
const DEFAULT_MODS = ['fabric-api', 'sodium', 'lithium', 'iris'];
const DEFAULT_VERSION_TYPES = ['release', 'beta', 'alpha'];

class CliError extends Error {}

function printHelp() {
  console.log(`Fabric-Mods ueber Modrinth herunterladen

Nutzung:
  node scripts/modrinth-fabric-downloader.js <minecraft-version> [optionen]

Beispiele:
  node scripts/modrinth-fabric-downloader.js 1.20.1
  node scripts/modrinth-fabric-downloader.js 1.20.1 --mods fabric-api sodium lithium iris --replace
  node scripts/modrinth-fabric-downloader.js 1.20.1 --mods-file mods.txt --mods-dir "%APPDATA%\\.minecraft\\mods"

Optionen:
  --mods <namen...>              Mod-Namen oder Slugs. Default: fabric-api sodium lithium iris
  --mods-file <datei>            Textdatei mit Mod-Namen, eine Zeile oder kommagetrennt
  --mods-dir <ordner>            Zielordner. Default: ./mods
  --version-types <typen...>     release beta alpha. Default: release beta alpha
  --clear                        Loescht vor dem Download alle .jar-Dateien im Zielordner
  --replace                      Ersetzt vorhandene/frueher verwaltete Dateien
  --no-fabric-api                Fabric API nicht automatisch zur Mod-Liste hinzufuegen
  --dry-run                      Zeigt nur, was passieren wuerde
  --timeout <sekunden>           HTTP-Timeout. Default: 30
  --help                         Diese Hilfe anzeigen`);
}

function parseArgs(argv) {
  const args = {
    minecraftVersion: '',
    mods: [],
    modsFile: '',
    modsDir: 'mods',
    versionTypes: DEFAULT_VERSION_TYPES.slice(),
    clear: false,
    replace: false,
    includeFabricApi: true,
    dryRun: false,
    timeoutSeconds: 30
  };

  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const [rawName, inlineValue] = token.split(/=(.*)/s);
    const name = rawName.slice(2);
    const readValue = () => {
      if (inlineValue !== undefined) {
        return inlineValue;
      }
      index += 1;
      if (index >= argv.length || argv[index].startsWith('--')) {
        throw new CliError(`Option --${name} braucht einen Wert.`);
      }
      return argv[index];
    };
    const readList = () => {
      const values = [];
      if (inlineValue !== undefined) {
        values.push(inlineValue);
        return values;
      }
      while (index + 1 < argv.length && !argv[index + 1].startsWith('--')) {
        index += 1;
        values.push(argv[index]);
      }
      if (!values.length) {
        throw new CliError(`Option --${name} braucht mindestens einen Wert.`);
      }
      return values;
    };

    if (name === 'mods') {
      addNameTokens(args.mods, readList());
    } else if (name === 'mods-file') {
      args.modsFile = readValue();
    } else if (name === 'mods-dir') {
      args.modsDir = readValue();
    } else if (name === 'version-types') {
      args.versionTypes = normalizeVersionTypes(readList());
    } else if (name === 'clear') {
      args.clear = true;
    } else if (name === 'replace') {
      args.replace = true;
    } else if (name === 'no-fabric-api') {
      args.includeFabricApi = false;
    } else if (name === 'dry-run') {
      args.dryRun = true;
    } else if (name === 'timeout') {
      args.timeoutSeconds = parsePositiveInt(readValue(), '--timeout');
    } else {
      throw new CliError(`Unbekannte Option: --${name}`);
    }
  }

  args.minecraftVersion = String(positionals.shift() || '').trim();
  if (positionals.length) {
    addNameTokens(args.mods, positionals);
  }

  return args;
}

function parsePositiveInt(value, label) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CliError(`${label} muss groesser als 0 sein.`);
  }
  return parsed;
}

function normalizeVersionTypes(values) {
  const allowed = new Set(DEFAULT_VERSION_TYPES);
  const normalized = values
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  for (const value of normalized) {
    if (!allowed.has(value)) {
      throw new CliError(`Ungueltiger Versionstyp: ${value}`);
    }
  }

  return uniqueStrings(normalized);
}

function addNameTokens(target, values) {
  for (const value of values) {
    for (const part of String(value || '').split(',')) {
      const trimmed = part.trim();
      if (trimmed) {
        target.push(trimmed);
      }
    }
  }
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = String(value || '').trim();
    const key = normalized.toLowerCase();
    if (normalized && !seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }
  return result;
}

function expandPath(inputPath) {
  const expanded = String(inputPath || '')
    .replace(/^~(?=$|[\\/])/, os.homedir())
    .replace(/%([^%]+)%/g, (_match, name) => process.env[name] || process.env[name.toUpperCase()] || '')
    .replace(/\$\{([^}]+)\}/g, (_match, name) => process.env[name] || '')
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name) => process.env[name] || '');

  return path.resolve(expanded || 'mods');
}

function ensureUsableModsDir(modsDir, dryRun) {
  const root = path.parse(modsDir).root;
  const home = path.resolve(os.homedir());
  const resolved = path.resolve(modsDir);
  if (resolved === path.resolve(root) || resolved === home) {
    throw new CliError(`Unsicherer Zielordner: ${modsDir}`);
  }

  if (fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory()) {
    throw new CliError(`Zielpfad ist kein Ordner: ${modsDir}`);
  }

  if (!dryRun) {
    fs.mkdirSync(resolved, { recursive: true });
  }
}

function readModNames(args) {
  const names = [];
  addNameTokens(names, args.mods);

  if (args.modsFile) {
    const modsFile = expandPath(args.modsFile);
    let content = '';
    try {
      content = fs.readFileSync(modsFile, 'utf8');
    } catch (error) {
      throw new CliError(`Mods-Datei kann nicht gelesen werden: ${modsFile}`);
    }

    for (const line of content.split(/\r?\n/u)) {
      const cleanLine = line.split('#')[0].trim();
      if (cleanLine) {
        addNameTokens(names, [cleanLine]);
      }
    }
  }

  const result = uniqueStrings(names.length ? names : DEFAULT_MODS);
  const hasFabricApi = result.some((name) => ['fabric-api', 'fabric api', 'fabricapi'].includes(name.toLowerCase()));
  if (args.includeFabricApi && !hasFabricApi) {
    result.unshift('fabric-api');
  }
  return result;
}

function getJarFiles(modsDir) {
  if (!fs.existsSync(modsDir)) {
    return [];
  }

  return fs.readdirSync(modsDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.jar'))
    .map((fileName) => path.join(modsDir, fileName))
    .filter((filePath) => fs.statSync(filePath).isFile());
}

function clearJarFiles(modsDir) {
  let deleted = 0;
  for (const jarPath of getJarFiles(modsDir)) {
    fs.unlinkSync(jarPath);
    deleted += 1;
  }

  const manifestPath = path.join(modsDir, MANIFEST_FILENAME);
  if (fs.existsSync(manifestPath)) {
    fs.unlinkSync(manifestPath);
  }

  return deleted;
}

function loadManifest(modsDir) {
  const manifestPath = path.join(modsDir, MANIFEST_FILENAME);
  if (!fs.existsSync(manifestPath)) {
    return { mods: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return parsed && typeof parsed === 'object' && parsed.mods && typeof parsed.mods === 'object'
      ? parsed
      : { mods: {} };
  } catch (_error) {
    return { mods: {} };
  }
}

function saveManifest(modsDir, manifest) {
  fs.writeFileSync(
    path.join(modsDir, MANIFEST_FILENAME),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
}

async function fetchJson(url, timeoutSeconds) {
  if (!fetchImpl) {
    throw new CliError('fetch ist nicht verfuegbar. Installiere node-fetch oder nutze Node 18+.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT
      },
      signal: controller.signal
    });

    const text = await response.text();
    if (!response.ok) {
      throw new CliError(`Modrinth API HTTP ${response.status}: ${text}`);
    }

    return JSON.parse(text);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new CliError(`Timeout nach ${timeoutSeconds}s: ${url}`);
    }
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError(`Modrinth API nicht erreichbar: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function buildApiUrl(pathname, params = {}) {
  const url = new URL(`${API_BASE_URL}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function searchProjects(modName, minecraftVersion, timeoutSeconds) {
  const facets = [
    ['project_type:mod'],
    [`categories:${LOADER}`]
  ];
  if (minecraftVersion) {
    facets.push([`versions:${minecraftVersion}`]);
  }

  const payload = await fetchJson(buildApiUrl('/search', {
    query: modName,
    facets: JSON.stringify(facets),
    limit: '10',
    index: 'relevance'
  }), timeoutSeconds);

  const hits = Array.isArray(payload && payload.hits) ? payload.hits : [];
  return hits
    .map((hit) => ({
      projectId: String(hit && (hit.project_id || hit.id) || '').trim(),
      slug: String(hit && hit.slug || '').trim(),
      title: String(hit && (hit.title || hit.slug) || modName).trim(),
      downloads: Number(hit && hit.downloads || 0)
    }))
    .filter((project) => project.projectId && project.slug);
}

async function listProjectVersions(project, minecraftVersion, timeoutSeconds) {
  const payload = await fetchJson(buildApiUrl(`/project/${encodeURIComponent(project.slug)}/version`, {
    loaders: JSON.stringify([LOADER]),
    game_versions: JSON.stringify([minecraftVersion]),
    include_changelog: 'false'
  }), timeoutSeconds);

  return Array.isArray(payload) ? payload.filter((entry) => entry && typeof entry === 'object') : [];
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function slugLike(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

function rankProjects(modName, projects) {
  const wantedSlug = slugLike(modName);
  const wantedName = normalizeName(modName);

  const scoreProject = (project) => {
    let score = 0;
    if (project.slug.toLowerCase() === wantedSlug) {
      score += 100;
    }
    if (normalizeName(project.title) === wantedName) {
      score += 90;
    }
    if (wantedName && normalizeName(project.title).includes(wantedName)) {
      score += 20;
    }
    if (wantedSlug && project.slug.toLowerCase().includes(wantedSlug)) {
      score += 15;
    }
    return [score, project.downloads || 0];
  };

  return projects.slice().sort((left, right) => {
    const leftScore = scoreProject(left);
    const rightScore = scoreProject(right);
    return (rightScore[0] - leftScore[0]) || (rightScore[1] - leftScore[1]);
  });
}

function isRuntimeJar(file) {
  const filename = String(file && file.filename || '').toLowerCase();
  const fileType = String(file && file.file_type || '').toLowerCase();
  if (!filename.endsWith('.jar')) {
    return false;
  }
  if (['sources-jar', 'dev-jar', 'javadoc-jar', 'signature'].includes(fileType)) {
    return false;
  }
  return !/(?:^|[-_.])(?:sources|dev|javadoc)(?:[-_.]|$)/u.test(filename);
}

function getPrimaryFile(version) {
  const files = Array.isArray(version && version.files) ? version.files.filter(isRuntimeJar) : [];
  return files.find((file) => file.primary) || files[0] || null;
}

function chooseVersion(project, versions, allowedVersionTypes) {
  const allowed = new Set(allowedVersionTypes);
  const candidates = versions
    .filter((version) => String(version.status || 'listed') === 'listed')
    .filter((version) => allowed.has(String(version.version_type || '').toLowerCase()))
    .map((version) => ({
      project,
      version,
      file: getPrimaryFile(version)
    }))
    .filter((entry) => entry.file);

  candidates.sort((left, right) => {
    const leftDate = Date.parse(left.version.date_published || '') || 0;
    const rightDate = Date.parse(right.version.date_published || '') || 0;
    return rightDate - leftDate;
  });

  return candidates[0] || null;
}

async function resolveCandidate(modName, minecraftVersion, allowedVersionTypes, timeoutSeconds) {
  const rankedProjects = rankProjects(
    modName,
    await searchProjects(modName, minecraftVersion, timeoutSeconds)
  );

  if (!rankedProjects.length) {
    const anyFabricProjects = await searchProjects(modName, '', timeoutSeconds);
    if (rankProjects(modName, anyFabricProjects).length) {
      return { candidate: null, reason: `Keine Fabric-Version fuer Minecraft ${minecraftVersion} gefunden.` };
    }
    return { candidate: null, reason: 'Kein Fabric-Mod auf Modrinth gefunden.' };
  }

  for (const project of rankedProjects) {
    const versions = await listProjectVersions(project, minecraftVersion, timeoutSeconds);
    const candidate = chooseVersion(project, versions, allowedVersionTypes);
    if (candidate) {
      return { candidate, reason: '' };
    }
  }

  return {
    candidate: null,
    reason: `Keine passende Datei gefunden (Minecraft ${minecraftVersion}, Loader ${LOADER}).`
  };
}

function safeFileName(fileName) {
  const parsed = path.parse(path.basename(String(fileName || '').trim() || 'download.jar'));
  const base = parsed.name.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').trim() || 'download';
  const ext = (parsed.ext || '.jar').replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '') || '.jar';
  return `${base}${ext.startsWith('.') ? ext : `.${ext}`}`;
}

function hashFile(filePath, algorithm) {
  const hash = crypto.createHash(algorithm);
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex').toLowerCase();
}

function existingFileMatches(filePath, hashes) {
  try {
    if (hashes && hashes.sha512) {
      return hashFile(filePath, 'sha512') === String(hashes.sha512).toLowerCase();
    }
    if (hashes && hashes.sha1) {
      return hashFile(filePath, 'sha1') === String(hashes.sha1).toLowerCase();
    }
  } catch (_error) {
    return false;
  }
  return false;
}

function requestDownload(url, timeoutSeconds, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'http:' ? http : https;
    const request = client.get(parsedUrl, {
      headers: {
        'User-Agent': USER_AGENT
      }
    }, (response) => {
      const statusCode = Number(response.statusCode || 0);
      const location = response.headers.location;

      if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
        response.resume();
        if (redirectsLeft <= 0) {
          reject(new CliError(`Zu viele Redirects fuer ${url}`));
          return;
        }
        resolve(requestDownload(new URL(location, parsedUrl).toString(), timeoutSeconds, redirectsLeft - 1));
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new CliError(`Download HTTP ${statusCode}: ${url}`));
        return;
      }

      resolve(response);
    });

    request.setTimeout(timeoutSeconds * 1000, () => {
      request.destroy(new CliError(`Download-Timeout nach ${timeoutSeconds}s: ${url}`));
    });
    request.on('error', reject);
  });
}

async function downloadFile(file, targetPath, timeoutSeconds) {
  const url = String(file && file.url || '').trim();
  if (!url) {
    throw new CliError('Modrinth-Datei hat keine Download-URL.');
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  const tempPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.part`
  );
  const hashes = file.hashes && typeof file.hashes === 'object' ? file.hashes : {};
  const sha512 = hashes.sha512 ? crypto.createHash('sha512') : null;
  const sha1 = hashes.sha1 ? crypto.createHash('sha1') : null;

  try {
    const stream = await requestDownload(url, timeoutSeconds);
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(tempPath);
      stream.on('data', (chunk) => {
        if (sha512) {
          sha512.update(chunk);
        }
        if (sha1) {
          sha1.update(chunk);
        }
      });
      stream.on('error', reject);
      output.on('error', reject);
      output.on('finish', resolve);
      stream.pipe(output);
    });

    if (sha512 && sha512.digest('hex').toLowerCase() !== String(hashes.sha512).toLowerCase()) {
      throw new CliError(`SHA-512 Check fehlgeschlagen: ${path.basename(targetPath)}`);
    }
    if (sha1 && sha1.digest('hex').toLowerCase() !== String(hashes.sha1).toLowerCase()) {
      throw new CliError(`SHA-1 Check fehlgeschlagen: ${path.basename(targetPath)}`);
    }

    fs.renameSync(tempPath, targetPath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

function removePreviousDownload(modsDir, manifest, projectId, targetPath) {
  const entry = manifest.mods && manifest.mods[projectId];
  const previousFileName = entry && entry.filename;
  if (!previousFileName) {
    return;
  }

  const previousPath = path.join(modsDir, path.basename(previousFileName));
  if (previousPath !== targetPath && fs.existsSync(previousPath)) {
    fs.unlinkSync(previousPath);
    console.log(`  Alte Datei entfernt: ${path.basename(previousPath)}`);
  }
}

function updateManifest(manifest, minecraftVersion, candidate, fileName) {
  manifest.minecraftVersion = minecraftVersion;
  manifest.loader = LOADER;
  manifest.updatedAt = new Date().toISOString();
  manifest.mods = manifest.mods || {};
  manifest.mods[candidate.project.projectId] = {
    title: candidate.project.title,
    slug: candidate.project.slug,
    versionId: String(candidate.version.id || '').trim(),
    versionNumber: String(candidate.version.version_number || '').trim(),
    versionType: String(candidate.version.version_type || '').trim(),
    filename: fileName
  };
}

function formatSize(size) {
  let value = Number(size || 0);
  for (const unit of ['B', 'KiB', 'MiB', 'GiB']) {
    if (value < 1024 || unit === 'GiB') {
      return unit === 'B' ? `${value} ${unit}` : `${value.toFixed(1)} ${unit}`;
    }
    value /= 1024;
  }
  return `${value.toFixed(1)} GiB`;
}

async function processMod(modName, args, modsDir, manifest) {
  console.log(`[${modName}] Suche kompatiblen Fabric-Mod...`);
  const { candidate, reason } = await resolveCandidate(
    modName,
    args.minecraftVersion,
    args.versionTypes,
    args.timeoutSeconds
  );

  if (!candidate) {
    console.log(`  Uebersprungen: ${reason}`);
    return 'missing';
  }

  const fileName = safeFileName(candidate.file.filename);
  const targetPath = path.join(modsDir, fileName);
  const hashes = candidate.file.hashes && typeof candidate.file.hashes === 'object'
    ? candidate.file.hashes
    : {};

  console.log(
    `  Gefunden: ${candidate.project.title} ${candidate.version.version_number || ''} `
    + `(${candidate.version.version_type || 'unknown'}, ${formatSize(candidate.file.size)})`
  );

  if (fs.existsSync(targetPath) && existingFileMatches(targetPath, hashes)) {
    console.log(`  Bereits vorhanden: ${fileName}`);
    updateManifest(manifest, args.minecraftVersion, candidate, fileName);
    return 'existing';
  }

  if (fs.existsSync(targetPath) && !args.replace) {
    console.log(`  Ziel existiert bereits: ${fileName} (nutze --replace zum Ersetzen)`);
    return 'skipped';
  }

  if (args.dryRun) {
    console.log(`  Dry run: wuerde ${fs.existsSync(targetPath) ? 'ersetzen' : 'herunterladen'}: ${fileName}`);
    return 'planned';
  }

  if (args.replace) {
    removePreviousDownload(modsDir, manifest, candidate.project.projectId, targetPath);
  }

  console.log(`  Download: ${fileName}`);
  await downloadFile(candidate.file, targetPath, args.timeoutSeconds);
  updateManifest(manifest, args.minecraftVersion, candidate, fileName);
  console.log(`  Gespeichert: ${targetPath}`);
  return 'downloaded';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }
  if (!args.minecraftVersion) {
    throw new CliError('Minecraft-Version fehlt.');
  }

  const modsDir = expandPath(args.modsDir);
  const modNames = readModNames(args);
  ensureUsableModsDir(modsDir, args.dryRun);

  if (args.clear) {
    const jarCount = getJarFiles(modsDir).length;
    if (args.dryRun) {
      console.log(`Dry run: wuerde alte .jar-Dateien loeschen: ${jarCount}`);
    } else {
      console.log(`Alte .jar-Dateien geloescht: ${clearJarFiles(modsDir)}`);
    }
  }

  const manifest = loadManifest(modsDir);
  const results = {
    downloaded: 0,
    existing: 0,
    planned: 0,
    skipped: 0,
    missing: 0,
    failed: 0
  };

  console.log(`Minecraft-Version: ${args.minecraftVersion}`);
  console.log(`Loader: ${LOADER}`);
  console.log(`Zielordner: ${modsDir}`);
  console.log(`Mods: ${modNames.join(', ')}`);
  console.log('');

  for (const modName of modNames) {
    try {
      const result = await processMod(modName, args, modsDir, manifest);
      results[result] += 1;
    } catch (error) {
      results.failed += 1;
      console.log(`[${modName}] Fehler: ${error.message}`);
    }
    console.log('');
  }

  if (!args.dryRun) {
    saveManifest(modsDir, manifest);
  }

  console.log('Zusammenfassung:');
  console.log(`  Heruntergeladen: ${results.downloaded}`);
  console.log(`  Bereits vorhanden: ${results.existing}`);
  if (args.dryRun) {
    console.log(`  Geplant: ${results.planned}`);
  }
  console.log(`  Uebersprungen: ${results.skipped + results.missing}`);
  console.log(`  Fehlgeschlagen: ${results.failed}`);

  return results.failed ? 1 : 0;
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(`Fehler: ${error.message}`);
    process.exitCode = error instanceof CliError ? 2 : 1;
  });
