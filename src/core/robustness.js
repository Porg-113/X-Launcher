const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_LOG_BYTES = 5 * 1024 * 1024;

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function sanitizeFileName(value, fallback = 'item') {
  const normalized = String(value || '')
    .replace(/^[A-Za-z]:/u, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/gu, '_')
    .replace(/\s+/gu, '_')
    .replace(/\.+$/gu, '')
    .slice(0, 160);
  return normalized || fallback;
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/gu, '-');
}

function serializeError(error) {
  if (!error) {
    return { message: 'Unknown error' };
  }

  return {
    name: String(error.name || 'Error'),
    message: String(error.message || error),
    code: error.code ? String(error.code) : '',
    stack: error.stack ? String(error.stack) : ''
  };
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return JSON.stringify({ unserializable: true });
  }
}

function createLogger({ logDir, debug = false, maxLogBytes = DEFAULT_MAX_LOG_BYTES } = {}) {
  if (!logDir) {
    throw new Error('logDir is required');
  }

  ensureDir(logDir);
  let debugEnabled = Boolean(debug);

  const getLogFilePath = () => path.join(logDir, `launcher-${new Date().toISOString().slice(0, 10)}.log`);

  const rotateIfNeeded = (filePath) => {
    try {
      if (!fs.existsSync(filePath) || fs.statSync(filePath).size < maxLogBytes) {
        return;
      }

      const rotatedPath = `${filePath}.${timestampForFile()}`;
      fs.renameSync(filePath, rotatedPath);
    } catch (error) {
      console.warn('Could not rotate launcher log:', error.message);
    }
  };

  const write = (level, message, context = {}) => {
    if (level === 'debug' && !debugEnabled) {
      return;
    }

    const entry = {
      ts: new Date().toISOString(),
      level,
      message: String(message || ''),
      context
    };

    try {
      ensureDir(logDir);
      const logFilePath = getLogFilePath();
      rotateIfNeeded(logFilePath);
      fs.appendFileSync(logFilePath, `${safeJsonStringify(entry)}\n`, 'utf8');
    } catch (error) {
      console.warn('Could not write launcher log:', error.message);
    }

    const consoleMethod = level === 'error'
      ? 'error'
      : level === 'warn'
        ? 'warn'
        : 'log';
    console[consoleMethod](`[${level}] ${message}`, context);
  };

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
    getLogFilePath,
    isDebugEnabled: () => debugEnabled,
    setDebugEnabled: (enabled) => {
      debugEnabled = Boolean(enabled);
      write('info', `Debug mode ${debugEnabled ? 'enabled' : 'disabled'}`);
    }
  };
}

