'use strict';

const ALLOWED_PERMISSIONS = Object.freeze(['hosting', 'xclient_xray', 'xclient_mobtrack', 'xclient_flight']);

function normalizeUuid(value) {
  return String(value || '').replace(/-/gu, '').trim().toUpperCase();
}

function normalizeState(rawState) {
  const players = Array.isArray(rawState?.players) ? rawState.players : [];
  const grants = rawState?.grants && typeof rawState.grants === 'object' ? rawState.grants : {};
  const normalizedPlayers = [];
  const seen = new Set();
  for (const rawPlayer of players) {
    const uuid = normalizeUuid(rawPlayer?.uuid);
    if (!uuid || seen.has(uuid)) continue;
    seen.add(uuid);
    normalizedPlayers.push({
      uuid,
      username: String(rawPlayer?.username || 'Unbekannt').trim().slice(0, 32) || 'Unbekannt',
      firstSeenAt: String(rawPlayer?.firstSeenAt || '').trim() || new Date(0).toISOString(),
      lastSeenAt: String(rawPlayer?.lastSeenAt || '').trim() || new Date(0).toISOString(),
      clientVersion: String(rawPlayer?.clientVersion || '').trim().slice(0, 32),
      online: rawPlayer?.online === true
    });
  }
  const normalizedGrants = {};
  for (const [rawUuid, permissions] of Object.entries(grants)) {
    const uuid = normalizeUuid(rawUuid);
    if (!uuid) continue;
    normalizedGrants[uuid] = ALLOWED_PERMISSIONS.filter((permission) => permissions?.[permission] === true)
      .reduce((result, permission) => ({ ...result, [permission]: true }), {});
  }
  return { players: normalizedPlayers, grants: normalizedGrants };
}

function upsertPlayer(state, user, details = {}) {
  const normalized = normalizeState(state);
  const uuid = normalizeUuid(user?.uuid);
  if (!uuid) return normalized;
  const now = String(details.now || new Date().toISOString());
  const existing = normalized.players.find((player) => player.uuid === uuid);
  const player = {
    uuid,
    username: String(user?.username || existing?.username || 'Unbekannt').trim().slice(0, 32),
    firstSeenAt: existing?.firstSeenAt || now,
    lastSeenAt: now,
    clientVersion: String(details.clientVersion || existing?.clientVersion || '').trim().slice(0, 32),
    online: details.online === true
  };
  return { ...normalized, players: [player, ...normalized.players.filter((entry) => entry.uuid !== uuid)] };
}

function setPermission(state, uuidValue, permission, enabled) {
  const normalized = normalizeState(state);
  const uuid = normalizeUuid(uuidValue);
  if (!uuid || !ALLOWED_PERMISSIONS.includes(permission)) throw new Error('Ungültige Admin-Berechtigung.');
  const permissions = { ...(normalized.grants[uuid] || {}) };
  if (enabled === true) permissions[permission] = true;
  else delete permissions[permission];
  return { ...normalized, grants: { ...normalized.grants, [uuid]: permissions } };
}

function hasPermission(state, uuid, permission) {
  return normalizeState(state).grants[normalizeUuid(uuid)]?.[permission] === true;
}

module.exports = { ALLOWED_PERMISSIONS, hasPermission, normalizeState, normalizeUuid, setPermission, upsertPlayer };
