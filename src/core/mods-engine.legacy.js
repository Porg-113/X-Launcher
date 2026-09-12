const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const MODRINTH_API_BASE_URL = 'https://api.modrinth.com/v2';
const MODRINTH_HEADERS = { 'User-Agent': 'XClient/2.0 (Fabric Mods Engine)' };
const CACHE_TTL_MS = 5 * 60 * 1000;
const COMPAT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const STATE_VERSION = 3;

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
    requiredBundledMods = [],
    requiredManagedProjectIds = [],
    hiddenProjectIds = [],
    hiddenSlugs = [],
    protectedProjectIds = [],
    disabledModsDirName = '.x-disabled-mods',
    modrinthProjectIdAliases = {},
    resourcepacksDir,
    shaderpacksDir
  } = options || {};

  if (!fetchImpl) {
    throw new Error('Mods engine requires fetch.');
  }

  const stateFile = pathModule.join(configDir, 'mods-state.json');
  const apiCache = new Map();
  const pendingSyncs = new Map();

  const requiredManagedSet = normalizeSet(requiredManagedProjectIds);
  const hiddenProjectSet = normalizeSet(hiddenProjectIds);
  const hiddenSlugSet = normalizeSet(hiddenSlugs);
  const protectedProjectSet = new Set([...normalizeSet(protectedProjectIds), ...requiredManagedSet]);
  const aliasMap = new Map(Object.entries(modrinthProjectIdAliases || {}).map(([key, value]) => [
    normalizeId(key),
    String(value || '').trim()
  ]));

  function debug(message, details = {}) {
    logger.info(`[mods-engine] ${message}`, details);
  }

  function warn(message, details = {}) {
    logger.warn(`[mods-engine] ${message}`, details);
  }

  function errorLog(message, details = {}) {
    logger.error(`[mods-engine] ${message}`, details);
  }

  function ensureDir(dir) {
    if (dir) {
      fsModule.mkdirSync(dir, { recursive: true });
    }
  }

  function readJson(file, fallback) {
    try {
      if (!fsModule.existsSync(file)) {
        return fallback;
      }
      return JSON.parse(fsModule.readFileSync(file, 'utf8'));
    } catch (error) {
      warn('JSON state could not be read; using fallback', { file, error: serializeError(error) });
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
      activeSync: { minecraftVersion: '', files: [] },
      keptLocalProjectIds: [],
      localFiles: {},
      lastChecks: {},
      operationLog: []
    };
  }

  function normalizeState(raw) {
    const base = defaultState();
    const state = { ...base, ...(raw && typeof raw === 'object' ? raw : {}) };
    state.version = STATE_VERSION;
    state.projects = state.projects && typeof state.projects === 'object' ? state.projects : {};
    state.disabledProjects = uniqueStrings(state.disabledProjects);
    state.autoDisabledProjects = uniqueStrings(state.autoDisabledProjects);
    state.disabledProjectReasons = state.disabledProjectReasons && typeof state.disabledProjectReasons === 'object'
      ? state.disabledProjectReasons
      : {};
    state.activeSync = state.activeSync && typeof state.activeSync === 'object' ? state.activeSync : base.activeSync;
    state.activeSync.files = Array.isArray(state.activeSync.files) ? state.activeSync.files : [];
    state.keptLocalProjectIds = uniqueStrings(state.keptLocalProjectIds);
    state.localFiles = state.localFiles && typeof state.localFiles === 'object' ? state.localFiles : {};
    state.lastChecks = state.lastChecks && typeof state.lastChecks === 'object' ? state.lastChecks : {};
    state.operationLog = Array.isArray(state.operationLog) ? state.operationLog.slice(-200) : [];
    return state;
  }

  function readState(modContext) {
    const file = modContext?.stateFile || stateFile;
    return normalizeState(readJson(file, defaultState()));
  }

  function writeState(state, modContext) {
    const normalized = normalizeState(state);
    writeJson(modContext?.stateFile || stateFile, normalized);
  }

  function recordDecision(state, event, details = {}) {
    state.operationLog = [
      ...(Array.isArray(state.operationLog) ? state.operationLog : []),
      {
        at: new Date().toISOString(),
        event,
        ...details
      }
    ].slice(-250);
  }

  async function fetchJson(pathOrUrl, options = {}) {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${MODRINTH_API_BASE_URL}${pathOrUrl}`;
    const cacheKey = `${url}:${JSON.stringify(options.query || {})}`;
    const cached = apiCache.get(cacheKey);
    if (!options.forceRefresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.value;
    }

    const response = await fetchImpl(url, {
      headers: { ...MODRINTH_HEADERS, ...(options.headers || {}) }
    });
    if (!response.ok) {
      throw new Error(`Modrinth antwortet mit HTTP ${response.status} fuer ${url}.`);
    }
    const value = await response.json();
    apiCache.set(cacheKey, { at: Date.now(), value });
    return value;
  }

  async function fetchProject(projectRef, options = {}) {
    const projectId = resolveProjectId(projectRef);
    if (!projectId) {
      throw new Error('Modrinth-Projekt fehlt.');
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
    return fetchJson(`/version_file/${encodeURIComponent(sha1)}?algorithm=sha1`);
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
    return String(projectRef?.project_type || projectRef?.projectType || 'mod').trim().toLowerCase() || 'mod';
  }

  function toProjectState(projectRef, project = null) {
    const source = project || projectRef || {};
    const projectId = resolveProjectId(source);
    return {
      projectId,
      slug: String(source.slug || projectRef?.slug || '').trim(),
      title: String(source.title || source.name || projectRef?.title || projectRef?.name || projectId).trim(),
      description: String(source.description || projectRef?.description || '').trim(),
      iconUrl: String(source.icon_url || source.iconUrl || projectRef?.iconUrl || '').trim(),
      projectType: projectType(source),
      versions: {}
    };
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

  function isInside(parent, child) {
    const relative = pathModule.relative(pathModule.resolve(parent), pathModule.resolve(child));
    return Boolean(relative) && !relative.startsWith('..') && !pathModule.isAbsolute(relative)
      || pathModule.resolve(parent) === pathModule.resolve(child);
  }

  function hashFile(file) {
    return crypto.createHash('sha1').update(fsModule.readFileSync(file)).digest('hex');
  }

  function verifyHash(file, expectedSha1) {
    if (!expectedSha1) {
      return true;
    }
    try {
      return hashFile(file).toLowerCase() === String(expectedSha1).toLowerCase();
    } catch (_error) {
      return false;
    }
  }

  function selectPrimaryFile(versionEntry) {
    const files = Array.isArray(versionEntry?.files) ? versionEntry.files : [];
    return files.find((file) => file.primary && file?.filename?.toLowerCase().endsWith('.jar'))
      || files.find((file) => file?.filename?.toLowerCase().endsWith('.jar'))
      || null;
  }

  function versionSupportsFabric(versionEntry) {
    const loaders = Array.isArray(versionEntry?.loaders) ? versionEntry.loaders.map((entry) => String(entry).toLowerCase()) : [];
    return loaders.includes('fabric');
  }

  function versionSupportsMinecraft(versionEntry, minecraftVersion) {
    const versions = Array.isArray(versionEntry?.game_versions) ? versionEntry.game_versions.map(String) : [];
    return versions.includes(String(minecraftVersion));
  }

  function versionIsStable(versionEntry) {
    return String(versionEntry?.version_type || '').toLowerCase() === 'release';
  }

  function versionDateMs(versionEntry) {
    return Date.parse(versionEntry?.date_published || versionEntry?.datePublished || '') || 0;
  }

  function rejectionReason(versionEntry, minecraftVersion) {
    if (!versionSupportsFabric(versionEntry)) {
      return 'Loader ist nicht Fabric.';
    }
    if (!versionSupportsMinecraft(versionEntry, minecraftVersion)) {
      return `Minecraft ${minecraftVersion} ist nicht in game_versions enthalten.`;
    }
    if (!versionIsStable(versionEntry)) {
      return `Version ist ${versionEntry?.version_type || 'nicht release'}.`;
    }
    if (!selectPrimaryFile(versionEntry)) {
      return 'Keine JAR-Datei gefunden.';
    }
    return '';
  }

  function chooseCompatibleVersion(versions, minecraftVersion) {
    const rejections = [];
    const compatible = [];
    for (const versionEntry of Array.isArray(versions) ? versions : []) {
      const reason = rejectionReason(versionEntry, minecraftVersion);
      if (reason) {
        rejections.push({
          versionId: String(versionEntry?.id || ''),
          versionNumber: String(versionEntry?.version_number || ''),
          reason
        });
      } else {
        compatible.push(versionEntry);
      }
    }
    compatible.sort((left, right) => versionDateMs(right) - versionDateMs(left));
    return { selected: compatible[0] || null, compatible, rejections };
  }

  async function downloadFile(url, targetPath, expectedSha1 = '') {
    ensureDir(pathModule.dirname(targetPath));
    if (fsModule.existsSync(targetPath) && verifyHash(targetPath, expectedSha1)) {
      debug('Download reused', { targetPath, expectedSha1 });
      return { downloaded: false, path: targetPath };
    }

    const tmp = `${targetPath}.download`;
    const response = await fetchImpl(url, { headers: MODRINTH_HEADERS });
    if (!response.ok) {
      throw new Error(`Download fehlgeschlagen: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fsModule.writeFileSync(tmp, buffer);
    if (expectedSha1 && hashFile(tmp).toLowerCase() !== String(expectedSha1).toLowerCase()) {
      tryUnlink(tmp);
      throw new Error('Download-Prüfsumme stimmt nicht.');
    }
    fsModule.renameSync(tmp, targetPath);
    debug('Download completed', { url, targetPath, expectedSha1, bytes: buffer.length });
    return { downloaded: true, path: targetPath };
  }

  function libraryPathFor(projectId, versionEntry, fileEntry, modContext) {
    return pathModule.join(
      getLibraryDir(modContext),
      safeName(projectId),
      safeName(String(versionEntry.id || versionEntry.version_number || 'version')),
      safeJarName(fileEntry.filename)
    );
  }

  async function ensureProjectInstalled(projectRef, minecraftVersion, modContext, state, options = {}) {
    const project = await fetchProject(projectRef, options);
    if (projectType(project) !== 'mod') {
      throw new Error(`${project.title || resolveProjectId(projectRef)} ist keine Mod.`);
    }

    const projectId = resolveProjectId(project);
    const projectState = {
      ...toProjectState(projectRef, project),
      versions: {
        ...(state.projects[projectId]?.versions || {})
      }
    };
    state.projects[projectId] = {
      ...(state.projects[projectId] || {}),
      ...projectState
    };

    const versions = await fetchVersions(projectId, options);
    const selection = chooseCompatibleVersion(versions, minecraftVersion);
    debug('Compatible version search finished', {
      modName: project.title || projectId,
      projectId,
      installedVersion: state.projects[projectId]?.versions?.[minecraftVersion]?.versionNumber || '',
      minecraftVersion,
      foundVersions: versions.length,
      compatibleVersions: selection.compatible.map((entry) => ({
        id: entry.id,
        versionNumber: entry.version_number,
        datePublished: entry.date_published
      })).slice(0, 20),
      selectedVersion: selection.selected?.version_number || '',
      rejected: selection.rejections.slice(0, 40)
    });

    if (!selection.selected) {
      const reason = `Keine stabile Fabric-Version fuer Minecraft ${minecraftVersion} gefunden.`;
      state.autoDisabledProjects = uniqueStrings([...(state.autoDisabledProjects || []), projectId]);
      state.disabledProjectReasons[projectId] = {
        reason,
        checkedAt: new Date().toISOString(),
        rejected: selection.rejections.slice(0, 80)
      };
      recordDecision(state, 'no-compatible-version', { projectId, title: project.title || projectId, minecraftVersion, reason });
      throw createMissingVersionError(`${project.title || projectId}: ${reason}`);
    }

    const selected = selection.selected;
    const fileEntry = selectPrimaryFile(selected);
    const expectedSha1 = String(fileEntry.hashes?.sha1 || '').trim();
    const targetLibraryPath = libraryPathFor(projectId, selected, fileEntry, modContext);
    const downloadResult = await downloadFile(fileEntry.url, targetLibraryPath, expectedSha1);
    const dependencies = await resolveRequiredDependencies(selected, minecraftVersion, modContext, state, {
      ...options,
      parentProjectId: projectId
    });

    state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((entry) => entry !== projectId);
    delete state.disabledProjectReasons[projectId];
    state.projects[projectId] = {
      ...state.projects[projectId],
      projectId,
      slug: project.slug || state.projects[projectId].slug || '',
      title: project.title || state.projects[projectId].title || projectId,
      description: project.description || state.projects[projectId].description || '',
      iconUrl: project.icon_url || state.projects[projectId].iconUrl || '',
      projectType: 'mod',
      versions: {
        ...(state.projects[projectId]?.versions || {}),
        [minecraftVersion]: {
          versionId: String(selected.id || ''),
          versionName: String(selected.name || selected.version_number || ''),
          versionNumber: String(selected.version_number || ''),
          versionType: String(selected.version_type || ''),
          datePublished: String(selected.date_published || ''),
          loaders: Array.isArray(selected.loaders) ? selected.loaders : [],
          gameVersions: Array.isArray(selected.game_versions) ? selected.game_versions : [],
          fileName: safeJarName(fileEntry.filename),
          libraryPath: targetLibraryPath,
          sha1: expectedSha1,
          dependencies,
          updatedAt: new Date().toISOString()
        }
      }
    };
    recordDecision(state, downloadResult.downloaded ? 'downloaded-version' : 'reused-download', {
      projectId,
      title: project.title || projectId,
      minecraftVersion,
      selectedVersionId: selected.id,
      selectedVersionNumber: selected.version_number,
      libraryPath: targetLibraryPath,
      dependencies: dependencies.map((entry) => entry.projectId)
    });

    return state.projects[projectId];
  }

  async function resolveRequiredDependencies(versionEntry, minecraftVersion, modContext, state, options = {}) {
    const dependencyEntries = [];
    const dependencies = Array.isArray(versionEntry?.dependencies) ? versionEntry.dependencies : [];
    const visited = options.visited instanceof Set ? options.visited : new Set();
    const parentProjectId = String(options.parentProjectId || '').trim();
    if (parentProjectId) {
      visited.add(parentProjectId);
    }

    for (const dependency of dependencies) {
      if (String(dependency?.dependency_type || '').toLowerCase() !== 'required') {
        continue;
      }

      let dependencyProjectId = String(dependency.project_id || '').trim();
      if (!dependencyProjectId && dependency.version_id) {
        try {
          const dependencyVersion = await fetchVersion(dependency.version_id, options);
          dependencyProjectId = String(dependencyVersion?.project_id || '').trim();
        } catch (error) {
          warn('Dependency version lookup failed', { dependency, error: serializeError(error) });
        }
      }
      dependencyProjectId = aliasMap.get(normalizeId(dependencyProjectId)) || dependencyProjectId;
      if (!dependencyProjectId || visited.has(dependencyProjectId)) {
        continue;
      }

      visited.add(dependencyProjectId);
      debug('Installing dependency', {
        parentProjectId,
        dependencyProjectId,
        minecraftVersion,
        dependencyType: dependency.dependency_type
      });
      try {
        await ensureProjectInstalled(dependencyProjectId, minecraftVersion, modContext, state, {
          ...options,
          visited,
          forceRefresh: options.forceRefresh,
          parentProjectId: dependencyProjectId
        });
        dependencyEntries.push({
          projectId: dependencyProjectId,
          versionId: String(dependency.version_id || ''),
          dependencyType: 'required'
        });
        recordDecision(state, 'installed-dependency', { parentProjectId, dependencyProjectId, minecraftVersion });
      } catch (error) {
        state.autoDisabledProjects = uniqueStrings([...(state.autoDisabledProjects || []), dependencyProjectId]);
        state.disabledProjectReasons[dependencyProjectId] = {
          reason: error.message,
          checkedAt: new Date().toISOString()
        };
        throw new Error(`Abhaengigkeit ${dependencyProjectId} konnte nicht installiert werden: ${error.message}`);
      }
    }

    return dependencyEntries;
  }

  function cleanupDuplicateManagedEntries(modContext, state, minecraftVersion, activeFiles, warnings) {
    const byProject = new Map();
    for (const entry of activeFiles) {
      if (!entry || !entry.projectId) continue;
      byProject.set(entry.projectId, (byProject.get(entry.projectId) || []).concat(entry));
    }

    const resultFiles = activeFiles.slice();

    for (const [projectId, files] of byProject.entries()) {
      if (!projectId || files.length <= 1) continue;
      const versionEntry = state.projects?.[projectId]?.versions?.[minecraftVersion] || {};
      const desiredSha1 = String(versionEntry.sha1 || '').toLowerCase();

      let preferred = null;
      // Prefer the canonical libraryPath if it exists and matches
      if (versionEntry.libraryPath && fsModule.existsSync(versionEntry.libraryPath) && (!desiredSha1 || verifyHash(versionEntry.libraryPath, desiredSha1))) {
        preferred = files.find((f) => normalizePath(f.libraryPath || '') === normalizePath(versionEntry.libraryPath) || normalizePath(f.targetPath) === normalizePath(versionEntry.libraryPath)) || null;
      }
      if (!preferred) {
        preferred = files.find((f) => f.libraryPath && fsModule.existsSync(f.libraryPath) && (!desiredSha1 || verifyHash(f.libraryPath, desiredSha1))) || files[0];
      }

      for (const f of files) {
        if (f === preferred) continue;
        try {
          if (f.targetPath && fsModule.existsSync(f.targetPath)) {
            movePreserving(f.targetPath, getRemovedDir(modContext));
            recordDecision(state, 'removed-duplicate-managed-file', { projectId, path: f.targetPath });
            warnings.push(`${f.fileName}: Duplikat fuer ${projectId} entfernt.`);
          }
        } catch (err) {
          warn('Failed to remove duplicate managed file', { projectId, path: f.targetPath, error: serializeError(err) });
        }
        const idx = resultFiles.findIndex((e) => normalizePath(e.targetPath) === normalizePath(f.targetPath));
        if (idx !== -1) resultFiles.splice(idx, 1);
      }

      // Also remove disabled copies that clearly match this project's selected version
      try {
        const disabledDir = getDisabledDir(modContext);
        for (const fileName of listJarFiles(disabledDir)) {
          const fullPath = pathModule.join(disabledDir, fileName);
          const lowerName = String(fileName || '').toLowerCase();
          if (String(versionEntry.fileName || '').toLowerCase() === lowerName || (desiredSha1 && verifyHash(fullPath, desiredSha1))) {
            movePreserving(fullPath, getRemovedDir(modContext));
            recordDecision(state, 'removed-duplicate-disabled-file', { projectId, path: fullPath });
            warnings.push(`${fileName}: Duplikat im versteckten Ordner fuer ${projectId} entfernt.`);
          }
        }
      } catch (err) {
        warn('Failed to scan disabled dir for duplicates', { error: serializeError(err) });
      }
    }

    return resultFiles;
  }

  function ensureRequiredBundled(modContext, minecraftVersion, state, warnings) {
    ensureDir(modContext.modsDir);
    for (const requiredMod of requiredBundledMods) {
      const assetPath = requiredMod?.assetPathByMinecraftVersion?.[minecraftVersion] || requiredMod?.assetPath || '';
      const fileName = requiredMod?.fileNameByMinecraftVersion?.[minecraftVersion] || requiredMod?.fileName || pathModule.basename(assetPath);
      if (!assetPath || !fileName) {
        warnings.push(`${requiredMod?.title || requiredMod?.projectId || 'Pflichtmod'}: Keine gebuendelte Version fuer ${minecraftVersion}.`);
        continue;
      }
      const targetPath = pathModule.join(modContext.modsDir, safeJarName(fileName));
      if (!isInside(modContext.modsDir, targetPath)) {
        warnings.push(`${fileName}: Zielpfad ist nicht sicher.`);
        continue;
      }
      try {
        if (!fsModule.existsSync(assetPath)) {
          warnings.push(`${fileName}: Pflichtmod-Asset fehlt.`);
          continue;
        }
        const needsCopy = !fsModule.existsSync(targetPath) || hashFile(assetPath) !== hashFile(targetPath);
        if (needsCopy) {
          fsModule.copyFileSync(assetPath, targetPath);
          debug('Bundled required mod repaired', {
            modName: requiredMod.title || requiredMod.projectId,
            minecraftVersion,
            source: assetPath,
            targetPath
          });
        }
        const projectId = String(requiredMod.projectId || fileName).trim();
        state.projects[projectId] = {
          ...(state.projects[projectId] || {}),
          projectId,
          slug: requiredMod.slug || '',
          title: requiredMod.title || projectId,
          description: requiredMod.description || '',
          iconUrl: '',
          bundled: true,
          showInModsTab: Boolean(requiredMod.showInModsTab),
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
              fileName: safeJarName(fileName),
              libraryPath: targetPath,
              sha1: hashFile(targetPath),
              bundled: true,
              updatedAt: new Date().toISOString()
            }
          }
        };
        state.disabledProjects = (state.disabledProjects || []).filter((entry) => entry !== projectId);
        state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((entry) => entry !== projectId);
        delete state.disabledProjectReasons[projectId];
      } catch (error) {
        warnings.push(`${fileName}: Pflichtmod konnte nicht repariert werden (${error.message}).`);
      }
    }
  }

  async function ensureRequiredManaged(modContext, minecraftVersion, state, warnings, options = {}) {
    for (const projectId of requiredManagedSet) {
      if (!projectId) {
        continue;
      }
      state.disabledProjects = (state.disabledProjects || []).filter((entry) => entry !== projectId);
      const currentVersion = state.projects?.[projectId]?.versions?.[minecraftVersion];
      const hasReusableVersion = currentVersion?.libraryPath
        && fsModule.existsSync(currentVersion.libraryPath)
        && verifyHash(currentVersion.libraryPath, currentVersion.sha1)
        && !isCompatibilityCacheExpired(state, projectId, minecraftVersion);
      if (hasReusableVersion && !options.forceRefresh) {
        state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((entry) => entry !== projectId);
        delete state.disabledProjectReasons[projectId];
        continue;
      }
      try {
        await ensureProjectInstalled(projectId, minecraftVersion, modContext, state, options);
      } catch (error) {
        warnings.push(`${projectId}: ${error.message}`);
      }
    }
  }

  function copyManagedFiles(modContext, minecraftVersion, state, warnings) {
    ensureDir(modContext.modsDir);
    const previousFiles = Array.isArray(state.activeSync?.files) ? state.activeSync.files : [];
    let activeFiles = [];
    const reservedNames = new Set(
      listJarFiles(modContext.modsDir)
        .filter((fileName) => !previousFiles.some((entry) => normalizePath(entry.targetPath) === normalizePath(pathModule.join(modContext.modsDir, fileName))))
        .map((fileName) => fileName.toLowerCase())
    );

    for (const [projectId, project] of Object.entries(state.projects || {})) {
      if ((state.disabledProjects || []).includes(projectId) && !isProtectedProject(projectId, project)) {
        continue;
      }

      const versionEntry = project?.versions?.[minecraftVersion];
      if (!versionEntry?.libraryPath || !fsModule.existsSync(versionEntry.libraryPath)) {
        if (isProtectedProject(projectId, project)) {
          warnings.push(`${project.title || projectId}: Pflichtmod-Datei fehlt und konnte nicht geladen werden.`);
        }
        continue;
      }
      if (!verifyHash(versionEntry.libraryPath, versionEntry.sha1)) {
        warnings.push(`${project.title || projectId}: Lokale Datei ist beschädigt.`);
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
      if (!isInside(modContext.modsDir, targetPath)) {
        warnings.push(`${targetName}: Zielpfad ist nicht sicher.`);
        continue;
      }
      try {
        const needsCopy = !fsModule.existsSync(targetPath)
          || (versionEntry.sha1 && !verifyHash(targetPath, versionEntry.sha1));
        if (needsCopy) {
          fsModule.copyFileSync(versionEntry.libraryPath, targetPath);
        }
        reservedNames.add(targetName.toLowerCase());
        activeFiles.push({
          projectId,
          fileName: targetName,
          targetPath,
          libraryPath: versionEntry.libraryPath,
          minecraftVersion
        });
      } catch (error) {
        warnings.push(`${project.title || projectId}: Konnte nicht in den Mods-Ordner kopiert werden (${error.message}).`);
      }
    }
    // Clean up duplicates among managed entries and on-disk disabled copies
    try {
      activeFiles = cleanupDuplicateManagedEntries(modContext, state, minecraftVersion, activeFiles, warnings);
    } catch (err) {
      warn('Duplicate cleanup failed', { error: serializeError(err) });
    }

    const activePaths = new Set(activeFiles.map((entry) => normalizePath(entry.targetPath)));
    for (const previous of previousFiles) {
      if (!previous?.targetPath || activePaths.has(normalizePath(previous.targetPath)) || !fsModule.existsSync(previous.targetPath)) {
        continue;
      }
      movePreserving(previous.targetPath, getRemovedDir(modContext));
    }
    state.activeSync = { minecraftVersion, files: activeFiles };
    return activeFiles;
  }

  async function syncManagedModsForVersion(versionId = getEffectiveSelectedVersionId(), options = {}) {
    const modContext = options.modContext || getActiveModContext(versionId);
    const minecraftVersion = String(modContext?.minecraftVersion || '').trim();
    if (!minecraftVersion) {
      return { synced: 0, totalProjects: 0, files: [], warnings: ['Keine Minecraft-Version ausgewaehlt.'] };
    }

    const syncKey = `${modContext.stateFile || stateFile}:${minecraftVersion}:${Boolean(options.refreshAll)}:${[...(options.refreshProjects || [])].join(',')}`;
    if (pendingSyncs.has(syncKey)) {
      return pendingSyncs.get(syncKey);
    }

    const promise = (async () => {
      ensureDir(modContext.modsDir);
      ensureDir(modContext.resourcepacksDir || resourcepacksDir);
      ensureDir(modContext.shaderpacksDir || shaderpacksDir);
      ensureDir(getLibraryDir(modContext));
      ensureDir(getDisabledDir(modContext));
      const state = readState(modContext);
      const warnings = [];

      debug('Sync started', {
        minecraftVersion,
        versionId,
        context: modContext.name || modContext.type || 'standard',
        refreshAll: Boolean(options.refreshAll)
      });

      ensureRequiredBundled(modContext, minecraftVersion, state, warnings);
      await ensureRequiredManaged(modContext, minecraftVersion, state, warnings, {
        forceRefresh: Boolean(options.refreshAll),
        visited: new Set()
      });

      const refreshProjects = options.refreshProjects instanceof Set ? options.refreshProjects : new Set();
      for (const [projectId, project] of Object.entries({ ...(state.projects || {}) })) {
        if (isBundledProject(project) || requiredManagedSet.has(projectId)) {
          continue;
        }
        if ((state.disabledProjects || []).includes(projectId) && !options.refreshDisabledProjects) {
          continue;
        }
        const versionEntry = project?.versions?.[minecraftVersion];
        const stale = !versionEntry
          || !versionEntry.libraryPath
          || !fsModule.existsSync(versionEntry.libraryPath)
          || !verifyHash(versionEntry.libraryPath, versionEntry.sha1)
          || options.refreshAll
          || refreshProjects.has(projectId)
          || isCompatibilityCacheExpired(state, projectId, minecraftVersion);
        if (!stale) {
          continue;
        }
        try {
          await ensureProjectInstalled(projectId, minecraftVersion, modContext, state, {
            forceRefresh: Boolean(options.refreshAll || refreshProjects.has(projectId)),
            visited: new Set()
          });
        } catch (error) {
          warnings.push(`${project.title || projectId}: ${error.message}`);
        }
      }

      state.lastChecks[`${modContext.type || 'standard'}:${minecraftVersion}`] = new Date().toISOString();
      const files = copyManagedFiles(modContext, minecraftVersion, state, warnings);
      writeState(state, modContext);

      debug('Sync finished', {
        minecraftVersion,
        synced: files.length,
        warnings,
        autoDisabledProjects: state.autoDisabledProjects || []
      });

      return {
        synced: files.length,
        totalProjects: Object.keys(state.projects || {}).length,
        files,
        autoDisabledProjects: uniqueStrings(state.autoDisabledProjects),
        disabledProjects: uniqueStrings([...(state.disabledProjects || []), ...(state.autoDisabledProjects || [])]),
        warnings: uniqueStrings(warnings)
      };
    })().finally(() => pendingSyncs.delete(syncKey));

    pendingSyncs.set(syncKey, promise);
    return promise;
  }

  async function installModrinthMod(projectReference, target = {}) {
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
      return { success: false, error: 'Bitte waehle zuerst eine Fabric-Version aus.' };
    }

    const state = readState(modContext);
    try {
      await ensureProjectInstalled(projectReference, minecraftVersion, modContext, state, {
        forceRefresh: true,
        visited: new Set()
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
          : `${title} wurde fuer Fabric ${minecraftVersion} installiert.`,
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
      message: `${project.title || projectId} wurde fuer ${getCurrentMinecraftVersion()} aktualisiert.`,
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
        ? `${updated}/${total} Eintraege wurden geprueft.`
        : 'Noch keine Modrinth-Mods oder Ressourcenpakete im Launcher installiert.'
    };
  }

  async function getInstalledManagedModProjectIds(versionId = getEffectiveSelectedVersionId(), options = {}) {
    const modContext = options.modContext || getActiveModContext(versionId);
    if (options.sync !== false) {
      await syncManagedModsForVersion(modContext.versionId || versionId, { modContext });
    }
    const state = readState(modContext);
    return Object.keys(state.projects || {})
      .filter((projectId) => !isHiddenProject(projectId, state.projects[projectId]));
  }

  async function getInstalledMods(versionId = getEffectiveSelectedVersionId(), options = {}) {
    const modContext = getActiveModContext(versionId);
    if (!options.skipManagedSync) {
      await syncManagedModsForVersion(versionId, { modContext });
    }

    ensureDir(modContext.modsDir);
    ensureDir(getDisabledDir(modContext));
    const minecraftVersion = String(modContext.minecraftVersion || '').trim();
    const state = readState(modContext);
    const managedByPath = new Map((state.activeSync?.files || []).map((entry) => [normalizePath(entry.targetPath), entry]));
    const mods = [];

    for (const fileName of listJarFiles(modContext.modsDir)) {
      const fullPath = pathModule.join(modContext.modsDir, fileName);
      const managed = managedByPath.get(normalizePath(fullPath));
      if (managed) {
        mods.push(createManagedListEntry(managed.projectId, fullPath, fileName, true, state, minecraftVersion));
      } else {
        mods.push(createLocalListEntry(fullPath, fileName, true, state, minecraftVersion));
      }
    }

    for (const fileName of listJarFiles(getDisabledDir(modContext))) {
      const fullPath = pathModule.join(getDisabledDir(modContext), fileName);
      mods.push(createLocalListEntry(fullPath, fileName, false, state, minecraftVersion));
    }

    for (const projectId of uniqueStrings([...(state.disabledProjects || []), ...(state.autoDisabledProjects || [])])) {
      if (mods.some((entry) => entry.projectId === projectId)) {
        continue;
      }
      const project = state.projects[projectId];
      if (!project || isHiddenProject(projectId, project)) {
        continue;
      }
      const versionEntry = project.versions?.[minecraftVersion] || {};
      mods.push({
        id: `project:${projectId}`,
        projectId,
        slug: project.slug || '',
        name: project.title || projectId,
        description: project.description || '',
        iconUrl: project.iconUrl || '',
        isProtected: isProtectedProject(projectId, project),
        canDisable: !isProtectedProject(projectId, project),
        path: versionEntry.libraryPath || '',
        size: getFileSize(versionEntry.libraryPath),
        enabled: false,
        autoDisabled: (state.autoDisabledProjects || []).includes(projectId),
        disabledReason: state.disabledProjectReasons?.[projectId]?.reason || `Keine passende stabile Fabric-Version fuer Minecraft ${minecraftVersion} gefunden.`,
        managed: true,
        source: 'modrinth',
        sourceLabel: isHiddenProject(projectId, project) ? 'Pflichtmod' : 'Modrinth',
        hiddenInModsTab: isHiddenProject(projectId, project),
        fileName: versionEntry.fileName || '',
        minecraftVersion,
        versionName: versionEntry.versionName || '',
        versionNumber: versionEntry.versionNumber || '',
        lastUpdated: versionEntry.updatedAt || new Date().toISOString()
      });
    }

    if (getInstalledDownloadableModrinthEntries) {
      mods.push(...await getInstalledDownloadableModrinthEntries(modContext));
    } else {
      mods.push(...listDownloadableFiles(modContext.resourcepacksDir || resourcepacksDir, 'resourcepack'));
      mods.push(...listDownloadableFiles(modContext.shaderpacksDir || shaderpacksDir, 'shader'));
    }

    return mods.sort(sortMods);
  }

  async function setInstalledModEnabled(modId, enabled) {
    const modContext = getActiveModContext();
    const state = readState(modContext);
    const projectId = parseProjectModId(modId);
    if (projectId) {
      const project = state.projects[projectId];
      if (isProtectedProject(projectId, project)) {
        return { success: false, error: 'Diese Pflichtmod muss immer aktiv bleiben.' };
      }
      state.disabledProjects = enabled
        ? (state.disabledProjects || []).filter((entry) => entry !== projectId)
        : uniqueStrings([...(state.disabledProjects || []), projectId]);
      if (enabled) {
        state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((entry) => entry !== projectId);
        delete state.disabledProjectReasons[projectId];
      }
      recordDecision(state, enabled ? 'enabled-project' : 'disabled-project', { projectId });
      writeState(state, modContext);
      const syncResult = await syncManagedModsForVersion(modContext.versionId, { modContext });
      return {
        success: true,
        warning: formatManagedModsWarning(syncResult.warnings),
        message: `${project?.title || projectId} wurde ${enabled ? 'eingeschaltet' : 'ausgeschaltet'}.`,
        mods: await getInstalledMods(modContext.versionId)
      };
    }

    const filePath = parseFileModId(modId);
    if (!filePath || !fsModule.existsSync(filePath)) {
      return { success: false, error: 'Mod-Datei wurde nicht gefunden.' };
    }
    const fileName = pathModule.basename(filePath);
    if (isRequiredFileName(fileName)) {
      return { success: false, error: 'Diese Pflichtmod muss immer aktiv bleiben.' };
    }
    const targetDir = enabled ? modContext.modsDir : getDisabledDir(modContext);
    ensureDir(targetDir);
    const targetPath = uniquePath(pathModule.join(targetDir, fileName));
    fsModule.renameSync(filePath, targetPath);
    return {
      success: true,
      message: `${fileName} wurde ${enabled ? 'eingeschaltet' : 'ausgeschaltet'}.`,
      mods: await getInstalledMods(modContext.versionId)
    };
  }

  async function removeInstalledMod(modId) {
    const modContext = getActiveModContext();
    const state = readState(modContext);
    const projectId = parseProjectModId(modId);
    if (projectId) {
      const project = state.projects[projectId];
      if (isProtectedProject(projectId, project)) {
        return { success: false, error: 'Diese Pflichtmod ist erforderlich und kann nicht entfernt werden.' };
      }
      const previousFiles = Array.isArray(state.activeSync?.files) ? state.activeSync.files : [];
      for (const entry of previousFiles.filter((item) => item.projectId === projectId)) {
        if (entry.targetPath && fsModule.existsSync(entry.targetPath)) {
          movePreserving(entry.targetPath, getRemovedDir(modContext));
        }
      }
      delete state.projects[projectId];
      state.disabledProjects = (state.disabledProjects || []).filter((entry) => entry !== projectId);
      state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((entry) => entry !== projectId);
      delete state.disabledProjectReasons[projectId];
      state.activeSync.files = previousFiles.filter((entry) => entry.projectId !== projectId);
      recordDecision(state, 'removed-project-preserved-files', { projectId });
      writeState(state, modContext);
      const syncResult = await syncManagedModsForVersion(modContext.versionId, { modContext });
      return {
        success: true,
        warning: formatManagedModsWarning(syncResult.warnings),
        message: `${project?.title || projectId} wurde aus der Verwaltung entfernt. Dateien wurden gesichert, nicht geloescht.`,
        mods: await getInstalledMods(modContext.versionId)
      };
    }

    const filePath = parseFileModId(modId);
    if (!filePath || !fsModule.existsSync(filePath)) {
      return { success: false, error: 'Mod-Datei wurde nicht gefunden.' };
    }
    const fileName = pathModule.basename(filePath);
    if (isRequiredFileName(fileName)) {
      return { success: false, error: 'Diese Pflichtmod ist erforderlich und kann nicht entfernt werden.' };
    }
    movePreserving(filePath, getRemovedDir(modContext));
    return {
      success: true,
      message: `${fileName} wurde aus der Liste entfernt und gesichert.`,
      mods: await getInstalledMods(modContext.versionId)
    };
  }

  async function importDroppedMods(filePaths, options = {}) {
    const normalized = uniqueStrings(Array.isArray(filePaths) ? filePaths : [filePaths])
      .map((entry) => pathModule.normalize(String(entry || '').trim()))
      .filter((entry) => entry && pathModule.isAbsolute(entry));
    if (!normalized.length) {
      return { success: false, error: 'Keine gueltige JAR-Datei erkannt.' };
    }

    const modContext = getActiveModContext();
    const minecraftVersion = String(modContext.minecraftVersion || '').trim();
    const state = readState(modContext);
    const imported = [];
    const rejected = [];
    for (const filePath of normalized) {
      const fileName = pathModule.basename(filePath);
      if (!fsModule.existsSync(filePath) || !fileName.toLowerCase().endsWith('.jar')) {
        rejected.push(`${fileName}: Nur vorhandene JAR-Dateien können importiert werden.`);
        continue;
      }
      try {
        const sha1 = hashFile(filePath);
        let versionEntry = null;
        try {
          versionEntry = await fetchVersionByHash(sha1);
        } catch (_error) {
          versionEntry = null;
        }
        if (versionEntry?.project_id) {
          await ensureProjectInstalled(versionEntry.project_id, minecraftVersion, modContext, state, {
            forceRefresh: true,
            visited: new Set()
          });
          imported.push(fileName);
          continue;
        }

        const targetDir = options?.requireManualApproval === false ? modContext.modsDir : getDisabledDir(modContext);
        ensureDir(targetDir);
        const targetPath = uniquePath(pathModule.join(targetDir, fileName));
        fsModule.copyFileSync(filePath, targetPath);
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
      total: normalized.length,
      warning: formatManagedModsWarning([...rejected, ...(syncResult.warnings || [])]),
      rejected,
      message: `${imported.length} Mod${imported.length === 1 ? '' : 's'} importiert.`,
      mods: await getInstalledMods(modContext.versionId)
    };
  }

  function formatManagedModsWarning(warnings) {
    const items = uniqueStrings(warnings).filter(Boolean);
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
      throw new Error(`Minecraft kann nicht gestartet werden, weil ${autoDisabled.length} Mod${autoDisabled.length === 1 ? '' : 's'} keine kompatible stabile Fabric-Version fuer ${minecraftVersion} hat: ${autoDisabled.join(', ')}`);
    }
    const activeProjects = new Set((syncResult?.files || []).map((entry) => entry.projectId));
    for (const projectId of requiredManagedSet) {
      if (!activeProjects.has(projectId)) {
        throw new Error(`Minecraft kann nicht gestartet werden, weil Pflichtmod ${projectId} nicht aktiv ist.`);
      }
    }
    for (const requiredMod of requiredBundledMods) {
      const projectId = String(requiredMod?.projectId || '').trim();
      if (projectId && !activeProjects.has(projectId)) {
        throw new Error(`Minecraft kann nicht gestartet werden, weil Pflichtmod ${requiredMod.title || projectId} nicht aktiv ist.`);
      }
    }
  }

  function isProtectedProject(projectId, project = null) {
    return protectedProjectSet.has(projectId)
      || requiredManagedSet.has(projectId)
      || Boolean(project?.bundled)
      || requiredBundledMods.some((entry) => String(entry?.projectId || '') === projectId);
  }

  function isHiddenProject(projectId, project = null) {
    if (project?.showInModsTab === true) {
      return false;
    }
    const slug = normalizeId(project?.slug || '');
    return hiddenProjectSet.has(projectId) || hiddenSlugSet.has(slug);
  }

  function isBundledProject(project) {
    return Boolean(project?.bundled);
  }

  function isRequiredFileName(fileName) {
    const lower = String(fileName || '').toLowerCase();
    return requiredBundledMods.some((entry) => {
      const names = [
        entry?.fileName,
        ...Object.values(entry?.fileNameByMinecraftVersion || {})
      ].filter(Boolean).map((item) => String(item).toLowerCase());
      return names.includes(lower);
    });
  }

  function createManagedListEntry(projectId, fullPath, fileName, enabled, state, minecraftVersion) {
    const project = state.projects?.[projectId] || {};
    const versionEntry = project.versions?.[minecraftVersion] || {};
    const hidden = isHiddenProject(projectId, project);
    return {
      id: `project:${projectId}`,
      projectId,
      slug: project.slug || '',
      name: project.title || fileName.replace(/\.jar$/i, ''),
      description: project.description || '',
      iconUrl: project.iconUrl || '',
      isProtected: isProtectedProject(projectId, project),
      canDisable: !isProtectedProject(projectId, project),
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

  function createLocalListEntry(fullPath, fileName, enabled, state, minecraftVersion) {
    const hidden = isRequiredFileName(fileName);
    return {
      id: `file:${fullPath}`,
      projectId: '',
      slug: '',
      name: fileName.replace(/\.jar$/i, ''),
      description: '',
      iconUrl: '',
      isProtected: hidden,
      canDisable: !hidden,
      path: fullPath,
      size: getFileSize(fullPath),
      enabled,
      autoDisabled: false,
      disabledReason: enabled ? '' : 'Ausgeschaltet.',
      managed: false,
      source: 'manual',
      sourceLabel: hidden ? 'Pflichtmod' : 'Manuell',
      hiddenInModsTab: hidden,
      fileName,
      minecraftVersion,
      versionName: '',
      versionNumber: '',
      lastUpdated: getFileMtime(fullPath)
    };
  }

  function listDownloadableFiles(dir, itemType) {
    if (!dir || !fsModule.existsSync(dir)) {
      return [];
    }
    const extension = itemType === 'resourcepack' ? '.zip' : '.zip';
    return fsModule.readdirSync(dir)
      .filter((fileName) => fileName.toLowerCase().endsWith(extension))
      .map((fileName) => {
        const fullPath = pathModule.join(dir, fileName);
        return {
          id: `file:${fullPath}`,
          projectId: '',
          slug: '',
          name: fileName.replace(/\.zip$/i, ''),
          description: '',
          iconUrl: '',
          isProtected: false,
          canDisable: false,
          path: fullPath,
          size: getFileSize(fullPath),
          enabled: true,
          managed: false,
          source: 'manual',
          sourceLabel: itemType === 'shader' ? 'Shader' : 'Ressourcenpaket',
          hiddenInModsTab: false,
          fileName,
          itemType,
          lastUpdated: getFileMtime(fullPath)
        };
      });
  }

  return {
    syncManagedModsForVersion,
    installModrinthMod,
    refreshInstalledMod,
    updateAllManagedMods,
    getInstalledManagedModProjectIds,
    getInstalledMods,
    setInstalledModEnabled,
    removeInstalledMod,
    importDroppedMods,
    formatManagedModsWarning,
    formatManagedModsLaunchMessage,
    assertLaunchRequiredModsSynced,
    readState,
    writeState
  };
}

function createMissingVersionError(message) {
  const error = new Error(message);
  error.code = 'NO_COMPATIBLE_MODRINTH_VERSION';
  return error;
}

function normalizeSet(values) {
  return new Set((Array.isArray(values) ? values : [...(values || [])])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean));
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean))];
}

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePath(value) {
  return path.resolve(String(value || '')).toLowerCase();
}