function createRobustness({ configDir, debug = false } = {}) {
  if (!configDir) {
    throw new Error('configDir is required');
  }

  const logDir = path.join(configDir, 'logs');
  const backupDir = path.join(configDir, 'backups');
  const auditDir = path.join(configDir, 'audit');
  ensureDir(configDir);
  ensureDir(logDir);
  ensureDir(backupDir);
  ensureDir(auditDir);

  const logger = createLogger({ logDir, debug });

  const getBackupPrefix = (filePath) => sanitizeFileName(path.resolve(filePath), 'file');

  const createFileBackup = (filePath, reason = 'backup', metadata = {}) => {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return '';
    }

    ensureDir(backupDir);
    const backupBaseName = `${getBackupPrefix(resolvedPath)}.${timestampForFile()}`;
    const backupPath = path.join(backupDir, backupBaseName);
    fs.copyFileSync(resolvedPath, backupPath);

    const metaPath = `${backupPath}.meta.json`;
    fs.writeFileSync(metaPath, JSON.stringify({
      sourcePath: resolvedPath,
      reason: String(reason || 'backup'),
      createdAt: new Date().toISOString(),
      metadata
    }, null, 2), 'utf8');

    logger.info('File backup created', {
      sourcePath: resolvedPath,
      backupPath,
      reason
    });
    return backupPath;
  };

  const listBackupsForFile = (filePath) => {
    if (!fs.existsSync(backupDir)) {
      return [];
    }

    const prefix = `${getBackupPrefix(filePath)}.`;
    return fs.readdirSync(backupDir)
      .filter((entry) => entry.startsWith(prefix) && !entry.endsWith('.meta.json'))
      .map((entry) => path.join(backupDir, entry))
      .filter((entryPath) => {
        try {
          return fs.statSync(entryPath).isFile();
        } catch (_error) {
          return false;
        }
      })
      .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  };

  const writeJsonFileAtomic = (filePath, value, options = {}) => {
    const label = String(options.label || path.basename(filePath));
    ensureDir(path.dirname(filePath));

    if (options.backup !== false && fs.existsSync(filePath)) {
      try {
        createFileBackup(filePath, `before-write:${label}`, options.metadata || {});
      } catch (error) {
        logger.warn('Could not create JSON backup before write', {
          label,
          filePath,
          error: serializeError(error)
        });
      }
    }

    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');

    try {
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        fs.renameSync(tempPath, filePath);
      } catch (renameError) {
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch (_cleanupError) {
          // Ignore cleanup errors; the original write failure is more useful.
        }
        throw renameError || error;
      }
    }
  };

  const readJsonFile = (filePath, defaultValue, options = {}) => {
    const label = String(options.label || path.basename(filePath));
    const normalize = typeof options.normalize === 'function' ? options.normalize : (value) => value;

    ensureDir(path.dirname(filePath));
    if (!fs.existsSync(filePath)) {
      const normalizedDefault = normalize(defaultValue);
      writeJsonFileAtomic(filePath, normalizedDefault, {
        label,
        backup: false,
        metadata: { createdDefault: true }
      });
      return normalizedDefault;
    }

    try {
      return normalize(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } catch (error) {
      logger.warn('JSON state is corrupt, attempting self-heal', {
        label,
        filePath,
        error: serializeError(error)
      });

      try {
        createFileBackup(filePath, `corrupt-json:${label}`, { error: serializeError(error) });
      } catch (backupError) {
        logger.warn('Could not backup corrupt JSON state', {
          label,
          filePath,
          error: serializeError(backupError)
        });
      }

      for (const backupPath of listBackupsForFile(filePath)) {
        try {
          const restoredValue = normalize(JSON.parse(fs.readFileSync(backupPath, 'utf8')));
          fs.copyFileSync(backupPath, filePath);
          logger.info('JSON state restored from backup', {
            label,
            filePath,
            backupPath
          });
          return restoredValue;
        } catch (restoreError) {
          logger.warn('JSON backup could not be restored', {
            label,
            backupPath,
            error: serializeError(restoreError)
          });
        }
      }

      const normalizedDefault = normalize(defaultValue);
      writeJsonFileAtomic(filePath, normalizedDefault, {
        label,
        backup: false,
        metadata: { repairedWithDefault: true }
      });
      logger.warn('JSON state repaired with defaults', {
        label,
        filePath
      });
      return normalizedDefault;
    }
  };

  const appendAudit = (name, entry) => {
    ensureDir(auditDir);
    const auditPath = path.join(auditDir, sanitizeFileName(name, 'audit.jsonl'));
    fs.appendFileSync(auditPath, `${safeJsonStringify({
      ts: new Date().toISOString(),
      ...entry
    })}\n`, 'utf8');
    return auditPath;
  };

  return {
    configDir,
    logDir,
    backupDir,
    auditDir,
    logger,
    appendAudit,
    createFileBackup,
    listBackupsForFile,
    readJsonFile,
    writeJsonFileAtomic
  };
}

