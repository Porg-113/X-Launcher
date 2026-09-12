const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function readNbtString(buffer, state) {
  const length = buffer.readUInt16BE(state.offset);
  state.offset += 2;
  const value = buffer.toString('utf8', state.offset, state.offset + length);
  state.offset += length;
  return value;
}

function readNbtPayload(buffer, state, type) {
  switch (type) {
    case 0: return null;
    case 1: return buffer.readInt8(state.offset++);
    case 2: { const value = buffer.readInt16BE(state.offset); state.offset += 2; return value; }
    case 3: { const value = buffer.readInt32BE(state.offset); state.offset += 4; return value; }
    case 4: { const value = Number(buffer.readBigInt64BE(state.offset)); state.offset += 8; return value; }
    case 5: { const value = buffer.readFloatBE(state.offset); state.offset += 4; return value; }
    case 6: { const value = buffer.readDoubleBE(state.offset); state.offset += 8; return value; }
    case 7: {
      const length = buffer.readInt32BE(state.offset); state.offset += 4;
      const value = buffer.subarray(state.offset, state.offset + length); state.offset += length; return value;
    }
    case 8: return readNbtString(buffer, state);
    case 9: {
      const itemType = buffer.readUInt8(state.offset++);
      const length = buffer.readInt32BE(state.offset); state.offset += 4;
      const values = [];
      for (let index = 0; index < length; index += 1) values.push(readNbtPayload(buffer, state, itemType));
      return values;
    }
    case 10: {
      const value = {};
      while (state.offset < buffer.length) {
        const childType = buffer.readUInt8(state.offset++);
        if (childType === 0) break;
        const name = readNbtString(buffer, state);
        value[name] = readNbtPayload(buffer, state, childType);
      }
      return value;
    }
    case 11: {
      const length = buffer.readInt32BE(state.offset); state.offset += 4;
      const values = [];
      for (let index = 0; index < length; index += 1) { values.push(buffer.readInt32BE(state.offset)); state.offset += 4; }
      return values;
    }
    case 12: {
      const length = buffer.readInt32BE(state.offset); state.offset += 4;
      const values = [];
      for (let index = 0; index < length; index += 1) { values.push(Number(buffer.readBigInt64BE(state.offset))); state.offset += 8; }
      return values;
    }
    default: throw new Error(`Unbekannter NBT-Typ ${type}`);
  }
}

function readNbtFile(filePath) {
  let buffer = fs.readFileSync(filePath);
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) buffer = zlib.gunzipSync(buffer);
  const state = { offset: 0 };
  const rootType = buffer.readUInt8(state.offset++);
  if (rootType !== 10) throw new Error('NBT-Wurzel ist kein Compound.');
  readNbtString(buffer, state);
  return readNbtPayload(buffer, state, rootType);
}

function listWorlds(minecraftDir) {
  const savesDir = path.join(minecraftDir, 'saves');
  if (!fs.existsSync(savesDir)) return [];
  return fs.readdirSync(savesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => {
    const worldDir = path.join(savesDir, entry.name);
    const levelPath = path.join(worldDir, 'level.dat');
    let data = {};
    try { data = readNbtFile(levelPath).Data || {}; } catch (_error) { data = {}; }
    return {
      id: entry.name,
      name: String(data.LevelName || entry.name),
      folder: entry.name,
      lastPlayed: Number(data.LastPlayed || fs.statSync(worldDir).mtimeMs),
      gameVersion: String(data.Version?.Name || ''),
      path: worldDir
    };
  }).sort((left, right) => right.lastPlayed - left.lastPlayed);
}

function listServers(minecraftDir) {
  const filePath = path.join(minecraftDir, 'servers.dat');
  if (!fs.existsSync(filePath)) return [];
  const root = readNbtFile(filePath);
  return (Array.isArray(root.servers) ? root.servers : []).map((server) => ({
    name: String(server.name || server.ip || 'Server'),
    address: String(server.ip || ''),
    iconDataUrl: typeof server.icon === 'string' ? server.icon : '',
    acceptTextures: Boolean(server.acceptTextures)
  })).filter((server) => server.address);
}

function listProfilesAndVersions(minecraftDir) {
  let profiles = [];
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(minecraftDir, 'launcher_profiles.json'), 'utf8'));
    profiles = Object.entries(raw.profiles || {}).map(([id, profile]) => ({
      id,
      name: String(profile.name || id),
      versionId: String(profile.lastVersionId || 'latest-release'),
      gameDir: String(profile.gameDir || minecraftDir),
      type: String(profile.type || 'custom')
    }));
  } catch (_error) { profiles = []; }
  const versionsDir = path.join(minecraftDir, 'versions');
  const versions = fs.existsSync(versionsDir)
    ? fs.readdirSync(versionsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => {
        const jsonPath = path.join(versionsDir, entry.name, `${entry.name}.json`);
        if (!fs.existsSync(jsonPath)) return false;
        try {
          const metadata = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          return Boolean(metadata.inheritsFrom || fs.existsSync(path.join(versionsDir, entry.name, `${entry.name}.jar`)));
        } catch (_error) {
          return false;
        }
      })
      .map((entry) => entry.name)
      .sort()
    : [];
  return { profiles, versions };
}

module.exports = { listProfilesAndVersions, listServers, listWorlds, readNbtFile };
