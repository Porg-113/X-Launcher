'use strict';

// Launcher-owned configuration. Admin membership is deliberately not read from
// user.json, accounts.json, renderer state, usernames, tokens, or UI input.
const ADMIN_UUIDS = Object.freeze([
  '990911BD-9C28-4FC6-9ED6-A7C9E231C1F2'
]);

const NORMALIZED_ADMIN_UUIDS = new Set(ADMIN_UUIDS.map(normalizeUuid));
let currentUser = null;

function normalizeUuid(uuid) {
  return String(uuid || '').replace(/-/gu, '').trim().toUpperCase();
}

function deriveCurrentUser(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }
  const uuid = String(user.uuid || '').replace(/-/gu, '').trim();
  return Object.freeze({
    ...user,
    uuid,
    isAdmin: Boolean(uuid) && NORMALIZED_ADMIN_UUIDS.has(normalizeUuid(uuid))
  });
}

function setCurrentUser(user) {
  currentUser = deriveCurrentUser(user);
  return currentUser;
}

function clearCurrentUser() {
  currentUser = null;
}

function getCurrentUser() {
  return currentUser;
}

// Authoritative permission checks for future privileged IPC handlers belong in
// the main process and should call this function immediately before acting.
function hasAdminPermission() {
  return currentUser?.isAdmin === true;
}

module.exports = {
  ADMIN_UUIDS,
  clearCurrentUser,
  deriveCurrentUser,
  getCurrentUser,
  hasAdminPermission,
  normalizeUuid,
  setCurrentUser
};
