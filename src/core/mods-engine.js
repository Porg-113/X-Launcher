const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const MODRINTH_API_BASE_URL = 'https://api.modrinth.com/v2';
const MODRINTH_HEADERS = { 'User-Agent': 'XClient/2.0 (Fabric Mods Engine)' };
const CACHE_TTL_MS = 5 * 60 * 1000;
const COMPAT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30000;
const VERBOSE_MOD_LOGGING = process.env.X_LAUNCHER_DEBUG_MODS === '1';
const STATE_VERSION = 1;
const KNOWN_CRASH_PROJECT_IDS = new Set([
  'fQEb0iXm',
  'krypton'
]);
const KNOWN_CRASH_SLUGS = new Set([
  'krypton'
]);
const KNOWN_CRASH_FILE_PATTERNS = [
  /^krypton.*\.jar$/iu
];

function createModsEngine(options) {
  const {
    fsModule = fs,
    pathModule = path,
    fetchImpl,
    logger = console,
    serializeError = (error) => ({ message: error?.message || String(error) }),
    configDir,
    getActiveModContext,
    getModrinthInstallContext,
    getEffectiveSelectedVersionId,
    persistEffectiveSelectedVersionId,
    getCurrentMinecraftVersion,
    getModrinthTargetChangeWarning,
    installDownloadableModrinthProject,
    installModrinthModpack,
    updateDownloadableModrinthProjects,
    getInstalledDownloadableModrinthEntries,
    removeDownloadableModrinthEntry,
    requiredBundledMods = [],
    requiredManagedProjectIds = [],
    hiddenProjectIds = [],
    hiddenSlugs = [],
    protectedProjectIds = [],
    fabricApiProjectId = 'P7dR8mSH',
    shouldPurgeModFile = () => false,
    disabledModsDirName = '.x-disabled-mods',
    modrinthProjectIdAliases = {},
    resourcepacksDir,
    shaderpacksDir
  } = options || {};

  const isMinecraftRunning = typeof options?.isMinecraftRunning === 'function'
    ? options.isMinecraftRunning
    : () => false;
  const getFileDeletionBlockReason = typeof options?.getFileDeletionBlockReason === 'function'
    ? options.getFileDeletionBlockReason
    : () => '';

  if (!fetchImpl) {
    throw new Error('Mods engine requires fetch.');
  }

  const stateFile = pathModule.join(configDir, 'mods-state.json');
  const apiCache = new Map();
  const pendingSyncs = new Map();
  const requiredManagedSet = normalizeSet(requiredManagedProjectIds);
  const hiddenProjectSet = normalizeSet(hiddenProjectIds);
  const hiddenSlugSet = new Set([...normalizeSet(hiddenSlugs)].map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean));
  const protectedProjectSet = new Set([...normalizeSet(protectedProjectIds), ...requiredManagedSet]);
  const normalizedFabricApiProjectId = String(fabricApiProjectId || 'P7dR8mSH').trim();
  const aliasMap = new Map(Object.entries(modrinthProjectIdAliases || {}).map(([key, value]) => [normalizeId(key), String(value || '').trim()]));
  const modOperationLocks = new Map();
  const localArchiveMetadataCache = new Map();

  function getArchiveCacheKey(filePath) {
    try {
      const stat = fsModule.statSync(filePath);
      return `${normalizePath(filePath)}:${stat.size}:${stat.mtimeMs}`;
    } catch (_error) {
      return '';
    }
  }

  function withModOperationLock(modId, operation) {
    const lockKey = String(modId || '').trim() || '__global__';
    const previous = modOperationLocks.get(lockKey) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => operation());
    modOperationLocks.set(lockKey, next.catch(() => {}));
    return next;
  }

  function info(message, details = {}) {
    if (!VERBOSE_MOD_LOGGING) {
      return;
    }
    logger.info ? logger.info(`[mods-engine] ${message}`, details) : console.info(`[mods-engine] ${message}`, details);
  }

  function warn(message, details = {}) {
    logger.warn ? logger.warn(`[mods-engine] ${message}`, details) : console.warn(`[mods-engine] ${message}`, details);
  }

  function errorLog(message, details = {}) {
    logger.error ? logger.error(`[mods-engine] ${message}`, details) : console.error(`[mods-engine] ${message}`, details);
  }

  function ensureDir(dir) {
    if (!dir) {
      return;
    }
    fsModule.mkdirSync(dir, { recursive: true });
  }

  function readJson(file, fallback) {
    try {
      if (!fsModule.existsSync(file)) {
        return fallback;
      }
      return JSON.parse(fsModule.readFileSync(file, 'utf8'));
    } catch (error) {
      warn('Could not read JSON state file, using fallback.', { file, error: serializeError(error) });
      return fallback;
    }
  }

  function writeJson(file, data) {
    ensureDir(pathModule.dirname(file));
    const tmp = `${file}.tmp`;
    fsModule.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fsModule.renameSync(tmp, file);
  }

  function defaultState() {
    return {
      version: STATE_VERSION,
      projects: {},
      disabledProjects: [],
      autoDisabledProjects: [],
      disabledProjectReasons: {},
      keptLocalMods: [],
      modAliases: {},
      activeSync: { minecraftVersion: '', files: [] },
      observedMods: [],
      operationLog: []
    };
  }

  function normalizeState(raw) {
    const state = { ...defaultState(), ...(raw && typeof raw === 'object' ? raw : {}) };
    state.version = STATE_VERSION;
    state.projects = state.projects && typeof state.projects === 'object' ? state.projects : {};
    state.modAliases = state.modAliases && typeof state.modAliases === 'object' ? state.modAliases : {};
    state.keptLocalMods = Array.isArray(state.keptLocalMods)
      ? state.keptLocalMods.filter((entry) => entry && typeof entry === 'object').map((entry) => ({
          identity: String(entry.identity || '').trim().toLowerCase(),
          fileName: String(entry.fileName || '').trim(),
          sha1: String(entry.sha1 || '').trim().toLowerCase(),
          keptAt: String(entry.keptAt || '').trim()
        })).filter((entry) => entry.identity || entry.sha1 || entry.fileName)
      : [];
    for (const project of Object.values(state.projects)) {
      if (!project || typeof project !== 'object') continue;
      // Older state files predate dependency ownership. Existing top-level
      // installations are deliberately treated as manual so an upgrade can
      // never remove user content accidentally.
      project.installationSource = project.installationSource === 'dependency' ? 'dependency' : 'manual';
    }

    for (const [aliasKey, canonicalProjectId] of aliasMap.entries()) {
      const aliasProjectId = Object.keys(state.projects).find((projectId) => normalizeId(projectId) === aliasKey);
      const canonicalId = String(canonicalProjectId || '').trim();
      if (!aliasProjectId || !canonicalId || normalizeId(aliasProjectId) === normalizeId(canonicalId)) {
        continue;
      }
      const aliasProject = state.projects[aliasProjectId] || {};
      const canonicalProject = state.projects[canonicalId] || {};
      state.projects[canonicalId] = {
        ...aliasProject,
        ...canonicalProject,
        projectId: canonicalId,
        slug: canonicalProject.slug || aliasProject.slug || '',
        title: canonicalProject.title || aliasProject.title || canonicalId,
        description: canonicalProject.description || aliasProject.description || '',
        iconUrl: canonicalProject.iconUrl || aliasProject.iconUrl || '',
        versions: {
          ...(aliasProject.versions || {}),
          ...(canonicalProject.versions || {})
        }
      };
      delete state.projects[aliasProjectId];
    }

    const canonicalizeProjectList = (entries) => uniqueStrings((Array.isArray(entries) ? entries : [])
      .map((projectId) => aliasMap.get(normalizeId(projectId)) || projectId));
    state.disabledProjects = uniqueStrings(state.disabledProjects);
    state.autoDisabledProjects = uniqueStrings(state.autoDisabledProjects);
    state.disabledProjects = canonicalizeProjectList(state.disabledProjects);
    state.autoDisabledProjects = canonicalizeProjectList(state.autoDisabledProjects);
    state.disabledProjectReasons = state.disabledProjectReasons && typeof state.disabledProjectReasons === 'object'
      ? state.disabledProjectReasons
      : {};
    state.activeSync = state.activeSync && typeof state.activeSync === 'object' ? state.activeSync : defaultState().activeSync;
    state.activeSync.files = Array.isArray(state.activeSync.files) ? state.activeSync.files : [];
    state.activeSync.files = state.activeSync.files.map((entry) => ({
      ...entry,
      projectId: aliasMap.get(normalizeId(entry?.projectId)) || entry?.projectId || ''
    }));
    state.observedMods = Array.isArray(state.observedMods) ? state.observedMods : [];
    state.operationLog = Array.isArray(state.operationLog) ? state.operationLog.slice(-250) : [];
    return state;
  }

  function readState(modContext) {
    const file = modContext?.stateFile || stateFile;
    return normalizeState(readJson(file, defaultState()));
  }

  function writeState(state, modContext) {
    const file = modContext?.stateFile || stateFile;
    writeJson(file, normalizeState(state));
  }

  function recordDecision(state, event, details = {}) {
    state.operationLog = [
      ...state.operationLog,
      {
        at: new Date().toISOString(),
        event,
        ...details
      }
    ].slice(-250);
  }

  async function fetchWithTimeout(requestUrl, init = {}, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || FETCH_TIMEOUT_MS)) : null;
    try {
      return await fetchImpl(requestUrl, {
        ...init,
        ...(controller ? { signal: controller.signal } : {})
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  async function fetchJson(url, options = {}) {
    const requestUrl = String(url || '').startsWith('http')
      ? String(url)
      : `${MODRINTH_API_BASE_URL}${String(url)}`;
    const cacheKey = `${requestUrl}:${JSON.stringify(options.query || {})}`;
    if (!options.forceRefresh && apiCache.has(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.value;
      }
    }

    const response = await fetchWithTimeout(requestUrl, {
      headers: { ...MODRINTH_HEADERS, ...(options.headers || {}) }
    });
    if (!response.ok) {
      throw new Error(`Modrinth responded with HTTP ${response.status} for ${requestUrl}.`);
    }
    const value = await response.json();
    apiCache.set(cacheKey, { at: Date.now(), value });
    return value;
  }

  function resolveProjectId(projectRef) {
    if (!projectRef) {
      return '';
    }
    const raw = typeof projectRef === 'string'
      ? projectRef
      : projectRef.projectId || projectRef.project_id || projectRef.id || projectRef.slug || '';
    const normalized = String(raw || '').trim();
    return aliasMap.get(normalizeId(normalized)) || normalized;
  }

  function projectType(projectRef) {
    const type = typeof projectRef === 'string'
      ? 'mod'
      : String(projectRef.projectType || projectRef.project_type || 'mod').trim().toLowerCase();
    return ['mod', 'modpack', 'resourcepack', 'shader'].includes(type) ? type : 'mod';
  }

  async function fetchProject(projectRef, options = {}) {
    const projectId = resolveProjectId(projectRef);
    if (!projectId) {
      throw new Error('Modrinth project id is required.');
    }
    return fetchJson(`/project/${encodeURIComponent(projectId)}`, options);
  }

  async function fetchVersions(projectId, options = {}) {
    return fetchJson(`/project/${encodeURIComponent(projectId)}/version`, options);
  }

  async function fetchVersion(versionId, options = {}) {
    return fetchJson(`/version/${encodeURIComponent(versionId)}`, options);
  }

  async function fetchVersionByHash(sha1) {
    if (!sha1) {
      throw new Error('SHA1 hash is required for version lookup.');
    }
    return fetchJson(`/version_file/${encodeURIComponent(sha1)}?algorithm=sha1`);
  }

  function selectPrimaryJarFile(versionEntry) {
    const files = Array.isArray(versionEntry?.files) ? versionEntry.files : [];
    return files.find((file) => file?.filename?.toLowerCase().endsWith('.jar') && file?.primary)
      || files.find((file) => file?.filename?.toLowerCase().endsWith('.jar'))
      || null;
  }

  function versionSupportsLoader(versionEntry, loader = 'fabric') {
    const loaders = Array.isArray(versionEntry?.loaders)
      ? versionEntry.loaders.map((entry) => String(entry || '').trim().toLowerCase())
      : [];
    return loaders.includes(String(loader || 'fabric').trim().toLowerCase());
  }

  function versionSupportsMinecraft(versionEntry, minecraftVersion) {
    const versions = Array.isArray(versionEntry?.game_versions)
      ? versionEntry.game_versions.map((entry) => String(entry || '').trim())
      : [];
    return versions.includes(String(minecraftVersion));
  }

  function versionDateMs(versionEntry) {
    return Date.parse(versionEntry?.date_published || versionEntry?.datePublished || '') || 0;
  }

  function compareModVersions(left, right) {
    const leftParts = String(left || '').replace(/^[v=]+/iu, '').split(/[.+-]/u).map((part) => Number(part) || 0);
    const rightParts = String(right || '').replace(/^[v=]+/iu, '').split(/[.+-]/u).map((part) => Number(part) || 0);
    for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
      const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
      if (difference) return difference;
    }
    return 0;
  }

  function modVersionSatisfies(requirement, actual) {
    const expression = String(requirement || '').trim().replace(/\s+or\s+/giu, ' || ');
    if (!expression || expression === '*') return true;
    const normalizedActual = String(actual || '').trim().replace(/^[v=]+/iu, '');
    return expression.split(/\s*\|\|\s*/u).some((alternative) => alternative.trim().split(/\s+/u).filter(Boolean).every((token) => {
      const match = token.match(/^(>=|<=|>|<|=|==|~|\^)?\s*v?(.+)$/u);
      if (!match) return false;
      const operator = match[1] || '=';
      const required = match[2];
      if ((operator === '=' || operator === '==') && /[xX*]/u.test(required)) {
        const wildcard = required.replace(/[xX*]/gu, '');
        return wildcard ? normalizedActual.startsWith(wildcard.replace(/\.$/u, '')) : true;
      }
      const difference = compareModVersions(actual, required);
      if (operator === '>') return difference > 0;
      if (operator === '>=') return difference >= 0;
      if (operator === '<') return difference < 0;
      if (operator === '<=') return difference <= 0;
      if (operator === '^') return difference >= 0 && String(actual).split('.')[0] === required.split('.')[0];
      if (operator === '~') return difference >= 0 && String(actual).split('.').slice(0, 2).join('.') === required.split('.').slice(0, 2).join('.');
      return difference === 0;
    }));
  }

  function getActiveManifestRecords(modContext) {
    return listActiveModJarPaths(modContext).map((filePath) => {
      const manifest = readFabricManifest(filePath);
      return manifest ? {
        filePath,
        manifest,
        modId: String(manifest.id || '').trim().toLowerCase(),
        version: String(manifest.version || '').trim()
      } : null;
    }).filter((entry) => entry?.modId);
  }

  function resolveDependencyProjectReference(state, fabricModId) {
    const normalizedId = normalizeId(fabricModId);
    const existingProject = Object.values(state.projects || {}).find((project) => [
      project?.projectId,
      project?.slug,
      project?.title
    ].some((value) => normalizeId(value) === normalizedId));
    return existingProject?.projectId || fabricModId;
  }

  async function resolveActiveManifestDependencies(modContext, state, options = {}) {
    const ignoredIds = new Set(['minecraft', 'java', 'fabricloader']);
    const records = getActiveManifestRecords(modContext);
    const installedById = new Map(records.map((entry) => [entry.modId, entry]));
    const requirements = new Map();
    for (const record of records) {
      const depends = record.manifest?.depends && typeof record.manifest.depends === 'object'
        ? record.manifest.depends
        : {};
      for (const [rawId, requirement] of Object.entries(depends)) {
        const dependencyId = normalizeId(rawId);
        if (!dependencyId || ignoredIds.has(dependencyId)) continue;
        const list = requirements.get(dependencyId) || [];
        list.push({ requirement: String(requirement || '*').trim(), parent: record.modId });
        requirements.set(dependencyId, list);
      }
    }

    const resolved = [];
    for (const [dependencyId, entries] of requirements.entries()) {
      const validInstalled = installedById.get(dependencyId)
        && entries.every((entry) => modVersionSatisfies(entry.requirement, installedById.get(dependencyId).version));
      if (validInstalled) {
        logger.info('[MOD-RESOLVER] Kept', {
          modId: dependencyId,
          version: installedById.get(dependencyId).version,
          requiredBy: entries.map((entry) => entry.parent)
        });
        continue;
      }

      const projectReference = resolveDependencyProjectReference(state, dependencyId);
      const versionRequirements = entries.map((entry) => entry.requirement);
      const previousVersion = installedById.get(dependencyId)?.version || '';
      try {
        await ensureProjectInstalled(projectReference, modContext.minecraftVersion, modContext, state, {
          ...options,
          forceRefresh: true,
          requiredVersionRequirements: versionRequirements,
          visited: new Set(),
          installationSource: 'dependency'
        });
        const selected = state.projects?.[resolveProjectId(projectReference)]?.versions?.[modContext.minecraftVersion];
        logger.info(`[MOD-RESOLVER] ${dependencyId} ${previousVersion || 'missing'} -> ${selected?.versionNumber || selected?.versionId || 'unknown'}`, {
          reason: `required by ${entries.map((entry) => entry.parent).join(' + ')}`
        });
        logger.info('[MOD-RESOLVER] Dependency selected', {
          modId: dependencyId,
          version: selected?.versionNumber || selected?.versionId || '',
          requiredBy: entries.map((entry) => entry.parent),
          requirements: versionRequirements
        });
        resolved.push(dependencyId);
      } catch (error) {
        throw new Error(`${dependencyId} wird benötigt von ${entries.map((entry) => entry.parent).join(', ')}: ${error.message}`);
      }
    }
    return resolved;
  }

  function assertArchiveLoaderCompatibility(filePath, modContext, projectId) {
    const loaderVersion = String(modContext?.loaderVersion || '').trim();
    if (!loaderVersion) return;
    const manifest = readFabricManifest(filePath);
    const requiredLoader = manifest?.depends?.fabricloader;
    const brokenLoader = manifest?.breaks?.fabricloader;
    if (requiredLoader && !modVersionSatisfies(requiredLoader, loaderVersion)) {
      throw createIncompatibleModError(`${projectId} benötigt Fabric Loader ${requiredLoader}, installiert ist ${loaderVersion}.`);
    }
    if (brokenLoader && modVersionSatisfies(brokenLoader, loaderVersion)) {
      throw createIncompatibleModError(`${projectId} ist mit Fabric Loader ${loaderVersion} inkompatibel.`);
    }
  }

  function filterCompatibleFabricVersions(versions, minecraftVersion, options = {}) {
    const loader = String(options.loader || 'fabric').trim().toLowerCase();
    const requiredVersionId = String(options.requiredVersionId || '').trim();
    return (Array.isArray(versions) ? versions : [])
      .filter((versionEntry) => versionSupportsLoader(versionEntry, loader) && selectPrimaryJarFile(versionEntry))
      .filter((versionEntry) => !requiredVersionId || String(versionEntry?.id || '').trim() === requiredVersionId)
      .map((versionEntry) => ({
        versionEntry,
        isExactMinecraftVersion: versionSupportsMinecraft(versionEntry, minecraftVersion)
      }))
      .sort((a, b) => {
        if (a.isExactMinecraftVersion !== b.isExactMinecraftVersion) {
          return a.isExactMinecraftVersion ? -1 : 1;
        }
        const aPriority = String(a.versionEntry?.version_type || '').toLowerCase() === 'release' ? 2 : 0;
        const bPriority = String(b.versionEntry?.version_type || '').toLowerCase() === 'release' ? 2 : 0;
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        return versionDateMs(b.versionEntry) - versionDateMs(a.versionEntry);
      })
      .map((item) => item.versionEntry);
  }

  function chooseCompatibleVersion(versions, minecraftVersion, options = {}) {
    const compatible = filterCompatibleFabricVersions(versions, minecraftVersion, options)
      .filter((entry) => versionSupportsMinecraft(entry, minecraftVersion))
      .filter((entry) => (options.requiredVersionRequirements || []).every((requirement) => (
        modVersionSatisfies(requirement, entry.version_number || entry.name || '')
      )));
    const selected = compatible[0] || null;
    const rejections = (Array.isArray(versions) ? versions : [])
      .filter((entry) => !compatible.includes(entry))
      .map((entry) => ({
        versionId: String(entry?.id || ''),
        versionNumber: String(entry?.version_number || ''),
        reason: versionSupportsLoader(entry, options.loader)
          ? (selectPrimaryJarFile(entry) ? `Minecraft ${minecraftVersion} ist nicht in game_versions enthalten.` : 'Keine JAR-Datei gefunden.')
          : `Loader ist nicht ${options.loader || 'Fabric'}.`
      }));

    return { selected, compatible, rejections };
  }

  function hashFile(filePath) {
    const hash = crypto.createHash('sha1');
    const data = fsModule.readFileSync(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  function verifyHash(filePath, expectedSha1) {
    if (!expectedSha1) {
      return true;
    }
    try {
      return hashFile(filePath).toLowerCase() === String(expectedSha1).toLowerCase();
    } catch (_error) {
      return false;
    }
  }

  function readZipBufferEntry(zipPath, entryName) {
    try {
      const buffer = fsModule.readFileSync(zipPath);
      const normalizedEntryName = String(entryName || '').replace(/\\/g, '/');
      const minimumEndRecordSize = 22;
      const searchStart = Math.max(0, buffer.length - 0xffff - minimumEndRecordSize);
      let endRecordOffset = -1;

      for (let offset = buffer.length - minimumEndRecordSize; offset >= searchStart; offset -= 1) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) {
          endRecordOffset = offset;
          break;
        }
      }
      if (endRecordOffset < 0) {
        return '';
      }

      const centralDirectorySize = buffer.readUInt32LE(endRecordOffset + 12);
      const centralDirectoryOffset = buffer.readUInt32LE(endRecordOffset + 16);
      const centralDirectoryEnd = Math.min(buffer.length, centralDirectoryOffset + centralDirectorySize);
      let cursor = centralDirectoryOffset;

      while (cursor + 46 <= centralDirectoryEnd && buffer.readUInt32LE(cursor) === 0x02014b50) {
        const compressionMethod = buffer.readUInt16LE(cursor + 10);
        const compressedSize = buffer.readUInt32LE(cursor + 20);
        const fileNameLength = buffer.readUInt16LE(cursor + 28);
        const extraLength = buffer.readUInt16LE(cursor + 30);
        const commentLength = buffer.readUInt16LE(cursor + 32);
        const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
        const fileNameStart = cursor + 46;
        const fileName = buffer.toString('utf8', fileNameStart, fileNameStart + fileNameLength).replace(/\\/g, '/');

        if (fileName === normalizedEntryName) {
          if (localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
            return '';
          }
          const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
          const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
          const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
          const dataEnd = dataStart + compressedSize;
          if (dataStart > buffer.length || dataEnd > buffer.length) {
            return '';
          }
          const data = buffer.subarray(dataStart, dataEnd);
          if (compressionMethod === 0) {
            return Buffer.from(data);
          }
          if (compressionMethod === 8) {
            return zlib.inflateRawSync(data);
          }
          return '';
        }

        cursor += 46 + fileNameLength + extraLength + commentLength;
      }
    } catch (_error) {
      return '';
    }
    return '';
  }

  function readZipTextEntry(zipPath, entryName) {
    const data = readZipBufferEntry(zipPath, entryName);
    return Buffer.isBuffer(data) ? data.toString('utf8') : '';
  }

  function getFabricManifestIconDataUrl(filePath, manifest) {
    const iconPath = typeof manifest?.icon === 'string'
      ? manifest.icon
      : (manifest?.icon && typeof manifest.icon === 'object' ? Object.values(manifest.icon)[0] : '');
    if (!iconPath) return '';
    const data = readZipBufferEntry(filePath, iconPath);
    if (!Buffer.isBuffer(data) || !data.length) return '';
    const extension = pathModule.extname(iconPath).toLowerCase();
    const mimeType = extension === '.jpg' || extension === '.jpeg'
      ? 'image/jpeg'
      : extension === '.webp' ? 'image/webp' : extension === '.gif' ? 'image/gif' : 'image/png';
    return `data:${mimeType};base64,${data.toString('base64')}`;
  }

  function readFabricManifest(filePath) {
    const cacheKey = getArchiveCacheKey(filePath);
    const cached = cacheKey ? localArchiveMetadataCache.get(cacheKey) : null;
    if (cached?.manifest) return cached.manifest;
    try {
      const text = readZipTextEntry(filePath, 'fabric.mod.json');
      const manifest = text ? JSON.parse(text) : null;
      if (cacheKey) localArchiveMetadataCache.set(cacheKey, { ...(cached || {}), manifest });
      return manifest;
    } catch (_error) {
      return null;
    }
  }

  function getLocalModIdentity(filePath, projectId = '') {
    const manifest = readFabricManifest(filePath);
    const fabricId = String(manifest?.id || '').trim().toLowerCase();
    if (fabricId) {
      return `fabric:${fabricId}`;
    }
    if (projectId) {
      return `project:${normalizeId(projectId)}`;
    }
    try {
      const stem = pathModule.basename(filePath, pathModule.extname(filePath))
        .toLowerCase()
        .replace(/(?:^|[-_. ])(?:fabric|forge|quilt|neoforge)(?=$|[-_. ])/gu, '-')
        .replace(/(?:^|[-_. ])v?\d+(?:[._-]\d+)+(?:[-_.][a-z]+\d*)*/giu, '-')
        .replace(/(?:^|[-_. ])(?:copy|final|new|old|updated?|\d+)(?=$|[-_. ])/gu, '-')
        .replace(/[-_. ]+/gu, '-')
        .replace(/^-+|-+$/gu, '');
      return stem ? `name:${stem}` : `sha1:${hashFile(filePath).toLowerCase()}`;
    } catch (_error) {
      return `file:${pathModule.basename(filePath).toLowerCase()}`;
    }
  }

  async function downloadFile(url, targetPath, expectedSha1 = '') {
    ensureDir(pathModule.dirname(targetPath));
    if (fsModule.existsSync(targetPath) && verifyHash(targetPath, expectedSha1)) {
      return { downloaded: false, path: targetPath };
    }
    const tmp = `${targetPath}.download`;
    const response = await fetchWithTimeout(url, { headers: MODRINTH_HEADERS });
    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fsModule.writeFileSync(tmp, buffer);
    if (expectedSha1 && hashFile(tmp).toLowerCase() !== String(expectedSha1).toLowerCase()) {
      tryUnlink(tmp);
      throw new Error('Download checksum mismatch.');
    }
    fsModule.renameSync(tmp, targetPath);
    return { downloaded: true, path: targetPath };
  }

  function getLibraryDir(modContext) {
    return modContext?.libraryDir || pathModule.join(configDir, 'mods-library');
  }

  function getDisabledDir(modContext) {
    return pathModule.join(modContext.modsDir, disabledModsDirName);
  }

  function getRemovedDir(modContext) {
    return pathModule.join(getLibraryDir(modContext), '.removed');
  }

  function safeName(value, fallback = 'file') {
    return String(value || fallback)
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || fallback;
  }

  function safeJarName(value, fallback = 'mod.jar') {
    const name = safeName(value || fallback, fallback);
    return name.toLowerCase().endsWith('.jar') ? name : `${name}.jar`;
  }

  function normalizePath(value) {
    return pathModule.resolve(String(value || '')).toLowerCase();
  }

  function uniquePath(targetPath) {
    if (!fsModule.existsSync(targetPath)) {
      return targetPath;
    }
    const parsed = pathModule.parse(targetPath);
    let index = 2;
    let candidate = targetPath;
    while (fsModule.existsSync(candidate)) {
      candidate = pathModule.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
      index += 1;
    }
    return candidate;
  }

  function isInside(parent, child) {
    const relative = pathModule.relative(pathModule.resolve(parent), pathModule.resolve(child));
    return Boolean(relative) && !relative.startsWith('..') && !pathModule.isAbsolute(relative)
      || pathModule.resolve(parent) === pathModule.resolve(child);
  }

  function listJarFiles(dir) {
    if (!dir || !fsModule.existsSync(dir)) {
      return [];
    }
    return fsModule.readdirSync(dir).filter((fileName) => fileName.toLowerCase().endsWith('.jar'));
  }

  function listJarFilePaths(dir) {
    return listJarFiles(dir).map((fileName) => pathModule.join(dir, fileName));
  }

  function getFileSize(filePath) {
    try {
      return filePath && fsModule.existsSync(filePath) ? fsModule.statSync(filePath).size : 0;
    } catch (_error) {
      return 0;
    }
  }

  function getFileMtime(filePath) {
    try {
      return filePath && fsModule.existsSync(filePath) ? fsModule.statSync(filePath).mtime.toISOString() : new Date().toISOString();
    } catch (_error) {
      return new Date().toISOString();
    }
  }

  function movePreserving(filePath, targetDir) {
    ensureDir(targetDir);
    const destination = uniquePath(pathModule.join(targetDir, pathModule.basename(filePath)));
    try {
      fsModule.renameSync(filePath, destination);
    } catch (_error) {
      fsModule.copyFileSync(filePath, destination);
      tryUnlink(filePath);
    }
    return destination;
  }

  function tryUnlink(filePath) {
    try {
      if (filePath && fsModule.existsSync(filePath)) {
        fsModule.unlinkSync(filePath);
      }
    } catch (_error) {
      // ignore
    }
  }

  function purgeBlockedModFiles(modContext, warnings = []) {
    const requiredByActiveMods = new Set(getActiveManifestRecords(modContext)
      .flatMap((entry) => Object.keys(entry.manifest?.depends || {}))
      .map(normalizeId));
    const candidates = [
      ...listActiveModJarPaths(modContext),
      ...listJarFilePathsRecursive(getDisabledDir(modContext)),
      ...listJarFilePathsRecursive(getLibraryDir(modContext))
    ];
    const removed = [];
    for (const filePath of candidates) {
      if (!shouldPurgeModFile(filePath)) {
        continue;
      }
      const manifest = readFabricManifest(filePath);
      const modId = normalizeId(manifest?.id || '');
      if (modId && requiredByActiveMods.has(modId)) {
        logger.info('[MOD-RESOLVER] Kept', {
          modId,
          filePath,
          reason: 'required by active mod dependency'
        });
        continue;
      }
      try {
        try {
          fsModule.chmodSync(filePath, 0o666);
        } catch (_error) {
          // Continue with normal deletion.
        }
        fsModule.unlinkSync(filePath);
        removed.push(filePath);
        logger.info('[MOD-RESOLVER] Removing old', { filePath, reason: 'blocked cleanup rule' });
      } catch (error) {
        warnings.push(`${pathModule.basename(filePath)} konnte nicht dauerhaft gelöscht werden (${error.message}).`);
      }
    }
    return removed;
  }

  function listJarFilePathsRecursive(dir, options = {}, visitedDirectories = new Set(), seenFiles = new Set()) {
    if (!dir || !fsModule.existsSync(dir)) {
      return [];
    }
    let canonicalDir;
    try {
      canonicalDir = normalizePath(fsModule.realpathSync(dir));
    } catch (_error) {
      canonicalDir = normalizePath(dir);
    }
    if (visitedDirectories.has(canonicalDir)) {
      return [];
    }
    visitedDirectories.add(canonicalDir);

    const excludedDirectories = new Set((options.excludeDirectories || []).map(normalizePath));
    const files = [];
    let entries = [];
    try {
      entries = fsModule.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      warn('Could not read mods directory', { directory: dir, error: serializeError(error) });
      return files;
    }
    for (const entry of entries) {
      const entryPath = pathModule.join(dir, entry.name);
      let stats;
      try {
        stats = entry.isSymbolicLink() ? fsModule.statSync(entryPath) : null;
      } catch (error) {
        warn('Ignored unreadable mod path', { path: entryPath, error: serializeError(error) });
        continue;
      }
      if (entry.isDirectory() || stats?.isDirectory()) {
        let canonicalEntry;
        try {
          canonicalEntry = normalizePath(fsModule.realpathSync(entryPath));
        } catch (_error) {
          canonicalEntry = normalizePath(entryPath);
        }
        if (!excludedDirectories.has(canonicalEntry)) {
          files.push(...listJarFilePathsRecursive(entryPath, options, visitedDirectories, seenFiles));
        }
      } else if ((entry.isFile() || stats?.isFile()) && entry.name.toLowerCase().endsWith('.jar')) {
        let canonicalFile;
        try {
          canonicalFile = normalizePath(fsModule.realpathSync(entryPath));
        } catch (_error) {
          canonicalFile = normalizePath(entryPath);
        }
        if (seenFiles.has(canonicalFile)) {
          info('Ignored duplicate JAR path (same file or symbolic link)', { path: entryPath, canonicalFile });
          continue;
        }
        seenFiles.add(canonicalFile);
        files.push(entryPath);
      }
    }
    return files;
  }

  function listActiveModJarPaths(modContext) {
    return listJarFilePathsRecursive(modContext.modsDir, {
      excludeDirectories: [getDisabledDir(modContext)]
    });
  }

  function deleteStoredCopies(modContext, identity, excludedPaths = []) {
    const excluded = new Set(excludedPaths.map(normalizePath));
    let removedCount = 0;
    for (const filePath of listJarFilePathsRecursive(getLibraryDir(modContext))) {
      if (excluded.has(normalizePath(filePath))) {
        continue;
      }
      if (getLocalModIdentity(filePath) !== identity) {
        continue;
      }
      tryUnlink(filePath);
      if (!fsModule.existsSync(filePath)) {
        removedCount += 1;
      }
    }
    return removedCount;
  }

  function reconcileExternallyDeletedMods(modContext, state, warnings) {
    const currentPaths = listActiveModJarPaths(modContext)
      .concat(listJarFilePaths(getDisabledDir(modContext)));
    const currentIdentities = new Set(currentPaths.map((filePath) => getLocalModIdentity(filePath)));
    const missing = (state.observedMods || []).filter((entry) => (
      entry?.path && !fsModule.existsSync(entry.path) && entry.identity && !currentIdentities.has(entry.identity)
    ));

    for (const entry of missing) {
      const projectId = String(entry.projectId || '').trim();
      if (projectId && isProtectedProject(projectId, state.projects?.[projectId], modContext)) {
        continue;
      }
      const removedBackups = deleteStoredCopies(modContext, entry.identity);
      if (projectId) {
        delete state.projects[projectId];
        state.disabledProjects = (state.disabledProjects || []).filter((id) => id !== projectId);
        state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((id) => id !== projectId);
        delete state.disabledProjectReasons[projectId];
        state.activeSync.files = (state.activeSync.files || []).filter((item) => item.projectId !== projectId);
      }
      recordDecision(state, 'recognized-external-mod-removal', {
        identity: entry.identity,
        fileName: entry.fileName,
        projectId,
        removedBackups
      });
      warnings.push(`${entry.fileName || 'Mod'}: externe Löschung erkannt; ${removedBackups} gespeicherte Kopie(n) entfernt.`);
    }
  }

  function rememberObservedMods(modContext, state) {
    const managedByPath = new Map((state.activeSync?.files || []).map((entry) => [normalizePath(entry.targetPath), entry]));
    state.observedMods = listActiveModJarPaths(modContext)
      .concat(listJarFilePaths(getDisabledDir(modContext)))
      .map((filePath) => {
        const managed = managedByPath.get(normalizePath(filePath));
        return {
          path: filePath,
          fileName: pathModule.basename(filePath),
          identity: getLocalModIdentity(filePath, managed?.projectId),
          projectId: String(managed?.projectId || '').trim()
        };
      });
  }

  function normalizeId(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeSet(values) {
    return new Set((Array.isArray(values) ? values : [...(values || [])])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean));
  }

  function uniqueStrings(values) {
    return [...new Set((Array.isArray(values) ? values : []).map((entry) => String(entry || '').trim()).filter(Boolean))];
  }

  function isProtectedProject(projectId, project = {}, modContext = null) {
    if (modContext?.type === 'pack') {
      return projectId === normalizedFabricApiProjectId || normalizeId(project?.slug || '') === 'fabric-api';
    }
    return protectedProjectSet.has(projectId)
      || requiredManagedSet.has(projectId)
      || requiredBundledMods.some((entry) => String(entry?.projectId || '').trim() === projectId);
  }

  function isKnownCrashProject(projectId, project = {}) {
    const normalizedProjectId = String(projectId || '').trim();
    const normalizedSlug = normalizeId(project?.slug || '');
    const normalizedTitle = normalizeId(project?.title || '');
    return KNOWN_CRASH_PROJECT_IDS.has(normalizedProjectId)
      || KNOWN_CRASH_SLUGS.has(normalizedSlug)
      || KNOWN_CRASH_SLUGS.has(normalizedTitle);
  }

  function comparableModId(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function requiredProjectMatchesLocalIdentity(projectId, identity) {
    const normalizedProjectId = String(projectId || '').trim();
    const rawIdentity = String(identity || '').trim().toLowerCase();
    const localId = rawIdentity.startsWith('fabric:')
      ? rawIdentity.slice('fabric:'.length)
      : rawIdentity;
    const localComparable = comparableModId(localId);
    if (!normalizedProjectId || !localComparable) {
      return false;
    }
    if (comparableModId(normalizedProjectId) === localComparable) {
      return true;
    }
    for (const [alias, canonicalProjectId] of aliasMap.entries()) {
      if (String(canonicalProjectId || '').trim() === normalizedProjectId && comparableModId(alias) === localComparable) {
        return true;
      }
    }
    return false;
  }

  function getRequiredProjectIdForLocalFile(filePath) {
    const identity = getLocalModIdentity(filePath);
    for (const projectId of requiredManagedSet) {
      if (requiredProjectMatchesLocalIdentity(projectId, identity)) {
        return projectId;
      }
    }
    return '';
  }

  function isHiddenProject(projectId, project = {}, modContext = null) {
    if (isXClientModEntry({ projectId, slug: project?.slug, name: project?.title })) {
      return true;
    }
    if (project?.showInModsTab === true) {
      return false;
    }
    const slug = normalizeId(project?.slug || '');
    if (modContext?.type === 'pack') {
      return projectId === normalizedFabricApiProjectId || slug === 'fabric-api';
    }
    return hiddenProjectSet.has(projectId) || hiddenSlugSet.has(slug);
  }

  function createManagedListEntry(projectId, fullPath, fileName, enabled, state, minecraftVersion, modContext = null) {
    const project = state.projects?.[projectId] || {};
    const versionEntry = project?.versions?.[minecraftVersion] || {};
    const hidden = isHiddenProject(projectId, project, modContext);
    const originalName = project.title || fileName.replace(/\.jar$/i, '');
    const alias = String(state.modAliases?.[`project:${normalizeId(projectId)}`] || '').trim();

    const requiredBy = getRequiredByProjectIds(state, projectId, minecraftVersion);
    return {
      id: `project:${projectId}`,
      projectId,
      slug: project.slug || '',
      name: alias || originalName,
      originalName,
      description: project.description || '',
      iconUrl: project.iconUrl || '',
      isProtected: isProtectedProject(projectId, project, modContext),
      canDelete: !isProtectedProject(projectId, project, modContext) && requiredBy.length === 0,
      deleteBlockedReason: requiredBy.length
        ? `Required by ${requiredBy.map((id) => state.projects?.[id]?.title || id).join(', ')}`
        : '',
      requiredBy,
      installationSource: project.installationSource || 'manual',
      canDisable: !isProtectedProject(projectId, project, modContext),
      path: fullPath,
      size: getFileSize(fullPath),
      enabled,
      autoDisabled: false,
      disabledReason: '',
      managed: true,
      source: project.bundled ? 'bundled' : 'modrinth',
      sourceLabel: hidden ? 'Pflichtmod' : 'Modrinth',
      hiddenInModsTab: hidden,
      fileName,
      minecraftVersion,
      versionName: versionEntry.versionName || '',
      versionNumber: versionEntry.versionNumber || '',
      lastUpdated: getFileMtime(fullPath)
    };
  }

  function createLocalListEntry(fullPath, fileName, enabled, state) {
    const manifest = readFabricManifest(fullPath) || {};
    const cacheKey = getArchiveCacheKey(fullPath);
    const cached = cacheKey ? localArchiveMetadataCache.get(cacheKey) : null;
    const manifestName = String(manifest.name || '').trim();
    const manifestDescription = typeof manifest.description === 'string'
      ? manifest.description.trim()
      : '';
    const manifestVersion = String(manifest.version || '').trim();
    const hidden = false;
    const originalName = manifestName || fileName.replace(/\.jar$/i, '');
    const alias = String(state?.modAliases?.[getLocalModIdentity(fullPath)] || '').trim();
    const keptLocal = isKeptLocalMod(state, fullPath, fileName);
    return {
      id: `file:${fullPath}`,
      projectId: '',
      slug: '',
      name: alias || originalName,
      originalName,
      description: manifestDescription,
      iconUrl: cached && Object.prototype.hasOwnProperty.call(cached, 'iconUrl')
        ? cached.iconUrl
        : (() => {
            const iconUrl = getFabricManifestIconDataUrl(fullPath, manifest);
            if (cacheKey) localArchiveMetadataCache.set(cacheKey, { ...(cached || {}), manifest, iconUrl });
            return iconUrl;
          })(),
      isProtected: false,
      canDisable: true,
      path: fullPath,
      size: getFileSize(fullPath),
      enabled,
      autoDisabled: false,
      disabledReason: enabled ? '' : 'Ausgeschaltet.',
      managed: false,
      source: 'manual',
      sourceLabel: keptLocal ? 'Behalten' : 'Manuell',
      keptLocal,
      hiddenInModsTab: hidden,
      fileName,
      minecraftVersion: '',
      versionName: manifestVersion,
      versionNumber: manifestVersion,
      lastUpdated: getFileMtime(fullPath)
    };
  }

  function isKeptLocalMod(state, filePath, fileName = '') {
    const identity = getLocalModIdentity(filePath);
    let sha1 = '';
    try { sha1 = hashFile(filePath).toLowerCase(); } catch (_error) { /* identity/name fallback */ }
    const name = String(fileName || pathModule.basename(filePath)).toLowerCase();
    return (state?.keptLocalMods || []).some((entry) => (
      entry.identity && entry.identity === identity
      || entry.sha1 && sha1 && entry.sha1 === sha1
      || entry.fileName && entry.fileName.toLowerCase() === name
    ));
  }

  function rememberKeptLocalMod(state, filePath) {
    const entry = {
      identity: getLocalModIdentity(filePath),
      fileName: pathModule.basename(filePath),
      sha1: hashFile(filePath).toLowerCase(),
      keptAt: new Date().toISOString()
    };
    state.keptLocalMods = [
      ...(state.keptLocalMods || []).filter((item) => item.identity !== entry.identity && item.sha1 !== entry.sha1),
      entry
    ];
    recordDecision(state, 'kept-local-mod', { identity: entry.identity, fileName: entry.fileName });
  }

  function getRequiredBundledMod(projectId) {
    return requiredBundledMods.find((entry) => String(entry?.projectId || '').trim() === projectId);
  }

  function listManagedFilesForProject(modContext, projectId, minecraftVersion, state) {
    return (state.activeSync?.files || []).filter((entry) => entry.projectId === projectId && entry.minecraftVersion === minecraftVersion);
  }

  function isStaleManagedVersion(versionEntry, minecraftVersion) {
    if (!versionEntry?.libraryPath || !fsModule.existsSync(versionEntry.libraryPath)) {
      return true;
    }
    if (versionEntry.sha1 && !verifyHash(versionEntry.libraryPath, versionEntry.sha1)) {
      return true;
    }
    const updatedAt = Date.parse(versionEntry.updatedAt || '');
    if (!updatedAt) {
      return false;
    }
    return Date.now() - updatedAt > COMPAT_CACHE_TTL_MS;
  }

  async function resolveRequiredDependencies(versionEntry, minecraftVersion, modContext, state, options = {}) {
    const dependencyEntries = [];
    const visited = options.visited instanceof Set ? options.visited : new Set();
    const dependencies = Array.isArray(versionEntry?.dependencyConstraints)
      ? versionEntry.dependencyConstraints
      : (Array.isArray(versionEntry?.dependencies) ? versionEntry.dependencies : []);
    for (const dependency of dependencies) {
      const dependencyType = String(dependency?.dependency_type || dependency?.dependencyType || '').trim().toLowerCase();
      if (dependencyType !== 'required') {
        continue;
      }

      let dependencyProjectId = String(dependency.project_id || dependency.projectId || '').trim();
      if (!dependencyProjectId && (dependency.version_id || dependency.versionId)) {
        try {
          const dependencyVersion = await fetchVersion(dependency.version_id || dependency.versionId, options);
          dependencyProjectId = String(dependencyVersion?.project_id || '').trim();
        } catch (error) {
          warn('Failed to resolve dependency project id from version id', { dependency, error: serializeError(error) });
        }
      }

      dependencyProjectId = aliasMap.get(normalizeId(dependencyProjectId)) || dependencyProjectId;
      if (!dependencyProjectId || visited.has(dependencyProjectId)) {
        continue;
      }
      visited.add(dependencyProjectId);

      try {
        await ensureProjectInstalled(dependencyProjectId, minecraftVersion, modContext, state, {
          ...options,
          visited,
          requiredVersionId: String(dependency.version_id || '').trim(),
          forceRefresh: options.forceRefresh,
          parentProjectId: options.parentProjectId || '',
          installationSource: 'dependency'
        });
        dependencyEntries.push({
          projectId: dependencyProjectId,
          versionId: String(dependency.version_id || dependency.versionId || '').trim(),
          dependencyType: 'required'
        });
      } catch (error) {
        state.autoDisabledProjects = uniqueStrings([...(state.autoDisabledProjects || []), dependencyProjectId]);
        state.disabledProjectReasons = {
          ...(state.disabledProjectReasons || {}),
          [dependencyProjectId]: {
            reason: error.message,
            checkedAt: new Date().toISOString()
          }
        };
        throw new Error(`Dependency ${dependencyProjectId} could not be installed: ${error.message}`);
      }
    }

    for (const dependency of dependencies) {
      if (String(dependency?.dependency_type || dependency?.dependencyType || '').trim().toLowerCase() !== 'incompatible') {
        continue;
      }
      const dependencyProjectId = aliasMap.get(normalizeId(dependency.project_id || dependency.projectId || '')) || String(dependency.project_id || dependency.projectId || '').trim();
      if (dependencyProjectId && state.projects?.[dependencyProjectId]
          && !(state.disabledProjects || []).includes(dependencyProjectId)
          && !(state.autoDisabledProjects || []).includes(dependencyProjectId)) {
        throw new Error(`Konflikt mit inkompatibler Mod ${dependencyProjectId}.`);
      }
    }

    return dependencyEntries;
  }

  async function ensureProjectInstalled(projectReference, minecraftVersion, modContext, state, options = {}) {
    const project = await fetchProject(projectReference, options);
    if (projectType(project) !== 'mod') {
      throw new Error(`${project.title || resolveProjectId(projectReference)} is not a mod.`);
    }

    const projectId = resolveProjectId(project);
    const projectState = state.projects[projectId] || { projectId, versions: {} };
    const requestedSource = options.installationSource === 'dependency' ? 'dependency' : 'manual';
    // A direct install permanently promotes a dependency to manual ownership.
    // Dependency installs never demote an existing manual installation.
    projectState.installationSource = projectState.installationSource === 'manual' || requestedSource === 'manual'
      ? 'manual'
      : 'dependency';
    const existingVersion = projectState.versions?.[minecraftVersion];
    const needsInstall = !existingVersion
      || !existingVersion.libraryPath
      || !fsModule.existsSync(existingVersion.libraryPath)
      || (existingVersion.sha1 && !verifyHash(existingVersion.libraryPath, existingVersion.sha1))
      || options.forceRefresh
      || (options.requiredVersionId && String(existingVersion.versionId || '').trim() !== String(options.requiredVersionId).trim())
      || (Array.isArray(options.requiredVersionRequirements) && options.requiredVersionRequirements.some((requirement) => (
        !modVersionSatisfies(requirement, existingVersion.versionNumber || existingVersion.versionName || '')
      )));

    if (!needsInstall) {
      await resolveRequiredDependencies(existingVersion, minecraftVersion, modContext, state, {
        ...options,
        visited: options.visited instanceof Set ? options.visited : new Set([projectId])
      });
      assertArchiveLoaderCompatibility(existingVersion.libraryPath, modContext, projectId);
      const enrichedProjectState = {
        ...projectState,
        projectId,
        slug: String(project.slug || projectState.slug || '').trim(),
        title: String(project.title || projectState.title || projectId).trim(),
        description: String(project.description || projectState.description || '').trim(),
        iconUrl: String(project.icon_url || projectState.iconUrl || '').trim(),
        projectType: 'mod'
      };
      state.projects[projectId] = enrichedProjectState;
      return enrichedProjectState;
    }

    const versions = await fetchVersions(projectId, options);
    const selection = chooseCompatibleVersion(versions, minecraftVersion, {
      loader: modContext?.loader || 'fabric',
      requiredVersionId: options.requiredVersionId,
      requiredVersionRequirements: options.requiredVersionRequirements
    });
    if (!selection.selected) {
      const reason = `Keine kompatible Fabric-Version für Minecraft ${minecraftVersion} gefunden.`;
      state.autoDisabledProjects = uniqueStrings([...(state.autoDisabledProjects || []), projectId]);
      state.disabledProjectReasons = {
        ...(state.disabledProjectReasons || {}),
        [projectId]: { reason, checkedAt: new Date().toISOString() }
      };
      recordDecision(state, 'no-compatible-version', { projectId, reason, minecraftVersion });
      throw createMissingVersionError(`${project.title || projectId}: ${reason}`);
    }

    const selected = selection.selected;
    const fileEntry = selectPrimaryJarFile(selected);
    if (!fileEntry) {
      throw new Error(`No downloadable JAR found for ${projectId}.`);
    }
    if (shouldPurgeModFile(fileEntry.filename)) {
      throw new Error(`${fileEntry.filename} ist durch die dauerhafte -2.jar-Löschregel gesperrt.`);
    }
    const expectedSha1 = String(fileEntry.hashes?.sha1 || '').trim();
    const targetLibraryPath = pathModule.join(
      getLibraryDir(modContext),
      safeName(projectId),
      safeName(String(selected.id || selected.version_number || minecraftVersion)),
      safeJarName(fileEntry.filename)
    );
    ensureDir(pathModule.dirname(targetLibraryPath));
    logger.info('[MOD-RESOLVER] Installing', {
      projectId,
      version: selected.version_number || selected.name || selected.id,
      reason: options.requiredVersionRequirements?.length ? 'shared dependency constraints' : 'selected compatible version'
    });
    await downloadFile(fileEntry.url, targetLibraryPath, expectedSha1);
    assertArchiveLoaderCompatibility(targetLibraryPath, modContext, projectId);

    const dependencies = await resolveRequiredDependencies(selected, minecraftVersion, modContext, state, {
      ...options,
      visited: options.visited instanceof Set ? options.visited : new Set([projectId])
    });

    state.projects[projectId] = {
      ...projectState,
      projectId,
      slug: String(project.slug || projectState.slug || '').trim(),
      title: String(project.title || projectState.title || projectId).trim(),
      description: String(project.description || projectState.description || '').trim(),
      iconUrl: String(project.icon_url || projectState.iconUrl || '').trim(),
      projectType: 'mod',
      installationSource: projectState.installationSource,
      versions: {
        ...(projectState.versions || {}),
        [minecraftVersion]: {
          versionId: String(selected.id || '').trim(),
          versionName: String(selected.name || selected.version_number || '').trim(),
          versionNumber: String(selected.version_number || '').trim(),
          versionType: String(selected.version_type || '').trim(),
          fileName: safeJarName(fileEntry.filename),
          libraryPath: targetLibraryPath,
          sha1: expectedSha1,
          loaders: Array.isArray(selected.loaders) ? selected.loaders : [],
          gameVersions: Array.isArray(selected.game_versions) ? selected.game_versions : [],
          dependencies,
          dependencyConstraints: Array.isArray(selected.dependencies)
            ? selected.dependencies.map((dependency) => ({
                projectId: String(dependency.project_id || '').trim(),
                versionId: String(dependency.version_id || '').trim(),
                dependencyType: String(dependency.dependency_type || '').trim().toLowerCase()
              })).filter((dependency) => dependency.projectId || dependency.versionId)
            : [],
          updatedAt: new Date().toISOString()
        }
      }
    };

    state.disabledProjects = (state.disabledProjects || []).filter((id) => id !== projectId);
    state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((id) => id !== projectId);
    delete state.disabledProjectReasons[projectId];
    recordDecision(state, 'installed-managed-project', { projectId, minecraftVersion, libraryPath: targetLibraryPath });
    logger.info('[MOD-RESOLVER] Validation passed', {
      projectId,
      version: selected.version_number || selected.name || selected.id,
      minecraftVersion,
      loader: modContext?.loader || 'fabric'
    });
    return state.projects[projectId];
  }

  function disableManagedProject(modContext, state, projectId, reason) {
    const project = state.projects?.[projectId] || {};
    const projectFiles = (state.activeSync?.files || []).filter((entry) => entry.projectId === projectId);
    for (const entry of projectFiles) {
      if (!entry?.targetPath || !fsModule.existsSync(entry.targetPath)) continue;
      try {
        movePreserving(entry.targetPath, getDisabledDir(modContext));
      } catch (error) {
        warn('Could not disable incompatible managed mod', { projectId, error: serializeError(error) });
      }
    }
    state.activeSync.files = (state.activeSync?.files || []).filter((entry) => entry.projectId !== projectId);
    state.autoDisabledProjects = uniqueStrings([...(state.autoDisabledProjects || []), projectId]);
    state.disabledProjectReasons = {
      ...(state.disabledProjectReasons || {}),
      [projectId]: { reason, checkedAt: new Date().toISOString() }
    };
    recordDecision(state, 'disabled-incompatible-project', { projectId, reason });
    logger.warn('[MOD-RESOLVER] Disabled', { projectId, reason: 'No compatible version found', details: reason });
    return project.title || projectId;
  }

  function getBundledModAsset(requiredMod, minecraftVersion) {
    if (!requiredMod) {
      return null;
    }
    return {
      assetPath: requiredMod.assetPathByMinecraftVersion?.[minecraftVersion] || requiredMod.assetPath,
      fileName: requiredMod.fileNameByMinecraftVersion?.[minecraftVersion] || requiredMod.fileName
    };
  }

  function ensureRequiredBundled(modContext, minecraftVersion, state, warnings) {
    if (!Array.isArray(requiredBundledMods) || !requiredBundledMods.length) {
      return;
    }
    ensureDir(modContext.modsDir);
    for (const requiredMod of requiredBundledMods) {
      const supported = getBundledModAsset(requiredMod, minecraftVersion);
      if (!supported?.assetPath || !supported.fileName) {
        warnings.push(`${requiredMod.title || requiredMod.projectId || 'Required mod'}: keine gebündelte Version für ${minecraftVersion}.`);
        continue;
      }
      if (!fsModule.existsSync(supported.assetPath)) {
        warnings.push(`${requiredMod.title || supported.fileName}: Asset fehlt.`);
        continue;
      }
      const targetPath = pathModule.join(modContext.modsDir, safeJarName(supported.fileName));
      if (shouldPurgeModFile(targetPath)) {
        tryUnlink(targetPath);
        continue;
      }
      try {
        const needsCopy = !fsModule.existsSync(targetPath) || hashFile(targetPath) !== hashFile(supported.assetPath);
        if (needsCopy) {
          fsModule.copyFileSync(supported.assetPath, targetPath);
        }
      } catch (error) {
        warnings.push(`${supported.fileName}: Pflichtmod konnte nicht kopiert werden (${error.message}).`);
        continue;
      }

      const projectId = String(requiredMod.projectId || supported.fileName).trim();
      state.projects[projectId] = {
        ...(state.projects[projectId] || {}),
        projectId,
        slug: String(requiredMod.slug || state.projects[projectId]?.slug || '').trim(),
        title: String(requiredMod.title || state.projects[projectId]?.title || projectId).trim(),
        description: String(requiredMod.description || state.projects[projectId]?.description || '').trim(),
        iconUrl: String(requiredMod.iconUrl || state.projects[projectId]?.iconUrl || '').trim(),
        bundled: true,
        projectType: 'mod',
        versions: {
          ...(state.projects[projectId]?.versions || {}),
          [minecraftVersion]: {
            versionId: `${projectId}:${minecraftVersion}`,
            versionName: requiredMod.versionName || requiredMod.versionNumber || minecraftVersion,
            versionNumber: requiredMod.versionNumber || '',
            versionType: 'release',
            loaders: ['fabric'],
            gameVersions: [minecraftVersion],
            fileName: safeJarName(supported.fileName),
            libraryPath: targetPath,
            sha1: hashFile(targetPath),
            updatedAt: new Date().toISOString(),
            bundled: true
          }
        }
      };
      state.disabledProjects = (state.disabledProjects || []).filter((id) => id !== projectId);
      state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((id) => id !== projectId);
      delete state.disabledProjectReasons[projectId];
    }
  }

  function allocateName(fileName, reservedLowerNames) {
    const parsed = pathModule.parse(fileName);
    let candidate = fileName;
    let index = 2;
    while (reservedLowerNames.has(candidate.toLowerCase())) {
      candidate = `${parsed.name}-${index}${parsed.ext || '.jar'}`;
      index += 1;
    }
    return candidate;
  }

  function cleanupDuplicateManagedEntries(modContext, state, minecraftVersion, activeFiles, warnings) {
    const byProject = new Map();
    for (const entry of activeFiles) {
      if (!entry?.projectId) {
        continue;
      }
      const list = byProject.get(entry.projectId) || [];
      list.push(entry);
      byProject.set(entry.projectId, list);
    }

    const result = [...activeFiles];
    for (const [projectId, entries] of byProject.entries()) {
      if (entries.length <= 1) {
        continue;
      }
      let preferred = entries[0];
      const stateEntry = state.projects?.[projectId]?.versions?.[minecraftVersion];
      if (stateEntry?.libraryPath) {
        const preferredByLibrary = entries.find((entry) => normalizePath(entry.libraryPath || '') === normalizePath(stateEntry.libraryPath));
        if (preferredByLibrary) {
          preferred = preferredByLibrary;
        }
      }
      for (const entry of entries) {
        if (entry === preferred) {
          continue;
        }
        try {
          if (entry.targetPath && fsModule.existsSync(entry.targetPath)) {
            tryUnlink(entry.targetPath);
          }
        } catch (error) {
          warn('Failed to remove duplicate managed file', { projectId, path: entry.targetPath, error: serializeError(error) });
        }
        const index = result.findIndex((candidate) => normalizePath(candidate.targetPath) === normalizePath(entry.targetPath));
        if (index !== -1) {
          result.splice(index, 1);
        }
        warnings.push(`${entry.fileName || projectId}: Duplikat für ${projectId} entfernt.`);
        logger.info('[MOD-RESOLVER] Removing old', {
          projectId,
          filePath: entry.targetPath,
          reason: 'replaced by selected shared dependency version'
        });
      }
    }

    return result;
  }

  function pruneMissingActiveSyncFiles(state, warnings) {
    const previousFiles = Array.isArray(state.activeSync?.files) ? state.activeSync.files : [];
    const nextFiles = previousFiles.filter((entry) => entry?.targetPath && fsModule.existsSync(entry.targetPath));
    if (nextFiles.length !== previousFiles.length) {
      const removedCount = previousFiles.length - nextFiles.length;
      state.activeSync = {
        minecraftVersion: String(state.activeSync?.minecraftVersion || '').trim(),
        files: nextFiles
      };
      recordDecision(state, 'pruned-missing-active-sync-files', { removedCount });
      warnings.push(`${removedCount} fehlende Mod-Datei aus der internen Datenbank entfernt.`);
    }
  }

  function cleanupDuplicateFilesystemMods(modContext, state, minecraftVersion, warnings) {
    const activeFiles = Array.isArray(state.activeSync?.files) ? state.activeSync.files : [];
    const managedByPath = new Map(activeFiles.map((entry) => [normalizePath(entry.targetPath), entry]));
    const entries = [];

    for (const directory of [modContext.modsDir, getDisabledDir(modContext)]) {
      const directoryFiles = normalizePath(directory) === normalizePath(modContext.modsDir)
        ? listActiveModJarPaths(modContext)
        : listJarFilePaths(directory);
      for (const filePath of directoryFiles) {
        const managed = managedByPath.get(normalizePath(filePath));
        const projectId = String(managed?.projectId || '').trim();
        entries.push({
          filePath,
          fileName: pathModule.basename(filePath),
          enabled: normalizePath(directory) === normalizePath(modContext.modsDir),
          managed: Boolean(projectId),
          projectId,
          protected: projectId
            ? isProtectedProject(projectId, state.projects?.[projectId], modContext)
            : isKeptLocalMod(state, filePath, pathModule.basename(filePath)),
          identity: getLocalModIdentity(filePath, projectId),
          mtimeMs: fsModule.statSync(filePath).mtimeMs
        });
        info('Found mod JAR', {
          path: filePath,
          identity: entries[entries.length - 1].identity,
          enabled: entries[entries.length - 1].enabled,
          managed: entries[entries.length - 1].managed
        });
      }
    }

    const byIdentity = new Map();
    for (const entry of entries) {
      const list = byIdentity.get(entry.identity) || [];
      list.push(entry);
      byIdentity.set(entry.identity, list);
    }

    for (const duplicates of byIdentity.values()) {
      if (duplicates.length <= 1) {
        continue;
      }

      const preferred = duplicates
        .slice()
        .sort((left, right) => {
          if (left.protected !== right.protected) {
            return left.protected ? -1 : 1;
          }
          if (left.managed !== right.managed) {
            return left.managed ? -1 : 1;
          }
          if (left.enabled !== right.enabled) {
            return left.enabled ? -1 : 1;
          }
          const leftCopyNumber = getNumberedCopySuffix(left.fileName);
          const rightCopyNumber = getNumberedCopySuffix(right.fileName);
          if ((leftCopyNumber === 0) !== (rightCopyNumber === 0)) {
            return leftCopyNumber === 0 ? -1 : 1;
          }
          if (leftCopyNumber !== rightCopyNumber) {
            return leftCopyNumber - rightCopyNumber;
          }
          return right.mtimeMs - left.mtimeMs;
        })[0];
      info('Duplicate mod identity detected', {
        identity: preferred.identity,
        kept: preferred.filePath,
        duplicates: duplicates.map((entry) => entry.filePath)
      });

      for (const duplicate of duplicates) {
        if (normalizePath(duplicate.filePath) === normalizePath(preferred.filePath)) {
          continue;
        }
        try {
          tryUnlink(duplicate.filePath);
          deleteStoredCopies(modContext, duplicate.identity, [preferred.filePath]);
          warnings.push(`${duplicate.fileName}: doppelte Mod entfernt (${pathModule.basename(preferred.filePath)} bleibt aktiv).`);
          recordDecision(state, 'removed-duplicate-file', {
            identity: duplicate.identity,
            fileName: duplicate.fileName,
            keptFileName: pathModule.basename(preferred.filePath),
            permanentlyDeleted: true,
            minecraftVersion
          });
        } catch (error) {
          warnings.push(`${duplicate.fileName}: Duplikat erkannt, konnte aber nicht verschoben werden.`);
          warn('Failed to move duplicate mod file', { filePath: duplicate.filePath, error: serializeError(error) });
        }
      }
    }

    state.activeSync.files = (state.activeSync?.files || []).filter((entry) => (
      entry?.targetPath && fsModule.existsSync(entry.targetPath)
    ));
  }

  function getNumberedCopySuffix(fileName) {
    const stem = pathModule.parse(String(fileName || '')).name;
    const match = stem.match(/-(\d+)$/u);
    if (!match) {
      return 0;
    }
    const value = Number(match[1]);
    return Number.isSafeInteger(value) && value >= 2 ? value : 0;
  }

  function disableKnownCrashProjects(modContext, state, minecraftVersion, warnings) {
    const disabledProjectIds = new Set(state.disabledProjects || []);
    for (const [projectId, project] of Object.entries(state.projects || {})) {
      if (!isKnownCrashProject(projectId, project)) {
        continue;
      }
      disabledProjectIds.add(projectId);
      state.disabledProjectReasons = {
        ...(state.disabledProjectReasons || {}),
        [projectId]: {
          reason: 'Bekannter Crash mit Minecraft 26.2: Krypton-Mixin auf net.minecraft.network.Connection.',
          checkedAt: new Date().toISOString(),
          automated: true
        }
      };
      recordDecision(state, 'disabled-known-crash-project', {
        projectId,
        title: project?.title || projectId,
        minecraftVersion
      });
    }
    state.disabledProjects = uniqueStrings([...disabledProjectIds]);
    state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((projectId) => !disabledProjectIds.has(projectId));

    ensureDir(getDisabledDir(modContext));
    for (const filePath of listJarFilePaths(modContext.modsDir)) {
      const fileName = pathModule.basename(filePath);
      if (!KNOWN_CRASH_FILE_PATTERNS.some((pattern) => pattern.test(fileName))) {
        continue;
      }
      try {
        const movedPath = movePreserving(filePath, getDisabledDir(modContext));
        warnings.push(`${fileName}: bekannter Crash-Mod wurde deaktiviert.`);
        recordDecision(state, 'moved-known-crash-file', {
          fileName,
          movedPath,
          minecraftVersion
        });
      } catch (error) {
        warnings.push(`${fileName}: bekannter Crash-Mod konnte nicht deaktiviert werden (${error.message}).`);
      }
    }

    state.activeSync.files = (state.activeSync?.files || []).filter((entry) => {
      const projectId = String(entry?.projectId || '').trim();
      const fileName = pathModule.basename(String(entry?.targetPath || entry?.fileName || ''));
      return !disabledProjectIds.has(projectId)
        && !KNOWN_CRASH_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
    });
  }

  function includeLocalRequiredModsInActiveSync(modContext, state, minecraftVersion) {
    const activeFiles = Array.isArray(state.activeSync?.files) ? [...state.activeSync.files] : [];
    const activeProjectIds = new Set(activeFiles.map((entry) => String(entry?.projectId || '').trim()).filter(Boolean));
    const activePaths = new Set(activeFiles.map((entry) => normalizePath(entry?.targetPath || '')).filter(Boolean));

    for (const filePath of listJarFilePaths(modContext.modsDir)) {
      const normalizedPath = normalizePath(filePath);
      if (activePaths.has(normalizedPath)) {
        continue;
      }

      const projectId = getRequiredProjectIdForLocalFile(filePath);
      if (!projectId || activeProjectIds.has(projectId)) {
        continue;
      }

      const fileName = pathModule.basename(filePath);
      activeFiles.push({
        projectId,
        fileName,
        targetPath: filePath,
        libraryPath: filePath,
        minecraftVersion,
        localRequired: true
      });
      activeProjectIds.add(projectId);
      activePaths.add(normalizedPath);
      recordDecision(state, 'accepted-local-required-mod', {
        projectId,
        fileName,
        minecraftVersion
      });
    }

    state.activeSync = {
      minecraftVersion,
      files: activeFiles
    };
  }

  async function copyManagedFiles(modContext, minecraftVersion, state, warnings, options = {}) {
    ensureDir(modContext.modsDir);
    ensureDir(getDisabledDir(modContext));
    const previousFiles = Array.isArray(state.activeSync?.files) ? state.activeSync.files : [];
    const previousPaths = new Set(previousFiles.map((entry) => normalizePath(entry.targetPath)));
    const reservedNames = new Set(
      listJarFiles(modContext.modsDir)
        .filter((fileName) => !previousPaths.has(normalizePath(pathModule.join(modContext.modsDir, fileName))))
        .map((fileName) => fileName.toLowerCase())
    );

    const activeFiles = [];
    const disabledProjects = new Set(state.disabledProjects || []);
    const autoDisabledProjects = new Set(state.autoDisabledProjects || []);

    for (const [projectId, project] of Object.entries(state.projects || {})) {
      const isProtected = isProtectedProject(projectId, project, modContext);
      if (disabledProjects.has(projectId) && !isProtected) {
        continue;
      }

      const versionEntry = project.versions?.[minecraftVersion];
      if (!versionEntry?.libraryPath || !fsModule.existsSync(versionEntry.libraryPath)) {
        if (isProtected) {
          warnings.push(`${project.title || projectId}: Pflichtmod-Datei fehlt.`);
        }
        continue;
      }
      if (versionEntry.sha1 && !verifyHash(versionEntry.libraryPath, versionEntry.sha1)) {
        warnings.push(`${project.title || projectId}: Lokale Library-JAR ist ungültig.`);
        continue;
      }

      if (versionEntry.bundled && isInside(modContext.modsDir, versionEntry.libraryPath)) {
        const bundledFileName = pathModule.basename(versionEntry.libraryPath);
        reservedNames.add(bundledFileName.toLowerCase());
        activeFiles.push({
          projectId,
          fileName: bundledFileName,
          targetPath: versionEntry.libraryPath,
          libraryPath: versionEntry.libraryPath,
          minecraftVersion
        });
        continue;
      }

      const targetName = allocateName(versionEntry.fileName || `${projectId}.jar`, reservedNames);
      const targetPath = pathModule.join(modContext.modsDir, targetName);
      if (shouldPurgeModFile(targetPath) || shouldPurgeModFile(versionEntry.libraryPath)) {
        tryUnlink(targetPath);
        tryUnlink(versionEntry.libraryPath);
        continue;
      }
      try {
        if (!fsModule.existsSync(targetPath) || !verifyHash(targetPath, versionEntry.sha1)) {
          fsModule.copyFileSync(versionEntry.libraryPath, targetPath);
        }
      } catch (error) {
        warnings.push(`${project.title || projectId}: Konnte nicht in den Mods-Ordner kopiert werden (${error.message}).`);
        continue;
      }
      reservedNames.add(targetName.toLowerCase());
      activeFiles.push({
        projectId,
        fileName: targetName,
        targetPath,
        libraryPath: versionEntry.libraryPath,
        minecraftVersion
      });
    }

    let finalFiles = cleanupDuplicateManagedEntries(modContext, state, minecraftVersion, activeFiles, warnings);
    const activePaths = new Set(finalFiles.map((entry) => normalizePath(entry.targetPath)));

    for (const previous of previousFiles) {
      if (!previous?.targetPath) {
        continue;
      }
      const normalizedPath = normalizePath(previous.targetPath);
      if (activePaths.has(normalizedPath)) {
        continue;
      }
      if (!fsModule.existsSync(previous.targetPath)) {
        continue;
      }
      try {
        movePreserving(
          previous.targetPath,
          options.preserveMods ? getDisabledDir(modContext) : getRemovedDir(modContext)
        );
      } catch (_error) {
        // ignore cleanup failures
      }
    }

    state.activeSync = { minecraftVersion, files: finalFiles };
    return finalFiles;
  }

  async function syncManagedModsForVersion(versionId = getEffectiveSelectedVersionId(), options = {}) {
    if (isMinecraftRunning()) {
      const lockedContext = options.modContext || getActiveModContext(versionId);
      const lockedState = readState(lockedContext);
      return {
        synced: (lockedState.activeSync?.files || []).length,
        totalProjects: Object.keys(lockedState.projects || {}).length,
        files: lockedState.activeSync?.files || [],
        autoDisabledProjects: lockedState.autoDisabledProjects || [],
        disabledProjects: lockedState.disabledProjects || [],
        warnings: ["Mods can't be changed while Minecraft is running."]
      };
    }
    const modContext = options.modContext || getActiveModContext(versionId);
    const minecraftVersion = String(modContext?.minecraftVersion || '').trim();
    if (!minecraftVersion) {
      return { synced: 0, totalProjects: 0, files: [], warnings: ['Keine Minecraft-Version ausgewählt.'] };
    }

    const syncKey = `${modContext.stateFile || stateFile}:${minecraftVersion}:${Boolean(options.refreshAll)}:${Boolean(options.preserveMods)}:${[...(options.refreshProjects || [])].join(',')}`;
    if (pendingSyncs.has(syncKey)) {
      return pendingSyncs.get(syncKey);
    }

    const promise = (async () => {
      ensureDir(modContext.modsDir);
      ensureDir(getDisabledDir(modContext));
      ensureDir(getLibraryDir(modContext));
      const state = readState(modContext);
      const warnings = [];
      let resolverBlocked = '';
      purgeBlockedModFiles(modContext, warnings);
      reconcileExternallyDeletedMods(modContext, state, warnings);
      pruneMissingActiveSyncFiles(state, warnings);
      disableKnownCrashProjects(modContext, state, minecraftVersion, warnings);

      if (modContext?.type !== 'pack') {
        try {
          ensureRequiredBundled(modContext, minecraftVersion, state, warnings);
        } catch (error) {
          warnings.push(`Failed to ensure bundled mods: ${error.message}`);
        }
      }

      try {
        await resolveActiveManifestDependencies(modContext, state, { modContext });
      } catch (error) {
        resolverBlocked = error.message;
        warnings.push(`Gemeinsame Mod-Abhängigkeit konnte nicht aufgelöst werden: ${error.message}`);
      }

      const refreshProjects = options.refreshProjects instanceof Set ? options.refreshProjects : new Set();
      if (!options.launchPreflight) {
        for (const projectId of requiredManagedSet) {
          if (modContext?.type === 'pack' && projectId !== normalizedFabricApiProjectId) {
            continue;
          }
          if (!state.projects[projectId]) {
            state.projects[projectId] = { projectId, projectType: 'mod', versions: {} };
          }
        }
      }
      for (const projectId of Object.keys(state.projects || [])) {
        if (state.disabledProjects.includes(projectId) && !options.refreshDisabledProjects) {
          continue;
        }

        const versionEntry = state.projects[projectId]?.versions?.[minecraftVersion];
        const stale = !versionEntry
          || !versionEntry.libraryPath
          || !fsModule.existsSync(versionEntry.libraryPath)
          || (versionEntry.sha1 && !verifyHash(versionEntry.libraryPath, versionEntry.sha1))
          || options.refreshAll
          || refreshProjects.has(projectId)
          || isStaleManagedVersion(versionEntry, minecraftVersion);
        if (!stale) {
          continue;
        }

        try {
          await ensureProjectInstalled(projectId, minecraftVersion, modContext, state, {
            forceRefresh: Boolean(options.refreshAll || refreshProjects.has(projectId)),
            visited: new Set(),
            modContext
          });
        } catch (error) {
          const project = state.projects[projectId];
            if ((error?.code === 'NO_COMPATIBLE_MODRINTH_VERSION'
              || error?.code === 'INCOMPATIBLE_MOD'
              || /inkompatib|konflikt/iu.test(error?.message || ''))
              && !isProtectedProject(projectId, project, modContext)) {
            const reason = error.message;
            const title = disableManagedProject(modContext, state, projectId, reason);
            warnings.push(`${title}: ${reason}; Mod wurde deaktiviert.`);
          } else {
            warnings.push(`${project?.title || projectId}: ${error.message}`);
          }
        }
      }

      disableKnownCrashProjects(modContext, state, minecraftVersion, warnings);
      await copyManagedFiles(modContext, minecraftVersion, state, warnings, options);
      if (!options.preserveMods) {
        cleanupDuplicateFilesystemMods(modContext, state, minecraftVersion, warnings);
      }
      disableKnownCrashProjects(modContext, state, minecraftVersion, warnings);
      includeLocalRequiredModsInActiveSync(modContext, state, minecraftVersion);
      purgeBlockedModFiles(modContext, warnings);
      state.activeSync.files = (state.activeSync?.files || []).filter((entry) => (
        entry?.targetPath && fsModule.existsSync(entry.targetPath)
      ));
      const files = Array.isArray(state.activeSync?.files) ? state.activeSync.files : [];
      if (!resolverBlocked) {
        logger.info('[MOD-RESOLVER] Validation passed', {
          minecraftVersion,
          activeFiles: files.length,
          reason: 'all active manifest dependencies resolved'
        });
      }
      rememberObservedMods(modContext, state);
      writeState(state, modContext);

      return {
        synced: files.length,
        totalProjects: Object.keys(state.projects || {}).length,
        files,
        autoDisabledProjects: uniqueStrings(state.autoDisabledProjects),
        disabledProjects: uniqueStrings([...(state.disabledProjects || []), ...(state.autoDisabledProjects || [])]),
        warnings: uniqueStrings(warnings),
        blocked: Boolean(resolverBlocked),
        blockedReason: resolverBlocked
      };
    })().finally(() => pendingSyncs.delete(syncKey));

    pendingSyncs.set(syncKey, promise);
    return promise;
  }

  async function installModrinthMod(projectReference, target = {}) {
    if (isMinecraftRunning()) {
      return { success: false, error: "Mods can't be changed while Minecraft is running." };
    }
    const type = projectType(projectReference);
    if (type === 'modpack') {
      return installModrinthModpack(projectReference, target);
    }
    if (type !== 'mod') {
      return installDownloadableModrinthProject(projectReference, type, target);
    }

    let modContext;
    try {
      modContext = getModrinthInstallContext(target);
    } catch (error) {
      return { success: false, error: error.message };
    }

    const minecraftVersion = String(modContext.minecraftVersion || '').trim();
    if (!minecraftVersion) {
      return { success: false, error: 'Bitte wähle zuerst eine Fabric-Version aus.' };
    }

    const state = readState(modContext);
    try {
      await ensureProjectInstalled(projectReference, minecraftVersion, modContext, state, {
        forceRefresh: true,
        visited: new Set(),
        installationSource: 'manual'
      });
      writeState(state, modContext);
      const syncResult = await syncManagedModsForVersion(modContext.versionId, { modContext });
      const title = state.projects[resolveProjectId(projectReference)]?.title || resolveProjectId(projectReference);
      return {
        success: true,
        warning: formatManagedModsWarning([
          getModrinthTargetChangeWarning(target, modContext),
          ...(syncResult.warnings || [])
        ]),
        message: modContext.type === 'pack'
          ? `${title} wurde in ${modContext.name} installiert.`
          : `${title} wurde für Fabric ${minecraftVersion} installiert.`,
        mods: await getInstalledMods(modContext.versionId)
      };
    } catch (error) {
      writeState(state, modContext);
      return {
        success: false,
        error: error.message,
        warning: formatManagedModsWarning([getModrinthTargetChangeWarning(target, modContext)]),
        mods: await getInstalledMods(modContext.versionId, { skipManagedSync: true })
      };
    }
  }

  async function refreshInstalledMod(modId) {
    const projectId = parseProjectModId(modId);
    if (!projectId) {
      return { success: false, error: 'Manuelle Mods können nicht automatisch aktualisiert werden.' };
    }
    const modContext = getActiveModContext();
    const state = readState(modContext);
    const project = state.projects[projectId];
    if (!project) {
      return { success: false, error: 'Der Mod wurde nicht mehr gefunden.' };
    }
    const syncResult = await syncManagedModsForVersion(modContext.versionId, {
      refreshProjects: new Set([projectId]),
      modContext
    });
    return {
      success: true,
      warning: formatManagedModsWarning(syncResult.warnings),
      message: `${project.title || projectId} wurde für ${getCurrentMinecraftVersion()} aktualisiert.`,
      mods: await getInstalledMods(modContext.versionId)
    };
  }

  async function updateAllManagedMods() {
    const modContext = getActiveModContext();
    const syncResult = await syncManagedModsForVersion(modContext.versionId, {
      refreshAll: true,
      refreshDisabledProjects: true,
      modContext
    });
    const downloadableResult = updateDownloadableModrinthProjects
      ? await updateDownloadableModrinthProjects(['resourcepack', 'shader'], modContext)
      : { updated: 0, total: 0, warnings: [] };
    const updated = syncResult.synced + (downloadableResult.updated || 0);
    const total = syncResult.totalProjects + (downloadableResult.total || 0);
    return {
      updated,
      total,
      warnings: uniqueStrings([...(syncResult.warnings || []), ...(downloadableResult.warnings || [])]),
      warning: formatManagedModsWarning([...(syncResult.warnings || []), ...(downloadableResult.warnings || [])]),
      message: total
        ? `${updated}/${total} Einträge wurden geprüft.`
        : 'Noch keine Modrinth-Mods, Ressourcenpakete oder Shader im Launcher installiert.'
    };
  }

  async function cleanupDuplicateMods(versionId = getEffectiveSelectedVersionId()) {
    if (isMinecraftRunning()) return { success: false, error: "Mods can't be changed while Minecraft is running." };
    const modContext = getActiveModContext(versionId);
    const state = readState(modContext);
    const warnings = [];
    const filesBefore = [
      ...listActiveModJarPaths(modContext),
      ...listJarFilePaths(getDisabledDir(modContext))
    ];

    cleanupDuplicateFilesystemMods(
      modContext,
      state,
      String(modContext.minecraftVersion || ''),
      warnings
    );
    rememberObservedMods(modContext, state);
    writeState(state, modContext);

    const removedNames = filesBefore
      .filter((filePath) => !fsModule.existsSync(filePath))
      .map((filePath) => pathModule.basename(filePath));
    return {
      removed: removedNames.length,
      removedNames,
      warnings: uniqueStrings(warnings)
    };
  }

  async function cleanupNumberedAndDuplicateMods(versionId = getEffectiveSelectedVersionId()) {
    if (isMinecraftRunning()) return { success: false, error: "Mods can't be changed while Minecraft is running." };
    const modContext = getActiveModContext(versionId);
    const state = readState(modContext);
    const warnings = [];
    const numberedRemovedNames = [];
    const managedByPath = new Map(
      (state.activeSync?.files || []).map((entry) => [normalizePath(entry.targetPath), entry])
    );
    const filesBefore = [
      ...listActiveModJarPaths(modContext),
      ...listJarFilePaths(getDisabledDir(modContext))
    ];

    for (const filePath of filesBefore) {
      if (!/-\d+\.jar$/iu.test(pathModule.basename(filePath))) {
        continue;
      }
      if (isKeptLocalMod(state, filePath, pathModule.basename(filePath))) {
        warnings.push(`${pathModule.basename(filePath)}: Behaltene lokale Mod wurde nicht automatisch gelöscht.`);
        continue;
      }
      const managed = managedByPath.get(normalizePath(filePath));
      const projectId = String(managed?.projectId || '').trim();
      tryUnlink(filePath);
      if (fsModule.existsSync(filePath)) {
        warnings.push(`${pathModule.basename(filePath)} konnte nicht gelöscht werden.`);
        continue;
      }
      numberedRemovedNames.push(pathModule.basename(filePath));

      if (projectId && !isProtectedProject(projectId, state.projects?.[projectId], modContext)) {
        delete state.projects[projectId];
        state.disabledProjects = (state.disabledProjects || []).filter((id) => id !== projectId);
        state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((id) => id !== projectId);
        delete state.disabledProjectReasons[projectId];
        state.activeSync.files = (state.activeSync?.files || []).filter((entry) => entry.projectId !== projectId);
      }
    }

    const duplicateFilesBefore = [
      ...listActiveModJarPaths(modContext),
      ...listJarFilePaths(getDisabledDir(modContext))
    ];
    cleanupDuplicateFilesystemMods(
      modContext,
      state,
      String(modContext.minecraftVersion || ''),
      warnings
    );
    const duplicateRemovedNames = duplicateFilesBefore
      .filter((filePath) => !fsModule.existsSync(filePath))
      .map((filePath) => pathModule.basename(filePath));

    writeState(state, modContext);
    const requiredResult = await syncManagedModsForVersion(modContext.versionId || versionId, {
      modContext,
      refreshProjects: new Set(requiredManagedSet),
      refreshDisabledProjects: true
    });
    warnings.push(...(requiredResult.warnings || []));

    const removedNames = uniqueStrings([...numberedRemovedNames, ...duplicateRemovedNames]);
    return {
      removed: removedNames.length,
      numberedRemoved: numberedRemovedNames.length,
      duplicatesRemoved: duplicateRemovedNames.length,
      removedNames,
      warnings: uniqueStrings(warnings),
      message: removedNames.length
        ? `${removedNames.length} Mod-Datei${removedNames.length === 1 ? '' : 'en'} gelöscht. Fehlende Pflichtmods wurden geprüft und wiederhergestellt.`
        : 'Keine nummerierten oder doppelten Mods gefunden. Pflichtmods sind vollständig.'
    };
  }

  async function getInstalledManagedModProjectIds(versionId = getEffectiveSelectedVersionId(), options = {}) {
    const modContext = options.modContext || getActiveModContext(versionId);
    if (options.sync !== false) {
      await syncManagedModsForVersion(modContext.versionId || versionId, { modContext });
    }
    const state = readState(modContext);
    return Object.keys(state.projects || {})
      .filter((projectId) => !isHiddenProject(projectId, state.projects[projectId], modContext));
  }

  async function getInstalledMods(versionId = getEffectiveSelectedVersionId(), options = {}) {
    const modContext = getActiveModContext(versionId);
    const mutationLocked = isMinecraftRunning();
    if (!options.skipManagedSync && !mutationLocked) {
      await syncManagedModsForVersion(versionId, { modContext });
    }

    ensureDir(modContext.modsDir);
    ensureDir(getDisabledDir(modContext));
    if (!mutationLocked) purgeBlockedModFiles(modContext);
    const state = readState(modContext);
    const managedByPath = new Map((state.activeSync?.files || []).map((entry) => [normalizePath(entry.targetPath), entry]));
    const mods = [];

    for (const fullPath of listActiveModJarPaths(modContext)) {
      const fileName = pathModule.basename(fullPath);
      const managed = managedByPath.get(normalizePath(fullPath));
      if (managed) {
        mods.push(createManagedListEntry(managed.projectId, fullPath, fileName, true, state, modContext.minecraftVersion, modContext));
      } else {
        mods.push(createLocalListEntry(fullPath, fileName, true, state));
      }
    }

    for (const fileName of listJarFiles(getDisabledDir(modContext))) {
      const fullPath = pathModule.join(getDisabledDir(modContext), fileName);
      mods.push(createLocalListEntry(fullPath, fileName, false, state));
    }

    const disabledProjectIds = new Set([...(state.disabledProjects || []), ...(state.autoDisabledProjects || [])]);
    for (const projectId of disabledProjectIds) {
      if (mods.some((entry) => entry.projectId === projectId)) {
        continue;
      }
      const project = state.projects[projectId];
      if (!project || isHiddenProject(projectId, project, modContext)) {
        continue;
      }
      const versionEntry = project.versions?.[modContext.minecraftVersion] || {};
      mods.push({
        id: `project:${projectId}`,
        projectId,
        slug: project.slug || '',
        name: project.title || projectId,
        description: project.description || '',
        iconUrl: project.iconUrl || '',
        isProtected: isProtectedProject(projectId, project, modContext),
        canDisable: !isProtectedProject(projectId, project, modContext),
        path: versionEntry.libraryPath || '',
        size: getFileSize(versionEntry.libraryPath),
        enabled: false,
        autoDisabled: (state.autoDisabledProjects || []).includes(projectId),
        disabledReason: state.disabledProjectReasons?.[projectId]?.reason || `Keine passende Fabric-Version für ${modContext.minecraftVersion} gefunden.`,
        managed: true,
        source: 'modrinth',
        sourceLabel: isHiddenProject(projectId, project, modContext) ? 'Pflichtmod' : 'Modrinth',
        hiddenInModsTab: isHiddenProject(projectId, project, modContext),
        fileName: versionEntry.fileName || '',
        minecraftVersion: modContext.minecraftVersion,
        versionName: versionEntry.versionName || '',
        versionNumber: versionEntry.versionNumber || '',
        lastUpdated: versionEntry.updatedAt || new Date().toISOString()
      });
    }

    if (getInstalledDownloadableModrinthEntries) {
      mods.push(...await getInstalledDownloadableModrinthEntries(modContext));
    }

    const uniqueMods = [];
    const seenModKeys = new Set();
    for (const mod of mods) {
      const key = mod.projectId
        ? `project:${normalizeId(mod.projectId)}:${String(mod.itemType || 'mod')}`
        : mod.itemType && mod.itemType !== 'mod'
          ? `${mod.itemType}:${normalizePath(mod.path || mod.fileName)}`
          : getLocalModIdentity(mod.path || '', '');
      if (seenModKeys.has(key)) {
        info('Ignored duplicate mod list entry', { key, path: mod.path, name: mod.name });
        continue;
      }
      seenModKeys.add(key);
      uniqueMods.push(mod);
    }
    info('Completed mod scan', {
      modsDirectory: modContext.modsDir,
      foundEntries: mods.length,
      displayedEntries: uniqueMods.length
    });
    return uniqueMods.sort(sortMods);
  }

  async function setInstalledModEnabled(modId, enabled) {
    return withModOperationLock(modId, async () => {
      if (isMinecraftRunning()) {
        return { success: false, error: "Mods can't be changed while Minecraft is running." };
      }
      const modContext = getActiveModContext();
      const state = readState(modContext);
      const projectId = parseProjectModId(modId);
      if (projectId) {
        const project = state.projects[projectId];
        if (isProtectedProject(projectId, project, modContext)) {
          return { success: false, error: 'Diese Pflichtmod muss immer aktiv bleiben.' };
        }
        const relatedProjectIds = enabled ? [projectId] : getDependencyComponentProjectIds(state, projectId, modContext.minecraftVersion);
        state.disabledProjects = enabled
          ? (state.disabledProjects || []).filter((id) => id !== projectId)
          : uniqueStrings([...(state.disabledProjects || []), ...relatedProjectIds]);
        if (enabled) {
          state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((id) => id !== projectId);
          delete state.disabledProjectReasons[projectId];
        }
        recordDecision(state, enabled ? 'enabled-project' : 'disabled-project-with-dependencies', { projectId, relatedProjectIds });
        writeState(state, modContext);
        const syncResult = await syncManagedModsForVersion(modContext.versionId, { modContext });
        return {
          success: true,
          warning: formatManagedModsWarning(syncResult.warnings),
          message: `${project?.title || projectId} wurde ${enabled ? 'eingeschaltet' : 'ausgeschaltet'}${!enabled && relatedProjectIds.length > 1 ? `; ${relatedProjectIds.length - 1} verbundene Abhängigkeit(en) ebenfalls` : ''}.`
        };
      }

      const requestedFilePath = parseFileModId(modId);
      const requestedFileName = requestedFilePath ? pathModule.basename(requestedFilePath) : '';
      const alternateFilePaths = requestedFileName
        ? [
            requestedFilePath,
            pathModule.join(modContext.modsDir, requestedFileName),
            pathModule.join(getDisabledDir(modContext), requestedFileName)
          ]
        : [];
      const filePath = alternateFilePaths.find((candidate) => candidate && fsModule.existsSync(candidate));
      if (!filePath) {
        return { success: false, error: 'Mod-Datei wurde nicht gefunden.' };
      }
      const fileName = pathModule.basename(filePath);
      if (!enabled) {
        try {
          const moved = disableLocalDependencyComponent(filePath, modContext);
          if (moved.length) {
            recordDecision(state, 'disabled-local-mod-with-dependencies', { fileName, moved });
            writeState(state, modContext);
            return { success: true, message: `${fileName} und ${Math.max(0, moved.length - 1)} verbundene Abhängigkeit(en) wurden ausgeschaltet.`, disabledFiles: moved };
          }
        } catch (error) {
          return { success: false, error: `Mod-Datei konnte nicht ausgeschaltet werden: ${error.message}` };
        }
      }
      const targetDir = enabled ? modContext.modsDir : getDisabledDir(modContext);
      const targetPath = uniquePath(pathModule.join(targetDir, fileName));
      const sourceExists = fsModule.existsSync(filePath);
      if (!sourceExists) {
        return { success: false, error: `Mod-Datei ${fileName} wurde bereits entfernt.` };
      }
      try {
        fsModule.mkdirSync(targetDir, { recursive: true });
        fsModule.renameSync(filePath, targetPath);
        const sourceStillExists = fsModule.existsSync(filePath);
        const targetStillExists = fsModule.existsSync(targetPath);
        if (sourceStillExists || !targetStillExists) {
          throw new Error(`Datei-Transfer für ${fileName} wurde nicht vollständig bestätigt.`);
        }
        return {
          success: true,
          message: `${fileName} wurde ${enabled ? 'eingeschaltet' : 'ausgeschaltet'}.`
        };
      } catch (error) {
        const sourceStillExists = fsModule.existsSync(filePath);
        const targetStillExists = fsModule.existsSync(targetPath);
        if (!sourceStillExists && targetStillExists && !enabled) {
          try {
            fsModule.renameSync(targetPath, filePath);
          } catch (_restoreError) {
            warn('Failed to restore disabled mod state after failed toggle', {
              filePath,
              targetPath,
              error: serializeError(_restoreError)
            });
          }
        }
        return {
          success: false,
          error: `Mod-Datei konnte nicht ${enabled ? 'eingeschaltet' : 'ausgeschaltet'} werden: ${error.message}`
        };
      }
    });
  }

  function getDependencyComponentProjectIds(state, projectId, minecraftVersion) {
    const seen = new Set();
    const queue = [projectId];
    while (queue.length) {
      const current = queue.shift();
      if (!current || seen.has(current)) continue;
      seen.add(current);
      const neighbours = [...getProjectDependencyIds(state, current, minecraftVersion), ...getRequiredByProjectIds(state, current, minecraftVersion)];
      for (const neighbour of neighbours) if (!seen.has(neighbour)) queue.push(neighbour);
    }
    return [...seen];
  }

  function getManifestRequiredIds(manifest) {
    const depends = manifest?.depends && typeof manifest.depends === 'object' && !Array.isArray(manifest.depends) ? manifest.depends : {};
    return Object.keys(depends).map((id) => id.toLowerCase()).filter((id) => !['minecraft', 'java', 'fabricloader'].includes(id));
  }

  function disableLocalDependencyComponent(filePath, modContext) {
    const active = listActiveModJarPaths(modContext).map((candidatePath) => {
      const manifest = readFabricManifest(candidatePath) || {};
      return { path: candidatePath, id: String(manifest.id || '').trim().toLowerCase(), dependencies: getManifestRequiredIds(manifest) };
    });
    const target = active.find((entry) => normalizePath(entry.path) === normalizePath(filePath));
    if (!target) return [];
    const selectedIds = new Set(target.id ? [target.id] : []);
    const selectedPaths = new Set([normalizePath(target.path)]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const entry of active) {
        const selectedDependsOnEntry = entry.id && active.some((item) => selectedPaths.has(normalizePath(item.path)) && item.dependencies.includes(entry.id));
        const connected = selectedPaths.has(normalizePath(entry.path)) || entry.dependencies.some((id) => selectedIds.has(id)) || selectedDependsOnEntry;
        if (connected && !selectedPaths.has(normalizePath(entry.path))) {
          selectedPaths.add(normalizePath(entry.path));
          if (entry.id) selectedIds.add(entry.id);
          changed = true;
        }
      }
    }
    const moved = [];
    const transfers = [];
    ensureDir(getDisabledDir(modContext));
    try {
      for (const entry of active.filter((item) => selectedPaths.has(normalizePath(item.path)))) {
        const destination = uniquePath(pathModule.join(getDisabledDir(modContext), pathModule.basename(entry.path)));
        fsModule.renameSync(entry.path, destination);
        transfers.push({ source: entry.path, destination });
        moved.push(pathModule.basename(destination));
      }
    } catch (error) {
      for (const transfer of transfers.reverse()) {
        try {
          if (!fsModule.existsSync(transfer.source) && fsModule.existsSync(transfer.destination)) {
            fsModule.renameSync(transfer.destination, transfer.source);
          }
        } catch (_restoreError) { /* best effort rollback */ }
      }
      throw error;
    }
    return moved;
  }

  async function setInstalledModAlias(modId, alias) {
    const normalizedModId = String(modId || '').trim();
    if (!normalizedModId) return { success: false, error: 'Mod wurde nicht gefunden.' };
    const modContext = getActiveModContext();
    const state = readState(modContext);
    const projectId = parseProjectModId(normalizedModId);
    const aliasKey = projectId
      ? `project:${normalizeId(projectId)}`
      : (() => {
          const filePath = parseFileModId(normalizedModId);
          return filePath ? getLocalModIdentity(filePath) : '';
        })();
    if (!aliasKey) return { success: false, error: 'Mod wurde nicht gefunden.' };
    const value = String(alias ?? '').trim().slice(0, 80);
    if (value) state.modAliases[aliasKey] = value;
    else delete state.modAliases[aliasKey];
    writeState(state, modContext);
    return { success: true, alias: value, message: value ? 'Spitzname gespeichert.' : 'Spitzname entfernt.' };
  }

  async function removeInstalledMod(modId) {
    return withModOperationLock(modId, async () => {
      if (isMinecraftRunning()) {
        return { success: false, error: "Mod can't be deleted while Minecraft is running." };
      }
      const modContext = getActiveModContext();
      if (String(modId || '').startsWith('download:') && removeDownloadableModrinthEntry) {
        const result = await removeDownloadableModrinthEntry(modId, modContext);
        return result;
      }
      const state = readState(modContext);
      const projectId = parseProjectModId(modId);
      if (projectId) {
        const project = state.projects[projectId];
        if (isProtectedProject(projectId, project, modContext)) {
          return { success: false, error: 'Diese Pflichtmod ist erforderlich und kann nicht entfernt werden.' };
        }
        const requiredBy = getRequiredByProjectIds(state, projectId, modContext.minecraftVersion);
        if (requiredBy.length) {
          const names = requiredBy.map((id) => state.projects?.[id]?.title || id);
          recordDecision(state, 'blocked-required-dependency-removal', { projectId, requiredBy });
          writeState(state, modContext);
          return {
            success: false,
            error: `Mod can't be deleted. Required by: ${names.join(', ')}.`,
            requiredBy
          };
        }
        const dependencyIds = getProjectDependencyIds(state, projectId, modContext.minecraftVersion);
        const previousFiles = Array.isArray(state.activeSync?.files) ? state.activeSync.files : [];
        const projectIdentity = previousFiles
          .filter((item) => item.projectId === projectId)
          .map((item) => item.targetPath)
          .filter((filePath) => filePath && fsModule.existsSync(filePath))
          .map((filePath) => getLocalModIdentity(filePath, projectId))[0] || `project:${normalizeId(projectId)}`;
        const filePaths = previousFiles.filter((item) => item.projectId === projectId).map((item) => item.targetPath).filter(Boolean);
        for (const filePath of filePaths) {
          if (!fsModule.existsSync(filePath)) {
            continue;
          }
          try {
            fsModule.unlinkSync(filePath);
          } catch (error) {
            return { success: false, error: `Mod-Datei ${pathModule.basename(filePath)} konnte nicht gelöscht werden: ${error.message}` };
          }
          if (fsModule.existsSync(filePath)) {
            return { success: false, error: `Mod-Datei ${pathModule.basename(filePath)} wurde nach dem Löschen noch gefunden.` };
          }
        }
        deleteStoredCopies(modContext, projectIdentity);
        delete state.projects[projectId];
        state.disabledProjects = (state.disabledProjects || []).filter((id) => id !== projectId);
        state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((id) => id !== projectId);
        delete state.disabledProjectReasons[projectId];
        state.activeSync.files = previousFiles.filter((entry) => entry.projectId !== projectId);
        recordDecision(state, 'removed-project', { projectId });
        writeState(state, modContext);
        const autoRemoved = removeOrphanedDependencies(state, dependencyIds, modContext);
        writeState(state, modContext);
        return {
          success: true,
          message: `${project?.title || projectId} wurde vollständig entfernt.${autoRemoved.length ? ` Nicht mehr benötigte Abhängigkeiten entfernt: ${autoRemoved.map((id) => state.projects?.[id]?.title || id).join(', ')}.` : ''}`,
          autoRemovedDependencies: autoRemoved
        };
      }

      const filePath = parseFileModId(modId);
      if (!filePath || !fsModule.existsSync(filePath)) {
        return { success: false, error: 'Mod-Datei wurde nicht gefunden.' };
      }
      const fileDeletionBlockReason = getFileDeletionBlockReason(filePath, modContext);
      if (fileDeletionBlockReason) {
        return { success: false, error: fileDeletionBlockReason };
      }
      const fileName = pathModule.basename(filePath);
      const identity = getLocalModIdentity(filePath);
      try {
        fsModule.unlinkSync(filePath);
      } catch (error) {
        return { success: false, error: `Mod-Datei ${fileName} konnte nicht gelöscht werden: ${error.message}` };
      }
      if (fsModule.existsSync(filePath)) {
        return { success: false, error: `Mod-Datei ${fileName} wurde nach dem Löschen noch gefunden.` };
      }
      const removedBackups = deleteStoredCopies(modContext, identity);
      return {
        success: true,
        message: `${fileName} wurde vollständig entfernt (${removedBackups} gespeicherte Kopie(n) bereinigt).`,
        path: ''
      };
    });
  }

  function getProjectDependencyIds(state, projectId, minecraftVersion) {
    const dependencies = state.projects?.[projectId]?.versions?.[minecraftVersion]?.dependencies;
    return uniqueStrings((Array.isArray(dependencies) ? dependencies : [])
      .filter((entry) => String(entry?.dependencyType || '').toLowerCase() === 'required')
      .map((entry) => aliasMap.get(normalizeId(entry?.projectId)) || String(entry?.projectId || '').trim())
      .filter(Boolean));
  }

  function getRequiredByProjectIds(state, dependencyProjectId, minecraftVersion) {
    const target = normalizeId(dependencyProjectId);
    return Object.keys(state.projects || {}).filter((projectId) => (
      normalizeId(projectId) !== target
      && getProjectDependencyIds(state, projectId, minecraftVersion).some((id) => normalizeId(id) === target)
    ));
  }

  function removeOrphanedDependencies(state, candidates, modContext) {
    const removed = [];
    const queue = [...uniqueStrings(candidates)];
    while (queue.length) {
      const projectId = queue.shift();
      const project = state.projects?.[projectId];
      if (!project || project.installationSource !== 'dependency') continue;
      if (getRequiredByProjectIds(state, projectId, modContext.minecraftVersion).length) continue;
      const children = getProjectDependencyIds(state, projectId, modContext.minecraftVersion);
      const files = (state.activeSync?.files || []).filter((entry) => entry.projectId === projectId);
      for (const entry of files) {
        const relativePath = entry.targetPath ? pathModule.relative(modContext.modsDir, entry.targetPath) : '..';
        const safelyInsideMods = relativePath && relativePath !== '..'
          && !relativePath.startsWith(`..${pathModule.sep}`)
          && !pathModule.isAbsolute(relativePath);
        if (safelyInsideMods && fsModule.existsSync(entry.targetPath)) {
          fsModule.unlinkSync(entry.targetPath);
        }
      }
      const versionEntry = project.versions?.[modContext.minecraftVersion];
      if (versionEntry?.libraryPath && fsModule.existsSync(versionEntry.libraryPath)) tryUnlink(versionEntry.libraryPath);
      delete state.projects[projectId];
      state.activeSync.files = (state.activeSync?.files || []).filter((entry) => entry.projectId !== projectId);
      state.disabledProjects = (state.disabledProjects || []).filter((id) => id !== projectId);
      state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((id) => id !== projectId);
      delete state.disabledProjectReasons[projectId];
      removed.push(projectId);
      queue.push(...children);
      recordDecision(state, 'removed-orphaned-dependency', { projectId });
    }
    return removed;
  }

  async function importDroppedMods(filePaths, options = {}) {
    if (isMinecraftRunning()) {
      return { success: false, error: "Mods can't be changed while Minecraft is running." };
    }
    const normalizedPaths = uniqueStrings(Array.isArray(filePaths) ? filePaths : [filePaths])
      .map((entry) => pathModule.normalize(String(entry || '').trim()))
      .filter((entry) => entry && pathModule.isAbsolute(entry));
    if (!normalizedPaths.length) {
      return { success: false, error: 'Keine gültige JAR-Datei erkannt.' };
    }

    const modContext = getActiveModContext();
    const minecraftVersion = String(modContext.minecraftVersion || '').trim();
    const state = readState(modContext);
    const imported = [];
    const rejected = [];

    for (const filePath of normalizedPaths) {
      const fileName = pathModule.basename(filePath);
      if (!fsModule.existsSync(filePath) || !fileName.toLowerCase().endsWith('.jar')) {
        rejected.push(`${fileName}: Nur vorhandene JAR-Dateien können importiert werden.`);
        continue;
      }

      try {
        if (options?.mode === 'keep') {
          const targetDir = options?.requireManualApproval === true ? getDisabledDir(modContext) : modContext.modsDir;
          ensureDir(targetDir);
          const targetPath = uniquePath(pathModule.join(targetDir, fileName));
          fsModule.copyFileSync(filePath, targetPath);
          rememberKeptLocalMod(state, targetPath);
          imported.push(fileName);
          continue;
        }
        const sha1 = hashFile(filePath);
        let versionData = null;
        try {
          versionData = await fetchVersionByHash(sha1);
        } catch (_error) {
          versionData = null;
        }
        if (versionData?.project_id) {
          await ensureProjectInstalled(versionData.project_id, minecraftVersion, modContext, state, {
            forceRefresh: true,
            visited: new Set()
          });
          imported.push(fileName);
          continue;
        }

        if (options?.mode === 'modrinth') {
          rejected.push(`${fileName}: Keine passende Mod auf Modrinth gefunden.`);
          continue;
        }

        const targetDir = options?.requireManualApproval === false ? modContext.modsDir : getDisabledDir(modContext);
        ensureDir(targetDir);
        fsModule.copyFileSync(filePath, uniquePath(pathModule.join(targetDir, fileName)));
        imported.push(fileName);
      } catch (error) {
        rejected.push(`${fileName}: ${error.message}`);
      }
    }

    writeState(state, modContext);
    const syncResult = await syncManagedModsForVersion(modContext.versionId, { modContext });
    if (!imported.length) {
      return { success: false, error: rejected[0] || 'Keine Mod konnte importiert werden.', rejected };
    }
    return {
      success: true,
      selectedVersionId: modContext.versionId,
      minecraftVersion,
      installed: imported.length,
      total: normalizedPaths.length,
      warning: formatManagedModsWarning([...rejected, ...(syncResult.warnings || [])]),
      rejected,
      message: `${imported.length} Mod${imported.length === 1 ? '' : 's'} importiert.`,
      mods: await getInstalledMods(modContext.versionId)
    };
  }

  function formatManagedModsWarning(warnings) {
    const items = uniqueStrings(Array.isArray(warnings) ? warnings : [warnings]).filter(Boolean);
    if (!items.length) {
      return '';
    }
    return items.length > 1 ? `${items[0]} | +${items.length - 1} weitere` : items[0];
  }

  function formatManagedModsLaunchMessage(syncResult) {
    const warningText = formatManagedModsWarning(syncResult?.warnings || []);
    return warningText ? ` Hinweis Mods: ${warningText}` : '';
  }

  function assertLaunchRequiredModsSynced(syncResult, minecraftVersion) {
    const autoDisabled = uniqueStrings(syncResult?.autoDisabledProjects || []);
    if (autoDisabled.length) {
      throw new Error(`Minecraft kann nicht gestartet werden, weil ${autoDisabled.length} Mod${autoDisabled.length === 1 ? '' : 's'} keine kompatible Fabric-Version für ${minecraftVersion} hat: ${autoDisabled.join(', ')}`);
    }

    const activeProjects = new Set((syncResult?.files || []).map((entry) => entry.projectId));
    for (const projectId of requiredManagedSet) {
      if (!activeProjects.has(projectId)) {
        throw new Error(`Minecraft kann nicht gestartet werden, weil Pflichtmod ${projectId} nicht aktiv ist.`);
      }
    }
  }

  function parseProjectModId(modId) {
    const value = String(modId || '').trim();
    return value.startsWith('project:') ? value.slice('project:'.length).trim() : '';
  }

  function parseFileModId(modId) {
    const value = String(modId || '').trim();
    return value.startsWith('file:') ? value.slice('file:'.length).trim() : '';
  }

  function sortMods(left, right) {
    const typeOrder = { mod: 0, resourcepack: 1, shader: 2 };
    const typeDiff = (typeOrder[left.itemType || 'mod'] ?? 9) - (typeOrder[right.itemType || 'mod'] ?? 9);
    if (typeDiff !== 0) {
      return typeDiff;
    }
    const xClientPriority = Number(isXClientModEntry(right)) - Number(isXClientModEntry(left));
    if (xClientPriority !== 0) {
      return xClientPriority;
    }
    if (left.enabled !== right.enabled) {
      return left.enabled ? -1 : 1;
    }
    if (left.managed !== right.managed) {
      return left.managed ? -1 : 1;
    }
    return String(left.name || '').localeCompare(String(right.name || ''), 'de', { sensitivity: 'base' });
  }

  function isXClientModEntry(entry = {}) {
    const projectId = normalizeId(entry.projectId || '');
    const slug = normalizeId(entry.slug || '');
    const fileName = String(entry.fileName || '').trim().toLowerCase();
    const name = String(entry.name || '').trim().toLowerCase();
    return projectId === 'x-launcher-menu'
      || projectId === 'x-client'
      || slug === 'x-launcher-menu'
      || slug === 'x-client'
      || fileName.startsWith('x-launcher-menu-')
      || fileName === 'x-launcher-menu.jar'
      || name === 'x client';
  }

  return {
    syncManagedModsForVersion,
    installModrinthMod,
    refreshInstalledMod,
    updateAllManagedMods,
    cleanupDuplicateMods,
    cleanupNumberedAndDuplicateMods,
    getInstalledManagedModProjectIds,
    getInstalledMods,
    setInstalledModEnabled,
    setInstalledModAlias,
    removeInstalledMod,
    importDroppedMods,
    formatManagedModsWarning,
    formatManagedModsLaunchMessage,
    assertLaunchRequiredModsSynced
  };
}

function createMissingVersionError(message) {
  const error = new Error(message);
  error.code = 'NO_COMPATIBLE_MODRINTH_VERSION';
  return error;
}

function createIncompatibleModError(message) {
  const error = new Error(message);
  error.code = 'INCOMPATIBLE_MOD';
  return error;
}

module.exports = createModsEngine;