function assertTrustedHttpsUrl(rawUrl, allowedHosts = []) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ''));
  } catch (_error) {
    throw new Error(`Invalid download URL: ${rawUrl}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`Unsafe download URL protocol: ${parsed.protocol}`);
  }

  const normalizedAllowedHosts = new Set(
    Array.from(allowedHosts || [])
      .map((host) => String(host || '').trim().toLowerCase())
      .filter(Boolean)
  );
  if (normalizedAllowedHosts.size && !normalizedAllowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error(`Untrusted download host: ${parsed.hostname}`);
  }

  return parsed;
}

function hashFile(filePath, algorithm = 'sha1') {
  const hash = crypto.createHash(algorithm);
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function hasZipEndOfCentralDirectory(filePath) {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return false;
    }

    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 22) {
      return false;
    }

    const minimumEndRecordSize = 22;
    const searchStart = Math.max(0, buffer.length - 0xffff - minimumEndRecordSize);
    for (let offset = buffer.length - minimumEndRecordSize; offset >= searchStart; offset -= 1) {
      if (buffer.readUInt32LE(offset) === 0x06054b50) {
        return true;
      }
    }
  } catch (_error) {
    return false;
  }

  return false;
}

function normalizeExpectedHashes(options = {}) {
  const hashes = {
    ...(options.expectedHashes && typeof options.expectedHashes === 'object' ? options.expectedHashes : {})
  };

  if (options.expectedSha1) {
    hashes.sha1 = options.expectedSha1;
  }
  if (options.expectedSha256) {
    hashes.sha256 = options.expectedSha256;
  }
  if (options.expectedSha512) {
    hashes.sha512 = options.expectedSha512;
  }

  return Object.fromEntries(
    Object.entries(hashes)
      .map(([algorithm, value]) => [
        String(algorithm || '').trim().toLowerCase(),
        String(value || '').trim().toLowerCase()
      ])
      .filter(([algorithm, value]) => algorithm && value)
  );
}

function verifyFileIntegrity(filePath, options = {}) {
  const result = {
    ok: false,
    filePath,
    size: 0,
    issues: [],
    hashes: {}
  };

  try {
    if (!filePath || !fs.existsSync(filePath)) {
      result.issues.push('Datei fehlt.');
      return result;
    }

    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      result.issues.push('Pfad ist keine Datei.');
      return result;
    }

    result.size = stats.size;
    if (stats.size <= 0) {
      result.issues.push('Datei ist leer.');
    }

    const expectedSize = Number(options.expectedSize || 0);
    if (expectedSize > 0 && stats.size !== expectedSize) {
      result.issues.push(`Dateigröße stimmt nicht: erwartet ${expectedSize}, erhalten ${stats.size}.`);
    }

    const minBytes = Number(options.minBytes || 0);
    if (minBytes > 0 && stats.size < minBytes) {
      result.issues.push(`Datei ist zu klein: mindestens ${minBytes}, erhalten ${stats.size}.`);
    }

    for (const [algorithm, expectedHash] of Object.entries(normalizeExpectedHashes(options))) {
      try {
        const actualHash = hashFile(filePath, algorithm).toLowerCase();
        result.hashes[algorithm] = actualHash;
        if (actualHash !== expectedHash) {
          result.issues.push(`${algorithm.toUpperCase()} stimmt nicht: erwartet ${expectedHash}, erhalten ${actualHash}.`);
        }
      } catch (error) {
        result.issues.push(`${algorithm.toUpperCase()} konnte nicht gelesen werden: ${error.message}`);
      }
    }

    if (options.requireZipEndRecord && !hasZipEndOfCentralDirectory(filePath)) {
      result.issues.push('ZIP/JAR-Endverzeichnis konnte nicht gelesen werden.');
    }
  } catch (error) {
    result.issues.push(`Integritaetspruefung fehlgeschlagen: ${error.message}`);
  }

  result.ok = result.issues.length === 0;
  return result;
}

module.exports = {
  assertTrustedHttpsUrl,
  createRobustness,
  ensureDir,
  hasZipEndOfCentralDirectory,
  hashFile,
  sanitizeFileName,
  serializeError,
  verifyFileIntegrity
};