function listJarFiles(dir) {
  if (!dir || !fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir).filter((fileName) => fileName.toLowerCase().endsWith('.jar'));
}

function getFileSize(file) {
  try {
    return file && fs.existsSync(file) ? fs.statSync(file).size : 0;
  } catch (_error) {
    return 0;
  }
}

function getFileMtime(file) {
  try {
    return file && fs.existsSync(file) ? fs.statSync(file).mtime.toISOString() : new Date().toISOString();
  } catch (_error) {
    return new Date().toISOString();
  }
}

function allocateName(fileName, reservedLowerNames) {
  const parsed = path.parse(fileName);
  let candidate = fileName;
  let index = 2;
  while (reservedLowerNames.has(candidate.toLowerCase())) {
    candidate = `${parsed.name}-${index}${parsed.ext || '.jar'}`;
    index += 1;
  }
  return candidate;
}

function uniquePath(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return targetPath;
  }
  const parsed = path.parse(targetPath);
  let index = 2;
  let candidate = targetPath;
  while (fs.existsSync(candidate)) {
    candidate = path.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

function tryUnlink(file) {
  try {
    if (file && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch (_error) {
    // best effort cleanup
  }
}

function movePreserving(filePath, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const targetPath = uniquePath(path.join(targetDir, path.basename(filePath)));
  try {
    fs.renameSync(filePath, targetPath);
  } catch (_error) {
    fs.copyFileSync(filePath, targetPath);
    tryUnlink(filePath);
  }
  return targetPath;
}

function parseProjectModId(modId) {
  const value = String(modId || '').trim();
  return value.startsWith('project:') ? value.slice('project:'.length).trim() : '';
}

function parseFileModId(modId) {
  const value = String(modId || '').trim();
  return value.startsWith('file:') ? value.slice('file:'.length).trim() : '';
}

function isCompatibilityCacheExpired(state, projectId, minecraftVersion) {
  const project = state.projects?.[projectId];
  const updatedAt = project?.versions?.[minecraftVersion]?.updatedAt || '';
  if (!updatedAt) {
    return true;
  }
  return Date.now() - (Date.parse(updatedAt) || 0) > COMPAT_CACHE_TTL_MS;
}

function sortMods(left, right) {
  const typeOrder = { mod: 0, resourcepack: 1, shader: 2 };
  const typeDiff = (typeOrder[left.itemType || 'mod'] ?? 9) - (typeOrder[right.itemType || 'mod'] ?? 9);
  if (typeDiff !== 0) {
    return typeDiff;
  }
  if (left.enabled !== right.enabled) {
    return left.enabled ? -1 : 1;
  }
  if (left.managed !== right.managed) {
    return left.managed ? -1 : 1;
  }
  return String(left.name || '').localeCompare(String(right.name || ''), 'de', { sensitivity: 'base' });
}

module.exports = createModsEngine;
