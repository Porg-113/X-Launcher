const { app, BrowserWindow, Menu, ipcMain, dialog, shell, safeStorage } = require('electron');
const path = require('path');
const { powerSaveBlocker } = require('electron');
const { autoUpdater } = require('electron-updater');
const { nativeTheme } = require('electron');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const net = require('net');
const dns = require('dns').promises;
const { spawn, spawnSync, execFileSync } = require('child_process');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { Authflow, Titles } = require('prismarine-auth');
const {
  assertTrustedHttpsUrl,
  createRobustness,
  hashFile,
  serializeError,
  verifyFileIntegrity
} = require('./core/robustness');
const createOracleHostingBackend = require('./oracle-hosting');
const createLocalDirectHostingBackend = require('./local-direct-hosting');
const createModsEngine = require('./core/mods-engine');
const { listServers } = require('./core/minecraft-data');
const {
  clearCurrentUser,
  deriveCurrentUser,
  hasAdminPermission,
  setCurrentUser
} = require('./core/admin-state');

let fetchImpl;
try {
  fetchImpl = globalThis.fetch || require('node-fetch');
} catch (error) {
  fetchImpl = globalThis.fetch;
}

if (!fetchImpl) {
  fetchImpl = async () => {
    throw new Error('fetch ist nicht verfügbar. Bitte installiere node-fetch oder nutze Node 18+.');
  };
}

let mainWindow;
const launcherWindows = new Set();
let windowCreateCount = 0;
let sharedWindowAnimationStartedAt = Date.now();
let sharedActiveSectionId = 'dashboard';
let startupUpdatePromise = null;
let launcherAppUpdateSetupDone = false;
let launcherAppUpdateCheckPromise = null;
let launcherAppUpdateReady = false;
let launcherAppUpdateInstallPromptOpen = false;
let hostedServerProcess = null;
let hostedServerStartedAt = '';
let hostedServerRunningId = '';
let hostedServerPowerSaveBlockerId = null;
const hostedServerProcesses = new Map();
const hostedServerUpnpMappings = new Map();
const hostedServerFirewallRules = new Map();
let activeMinecraftProcess = null;
let minecraftLaunchReserved = false;

const PROJECT_ROOT_DIR = path.join(__dirname, '..');
const ICONS_DIR = path.join(PROJECT_ROOT_DIR, 'icons');
const ASSETS_DIR = path.join(PROJECT_ROOT_DIR, 'assets');
const REQUIRED_MODS_DIR = path.join(ASSETS_DIR, 'required-mods');
const FULLBRIGHT_RESOURCE_PACK_FILE_NAME = 'X Client Fullbright.zip';
const FULLBRIGHT_RESOURCE_PACK_ID = `file/${FULLBRIGHT_RESOURCE_PACK_FILE_NAME}`;
const LEGACY_FULLBRIGHT_RESOURCE_PACK_IDS = [
  'file/X Client Fullbright'
];

const ROAMING_APPDATA_DIR = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const WINDOWS_USERS_DIR = path.dirname(os.homedir());
const DEFAULT_WINDOWS_USER_NAME = path.basename(os.homedir());
const DEFAULT_MINECRAFT_FOLDER_NAME = '.minecraft';
const FALLBACK_MINECRAFT_DIR = path.join(WINDOWS_USERS_DIR, DEFAULT_WINDOWS_USER_NAME, 'AppData', 'Roaming', DEFAULT_MINECRAFT_FOLDER_NAME);
let DEFAULT_MINECRAFT_DIR = FALLBACK_MINECRAFT_DIR;
const DEFAULT_DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');
const CONFIG_DIR = path.join(ROAMING_APPDATA_DIR, '.minecraft-launcher');
const ROBUSTNESS = createRobustness({
  configDir: CONFIG_DIR,
  debug: parseBooleanEnv(process.env.X_LAUNCHER_DEBUG)
});
const logger = ROBUSTNESS.logger;
const LOG_DIR = ROBUSTNESS.logDir;
const BACKUP_DIR = ROBUSTNESS.backupDir;
const DIAGNOSTICS_DIR = path.join(CONFIG_DIR, 'diagnostics');
const PROFILE_SETTINGS_CLIPBOARD_DIR = path.join(CONFIG_DIR, 'profile-settings-clipboard');
let RESOURCEPACKS_DIR = path.join(DEFAULT_MINECRAFT_DIR, 'resourcepacks');
let SHADERPACKS_DIR = path.join(DEFAULT_MINECRAFT_DIR, 'shaderpacks');
const MODS_LIBRARY_DIR = path.join(CONFIG_DIR, 'mods-library');
const MODS_STATE_FILE = path.join(CONFIG_DIR, 'mods-state.json');
const DASH_TWO_MOD_PURGE_MARKER_FILE = path.join(CONFIG_DIR, 'delete-dash-two-mods.enabled');
const DOWNLOADABLE_MODRINTH_STATE_FILE = path.join(CONFIG_DIR, 'modrinth-downloads.json');
const MODRINTH_CATALOG_CACHE_FILE = path.join(CONFIG_DIR, 'modrinth-catalog-cache.json');
const MOD_DISABLE_AUDIT_NAME = 'mod-disable-history.jsonl';
const PACKS_DIR = path.join(CONFIG_DIR, 'packs');
const PACKS_STATE_FILE = path.join(CONFIG_DIR, 'packs.json');
const OFFICIAL_LAUNCHER_PROFILES_FILE_NAME = 'launcher_profiles.json';
const ACCOUNTS_STATE_FILE = path.join(CONFIG_DIR, 'accounts.json');
const SERVER_FAVORITES_STATE_FILE = path.join(CONFIG_DIR, 'server-favorites.json');
const HOSTED_SERVER_DIR = path.join(CONFIG_DIR, 'hosted-server');
const HOSTED_SERVER_STATE_FILE = path.join(HOSTED_SERVER_DIR, 'hosted-server.json');
const HOSTED_SERVER_INSTANCES_DIR = path.join(HOSTED_SERVER_DIR, 'servers');
const HOSTED_SERVER_AUTO_DNS_SUFFIX = 'sslip.io';
const SKINS_DIR = path.join(CONFIG_DIR, 'skins');
const SKIN_LIBRARY_DIR = path.join(SKINS_DIR, 'library');
const USER_FILE = path.join(CONFIG_DIR, 'user.json');
const LAUNCHER_CONFIG_FILE = path.join(CONFIG_DIR, 'launcher-config.json');
const LAUNCHER_LIVE_THEME_FILE = path.join(CONFIG_DIR, 'x-launcher-theme.json');
const SELECTED_SKIN_FILE = path.join(SKINS_DIR, 'selected-skin.png');
const AUTH_CACHE_DIR = path.join(CONFIG_DIR, 'auth-cache');
const DEFAULT_MICROSOFT_CLIENT_ID = Titles.MinecraftJava;
const FORCE_OFFLINE_MODE = parseBooleanEnv(process.env.X_FORCE_OFFLINE_MODE);
const ALLOW_OFFICIAL_LAUNCHER_FALLBACK = parseBooleanEnv(process.env.X_ALLOW_OFFICIAL_LAUNCHER_FALLBACK);
const ORACLE_HOSTING = createOracleHostingBackend({
  configDir: CONFIG_DIR,
  robustness: ROBUSTNESS,
  logger,
  shell,
  safeStorage
});
const LOCAL_DIRECT_HOSTING = createLocalDirectHostingBackend({
  configDir: CONFIG_DIR,
  robustness: ROBUSTNESS,
  logger,
  shell
});
const MINECRAFT_SERVER_STATUS_TIMEOUT_MS = 5000;
const MAX_SERVER_ICON_DATA_URL_LENGTH = 180000;
const VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
const FABRIC_GAME_VERSIONS_URL = 'https://meta.fabricmc.net/v2/versions/game';
const FABRIC_LOADER_VERSIONS_URL = 'https://meta.fabricmc.net/v2/versions/loader';
const PAPER_API_BASE_URL = 'https://api.papermc.io/v2';
const BEDROCK_DOWNLOAD_LINKS_URL = 'https://net-secondary.web.minecraft-services.net/api/v1.0/download/links';
const BEDROCK_SERVER_DOWNLOAD_PAGE_URL = 'https://www.minecraft.net/en-us/download/server/bedrock';
const FABRIC_RELEASE_LIMIT = 120;
const FABRIC_LATEST_FALLBACK_LIMIT = 5;
const SUPPORTED_MINECRAFT_VERSIONS = [
  '26.2'
];
const SUPPORTED_MINECRAFT_VERSION_SET = new Set(SUPPORTED_MINECRAFT_VERSIONS);
const STANDARD_MIN_MINECRAFT_VERSION = SUPPORTED_MINECRAFT_VERSIONS[0];
const STANDARD_SUPPORTED_MINECRAFT_VERSIONS_LABEL = `${STANDARD_MIN_MINECRAFT_VERSION}+`;
const PROFILE_MIN_MINECRAFT_VERSION = '1.8';
const WEAK_MANAGED_VERSION_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MODRINTH_API_BASE_URL = 'https://api.modrinth.com/v2';
const MODRINTH_SEARCH_LIMIT = 100;
const MODRINTH_MIN_SEARCH_LIMIT = 4;
const MODRINTH_MAX_SEARCH_LIMIT = 100;
const MODRINTH_SEARCH_CACHE_TTL_MS = 2 * 60 * 1000;
const MODRINTH_UNAVAILABLE_RETRY_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MODRINTH_SEARCH_CACHE_MAX_ENTRIES = 120;
const modrinthSearchCache = new Map();
let modrinthCatalogDiskCache = null;
const SERVICE_HEALTH_TIMEOUT_MS = 4500;
const SERVICE_HEALTH_CHECKS = [
  {
    id: 'internet',
    level: 'critical',
    message: 'Keine Internetverbindung.',
    url: 'https://www.google.com/generate_204',
    okStatus: (status) => status === 204 || (status >= 200 && status < 400)
  },
  {
    id: 'modrinth',
    level: 'warning',
    message: 'Modrinth ist momentan nicht erreichbar.',
    url: `${MODRINTH_API_BASE_URL}/search?limit=1`,
    headers: {
      'User-Agent': 'XLauncher/1.0 (Mod Manager)'
    }
  },
  {
    id: 'microsoft-auth',
    level: 'warning',
    message: 'Microsoft-Anmeldung momentan nicht verfügbar.',
    url: 'https://login.live.com/oauth20_authorize.srf?client_id=00000000402b5328&response_type=code&redirect_uri=https%3A%2F%2Flogin.live.com%2Foauth20_desktop.srf&scope=XboxLive.signin%20offline_access',
    okStatus: (status) => status >= 200 && status < 500
  },
  {
    id: 'launcher-server',
    level: 'critical',
    message: 'Launcher-Server antwortet nicht.',
    url: 'https://api.github.com/repos/Porg-113/X-Launcher/releases/latest',
    headers: {
      'User-Agent': 'XLauncher/1.0 (Service Health)'
    },
    okStatus: (status) => status === 200 || status === 404
  }
];
const MODPACK_CACHE_DIR = path.join(CONFIG_DIR, 'modpacks-cache');
const MODRINTH_API_HEADERS = {
  'User-Agent': 'XLauncher/1.0 (Mod Manager)'
};
const MODRINTH_API_CACHE_TTL_MS = 5 * 60 * 1000;
const modrinthApiCache = new Map();
const TRUSTED_MODRINTH_DOWNLOAD_HOSTS = new Set([
  'api.modrinth.com',
  'cdn.modrinth.com'
]);
const TRUSTED_MOJANG_DOWNLOAD_HOSTS = new Set([
  'launchermeta.mojang.com',
  'launcher.mojang.com',
  'piston-meta.mojang.com',
  'piston-data.mojang.com',
  'libraries.minecraft.net',
  'resources.download.minecraft.net'
]);
const TRUSTED_FABRIC_META_HOSTS = new Set([
  'meta.fabricmc.net'
]);
const TRUSTED_PAPER_DOWNLOAD_HOSTS = new Set([
  'api.papermc.io'
]);
const TRUSTED_BEDROCK_DOWNLOAD_HOSTS = new Set([
  'net-secondary.web.minecraft-services.net',
  'www.minecraft.net',
  'minecraft.azureedge.net',
  'minecraftpe.azureedge.net'
]);
const TRUSTED_PUBLIC_IP_HOSTS = new Set([
  'api.ipify.org'
]);
const TRUSTED_MINECRAFT_STATUS_HOSTS = new Set([
  'api.mcsrvstat.us'
]);
const TRUSTED_LIBRARY_DOWNLOAD_HOSTS = new Set([
  ...TRUSTED_MOJANG_DOWNLOAD_HOSTS,
  ...TRUSTED_PAPER_DOWNLOAD_HOSTS,
  'maven.fabricmc.net'
]);
const TRUSTED_MINECRAFT_SERVICE_HOSTS = new Set([
  'api.minecraftservices.com'
]);
const TRUSTED_MINECRAFT_PROFILE_HOSTS = new Set([
  'api.minecraftservices.com',
  'api.mojang.com',
  'sessionserver.mojang.com'
]);
const TRUSTED_MINECRAFT_TEXTURE_HOSTS = new Set([
  'textures.minecraft.net'
]);
const SKINMC_BASE_URL = 'https://skinmc.net';
const ONLINE_SKIN_SEARCH_LIMIT = 8;
const ONLINE_SKIN_PAGE_LIMIT = 8;
const ONLINE_SKIN_MAX_BYTES = 512 * 1024;
const SKIN_LIBRARY_API_HEADERS = {
  'User-Agent': 'XLauncher/1.0 (Skin Library)'
};
const NAME_SKIN_DIRECT_TAGS = new Set([
  'angel',
  'anime',
  'blue',
  'boy',
  'cat',
  'creeper',
  'cute',
  'dark',
  'demon',
  'dragon',
  'enderman',
  'fire',
  'fox',
  'girl',
  'green',
  'hero',
  'hoodie',
  'ice',
  'king',
  'knight',
  'mage',
  'ninja',
  'pirate',
  'pvp',
  'red',
  'robot',
  'space',
  'warrior',
  'wizard',
  'wolf'
]);
const NAME_SKIN_COLOR_TAGS = ['blue', 'red', 'green', 'black', 'white', 'purple', 'orange', 'cyan'];
const NAME_SKIN_STYLE_TAGS = ['hoodie', 'pvp', 'warrior', 'ninja', 'knight', 'anime', 'cyber', 'adventurer'];
const NAME_SKIN_THEME_TAGS = ['dragon', 'wolf', 'fire', 'ice', 'space', 'demon', 'angel', 'king'];
const FABRIC_API_PROJECT_ID = 'P7dR8mSH';
const SODIUM_PROJECT_ID = 'AANobbMI';
const IRIS_PROJECT_ID = 'YL57xq9U';
const MOD_MENU_PROJECT_ID = 'mOgUt4GM';
const INFINITE_ZOOM_PROJECT_ID = 'pS3Sez5p';
const SIMPLE_VOICE_CHAT_PROJECT_ID = 'simple-voice-chat';
const LITHIUM_PROJECT_ID = 'lithium';
const FERRITE_CORE_PROJECT_ID = 'ferrite-core';
const ENTITY_CULLING_PROJECT_ID = 'entityculling';
const IMMEDIATELY_FAST_PROJECT_ID = 'immediatelyfast';
const MORE_CULLING_PROJECT_ID = 'moreculling';
const DYNAMIC_FPS_PROJECT_ID = 'dynamic-fps';
const CLUMPS_PROJECT_ID = 'Wnxd13zP';
const FAST_IP_PING_PROJECT_ID = '9mtu0sUO';
const PARTICLE_CORE_PROJECT_ID = 'RSeLon5O';
const C2ME_PROJECT_ID = 'c2me-fabric';
const APPLE_SKIN_PROJECT_ID = 'appleskin';
const CONTINUITY_PROJECT_ID = 'continuity';
const CHAT_HEADS_PROJECT_ID = 'chat-heads';
const CONTROLLING_PROJECT_ID = 'controlling';
const SHULKER_BOX_TOOLTIP_PROJECT_ID = 'shulkerboxtooltip';
const ENTITY_MODEL_FEATURES_PROJECT_ID = 'entity-model-features';
const ENTITY_TEXTURE_FEATURES_PROJECT_ID = 'entitytexturefeatures';
const THREE_D_SKIN_LAYERS_PROJECT_ID = '3dskinlayers';
const CREATIVE_CORE_PROJECT_ID = 'creativecore';
const CLOTH_CONFIG_PROJECT_ID = 'cloth-config';
const SILICON_PROJECT_ID = 'MdNZOBlg';
const DISTANT_HORIZONS_PROJECT_ID = 'uCdwusMi';
const VOXY_PROJECT_ID = 'fxxUqruK';
const MODRINTH_PROJECT_ID_ALIASES = {
  silicon: SILICON_PROJECT_ID,
  silicons: SILICON_PROJECT_ID,
  '9eGKb6K1': SIMPLE_VOICE_CHAT_PROJECT_ID,
  'gvQqBUqZ': LITHIUM_PROJECT_ID,
  'uXXizFIs': FERRITE_CORE_PROJECT_ID,
  'NNAgCjsB': ENTITY_CULLING_PROJECT_ID,
  '5ZwdcRci': IMMEDIATELY_FAST_PROJECT_ID,
  '51shyZVL': MORE_CULLING_PROJECT_ID,
  'LQ3K71Q1': DYNAMIC_FPS_PROJECT_ID,
  'VSNURh3q': C2ME_PROJECT_ID,
  'EsAfCjCV': APPLE_SKIN_PROJECT_ID,
  '1IjD5062': CONTINUITY_PROJECT_ID,
  'Wb5oqrBJ': CHAT_HEADS_PROJECT_ID,
  'xv94TkTM': CONTROLLING_PROJECT_ID,
  '2M01OLQq': SHULKER_BOX_TOOLTIP_PROJECT_ID,
  '4I1XuqiY': ENTITY_MODEL_FEATURES_PROJECT_ID,
  'BVzZfTc1': ENTITY_TEXTURE_FEATURES_PROJECT_ID,
  'zV5r3pPn': THREE_D_SKIN_LAYERS_PROJECT_ID,
  'OsZiaDHq': CREATIVE_CORE_PROJECT_ID,
  '9s6osm5g': CLOTH_CONFIG_PROJECT_ID
};
const DEFAULT_PACK_PROJECTS = [
  {
    projectId: FABRIC_API_PROJECT_ID,
    slug: 'fabric-api',
    title: 'Fabric API'
  },
  {
    projectId: SILICON_PROJECT_ID,
    slug: 'silicons',
    title: 'Silicon'
  },
  {
    projectId: SODIUM_PROJECT_ID,
    slug: 'sodium',
    title: 'Sodium'
  },
  {
    projectId: IRIS_PROJECT_ID,
    slug: 'iris',
    title: 'Iris Shaders'
  },
  {
    projectId: MOD_MENU_PROJECT_ID,
    slug: 'modmenu',
    title: 'Mod Menu'
  },
  {
    projectId: INFINITE_ZOOM_PROJECT_ID,
    slug: 'infinite-zoom',
    title: 'Infinite Zoom'
  },
  {
    projectId: SIMPLE_VOICE_CHAT_PROJECT_ID,
    slug: 'simple-voice-chat',
    title: 'Simple Voice Chat'
  },
  {
    projectId: LITHIUM_PROJECT_ID,
    slug: 'lithium',
    title: 'Lithium'
  },
  {
    projectId: FERRITE_CORE_PROJECT_ID,
    slug: 'ferrite-core',
    title: 'FerriteCore'
  },
  {
    projectId: ENTITY_CULLING_PROJECT_ID,
    slug: 'entityculling',
    title: 'Entity Culling'
  },
  {
    projectId: IMMEDIATELY_FAST_PROJECT_ID,
    slug: 'immediatelyfast',
    title: 'ImmediatelyFast'
  },
  {
    projectId: MORE_CULLING_PROJECT_ID,
    slug: 'moreculling',
    title: 'More Culling'
  },
  {
    projectId: DYNAMIC_FPS_PROJECT_ID,
    slug: 'dynamic-fps',
    title: 'Dynamic FPS'
  },
  {
    projectId: CLUMPS_PROJECT_ID,
    slug: 'clumps',
    title: 'Clumps'
  },
  {
    projectId: FAST_IP_PING_PROJECT_ID,
    slug: 'fast-ip-ping',
    title: 'Fast IP Ping'
  },
  {
    projectId: PARTICLE_CORE_PROJECT_ID,
    slug: 'particle-core',
    title: 'Particle Core'
  },
  {
    projectId: C2ME_PROJECT_ID,
    slug: 'c2me-fabric',
    title: 'Concurrent Chunk Management Engine'
  },
  {
    projectId: APPLE_SKIN_PROJECT_ID,
    slug: 'appleskin',
    title: 'AppleSkin'
  },
  {
    projectId: CONTINUITY_PROJECT_ID,
    slug: 'continuity',
    title: 'Continuity'
  },
  {
    projectId: CHAT_HEADS_PROJECT_ID,
    slug: 'chat-heads',
    title: 'Chat Heads'
  },
  {
    projectId: CONTROLLING_PROJECT_ID,
    slug: 'controlling',
    title: 'Controlling'
  },
  {
    projectId: SHULKER_BOX_TOOLTIP_PROJECT_ID,
    slug: 'shulkerboxtooltip',
    title: 'Shulker Box Tooltip'
  }
];
const KNOWN_FABRIC_MOD_ID_PROJECT_IDS = {
  silicon: SILICON_PROJECT_ID,
  sodium: SODIUM_PROJECT_ID,
  iris: IRIS_PROJECT_ID,
  modmenu: MOD_MENU_PROJECT_ID,
  'mod-menu': MOD_MENU_PROJECT_ID,
  infinitezoom: INFINITE_ZOOM_PROJECT_ID,
  'infinite-zoom': INFINITE_ZOOM_PROJECT_ID,
  voicechat: SIMPLE_VOICE_CHAT_PROJECT_ID,
  lithium: LITHIUM_PROJECT_ID,
  ferritecore: FERRITE_CORE_PROJECT_ID,
  entityculling: ENTITY_CULLING_PROJECT_ID,
  immediatelyfast: IMMEDIATELY_FAST_PROJECT_ID,
  moreculling: MORE_CULLING_PROJECT_ID,
  dynamic_fps: DYNAMIC_FPS_PROJECT_ID,
  clumps: CLUMPS_PROJECT_ID,
  fastipping: FAST_IP_PING_PROJECT_ID,
  'fast-ip-ping': FAST_IP_PING_PROJECT_ID,
  particle_core: PARTICLE_CORE_PROJECT_ID,
  'particle-core': PARTICLE_CORE_PROJECT_ID,
  c2me: C2ME_PROJECT_ID,
  appleskin: APPLE_SKIN_PROJECT_ID,
  entity_model_features: ENTITY_MODEL_FEATURES_PROJECT_ID,
  entitymodelfeatures: ENTITY_MODEL_FEATURES_PROJECT_ID,
  emf: ENTITY_MODEL_FEATURES_PROJECT_ID,
  entity_texture_features: ENTITY_TEXTURE_FEATURES_PROJECT_ID,
  entitytexturefeatures: ENTITY_TEXTURE_FEATURES_PROJECT_ID,
  etf: ENTITY_TEXTURE_FEATURES_PROJECT_ID,
  skinlayers3d: THREE_D_SKIN_LAYERS_PROJECT_ID,
  '3d-skin-layers': THREE_D_SKIN_LAYERS_PROJECT_ID,
  creativecore: CREATIVE_CORE_PROJECT_ID,
  cloth_config: CLOTH_CONFIG_PROJECT_ID,
  clothconfig: CLOTH_CONFIG_PROJECT_ID,
  continuity: CONTINUITY_PROJECT_ID,
  chat_heads: CHAT_HEADS_PROJECT_ID,
  chatheads: CHAT_HEADS_PROJECT_ID,
  controlling: CONTROLLING_PROJECT_ID,
  shulkerboxtooltip: SHULKER_BOX_TOOLTIP_PROJECT_ID,
  distanthorizons: DISTANT_HORIZONS_PROJECT_ID,
  'distant-horizons': DISTANT_HORIZONS_PROJECT_ID,
  distant_horizons: DISTANT_HORIZONS_PROJECT_ID,
  'distant horizons': DISTANT_HORIZONS_PROJECT_ID,
  voxy: VOXY_PROJECT_ID,
  fabric: FABRIC_API_PROJECT_ID,
  'fabric-api': FABRIC_API_PROJECT_ID
};
const KNOWN_MOD_CONFLICTS = [
  {
    id: 'sodium-optifine',
    title: 'Sodium und OptiFine/OptiFabric',
    left: { projectIds: [SODIUM_PROJECT_ID], terms: ['sodium'] },
    right: { terms: ['optifine', 'optifabric'] },
    message: 'Sodium/Iris und OptiFine/OptiFabric patchen dieselben Renderpfade. Entferne OptiFine/OptiFabric oder nutze eine Modrinth-kompatible Alternative.'
  },
  {
    id: 'iris-optifine',
    title: 'Iris und OptiFine/OptiFabric',
    left: { projectIds: [IRIS_PROJECT_ID], terms: ['iris'] },
    right: { terms: ['optifine', 'optifabric'] },
    message: 'Iris ersetzt die Shader-Funktionen von OptiFine. Beide gemeinsam verursachen häufig Fabric-Startfehler.'
  }
];
const HIDDEN_FABRIC_API_MINECRAFT_VERSIONS = new Set([
  '1.21.11'
]);
const X_CLIENT_MOD_VERSION = '1.0.134';
const REQUIRED_BUNDLED_MODS = [
  {
    projectId: 'x-launcher-menu',
    slug: 'x-launcher-menu',
    title: 'X Client',
    description: 'Vollständiges X-Client-Menü mit HUD, Zoom, Fullbright und Client-Modulen.',
    iconUrl: '',
    fileName: 'x-launcher-menu.jar',
    versionNumber: X_CLIENT_MOD_VERSION,
    versionName: `X Client ${X_CLIENT_MOD_VERSION}`,
    minecraftVersions: SUPPORTED_MINECRAFT_VERSIONS,
    assetPathByMinecraftVersion: {
      '26.2': path.join(REQUIRED_MODS_DIR, 'x-launcher-menu-26.2.jar')
    }
  }
];
const MODS_TAB_REQUIRED_BUNDLED_MODS = REQUIRED_BUNDLED_MODS.filter((entry) => (
  ['x-launcher-menu'].includes(String(entry?.projectId || '').trim())
));
const REMOVED_BUNDLED_PROJECT_IDS = new Set([
  'safe-settings',
  'x-client',
  'x-standard-client',
  'Ji79dP1f'
]);
const REMOVED_BUNDLED_MOD_FILE_NAMES = new Set([
  'safe-settings.jar',
  'x-standard-client.jar',
  'x_client.jar',
  'xclient.jar',
  'simplefullbright.jar',
  'verysimplefullbright.jar'
]);
const LEGACY_BUNDLED_PROJECT_IDS = new Set([
  'fabric-key-mapping-api-v1',
  ...REMOVED_BUNDLED_PROJECT_IDS
]);
const REQUIRED_MANAGED_PROJECT_IDS = new Set([
  FABRIC_API_PROJECT_ID,
  SILICON_PROJECT_ID,
  SODIUM_PROJECT_ID,
  IRIS_PROJECT_ID,
  MOD_MENU_PROJECT_ID,
  INFINITE_ZOOM_PROJECT_ID,
  SIMPLE_VOICE_CHAT_PROJECT_ID,
  LITHIUM_PROJECT_ID,
  FERRITE_CORE_PROJECT_ID,
  ENTITY_CULLING_PROJECT_ID,
  IMMEDIATELY_FAST_PROJECT_ID,
  MORE_CULLING_PROJECT_ID,
  DYNAMIC_FPS_PROJECT_ID,
  CLUMPS_PROJECT_ID,
  FAST_IP_PING_PROJECT_ID,
  PARTICLE_CORE_PROJECT_ID,
  C2ME_PROJECT_ID,
  APPLE_SKIN_PROJECT_ID,
  ENTITY_MODEL_FEATURES_PROJECT_ID,
  ENTITY_TEXTURE_FEATURES_PROJECT_ID,
  THREE_D_SKIN_LAYERS_PROJECT_ID,
  CREATIVE_CORE_PROJECT_ID,
  CLOTH_CONFIG_PROJECT_ID,
  CONTINUITY_PROJECT_ID,
  CHAT_HEADS_PROJECT_ID,
  CONTROLLING_PROJECT_ID,
  SHULKER_BOX_TOOLTIP_PROJECT_ID
]);
const OPTIONAL_DEFAULT_CONFLICT_IDENTIFIERS = new Set(
  DEFAULT_PACK_PROJECTS
    .flatMap((entry) => [entry?.projectId, entry?.slug])
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter((entry) => entry && entry !== FABRIC_API_PROJECT_ID.toLowerCase() && entry !== 'fabric-api')
);
const HIDDEN_MODS_TAB_PROJECT_IDS = new Set([
  FABRIC_API_PROJECT_ID,
  SILICON_PROJECT_ID,
  SODIUM_PROJECT_ID,
  IRIS_PROJECT_ID,
  MOD_MENU_PROJECT_ID,
  INFINITE_ZOOM_PROJECT_ID,
  SIMPLE_VOICE_CHAT_PROJECT_ID,
  LITHIUM_PROJECT_ID,
  FERRITE_CORE_PROJECT_ID,
  ENTITY_CULLING_PROJECT_ID,
  IMMEDIATELY_FAST_PROJECT_ID,
  MORE_CULLING_PROJECT_ID,
  DYNAMIC_FPS_PROJECT_ID,
  CLUMPS_PROJECT_ID,
  FAST_IP_PING_PROJECT_ID,
  PARTICLE_CORE_PROJECT_ID,
  C2ME_PROJECT_ID,
  APPLE_SKIN_PROJECT_ID,
  ENTITY_MODEL_FEATURES_PROJECT_ID,
  ENTITY_TEXTURE_FEATURES_PROJECT_ID,
  THREE_D_SKIN_LAYERS_PROJECT_ID,
  CREATIVE_CORE_PROJECT_ID,
  CLOTH_CONFIG_PROJECT_ID,
  CONTINUITY_PROJECT_ID,
  CHAT_HEADS_PROJECT_ID,
  CONTROLLING_PROJECT_ID,
  SHULKER_BOX_TOOLTIP_PROJECT_ID,
  'safe-settings'
]);
const HIDDEN_MODS_TAB_PROJECT_SLUGS = new Set([
  'fabric-api',
  'silicon',
  'silicons',
  'sodium',
  'iris',
  'modmenu',
  'infinite-zoom',
  'infinitezoom',
  'simple-voice-chat',
  'lithium',
  'ferrite-core',
  'entityculling',
  'immediatelyfast',
  'moreculling',
  'dynamic-fps',
  'clumps',
  'fast-ip-ping',
  'particle-core',
  'c2me-fabric',
  'appleskin',
  'entity-model-features',
  'entitytexturefeatures',
  '3dskinlayers',
  'creativecore',
  'cloth-config',
  'continuity',
  'chat-heads',
  'controlling',
  'shulkerboxtooltip',
  'safe-settings'
]);
const REQUIRED_MANUAL_MOD_FILE_PREFIXES = new Set([
  'clumps',
  'dynamic-fps',
  'dynamicfps',
  'fast-ip-ping',
  'particle-core',
  'particlecore'
]);
const PROTECTED_MOD_PROJECT_IDS = new Set(
  [
    ...REQUIRED_MANAGED_PROJECT_IDS,
    ...(MODS_TAB_REQUIRED_BUNDLED_MODS || [])
      .map((entry) => String(entry?.projectId || '').trim())
      .filter(Boolean)
  ]
);
const PROTECTED_MOD_SLUGS = new Set(
  [
    ...HIDDEN_MODS_TAB_PROJECT_SLUGS,
    ...(MODS_TAB_REQUIRED_BUNDLED_MODS || [])
      .map((entry) => String(entry?.slug || '').trim().toLowerCase())
      .filter(Boolean)
  ]
);
const MINECRAFT_SKIN_UPLOAD_URL = 'https://api.minecraftservices.com/minecraft/profile/skins';
const DISABLED_MOD_SUFFIX = '.disabled';
const DISABLED_MODS_DIR_NAME = '.x-disabled-mods';
const MODS_ENGINE = createModsEngine({
  fsModule: fs,
  pathModule: path,
  fetchImpl,
  logger,
  serializeError,
  configDir: CONFIG_DIR,
  getActiveModContext: (...args) => getActiveModContext(...args),
  getModrinthInstallContext: (...args) => getModrinthInstallContext(...args),
  getEffectiveSelectedVersionId: (...args) => getEffectiveSelectedVersionId(...args),
  persistEffectiveSelectedVersionId: (...args) => persistEffectiveSelectedVersionId(...args),
  getCurrentMinecraftVersion: (...args) => getCurrentMinecraftVersion(...args),
  getModrinthTargetChangeWarning: (...args) => getModrinthTargetChangeWarning(...args),
  installDownloadableModrinthProject: (...args) => installDownloadableModrinthProject(...args),
  installModrinthModpack: (...args) => installModrinthModpack(...args),
  updateDownloadableModrinthProjects: (...args) => updateDownloadableModrinthProjects(...args),
  getInstalledDownloadableModrinthEntries: (...args) => getInstalledDownloadableModrinthEntries(...args),
  removeDownloadableModrinthEntry: (...args) => removeDownloadableModrinthEntry(...args),
  requiredBundledMods: REQUIRED_BUNDLED_MODS,
  requiredManagedProjectIds: REQUIRED_MANAGED_PROJECT_IDS,
  hiddenProjectIds: HIDDEN_MODS_TAB_PROJECT_IDS,
  hiddenSlugs: HIDDEN_MODS_TAB_PROJECT_SLUGS,
  protectedProjectIds: PROTECTED_MOD_PROJECT_IDS,
  fabricApiProjectId: FABRIC_API_PROJECT_ID,
  disabledModsDirName: DISABLED_MODS_DIR_NAME,
  modrinthProjectIdAliases: MODRINTH_PROJECT_ID_ALIASES,
  resourcepacksDir: RESOURCEPACKS_DIR,
  shaderpacksDir: SHADERPACKS_DIR,
  shouldPurgeModFile: (filePath) => (
    fs.existsSync(DASH_TWO_MOD_PURGE_MARKER_FILE)
    && /-2\.jar$/iu.test(path.basename(String(filePath || '')))
  )
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in launcher main process', {
    error: serializeError(error),
    memory: process.memoryUsage()
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection in launcher main process', {
    error: serializeError(reason),
    memory: process.memoryUsage()
  });
});

ensureDir(CONFIG_DIR);
ensureLauncherConfig();
logger.setDebugEnabled(isDebugModeEnabled());
setActiveMinecraftDirectory(getConfiguredMinecraftDirectory());
const startupMinecraftConfig = readLauncherConfig();
if (getComparablePath(startupMinecraftConfig.minecraftPath) !== getComparablePath(FALLBACK_MINECRAFT_DIR)
  || startupMinecraftConfig.minecraftFolderName !== DEFAULT_MINECRAFT_FOLDER_NAME
  || startupMinecraftConfig.minecraftWindowsUserName !== DEFAULT_WINDOWS_USER_NAME
  || String(startupMinecraftConfig.standardModsPath || '').trim()) {
  writeLauncherConfig({
    minecraftPath: FALLBACK_MINECRAFT_DIR,
    minecraftFolderName: DEFAULT_MINECRAFT_FOLDER_NAME,
    minecraftWindowsUserName: DEFAULT_WINDOWS_USER_NAME,
    standardModsPath: ''
  });
}
repairInstalledBundledMods();
syncOfficialLauncherProfiles();

syncManagedModsForVersion = (...args) => MODS_ENGINE.syncManagedModsForVersion(...args);
installModrinthMod = (...args) => MODS_ENGINE.installModrinthMod(...args);
refreshInstalledMod = (...args) => MODS_ENGINE.refreshInstalledMod(...args);
updateAllManagedMods = (...args) => MODS_ENGINE.updateAllManagedMods(...args);
getInstalledManagedModProjectIds = (...args) => MODS_ENGINE.getInstalledManagedModProjectIds(...args);
getInstalledMods = (...args) => MODS_ENGINE.getInstalledMods(...args);
setInstalledModEnabled = (...args) => MODS_ENGINE.setInstalledModEnabled(...args);
removeInstalledMod = (...args) => MODS_ENGINE.removeInstalledMod(...args);
importDroppedMods = async (...args) => {
  const result = await MODS_ENGINE.importDroppedMods(...args);
  if (result?.success) {
    const modContext = getActiveModContext();
    const dependencyResult = await installMissingManifestDependencies(modContext);
    if (dependencyResult.installed.length || dependencyResult.warnings.length) {
      result.warning = formatManagedModsWarning([
        result.warning,
        ...dependencyResult.warnings
      ]);
      result.message = `${result.message || 'Mod installiert.'}${dependencyResult.installed.length
        ? ` Abhängigkeiten sofort installiert: ${dependencyResult.installed.join(', ')}.`
        : ''}`;
      result.mods = await MODS_ENGINE.getInstalledMods(modContext.versionId, { skipManagedSync: true });
    }
  }
  return result;
};
formatManagedModsWarning = (...args) => MODS_ENGINE.formatManagedModsWarning(...args);
formatManagedModsLaunchMessage = (...args) => MODS_ENGINE.formatManagedModsLaunchMessage(...args);
assertLaunchRequiredModsSynced = (...args) => MODS_ENGINE.assertLaunchRequiredModsSynced(...args);

function getLiveLauncherWindows() {
  for (const browserWindow of launcherWindows) {
    if (!browserWindow || browserWindow.isDestroyed()) {
      launcherWindows.delete(browserWindow);
    }
  }

  return Array.from(launcherWindows);
}

function getEventWindow(event) {
  return BrowserWindow.fromWebContents(event?.sender) || mainWindow;
}

function sendWindowStateToRenderer(targetWindow = mainWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  const webContents = targetWindow.webContents;
  if (!webContents || webContents.isDestroyed()) {
    return;
  }

  webContents.send('window-state-changed', {
    maximized: targetWindow.isMaximized(),
    minimized: targetWindow.isMinimized(),
    fullScreen: targetWindow.isFullScreen()
  });
}

function sendMinecraftLifecycleEvent(channel, payload = {}, targetWindow = null) {
  const targetWindows = targetWindow ? [targetWindow] : getLiveLauncherWindows();
  for (const browserWindow of targetWindows) {
    if (!browserWindow || browserWindow.isDestroyed()) {
      continue;
    }

    const webContents = browserWindow.webContents;
    if (!webContents || webContents.isDestroyed()) {
      continue;
    }

    webContents.send(channel, payload);
  }
}

function sendMinecraftLaunchProgress(targetWindow, progress, status, details = {}) {
  sendMinecraftLifecycleEvent('minecraft-launch-progress', {
    progress: Math.max(0, Math.min(100, Math.round(Number(progress) || 0))),
    status: String(status || ''),
    ...details
  }, targetWindow);
}

const ACTIVE_MOD_FOLDER_WATCHERS = new Map();
let activeModFolderChangeTimer = null;
let activeModFolderChangePayload = null;

function clearActiveModFolderWatchers() {
  for (const watcher of ACTIVE_MOD_FOLDER_WATCHERS.values()) {
    try {
      watcher.close();
    } catch (_error) {
      // ignore
    }
  }
  ACTIVE_MOD_FOLDER_WATCHERS.clear();

  if (activeModFolderChangeTimer) {
    clearTimeout(activeModFolderChangeTimer);
    activeModFolderChangeTimer = null;
  }
  activeModFolderChangePayload = null;
}

function sendActiveModFolderChanged(payload) {
  activeModFolderChangePayload = {
    type: payload?.type || 'mods',
    eventType: payload?.eventType || 'change',
    path: payload?.path || '',
    timestamp: Date.now()
  };

  if (activeModFolderChangeTimer) {
    clearTimeout(activeModFolderChangeTimer);
  }

  activeModFolderChangeTimer = setTimeout(() => {
    activeModFolderChangeTimer = null;
    if (!activeModFolderChangePayload) {
      return;
    }
    sendMinecraftLifecycleEvent('mod-folder-changed', activeModFolderChangePayload);
    activeModFolderChangePayload = null;
  }, 150);
}

function watchActiveModFolder(directory, type) {
  if (!directory) {
    return;
  }

  const normalized = path.resolve(directory);
  if (ACTIVE_MOD_FOLDER_WATCHERS.has(normalized)) {
    return;
  }

  try {
    ensureDir(normalized);
    const watcher = fs.watch(normalized, { persistent: false, recursive: true }, (eventType, filename) => {
      if (!filename) {
        sendActiveModFolderChanged({ type, eventType, path: normalized });
        return;
      }
      const filePath = path.join(normalized, filename.toString());
      logger.info('Mod folder change detected', { directory: normalized, type, eventType, path: filePath });
      sendActiveModFolderChanged({ type, eventType, path: filePath });
    });

    watcher.on('error', (error) => {
      logger.warn('Mod folder watcher error', { directory: normalized, type, error: serializeError(error) });
      if (ACTIVE_MOD_FOLDER_WATCHERS.has(normalized)) {
        ACTIVE_MOD_FOLDER_WATCHERS.delete(normalized);
      }
    });

    ACTIVE_MOD_FOLDER_WATCHERS.set(normalized, watcher);
    logger.info('Watching mod folder recursively', { directory: normalized, type });
  } catch (error) {
    logger.warn('Could not watch mod folder', { directory: normalized, type, error: serializeError(error) });
  }
}

function ensureActiveModFolderWatchers() {
  clearActiveModFolderWatchers();
  const modContext = getActiveModContext();
  if (!modContext) {
    return;
  }

  watchActiveModFolder(modContext.modsDir, 'mods');
  watchActiveModFolder(modContext.resourcepacksDir || RESOURCEPACKS_DIR, 'resourcepack');
  watchActiveModFolder(modContext.shaderpacksDir || SHADERPACKS_DIR, 'shader');
}

function updateActiveModFolderWatchers() {
  clearActiveModFolderWatchers();
  ensureActiveModFolderWatchers();
}

function sendWindowGroupStateToRenderer() {
  const windows = getLiveLauncherWindows();
  const visibleWindows = windows.filter((browserWindow) => browserWindow.isVisible());
  const activeWindows = (visibleWindows.length ? visibleWindows : windows)
    .sort((firstWindow, secondWindow) => {
      const firstBounds = firstWindow.getBounds();
      const secondBounds = secondWindow.getBounds();
      if (firstBounds.x !== secondBounds.x) {
        return firstBounds.x - secondBounds.x;
      }
      return firstBounds.y - secondBounds.y;
    });
  const count = activeWindows.length;

  activeWindows.forEach((browserWindow, index) => {
    const webContents = browserWindow.webContents;
    if (!webContents || webContents.isDestroyed()) {
      return;
    }

    webContents.send('window-group-state-changed', {
      count,
      index,
      role: count > 1 && index === 0 ? 'navigation' : 'content',
      grouped: count > 1,
      activeSectionId: sharedActiveSectionId,
      sharedAnimationStartedAt: sharedWindowAnimationStartedAt
    });
  });
}

function scheduleWindowGroupStateSync() {
  setTimeout(sendWindowGroupStateToRenderer, 80);
}

function sendLauncherAppUpdateState(status, detail = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const webContents = mainWindow.webContents;
  if (!webContents || webContents.isDestroyed()) {
    return;
  }

  webContents.send('launcher-app-update-state', {
    status,
    ...detail
  });
}

function isPortableLauncherBuild() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE);
}

function getPackagedLauncherUpdateConfig() {
  const updateConfigPath = path.join(process.resourcesPath || '', 'app-update.yml');
  if (!updateConfigPath || !fs.existsSync(updateConfigPath)) {
    return {};
  }

  try {
    const rawConfig = fs.readFileSync(updateConfigPath, 'utf8');
    return {
      provider: getUpdateConfigValue(rawConfig, 'provider'),
      url: getUpdateConfigValue(rawConfig, 'url'),
      owner: getUpdateConfigValue(rawConfig, 'owner'),
      repo: getUpdateConfigValue(rawConfig, 'repo')
    };
  } catch (_error) {
    return {};
  }
}

function getUpdateConfigValue(rawConfig, key) {
  const match = rawConfig.match(new RegExp(`^\\s*${key}:\\s*['"]?([^'"]+?)['"]?\\s*$`, 'im'));
  return String(match?.[1] || '').trim();
}

function isPlaceholderLauncherUpdateConfig(updateConfig) {
  const values = [
    updateConfig?.url,
    updateConfig?.owner,
    updateConfig?.repo
  ].map((value) => String(value || '').trim().toLowerCase());

  return values.some((value) => (
    value.includes('example.com')
    || value.includes('deine-domain')
    || value.includes('dein_github_name')
    || value.includes('dein-github-name')
  ));
}

function getLauncherAppUpdateAvailability() {
  if (!app.isPackaged) {
    return {
      available: false,
      reason: 'Auto-Updates laufen nur in der installierten App.'
    };
  }

  if (process.platform !== 'win32') {
    return {
      available: false,
      reason: 'Dieser Build ist nur für Windows-Auto-Updates konfiguriert.'
    };
  }

  if (isPortableLauncherBuild()) {
    return {
      available: false,
      reason: 'Portable Builds werden nicht automatisch aktualisiert. Bitte den Installer nutzen.'
    };
  }

  const updateConfig = getPackagedLauncherUpdateConfig();
  if (isPlaceholderLauncherUpdateConfig(updateConfig)) {
    return {
      available: false,
      reason: 'Update-Quelle ist noch ein Platzhalter.',
      updateUrl: updateConfig.url || '',
      updateOwner: updateConfig.owner || '',
      updateRepo: updateConfig.repo || ''
    };
  }

  return {
    available: true,
    updateUrl: updateConfig.url || '',
    updateOwner: updateConfig.owner || '',
    updateRepo: updateConfig.repo || ''
  };
}

function getUpdateVersion(info) {
  return String(info?.version || info?.releaseName || '').trim();
}

function getUpdateReleaseNotes(info) {
  const releaseNotes = info?.releaseNotes;
  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((entry) => String(entry?.note || entry || '').trim())
      .filter(Boolean)
      .join('\n');
  }
  return String(releaseNotes || '').trim();
}

function setupLauncherAppAutoUpdater() {
  if (launcherAppUpdateSetupDone) {
    return;
  }

  launcherAppUpdateSetupDone = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    sendLauncherAppUpdateState('checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendLauncherAppUpdateState('available', {
      version: getUpdateVersion(info),
      releaseNotes: getUpdateReleaseNotes(info),
      message: 'Launcher-Update gefunden. Download startet...'
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendLauncherAppUpdateState('not-available', {
      version: getUpdateVersion(info)
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendLauncherAppUpdateState('download-progress', {
      percent: Math.max(0, Math.min(100, Number(progress?.percent) || 0)),
      transferred: Number(progress?.transferred) || 0,
      total: Number(progress?.total) || 0,
      bytesPerSecond: Number(progress?.bytesPerSecond) || 0
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    launcherAppUpdateReady = true;
    sendLauncherAppUpdateState('downloaded', {
      version: getUpdateVersion(info),
      releaseNotes: getUpdateReleaseNotes(info),
      message: 'Launcher-Update ist bereit und wird automatisch installiert.'
    });
    setTimeout(() => {
      installDownloadedLauncherAppUpdate({ automatic: true, silent: true });
    }, 1200);
  });

  autoUpdater.on('error', (error) => {
    sendLauncherAppUpdateState('error', {
      error: error?.message || String(error || 'Unbekannter Update-Fehler')
    });
  });

  setTimeout(() => {
    checkLauncherAppUpdates({ silent: true }).catch((error) => {
      sendLauncherAppUpdateState('error', {
        error: error?.message || String(error || 'Unbekannter Update-Fehler')
      });
    });
  }, 3500);
}

async function checkLauncherAppUpdates(options = {}) {
  const availability = getLauncherAppUpdateAvailability();
  if (!availability.available) {
    if (!options.silent) {
      sendLauncherAppUpdateState('skipped', {
        reason: availability.reason,
        updateUrl: availability.updateUrl || ''
      });
    }

    return {
      success: true,
      skipped: true,
      reason: availability.reason,
      updateUrl: availability.updateUrl || '',
      updateOwner: availability.updateOwner || '',
      updateRepo: availability.updateRepo || ''
    };
  }

  if (launcherAppUpdateCheckPromise) {
    return launcherAppUpdateCheckPromise;
  }

  launcherAppUpdateCheckPromise = autoUpdater.checkForUpdates()
    .then((result) => ({
      success: true,
      updateInfo: result?.updateInfo || null
    }))
    .catch((error) => {
      const message = error?.message || String(error || 'Unbekannter Update-Fehler');
      sendLauncherAppUpdateState('error', { error: message });
      return { success: false, error: message };
    })
    .finally(() => {
      launcherAppUpdateCheckPromise = null;
    });

  return launcherAppUpdateCheckPromise;
}

async function promptInstallDownloadedLauncherAppUpdate(info) {
  if (launcherAppUpdateInstallPromptOpen || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  launcherAppUpdateInstallPromptOpen = true;
  try {
    const version = getUpdateVersion(info);
    const language = resolveLauncherLanguage();
    const copy = language === 'de'
      ? {
          buttons: ['Jetzt neu starten', 'Spaeter'],
          title: 'Launcher-Update bereit',
          message: version
            ? `X Launcher ${version} wurde heruntergeladen.`
            : 'Ein Launcher-Update wurde heruntergeladen.',
          detail: 'Starte den Launcher neu, um das Update zu installieren.'
        }
      : {
          buttons: ['Restart now', 'Later'],
          title: 'Launcher update ready',
          message: version
            ? `X Launcher ${version} has been downloaded.`
            : 'A launcher update has been downloaded.',
          detail: 'Restart the launcher to install the update.'
        };
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: copy.buttons,
      defaultId: 0,
      cancelId: 1,
      title: copy.title,
      message: copy.message,
      detail: copy.detail
    });

    if (result.response === 0) {
      installDownloadedLauncherAppUpdate();
    }
  } finally {
    launcherAppUpdateInstallPromptOpen = false;
  }
}

function installDownloadedLauncherAppUpdate(options = {}) {
  if (!launcherAppUpdateReady) {
    return {
      success: false,
      error: 'Es ist noch kein Launcher-Update heruntergeladen.'
    };
  }

  sendLauncherAppUpdateState('installing');
  const silent = options.silent !== false;
  setImmediate(() => autoUpdater.quitAndInstall(silent, true));
  return { success: true };
}

function createWindow() {
  const launcherIconPath = resolveLauncherIconPath();
  const launcherWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 800,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    },
    ...(launcherIconPath ? { icon: launcherIconPath } : {})
  });

  windowCreateCount += 1;
  launcherWindow.__xLauncherWindowId = windowCreateCount;
  launcherWindows.add(launcherWindow);
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = launcherWindow;
  }

  launcherWindow.loadFile(path.join(__dirname, '../index.html')).catch((error) => {
    logger.error('Launcher window failed to load', {
      windowId: launcherWindow.__xLauncherWindowId,
      error: serializeError(error)
    });
  });
  launcherWindow.on('maximize', () => sendWindowStateToRenderer(launcherWindow));
  launcherWindow.on('unmaximize', () => {
    sendWindowStateToRenderer(launcherWindow);
    scheduleWindowGroupStateSync();
  });
  launcherWindow.on('restore', () => {
    sendWindowStateToRenderer(launcherWindow);
    scheduleWindowGroupStateSync();
  });
  launcherWindow.on('enter-full-screen', () => sendWindowStateToRenderer(launcherWindow));
  launcherWindow.on('leave-full-screen', () => {
    sendWindowStateToRenderer(launcherWindow);
    scheduleWindowGroupStateSync();
  });
  launcherWindow.on('show', scheduleWindowGroupStateSync);
  launcherWindow.on('hide', scheduleWindowGroupStateSync);
  launcherWindow.on('move', scheduleWindowGroupStateSync);
  launcherWindow.on('resize', scheduleWindowGroupStateSync);
  launcherWindow.webContents.on('did-finish-load', () => {
    sendWindowStateToRenderer(launcherWindow);
    sendWindowGroupStateToRenderer();
  });
  launcherWindow.on('closed', () => {
    launcherWindows.delete(launcherWindow);
    if (mainWindow === launcherWindow) {
      mainWindow = getLiveLauncherWindows()[0] || null;
    }
    scheduleWindowGroupStateSync();
  });

  Menu.setApplicationMenu(null);
  scheduleWindowGroupStateSync();
  return launcherWindow;
}

function resolveLauncherIconPath() {
  const iconCandidates = [
    path.join(ICONS_DIR, 'icon.ico'),
    path.join(ICONS_DIR, 'app-icon.ico'),
    path.join(ICONS_DIR, 'icon.png'),
    path.join(ICONS_DIR, 'app-icon.png'),
    path.join(ASSETS_DIR, 'icon.png'),
    path.join(ASSETS_DIR, 'icon -.png')
  ];

  return iconCandidates.find((candidatePath) => fs.existsSync(candidatePath)) || '';
}

function getUserFacingErrorMessage(error, fallback = 'Interner Launcher-Fehler.') {
  const rawMessage = String(error?.message || error || '').trim();
  if (!rawMessage) {
    return fallback;
  }

  if (/HTTP 429|Error 1015|rate limited|being rate limited|temporarily.*banned/iu.test(rawMessage)) {
    return 'Modrinth blockiert gerade zu viele Suchanfragen. Bitte warte kurz und suche dann mit mindestens 3 Zeichen erneut.';
  }

  if (/api\.modrinth\.com/iu.test(rawMessage) && /<!doctype html>|<html/iu.test(rawMessage)) {
    return 'Modrinth hat statt einer API-Antwort eine Fehlerseite gesendet. Bitte versuche es gleich noch einmal.';
  }

  if (/heap out of memory|allocation failed|out of memory/i.test(rawMessage)) {
    return 'Nicht genug Arbeitsspeicher für diese Aktion. Details wurden im Launcher-Log gespeichert.';
  }

  return rawMessage;
}

function registerIpcHandler(channel, handler, options = {}) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      logger.error(`IPC handler failed: ${channel}`, {
        channel,
        args: options.logArgs === false ? '[redacted]' : args,
        error: serializeError(error),
        memory: process.memoryUsage()
      });

      if (typeof options.fallback === 'function') {
        try {
          return options.fallback(error, args);
        } catch (fallbackError) {
          logger.error(`IPC fallback failed: ${channel}`, {
            channel,
            error: serializeError(fallbackError)
          });
        }
      }

      return {
        success: false,
        error: getUserFacingErrorMessage(error)
      };
    }
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    app.whenReady().then(() => {
      const launcherWindow = mainWindow && !mainWindow.isDestroyed()
        ? mainWindow
        : getLiveLauncherWindows()[0];
      if (!launcherWindow || launcherWindow.isDestroyed()) {
        mainWindow = createWindow();
        return;
      }
      if (launcherWindow.isMinimized()) {
        launcherWindow.restore();
      }
      launcherWindow.show();
      launcherWindow.focus();
    });
  });
}

if (hasSingleInstanceLock) {
  app.whenReady().then(() => {
    createWindow();
    ensureActiveModFolderWatchers();
    setupLauncherAppAutoUpdater();
    startupUpdatePromise = null;
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopAllHostedServerProcesses();
});

app.on('activate', () => {
  if (!mainWindow) {
    createWindow();
  }
});

registerIpcHandler('get-user-info', async () => readSavedUser(), { fallback: () => null, logArgs: false });
registerIpcHandler('get-app-version', async () => ({
  success: true,
  version: app.getVersion()
}));
registerIpcHandler('check-service-health', async () => checkServiceHealth());
registerIpcHandler('get-launcher-status', async () => getLauncherStatus());
registerIpcHandler('check-app-updates', async () => checkLauncherAppUpdates({ manual: true }));
registerIpcHandler('install-app-update', async () => installDownloadedLauncherAppUpdate());
registerIpcHandler('check-launcher-updates', async () => {
  try {
    startupUpdatePromise = null;
    return {
      success: true,
      changed: false,
      skipped: true,
      message: 'Automatische Mod-Prüfung ist deaktiviert. Nutze „Alle prüfen“ im Mods-Tab.'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
registerIpcHandler('get-available-versions', async () => getAvailableVersions());
registerIpcHandler('set-selected-version', async (_event, versionId) => {
  const result = await setSelectedVersion(versionId);
  updateActiveModFolderWatchers();
  return result;
});
registerIpcHandler('set-standard-version', async (_event, versionId) => setStandardVersion(versionId));
registerIpcHandler('download-version', async (_event, versionId) => downloadVersion(versionId));
registerIpcHandler('window-minimize', async (event) => {
  const targetWindow = getEventWindow(event);
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { success: false, error: 'Fenster nicht gefunden.' };
  }
  targetWindow.minimize();
  sendWindowStateToRenderer(targetWindow);
  scheduleWindowGroupStateSync();
  return { success: true };
});
registerIpcHandler('window-toggle-maximize', async (event) => {
  const targetWindow = getEventWindow(event);
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { success: false, error: 'Fenster nicht gefunden.' };
  }
  if (targetWindow.isMaximized()) {
    targetWindow.unmaximize();
    sendWindowStateToRenderer(targetWindow);
    scheduleWindowGroupStateSync();
    return { success: true, maximized: false };
  }
  targetWindow.maximize();
  sendWindowStateToRenderer(targetWindow);
  sendWindowGroupStateToRenderer();
  return { success: true, maximized: true };
});
registerIpcHandler('get-window-state', async (event) => {
  const targetWindow = getEventWindow(event);
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { success: false, error: 'Fenster nicht gefunden.' };
  }

  return {
    success: true,
    maximized: targetWindow.isMaximized(),
    minimized: targetWindow.isMinimized(),
    fullScreen: targetWindow.isFullScreen()
  };
});
registerIpcHandler('get-global-cursor-position', async (event) => {
  const targetWindow = getEventWindow(event);
  const cursor = require('electron').screen.getCursorScreenPoint();
  const bounds = targetWindow && !targetWindow.isDestroyed()
    ? targetWindow.getContentBounds()
    : { x: 0, y: 0, width: 0, height: 0 };

  return {
    success: true,
    screenX: cursor.x,
    screenY: cursor.y,
    clientX: cursor.x - bounds.x,
    clientY: cursor.y - bounds.y,
    windowBounds: bounds
  };
});
registerIpcHandler('get-window-group-state', async () => {
  sendWindowGroupStateToRenderer();
  return {
    success: true,
    activeSectionId: sharedActiveSectionId,
    count: getLiveLauncherWindows().length
  };
});
registerIpcHandler('set-window-active-section', async (_event, sectionId) => {
  const normalizedSectionId = String(sectionId || '').trim();
  if (!normalizedSectionId) {
    return { success: false, error: 'Bereich nicht gefunden.' };
  }

  sharedActiveSectionId = normalizedSectionId;
  sendWindowGroupStateToRenderer();
  return { success: true, activeSectionId: sharedActiveSectionId };
});
registerIpcHandler('window-close', async (event) => {
  const targetWindow = getEventWindow(event);
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { success: false, error: 'Fenster nicht gefunden.' };
  }
  targetWindow.close();
  return { success: true };
});
registerIpcHandler('get-packs', async () => getPacksConfig());
registerIpcHandler('create-pack', async (_event, name, versionId) => {
  const result = await createPack(name, versionId);
  updateActiveModFolderWatchers();
  return result;
});
registerIpcHandler('set-active-pack', async (_event, packId) => {
  const result = await setActivePack(packId);
  updateActiveModFolderWatchers();
  return result;
});
registerIpcHandler('delete-pack', async (_event, packId) => {
  const result = await deletePack(packId);
  updateActiveModFolderWatchers();
  return result;
});
registerIpcHandler('copy-profile-settings', async (_event, packId) => copyProfileSettings(packId));
registerIpcHandler('paste-profile-settings', async (_event, packId) => pasteProfileSettings(packId));

registerIpcHandler('login', async (_event, loginInput, _accessToken = '') => {
  const loginOptions = loginInput && typeof loginInput === 'object' ? loginInput : {};
  const loginHint = typeof loginInput === 'string' ? loginInput : '';
  if (FORCE_OFFLINE_MODE) {
    const existingUser = (() => {
      if (!fs.existsSync(USER_FILE)) {
        return null;
      }
      try {
        return readSavedUserFile();
      } catch (_error) {
        return null;
      }
    })();
    const offlineUser = writeSavedUserFile(createOfflineUser(loginHint, existingUser), 'force-offline-login');
    return {
      success: true,
      user: offlineUser,
      warning: 'Dauer-Offline-Modus ist aktiv. Multiplayer geht nur auf Offline-Mode-Servern.'
    };
  }

  try {
    const authCacheId = loginOptions.addAccount
      ? `x-launcher-account-${crypto.randomUUID()}`
      : 'x-launcher';
    const profile = await loginWithOfficialMicrosoftXboxLogin({ forceRefresh: false, authCacheId });
    const userInfo = {
      username: profile.username,
      email: null,
      uuid: profile.uuid,
      loginTime: new Date().toISOString(),
      accessToken: profile.accessToken,
      microsoftAccessToken: profile.microsoftAccessToken || '',
      userType: 'msa',
      loginSource: 'official-sisu',
      tokenSource: 'prismarine-auth',
      authCacheId
    };

    const savedUserInfo = writeSavedUserFile(userInfo, 'microsoft-login');
    return { success: true, user: savedUserInfo };
  } catch (error) {
    console.error('Login error:', error);
    if (ALLOW_OFFICIAL_LAUNCHER_FALLBACK && shouldUseOfficialLauncherFallback(error)) {
      const importedUser = createOfficialLauncherImportedUser(loginHint);
      if (importedUser) {
        const savedImportedUser = writeSavedUserFile(importedUser, 'official-launcher-fallback');
        return {
          success: true,
          user: savedImportedUser,
          warning: 'Microsoft/Xbox-Login war nicht verfügbar. Es wurde automatisch dein offizielles Launcher-Konto übernommen.'
        };
      }
    }

    if (shouldUseOfficialLauncherFallback(error)) {
      return {
        success: false,
        error: `${error.message} Microsoft-Login muss erfolgreich sein, damit Online-Server funktionieren.`
      };
    }

    return { success: false, error: error.message };
  }
});

registerIpcHandler('login-offline', async (_event, username) => createOfflineAccount(username));
registerIpcHandler('get-accounts', async () => getAccountsConfig());
registerIpcHandler('switch-account', async (_event, accountId) => switchAccount(accountId));
registerIpcHandler('remove-account', async (_event, accountId) => removeAccount(accountId));

registerIpcHandler('logout', async () => {
  try {
    clearCurrentUser();
    if (fs.existsSync(USER_FILE)) {
      fs.unlinkSync(USER_FILE);
    }
    setActiveAccountId('');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

registerIpcHandler('get-minecraft-path', async () => DEFAULT_MINECRAFT_DIR, { fallback: () => '' });
registerIpcHandler('get-minecraft-runtime-status', async () => getMinecraftRuntimeStatus(), {
  fallback: () => ({ running: false, pid: 0 })
});
registerIpcHandler('choose-minecraft-path', async () => chooseMinecraftPath());
registerIpcHandler('get-standard-mods-path', async () => getStandardModsPathInfo());
registerIpcHandler('choose-standard-mods-path', async () => chooseStandardModsPath());
registerIpcHandler('reset-standard-mods-path', async () => resetStandardModsPath());
registerIpcHandler('set-minecraft-windows-user-name', async (_event, windowsUserName) => setMinecraftWindowsUserName(windowsUserName));
registerIpcHandler('get-auth-config', async () => getAuthConfig());
registerIpcHandler('set-microsoft-client-id', async (_event, clientId) => setMicrosoftClientId(clientId));
registerIpcHandler('get-theme-config', async () => getThemeConfig());
registerIpcHandler('set-primary-color', async (_event, primaryColor) => setPrimaryColor(primaryColor));
registerIpcHandler('set-theme-mode', async (_event, themeMode) => setThemeMode(themeMode));
registerIpcHandler('set-appearance-mode', async (_event, appearanceMode) => setAppearanceMode(appearanceMode));
registerIpcHandler('set-background-animation', async (_event, backgroundAnimation) => setBackgroundAnimation(backgroundAnimation));
registerIpcHandler('set-live-theme-color', async (_event, primaryColor, appearanceMode) => setLiveThemeColor(primaryColor, appearanceMode), { logArgs: false });
registerIpcHandler('get-language-config', async () => getLanguageConfig());
registerIpcHandler('set-language-preference', async (_event, languagePreference) => setLanguagePreference(languagePreference));
registerIpcHandler('open-launcher-config', async () => openLauncherConfig());
registerIpcHandler('open-external-url', async (_event, url) => {
  const normalizedUrl = String(url || '').trim();
  const allowedHosts = new Set([
    'cloud.oracle.com',
    'www.oracle.com',
    'signup.oraclecloud.com',
    'docs.oracle.com',
    'discord.gg',
    'youtube.com',
    'www.youtube.com'
  ]);
  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch (_error) {
    return { success: false, error: 'Ungültige URL.' };
  }
  if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname)) {
    return { success: false, error: 'Diese URL ist im Launcher nicht erlaubt.' };
  }
  await shell.openExternal(parsed.toString());
  return { success: true };
});
registerIpcHandler('open-router-settings', async (_event, url) => {
  let parsed;
  try {
    parsed = new URL(String(url || ''));
  } catch (_error) {
    return { success: false, error: 'Ungültige Router-Adresse.' };
  }
  const parts = parsed.hostname.split('.').map(Number);
  const privateIpv4 = parts.length === 4 && (
    parts[0] === 10
    || parts[0] === 192 && parts[1] === 168
    || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31
  );
  if (parsed.protocol !== 'http:' || !privateIpv4) {
    return { success: false, error: 'Nur lokale Router-Adressen sind erlaubt.' };
  }
  await shell.openExternal(parsed.toString());
  return { success: true };
});
registerIpcHandler('configure-swisscom-port-forwarding', async (_event, options = {}) => {
  const password = String(options.password || '');
  const localIp = String(options.localIp || '');
  const internalPort = Math.round(Number(options.internalPort) || 25565);
  if (!password || !/^192\.168\.0\.\d{1,3}$/u.test(localIp) || internalPort < 1024 || internalPort > 65535) {
    return { success: false, error: 'Router-Passwort oder lokale Serveradresse fehlt.' };
  }
  const routerRequest = (pathname, { headers = {}, body = '' } = {}) => new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '192.168.0.254',
      port: 80,
      path: pathname,
      method: 'POST',
      headers: { 'Content-Length': Buffer.byteLength(body), ...headers },
      timeout: 10000
    }, (response) => {
      let text = '';
      response.on('data', (chunk) => { text += chunk.toString(); });
      response.on('end', () => {
        let data;
        try { data = JSON.parse(text); } catch (_error) { data = null; }
        if (response.statusCode >= 200 && response.statusCode < 300) resolve({ payload: data, headers: response.headers });
        else {
          const routerError = data?.errors?.[0] || data?.result?.errors?.[0] || data?.status?.errors?.[0];
          const detail = [routerError?.description, routerError?.info].filter(Boolean).join(' – ');
          const normalizedDetail = detail || text.slice(0, 240);
          if (/shared address space/iu.test(normalizedDetail)) {
            reject(new Error('CGNAT erkannt: Swisscom verwendet „Shared Address Space“. Dein Router hat keine eigene öffentliche IPv4, deshalb ist eine direkte Portweiterleitung nicht möglich. Bitte bei Swisscom eine öffentliche IPv4 aktivieren lassen.'));
          }
          reject(new Error(detail || `Router antwortete mit HTTP ${response.statusCode}: ${text.slice(0, 240)}`));
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Zeitüberschreitung bei der Router-Anmeldung.')));
    request.on('error', reject);
    request.write(body);
    request.end();
  });
  try {
    const loginBody = JSON.stringify({
      service: 'sah.Device.Information',
      method: 'createContext',
      parameters: { applicationName: 'webui', username: 'admin', password }
    });
    const loginResponse = await routerRequest('/ws', {
      headers: {
        Authorization: 'X-Sah-Login',
        'Content-Type': 'application/x-sah-ws-4-call+json'
      },
      body: loginBody
    });
    const login = loginResponse.payload;
    const contextId = String(login?.data?.contextID || login?.result?.data?.contextID || '');
    if (!contextId || Number(login?.status ?? login?.result?.status ?? -1) !== 0) {
      return { success: false, error: 'Router-Anmeldung fehlgeschlagen. Bitte das Internet-Box-Admin-Passwort prüfen.' };
    }
    const sessionCookies = (loginResponse.headers['set-cookie'] || [])
      .map((cookie) => String(cookie).split(';')[0])
      .filter(Boolean)
      .join('; ');
    const authenticatedCall = (pathname, parameters) => routerRequest(pathname, {
      headers: {
        Authorization: `X-Sah ${contextId}`,
        'X-Context': contextId,
        Cookie: sessionCookies,
        Origin: 'http://192.168.0.254',
        Referer: 'http://192.168.0.254/',
        'Content-Type': 'application/x-sah-ws-4-call+json'
      },
      body: JSON.stringify({ parameters })
    });
    await authenticatedCall('/sysbus/Time:getTime', {});
    const existingResponse = await authenticatedCall('/sysbus/Firewall:getPortForwarding', {});
    const existingRules = existingResponse.payload?.status || existingResponse.payload?.result?.status || {};
    const occupiedRule = Object.values(existingRules).find((rule) => {
      const externalPorts = String(rule?.ExternalPort || '').split('-').map(Number);
      return Number(rule?.Protocol) === 6
        && externalPorts.length
        && 25565 >= externalPorts[0]
        && 25565 <= (externalPorts[1] || externalPorts[0]);
    });
    if (occupiedRule && !/^X Launcher Minecraft Java$/iu.test(String(occupiedRule.Description || ''))) {
      return {
        success: false,
        error: `Port 25565 ist im Router bereits durch „${occupiedRule.Description || occupiedRule.Id || 'eine andere Regel'}“ belegt. Entferne diese Regel zuerst.`
      };
    }
    const ruleId = String(occupiedRule?.Id || `${Date.now()}_1`);
    await authenticatedCall('/sysbus/Firewall:setPortForwarding', {
      id: ruleId,
      description: 'X Launcher Minecraft Java',
      persistent: true,
      origin: 'webui',
      sourceInterface: 'data',
      sourcePrefix: '',
      enable: true,
      protocol: '6',
      destinationIPAddress: localIp,
      internalPort: String(internalPort),
      externalPort: '25565'
    });
    await authenticatedCall('/sysbus/Firewall:commit', {});
    return { success: true, message: `Router-Port 25565/TCP wurde auf ${localIp}:${internalPort} weitergeleitet.` };
  } catch (error) {
    return { success: false, error: `Router-Konfiguration fehlgeschlagen: ${error.message || String(error)}` };
  }
}, { logArgs: false });

registerIpcHandler('install-fabric', async () => selectPreferredFabricVersion());
registerIpcHandler('get-server-favorites', async () => getServerFavoritesConfig());
registerIpcHandler('add-server-favorite', async (_event, server) => addServerFavorite(server));
registerIpcHandler('remove-server-favorite', async (_event, serverId) => removeServerFavorite(serverId));
const requireOwner = (action) => (...args) => hasAdminPermission()
  ? action(...args)
  : { success: false, error: 'Diese Hosting-Funktion ist nur für den XClient Owner verfügbar.' };
registerIpcHandler('get-hosted-server-status', requireOwner(async () => getHostedServerStatus()));
registerIpcHandler('start-hosted-server', requireOwner(async (_event, options) => startHostedServer(options)));
registerIpcHandler('stop-hosted-server', requireOwner(async (_event, serverId) => stopHostedServer(serverId)));
registerIpcHandler('restart-hosted-server', requireOwner(async (_event, options) => restartHostedServer(options)));
registerIpcHandler('create-hosted-server', requireOwner(async (_event, options) => createHostedServer(options)));
registerIpcHandler('save-hosted-server', requireOwner(async (_event, options) => saveHostedServer(options)));
registerIpcHandler('select-hosted-server', requireOwner(async (_event, serverId) => selectHostedServer(serverId)));
registerIpcHandler('delete-hosted-server', requireOwner(async (_event, serverId) => deleteHostedServer(serverId)));
registerIpcHandler('send-hosted-server-command', requireOwner(async (_event, serverId, command) => sendHostedServerCommand(serverId, command)));
registerIpcHandler('import-hosted-server-mods', requireOwner(async (_event, filePaths) => importHostedServerMods(filePaths)));
registerIpcHandler('install-hosted-server-modrinth-mod', requireOwner(async (_event, project) => installHostedServerModrinthMod(project)));
registerIpcHandler('remove-hosted-server-mod', requireOwner(async (_event, fileName) => removeHostedServerMod(fileName)));
registerIpcHandler('open-hosted-server-mods-folder', requireOwner(async () => openHostedServerModsFolder()));
registerIpcHandler('open-hosted-server-folder', requireOwner(async () => openHostedServerFolder()));
registerIpcHandler('save-oracle-hosting-credentials', requireOwner(async (_event, credentials) => ORACLE_HOSTING.saveCredentials(credentials)), { logArgs: false });
registerIpcHandler('login-oracle-cloud', requireOwner(async (_event, options) => ORACLE_HOSTING.loginWithOracleCloud(options)), { logArgs: false });
registerIpcHandler('logout-oracle-cloud', requireOwner(async () => ORACLE_HOSTING.logoutOracleCloud()));
registerIpcHandler('hosted-server-vm-action', requireOwner(async (_event, serverId, action) => ORACLE_HOSTING.vmAction(serverId, action)));
registerIpcHandler('create-hosted-server-backup', requireOwner(async () => LOCAL_DIRECT_HOSTING.createBackup()));
registerIpcHandler('restore-hosted-server-backup', requireOwner(async (_event, fileName) => LOCAL_DIRECT_HOSTING.restoreBackup(fileName)));
registerIpcHandler('configure-direct-hosting', requireOwner(async (_event, serverId) => LOCAL_DIRECT_HOSTING.configureDirectConnection(serverId)));

registerIpcHandler('get-mods', async () => getInstalledMods(), { fallback: () => [] });
registerIpcHandler('get-mods-without-sync', async () => getInstalledMods(getEffectiveSelectedVersionId(), {
  skipManagedSync: true
}), { fallback: () => [] });
registerIpcHandler('get-installed-mod-project-ids', async (_event, versionId) => getInstalledManagedModProjectIds(versionId, { sync: false }), { fallback: () => [] });
const activeModrinthSearches = new Map();
registerIpcHandler('search-modrinth-mods', async (event, query, versionId, projectType, offset, limit, forceRefresh) => {
  const senderId = event.sender.id;
  activeModrinthSearches.get(senderId)?.abort();
  const controller = new AbortController();
  activeModrinthSearches.set(senderId, controller);
  try {
    return await searchModrinthMods(query, versionId, projectType, offset, limit, controller.signal, Boolean(forceRefresh));
  } finally {
    if (activeModrinthSearches.get(senderId) === controller) {
      activeModrinthSearches.delete(senderId);
    }
  }
});
registerIpcHandler('install-modrinth-mod', async (_event, project, target) => installModrinthMod(project, target));
registerIpcHandler('remove-mod', async (_event, modId) => removeInstalledMod(modId));
registerIpcHandler('remove-incompatible-mods', async () => {
  const installedMods = await getInstalledMods();
  const incompatibleMods = installedMods.filter((mod) => (
    mod.autoDisabled === true
    && !mod.isProtected
    && !mod.hiddenInModsTab
  ));
  const removed = [];
  const errors = [];

  for (const mod of incompatibleMods) {
    const result = await removeInstalledMod(mod.id);
    if (result.success) {
      removed.push(mod.name);
    } else {
      errors.push(`${mod.name}: ${result.error || 'Konnte nicht entfernt werden.'}`);
    }
  }

  return {
    success: errors.length === 0,
    removed: removed.length,
    removedNames: removed,
    errors,
    message: removed.length === 1
      ? 'Eine unpassende Mod wurde entfernt.'
      : `${removed.length} unpassende Mods wurden entfernt.`
  };
});
registerIpcHandler('refresh-mod', async (_event, modId) => refreshInstalledMod(modId));
registerIpcHandler('set-mod-enabled', async (_event, modId, enabled) => setInstalledModEnabled(modId, enabled));
registerIpcHandler('import-dropped-mods', async (_event, filePaths, options) => importDroppedMods(filePaths, options));
registerIpcHandler('get-skin-config', async () => getSkinConfigWithAccountImport());
registerIpcHandler('choose-skin-file', async () => chooseSkinFile());
registerIpcHandler('clear-skin-file', async () => clearSkinFile());
registerIpcHandler('set-active-skin', async (_event, skinId) => setActiveSkin(skinId));
registerIpcHandler('remove-skin-file', async (_event, skinId) => removeSkinFile(skinId));
registerIpcHandler('set-skin-variant', async (_event, skinId, variant) => setSkinVariant(skinId, variant));
registerIpcHandler('search-online-skins', async (_event, query) => searchOnlineSkins(query));
registerIpcHandler('download-online-skin', async (_event, onlineSkin) => downloadOnlineSkin(onlineSkin));
registerIpcHandler('get-debug-mode', async () => ({
  success: true,
  debugMode: logger.isDebugEnabled(),
  logFile: logger.getLogFilePath(),
  backupDir: BACKUP_DIR,
  diagnosticsDir: DIAGNOSTICS_DIR
}));
registerIpcHandler('run-diagnostics', async () => runLauncherDiagnostics());
registerIpcHandler('set-debug-mode', async (_event, enabled) => setDebugMode(enabled));
registerIpcHandler('open-diagnostics-folder', async () => {
  ensureDir(LOG_DIR);
  ensureDir(DIAGNOSTICS_DIR);
  const openError = await shell.openPath(CONFIG_DIR);
  if (openError) {
    return { success: false, error: `Diagnose-Ordner konnte nicht geöffnet werden: ${openError}` };
  }
  return { success: true, path: CONFIG_DIR };
});

registerIpcHandler('load-mods-folder', async () => {
  const modContext = getActiveModContext();
  ensureDir(modContext.modsDir);
  const openError = await shell.openPath(modContext.modsDir);
  if (openError) {
    return {
      success: false,
      error: `Mods-Ordner konnte nicht geöffnet werden: ${openError}`,
      modsPath: modContext.modsDir
    };
  }

  return { success: true, modsPath: modContext.modsDir };
});

registerIpcHandler('update-all-mods', async () => {
  try {
    const duplicateResult = { removed: 0, warnings: [] };
    const result = await cleanReinstallAllModrinthContent();
    const warnings = uniqueStrings([
      ...(duplicateResult.warnings || []),
      ...(result.warnings || [])
    ]);
    const duplicateMessage = duplicateResult.removed
      ? ` ${duplicateResult.removed} doppelte Mod${duplicateResult.removed === 1 ? '' : 's'} gelöscht.`
      : ' Keine doppelten Mods gefunden.';
    return {
      success: true,
      updated: result.updated,
      total: result.total,
      warnings: result.warnings,
      message: result.message
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

registerIpcHandler('cleanup-numbered-and-duplicate-mods', async () => {
  try {
    fs.writeFileSync(DASH_TWO_MOD_PURGE_MARKER_FILE, 'enabled\n', 'utf8');
    const activeContext = getActiveModContext();
    const roots = uniqueStrings([
      path.join(DEFAULT_MINECRAFT_DIR, 'mods'),
      getConfiguredStandardModsDir(),
      activeContext.modsDir,
      activeContext.disabledModsDir,
      activeContext.libraryDir,
      CONFIG_DIR
    ]).map((entry) => path.resolve(entry));
    const visitedDirectories = new Set();
    const deletedFiles = [];
    const errors = [];

    const deleteDashTwoJars = (directory) => {
      if (!directory || !fs.existsSync(directory)) {
        return;
      }
      let realDirectory;
      try {
        realDirectory = fs.realpathSync(directory).toLowerCase();
      } catch (_error) {
        realDirectory = path.resolve(directory).toLowerCase();
      }
      if (visitedDirectories.has(realDirectory)) {
        return;
      }
      visitedDirectories.add(realDirectory);

      let entries = [];
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch (error) {
        errors.push(`${directory}: ${error.message}`);
        return;
      }
      for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          deleteDashTwoJars(entryPath);
          continue;
        }
        if (!entry.isFile() || !/-2\.jar$/iu.test(entry.name)) {
          continue;
        }
        try {
          try {
            fs.chmodSync(entryPath, 0o666);
          } catch (_error) {
            // Continue: normal files do not need an attribute change.
          }
          fs.unlinkSync(entryPath);
          deletedFiles.push(entryPath);
        } catch (error) {
          errors.push(`${entryPath}: ${error.message}`);
        }
      }
    };

    roots.forEach(deleteDashTwoJars);
    return {
      success: true,
      removed: deletedFiles.length,
      removedNames: deletedFiles.map((filePath) => path.basename(filePath)),
      errors,
      message: deletedFiles.length
        ? `${deletedFiles.length} Mod-Datei${deletedFiles.length === 1 ? '' : 'en'} mit -2.jar am Ende dauerhaft gelöscht.`
        : 'Keine Mod-Dateien mit -2.jar am Ende gefunden.'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

registerIpcHandler('launch-minecraft', async (event, username, passedAccessToken = '', launchOptions = {}) => {
  const runtimeStatus = getMinecraftRuntimeStatus();
  if (minecraftLaunchReserved || runtimeStatus.running) {
    return {
      success: false,
      alreadyRunning: true,
      pid: runtimeStatus.pid || activeMinecraftProcess?.pid || 0,
      error: 'Minecraft läuft bereits. Beende es vollständig, bevor du eine weitere Instanz startest.'
    };
  }

  minecraftLaunchReserved = true;
  const repairMessages = [];
  let lastError = null;
  const sourceWindow = getEventWindow(event);
  sendMinecraftLaunchProgress(sourceWindow, 2, 'Launcher wird vorbereitet');

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await launchMinecraftOnce(username, passedAccessToken, {
        forceRefreshCoreFiles: attempt > 0,
        forceRefreshManagedMods: attempt > 0,
        launchOptions,
        sourceWindow
      });
      minecraftLaunchReserved = false;
      return {
        ...result,
        message: formatAutoRepairLaunchMessage(result.message, repairMessages)
      };
    } catch (error) {
      lastError = error;
      console.error(attempt > 0 ? 'Launch error after auto repair:' : 'Launch error:', error);

      if (attempt > 0 || isNonRepairableLaunchError(error)) {
        break;
      }

      const repairResult = await repairMinecraftLaunchFailure(error, {
        versionId: getEffectiveSelectedVersionId()
      });
      if (!repairResult.repaired) {
        repairMessages.push(...(repairResult.messages || []));
        break;
      }
      repairMessages.push(...repairResult.messages);
    }
  }

  const repairNote = repairMessages.length
    ? ` Automatische Reparatur versucht: ${uniqueStrings(repairMessages).join(' | ')}.`
    : '';

  minecraftLaunchReserved = false;
  return {
    success: false,
    error: `Minecraft konnte nicht aus ${DEFAULT_MINECRAFT_DIR} gestartet werden. ${lastError?.message || 'Unbekannter Fehler.'}${repairNote}`
  };
});

async function launchMinecraftOnce(username, passedAccessToken = '', options = {}) {
  const reportProgress = (progress, status, details = {}) => sendMinecraftLaunchProgress(options.sourceWindow, progress, status, details);
  reportProgress(5, 'Spielerprofil ist bereit', { phase: 'player', phaseStatus: 'done', detail: username });
  ensureDir(DEFAULT_MINECRAFT_DIR);

  reportProgress(10, 'Authentifizierung wird geprüft');
  const savedUser = await readSavedUser();
  const isOfflineMode = shouldLaunchOfflineSession(savedUser, passedAccessToken);
  reportProgress(16, 'Launcher-Dateien werden geprüft', { phase: 'dependencies', phaseStatus: 'loading' });
  await ensureStandardLauncherUpdatedForLaunch();
  reportProgress(23, 'Minecraft-Version wird geladen', { phase: 'version', phaseStatus: 'loading' });
  const selectedVersion = await resolveSelectedVersion(getEffectiveSelectedVersionId());
  const selectedVersionId = selectedVersion.id;
  const versionData = selectedVersion.data;
  const modContext = getActiveModContext(selectedVersionId);
  reportProgress(26, 'Minecraft-Version ist bereit', { phase: 'version', phaseStatus: 'done', detail: getMinecraftVersionName(selectedVersionId, versionData) });
  reportProgress(28, 'Fabric Loader wird geprüft', { phase: 'fabric', phaseStatus: 'loading', detail: selectedVersionId });
  const launchGameDir = modContext.gameDir || DEFAULT_MINECRAFT_DIR;
  ensureDir(launchGameDir);
  ensureDir(modContext.resourcepacksDir || path.join(launchGameDir, 'resourcepacks'));
  ensureDir(modContext.shaderpacksDir || path.join(launchGameDir, 'shaderpacks'));
  ensureVisibleChatOptions(launchGameDir);
  cleanupFullbrightResourcePack(launchGameDir);
  repairKnownBrokenModConfigs(launchGameDir);
  syncOfficialLauncherProfiles();
  const launchServer = resolveLaunchServer(options.launchOptions || {});
  let modSyncResult = {
    synced: 0,
    totalProjects: 0,
    files: [],
    autoDisabledProjects: [],
    disabledProjects: [],
    warnings: []
  };
  reportProgress(31, 'Fabric Loader ist bereit', { phase: 'fabric', phaseStatus: 'done', detail: selectedVersionId });
  reportProgress(33, 'Mods werden geprüft', { phase: 'mods', phaseStatus: 'loading' });
  try {
    const declaredConflictWarnings = resolveFabricDeclaredDefaultConflicts(modContext, []);
    modSyncResult = await MODS_ENGINE.syncManagedModsForVersion(selectedVersionId, {
      modContext,
      launchPreflight: true,
      refreshAll: false,
      refreshDisabledProjects: false
    });
    const postSyncConflictWarnings = resolveFabricDeclaredDefaultConflicts(modContext, []);
    modSyncResult.warnings = uniqueStrings([
      ...(modSyncResult.warnings || []),
      ...declaredConflictWarnings,
      ...postSyncConflictWarnings
    ]);
    const launchModRepairWarnings = await ensureLaunchModFolderHealthy(modContext, selectedVersionId);
    if (launchModRepairWarnings.length) {
      modSyncResult.warnings = uniqueStrings([
        ...(modSyncResult.warnings || []),
        ...launchModRepairWarnings
      ]);
    }
    const voiceChatCompatibilityWarnings = disableIncompatibleVoiceChatGroupAddons(modContext);
    if (voiceChatCompatibilityWarnings.length) {
      modSyncResult.warnings = uniqueStrings([
        ...(modSyncResult.warnings || []),
        ...voiceChatCompatibilityWarnings
      ]);
    }
  } catch (error) {
    logger.warn('Launch mod preflight skipped so Minecraft can start', {
      selectedVersionId,
      minecraftVersion: modContext.minecraftVersion,
      error: serializeError(error)
    });
    modSyncResult.warnings = uniqueStrings([
      ...(modSyncResult.warnings || []),
      `Mod-Prüfung wurde übersprungen: ${error.message}`
    ]);
    reportProgress(33, 'Mod-Prüfung fehlgeschlagen', { phase: 'mods', phaseStatus: 'error', detail: error.message });
    throw error;
  }
  const launchContentEntries = await MODS_ENGINE.getInstalledMods(selectedVersionId, { skipManagedSync: true });
  const activeModItems = launchContentEntries.filter((entry) => String(entry.itemType || 'mod') === 'mod' && entry.enabled !== false);
  reportProgress(43, `${activeModItems.length} Mods sind bereit`, {
    phase: 'mods', phaseStatus: 'done', detail: `${activeModItems.length} aktive Mods`,
    items: activeModItems.map((entry) => ({ name: entry.name, iconUrl: entry.iconUrl || '' }))
  });
  const validateContentPacks = async (projectType, label, progress) => {
    const entries = launchContentEntries.filter((entry) => entry.itemType === projectType && entry.enabled !== false);
    const items = [];
    for (const entry of entries) {
      try {
        const archiveBuffer = await fs.promises.readFile(entry.path);
        const archive = getZipCentralDirectoryEntriesFromBuffer(archiveBuffer);
        if (!archive.entries.length) throw new Error('ZIP enthält keine Dateien.');
        items.push({ name: entry.name, iconUrl: entry.iconUrl || '' });
      } catch (error) {
        items.push({ name: entry.name, iconUrl: entry.iconUrl || '', error: error.message });
      }
    }
    const failed = items.filter((item) => item.error);
    reportProgress(progress, failed.length ? `${failed.length} ${label} fehlerhaft` : `${items.length} ${label} sind bereit`, {
      phase: projectType === 'resourcepack' ? 'resourcepacks' : 'shaders',
      phaseStatus: failed.length ? 'error' : 'done', detail: `${items.length} geprüft`, items
    });
    if (failed.length) throw new Error(`${label}: ${failed.map((item) => `${item.name}: ${item.error}`).join(' | ')}`);
  };
  reportProgress(45, 'Ressourcenpakete werden geprüft', { phase: 'resourcepacks', phaseStatus: 'loading' });
  await validateContentPacks('resourcepack', 'Ressourcenpakete', 50);
  reportProgress(52, 'Shader werden geprüft', { phase: 'shaders', phaseStatus: 'loading' });
  await validateContentPacks('shader', 'Shader', 57);
  let profile;
  reportProgress(44, isOfflineMode ? 'Offline-Profil wird vorbereitet' : 'Microsoft-Authentifizierung wird geprüft');
  if (isOfflineMode) {
    const savedLoginSource = String(savedUser?.loginSource || '').trim().toLowerCase();
    const launcherAccount = savedLoginSource === 'official-launcher'
      ? readOfficialLauncherAccountProfile()
      : null;
    const offlineUsername = launcherAccount?.username
      || normalizeOfflineUsername(savedUser?.username || username || '', 'OfflinePlayer');
    const offlineUuid = savedLoginSource === 'offline'
      ? createOfflineUuid(offlineUsername)
      : normalizeMinecraftUuid(launcherAccount?.uuid || savedUser?.uuid) || createOfflineUuid(offlineUsername);
    profile = {
      username: offlineUsername,
      uuid: offlineUuid,
      accessToken: '0',
      userType: 'legacy'
    };
  } else {
    let minecraftAccessToken = passedAccessToken || savedUser?.accessToken;
    if (!minecraftAccessToken) {
      throw new Error('Bitte melde dich zuerst mit Microsoft an.');
    }
    try {
      profile = await fetchMinecraftProfile(minecraftAccessToken);
    } catch (error) {
      if (!isMinecraftUnauthorizedError(error)) {
        if (isNetworkFetchError(error) && savedUser?.username && savedUser?.uuid) {
          profile = {
            uuid: normalizeMinecraftUuid(savedUser.uuid),
            username: savedUser.username,
            accessToken: minecraftAccessToken
          };
        } else {
          throw error;
        }
      } else {
        const refreshedProfile = await refreshOfficialMinecraftSession(savedUser);
        minecraftAccessToken = refreshedProfile.accessToken;
        profile = {
          uuid: refreshedProfile.uuid,
          username: refreshedProfile.username,
          accessToken: minecraftAccessToken
        };
      }

      if (!profile) {
        throw error;
      }
    }
    profile.accessToken = minecraftAccessToken;
    profile.userType = 'msa';
  }

  const skinSyncResult = await syncActiveSkinForLaunch({
    accessToken: profile.accessToken,
    isOfflineMode
  });
  const activeSkinLaunchConfig = getActiveSkinLaunchConfig();

  reportProgress(64, 'Assets und Bibliotheken werden vorbereitet', { phase: 'dependencies', phaseStatus: 'loading' });
  const preparedVersion = await prepareVersion(selectedVersionId, versionData, {
    forceRefresh: Boolean(options.forceRefreshCoreFiles)
  });

  const requiredJava = preparedVersion.data.javaVersion?.majorVersion || 8;
  reportProgress(78, 'Java-Laufzeit wird vorbereitet', { phase: 'dependencies', phaseStatus: 'loading' });
  const javaInfo = getJavaDetails(preparedVersion.data.javaVersion?.component, requiredJava);
  reportProgress(84, 'Abhängigkeiten sind bereit', { phase: 'dependencies', phaseStatus: 'done', detail: `Java ${javaInfo.majorVersion}` });
  reportProgress(88, 'Minecraft-Prozess wird gestartet', { phase: 'launch', phaseStatus: 'loading' });

  const launchProfileName = getLaunchProfileWindowTitle(modContext);
  const launchResult = await startMinecraftProcess({
    javaPath: javaInfo.path,
    versionId: preparedVersion.id,
    versionData: {
      ...preparedVersion.data,
      loggingConfigPath: preparedVersion.loggingConfigPath
    },
    minecraftDir: DEFAULT_MINECRAFT_DIR,
    gameDir: launchGameDir,
    modsDir: modContext.modsDir,
    profile,
    nativesDir: preparedVersion.nativesDir,
    launchTitle: launchProfileName,
    launchServer,
    activeSkinLaunchConfig,
    sourceWindow: options.sourceWindow
  });
  reportProgress(100, 'Minecraft läuft', { phase: 'launch', phaseStatus: 'done' });
  const serverLaunchMessage = launchServer
    ? ` Direktbeitritt: ${launchServer.name} (${launchServer.host}:${launchServer.port}).`
    : '';

  return {
    success: true,
    message: `Minecraft ${getMinecraftVersionName(preparedVersion.id, preparedVersion.data)} wird als ${profile.username} mit Profil ${launchProfileName} und Java ${javaInfo.majorVersion} gestartet.${serverLaunchMessage} Log: ${launchResult.logPath}${formatSkinLaunchMessage(skinSyncResult)}${formatManagedModsLaunchMessage(modSyncResult)}`,
    pid: launchResult.pid
  };
}

function repairKnownBrokenModConfigs(gameDir) {
  const appleSkinConfigPath = path.join(gameDir, 'config', 'appleskin.json5');
  if (!fs.existsSync(appleSkinConfigPath)) return [];
  const content = fs.readFileSync(appleSkinConfigPath, 'utf8').trim();
  if (!content || (content.startsWith('{') && content.endsWith('}'))) return [];
  ROBUSTNESS.createFileBackup(appleSkinConfigPath, 'corrupt-appleskin-config', {
    operation: 'repairKnownBrokenModConfigs'
  });
  fs.writeFileSync(appleSkinConfigPath, '{}\n', 'utf8');
  return ['AppleSkin-Konfiguration wurde aus einem Backup zurückgesetzt.'];
}

function formatAutoRepairLaunchMessage(message, repairMessages = []) {
  const uniqueMessages = uniqueStrings(repairMessages);
  if (!uniqueMessages.length) {
    return message;
  }

  return `${message} Automatisch repariert: ${uniqueMessages.join(' | ')}`;
}

function formatRequiredResourcePackLaunchMessage(syncResult) {
  if (!syncResult?.fileName) {
    return '';
  }

  return syncResult.installed
    ? ` Ressourcenpaket ${syncResult.fileName} wurde installiert/repariert und aktiviert.`
    : ` Ressourcenpaket ${syncResult.fileName} ist aktiv.`;
}

function isNonRepairableLaunchError(error) {
  const message = String(error?.message || '').toLowerCase();
  return [
    'bitte melde dich',
    'besitzt kein minecraft java edition profil',
    'java wurde nicht gefunden',
    'java-version konnte nicht erkannt',
    'wird benötigt, gefunden wurde java',
    'microsoft login ist noch nicht konfiguriert'
  ].some((fragment) => message.includes(fragment));
}

async function repairMinecraftLaunchFailure(error, context = {}) {
  const messages = [];
  let repaired = false;
  const selectedVersionId = String(context.versionId || getEffectiveSelectedVersionId() || '').trim();
  const modContext = getActiveModContext(selectedVersionId);

  try {
    ensureDir(DEFAULT_MINECRAFT_DIR);
    ensureVisibleChatOptions(DEFAULT_MINECRAFT_DIR);
    cleanupFullbrightResourcePack(DEFAULT_MINECRAFT_DIR);
  } catch (repairError) {
    messages.push(`Basisprüfung unvollständig: ${repairError.message}`);
  }

  const diagnostics = readLaunchDiagnostics(DEFAULT_MINECRAFT_DIR);
  const optionRepairs = repairMinecraftOptionsFromLaunchDiagnostics(diagnostics, error);
  if (optionRepairs.length) {
    repaired = true;
    messages.push(...optionRepairs);
  }

  try {
    const corruptedWarnings = quarantineCorruptedModFiles(modContext);
    if (corruptedWarnings.length) {
      repaired = true;
      messages.push(`Beschädigte Mods deaktiviert: ${corruptedWarnings.length}`);
    }

    const incompatibleMods = deleteFabricIncompatibleMods(modContext, diagnostics);
    if (incompatibleMods.length) {
      repaired = true;
      messages.push(`Inkompatible Mods gelöscht: ${incompatibleMods.join(', ')}`);
    }

    const installedDependencies = await installMissingFabricDependencies(modContext, diagnostics);
    if (installedDependencies.length) {
      repaired = true;
      messages.push(`Fehlende Abhängigkeiten installiert: ${installedDependencies.join(', ')}`);
    }

    const knownCrashMods = disableKnownCrashModsLocally(modContext, diagnostics);
    if (knownCrashMods.length) {
      repaired = true;
      messages.push(`Crash-Mods deaktiviert: ${knownCrashMods.join(', ')}`);
    }

    const disabledSuspects = await disableSuspectModsFromLaunchDiagnostics(modContext, diagnostics);
    if (disabledSuspects.length) {
      repaired = true;
      messages.push(`Verdächtige Mods deaktiviert: ${disabledSuspects.join(', ')}`);
    }
  } catch (repairError) {
    messages.push(`Mod-Reparatur unvollständig: ${repairError.message}`);
  }

  try {
    if (selectedVersionId) {
      const selectedVersion = await resolveSelectedVersion(selectedVersionId);
      await prepareVersion(selectedVersion.id, selectedVersion.data, { forceRefresh: true });
      repaired = true;
      messages.push('Minecraft/Fabric-Dateien geprüft und neu geladen');
      if (false) {
        messages.push(`Mods geprüft: ${formatManagedModsWarning(syncResult.warnings)}`);
      }
    }
  } catch (repairError) {
    if (repaired) {
      messages.push(`Core-Reparatur unvollständig: ${repairError.message}`);
    }
  }

  return {
    repaired,
    messages: uniqueStrings(messages)
  };
}

function parseMissingFabricDependencies(diagnostics) {
  const dependencies = [];
  const text = String(diagnostics || '');
  const pattern = /Install\s+([a-z0-9_.-]+),\s+version\s+(.+?)\s+or\s+later\.?/giu;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    dependencies.push({ id: match[1].toLowerCase(), requirement: `${match[2].trim()} or later` });
  }
  return [...new Map(dependencies.map((entry) => [entry.id, entry])).values()];
}

async function installMissingFabricDependencies(modContext, diagnostics) {
  const installed = [];
  for (const dependency of parseMissingFabricDependencies(diagnostics)) {
    try {
      const result = await installManagedProjectVersion(
        { projectId: dependency.id, slug: dependency.id, title: dependency.id },
        modContext.minecraftVersion,
        { forceRefresh: true, visitedProjects: new Set(), modContext }
      );
      installed.push(result.title || dependency.id);
    } catch (error) {
      logger.warn('Missing Fabric dependency could not be installed automatically', {
        dependency,
        minecraftVersion: modContext.minecraftVersion,
        error: serializeError(error)
      });
    }
  }
  return uniqueStrings(installed);
}

function getFabricModIdsFromIncompatibilityDiagnostics(diagnostics) {
  const ids = [];
  const text = String(diagnostics || '');
  const pattern = /Mod\s+'[^'\r\n]+'\s+\(([a-z0-9_.-]+)\)[^\r\n]*/giu;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    // A missing dependency is repaired instead of deleting the mod that needs it.
    if (/\b(?:is incompatible|requires|conflicts)\b/iu.test(match[0])
        && !/\bwhich is missing\b/iu.test(match[0])) {
      ids.push(match[1].toLowerCase());
    }
  }
  return new Set(ids);
}

function deleteFabricIncompatibleMods(modContext, diagnostics) {
  const incompatibleIds = getFabricModIdsFromIncompatibilityDiagnostics(diagnostics);
  // Known broken builds can fail before Fabric prints the normal incompatibility line.
  if (/chatanimation-fabric-1\.3\.0\+mc26\.2/iu.test(String(diagnostics || ''))) {
    incompatibleIds.add('chatanimation');
  }
  if (!incompatibleIds.size || !fs.existsSync(modContext.modsDir)) {
    return [];
  }

  const removed = [];
  for (const fileName of fs.readdirSync(modContext.modsDir)) {
    if (!fileName.toLowerCase().endsWith('.jar')) continue;
    const filePath = path.join(modContext.modsDir, fileName);
    const manifestInfo = readFabricModManifest(filePath);
    const manifest = manifestInfo?.manifest || null;
    const modId = String(manifest?.id || '').trim().toLowerCase();
    const fileStem = fileName.replace(/\.jar$/iu, '').toLowerCase();
    const matchedId = [...incompatibleIds].find((id) => modId === id || fileStem.startsWith(id));
    if (!matchedId || isProtectedManagedProject('', { slug: matchedId, title: manifest?.name || fileName })) continue;
    try {
      fs.unlinkSync(filePath);
      removed.push(fileName);
      logger.warn('Fabric-incompatible mod deleted automatically', { fileName, modId: matchedId });
    } catch (error) {
      logger.warn('Fabric-incompatible mod could not be deleted', { fileName, error: serializeError(error) });
    }
  }
  return uniqueStrings(removed);
}

function readLaunchDiagnostics(minecraftDir) {
  const logPaths = [
    path.join(CONFIG_DIR, 'last-launch.log'),
    path.join(minecraftDir, 'logs', 'latest.log'),
    getNewestCrashReportPath(minecraftDir)
  ].filter(Boolean);

  return logPaths
    .map((logPath) => readTextTail(logPath, 160000))
    .filter(Boolean)
    .join('\n');
}

function getNewestCrashReportPath(minecraftDir) {
  const crashReportsDir = path.join(minecraftDir, 'crash-reports');
  if (!fs.existsSync(crashReportsDir)) {
    return '';
  }

  try {
    const reports = fs.readdirSync(crashReportsDir)
      .filter((fileName) => fileName.toLowerCase().endsWith('.txt'))
      .map((fileName) => {
        const filePath = path.join(crashReportsDir, fileName);
        let mtimeMs = 0;
        try {
          mtimeMs = fs.statSync(filePath).mtimeMs;
        } catch (_error) {
          mtimeMs = 0;
        }
        return { filePath, mtimeMs };
      })
      .sort((left, right) => right.mtimeMs - left.mtimeMs);
    return reports[0]?.filePath || '';
  } catch (_error) {
    return '';
  }
}

function readTextTail(filePath, maxChars = 120000) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return '';
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return content.length > maxChars ? content.slice(content.length - maxChars) : content;
  } catch (_error) {
    return '';
  }
}

function repairMinecraftOptionsFromLaunchDiagnostics(diagnostics, error) {
  const text = `${diagnostics || ''}\n${error?.message || ''}`.toLowerCase();
  const shouldResetResourcePacks = /resource\s*pack|incompatibleresourcepacks|failed to load pack|pack\.mcmeta/u.test(text);
  const shouldResetShaders = /shader|opengl|glfw|render thread|could not create window|failed to create window/u.test(text);
  const repairs = [];

  if (!shouldResetResourcePacks && !shouldResetShaders) {
    return repairs;
  }

  const optionsPath = path.join(DEFAULT_MINECRAFT_DIR, 'options.txt');
  if (fs.existsSync(optionsPath)) {
    try {
      const original = fs.readFileSync(optionsPath, 'utf8');
      const lines = original.split(/\r?\n/).map((line) => {
        if (shouldResetResourcePacks && line.startsWith('resourcePacks:')) {
          return 'resourcePacks:[]';
        }
        if (shouldResetResourcePacks && line.startsWith('incompatibleResourcePacks:')) {
          return 'incompatibleResourcePacks:[]';
        }
        if (shouldResetShaders && line.startsWith('fullscreen:')) {
          return 'fullscreen:false';
        }
        return line;
      });
      const next = lines.join('\n');
      if (next !== original) {
        fs.writeFileSync(optionsPath, next, 'utf8');
        repairs.push('Minecraft-Optionen zurückgesetzt');
      }
    } catch (_error) {
      // Option repair is best-effort; other repair steps can still help.
    }
  }

  const shaderOptionsPath = path.join(DEFAULT_MINECRAFT_DIR, 'optionsshaders.txt');
  if (shouldResetShaders && fs.existsSync(shaderOptionsPath)) {
    try {
      const original = fs.readFileSync(shaderOptionsPath, 'utf8');
      const next = original
        .split(/\r?\n/)
        .map((line) => line.startsWith('shaderPack:') ? 'shaderPack:OFF' : line)
        .join('\n');
      if (next !== original) {
        fs.writeFileSync(shaderOptionsPath, next, 'utf8');
        repairs.push('Shader deaktiviert');
      }
    } catch (_error) {
      // ignore
    }
  }

  return repairs;
}

function disableKnownCrashModsLocally(modContext, diagnostics) {
  const text = String(diagnostics || '').toLowerCase();
  if (!text || !fs.existsSync(modContext.modsDir)) {
    return [];
  }

  const rules = [
    {
      id: 'voicechat-names',
      match: [
        'voicechat-names.mixins.json:groupchatmanagermixin',
        'from mod voicechat-names',
        'mod voicechat-names'
      ],
      filePatterns: [/^voicechat-names.*\.jar$/iu]
    },
    {
      id: 'krypton',
      match: ['krypton.mixins.json', 'from mod krypton', 'mod krypton'],
      filePatterns: [/^krypton.*\.jar$/iu]
    }
  ];
  const disabled = [];

  ensureDir(getDisabledModsDir(modContext));
  for (const rule of rules) {
    if (!rule.match.some((fragment) => text.includes(fragment))) {
      continue;
    }

    for (const fileName of fs.readdirSync(modContext.modsDir)) {
      if (!rule.filePatterns.some((pattern) => pattern.test(fileName))) {
        continue;
      }

      const sourcePath = path.join(modContext.modsDir, fileName);
      const targetPath = path.join(getDisabledModsDir(modContext), fileName);
      if (!isPathInsideDirectory(modContext.modsDir, sourcePath)
          || !isPathInsideDirectory(getDisabledModsDir(modContext), targetPath)
          || !fs.existsSync(sourcePath)) {
        continue;
      }

      const movedPath = moveFileIfExists(sourcePath, targetPath);
      if (movedPath) {
        disabled.push(fileName);
        logger.warn('Known crash mod disabled locally', {
          rule: rule.id,
          fileName,
          movedPath,
          minecraftVersion: modContext.minecraftVersion
        });
      }
    }
  }

  return uniqueStrings(disabled);
}

function disableIncompatibleVoiceChatGroupAddons(modContext) {
  if (!fs.existsSync(modContext.modsDir)) {
    return [];
  }

  const mods = fs.readdirSync(modContext.modsDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.jar'))
    .map((fileName) => ({
      fileName,
      manifest: readFabricModManifest(path.join(modContext.modsDir, fileName))?.manifest || null
    }));
  const voiceChatNames = mods.find(({ manifest }) => String(manifest?.id || '').toLowerCase() === 'voicechat-names'
    && String(manifest?.version || '') === '1.0.0');
  const simpleVoiceChat = mods.find(({ manifest }) => String(manifest?.id || '').toLowerCase() === 'voicechat'
    && /^2\.6\./u.test(String(manifest?.version || '')));
  const voiceChatNamesFile = voiceChatNames?.fileName || '';
  const simpleVoiceChatFile = simpleVoiceChat?.fileName || '';
  if (!voiceChatNamesFile || !simpleVoiceChatFile) {
    return [];
  }

  const sourcePath = path.join(modContext.modsDir, voiceChatNamesFile);
  const targetPath = path.join(getDisabledModsDir(modContext), voiceChatNamesFile);
  if (!isPathInsideDirectory(modContext.modsDir, sourcePath)
      || !isPathInsideDirectory(getDisabledModsDir(modContext), targetPath)) {
    return [];
  }

  ensureDir(getDisabledModsDir(modContext));
  const movedPath = moveFileIfExists(sourcePath, targetPath);
  if (!movedPath) {
    return [];
  }

  const reason = 'Voice Chat Names 26.2-1.0.0 erwartet eine veraltete GroupChatManager-Signatur und ist mit Simple Voice Chat 2.6.x für Minecraft 26.2 inkompatibel.';
  rememberDisabledFileReason(modContext, voiceChatNamesFile, {
    automated: true,
    source: 'launch-preflight',
    reason,
    technicalEvidence: 'GroupChatManagerMixin: expected CallbackInfoReturnable, addon injects boolean + CallbackInfoReturnable'
  });
  recordModDisableEntry(modContext, {
    fileName: voiceChatNamesFile,
    filePath: movedPath,
    reason,
    technicalEvidence: 'InvalidInjectionException in voicechat-names GroupChatManagerMixin'
  });
  return [`${voiceChatNamesFile} wurde wegen einer inkompatiblen Gruppen-Mixin-Signatur deaktiviert; Simple Voice Chat bleibt aktiv.`];
}

async function disableSuspectModsFromLaunchDiagnostics(modContext, diagnostics) {
  if (!diagnostics || !fs.existsSync(modContext.modsDir)) {
    return [];
  }

  const suspectText = extractSuspectLaunchDiagnosticText(diagnostics);
  if (!suspectText) {
    return [];
  }

  const candidates = getLaunchRepairModCandidates(modContext);
  const disabled = [];
  for (const candidate of candidates) {
    if (candidate.protected) {
      continue;
    }

    const evidence = candidate.terms
      .map((term) => getSuspectTermEvidence(term, suspectText))
      .find(Boolean);
    if (!evidence) {
      continue;
    }

    if (candidate.projectId) {
      try {
        await installManagedProjectVersion({ projectId: candidate.projectId }, modContext.minecraftVersion, {
          forceRefresh: true,
          visitedProjects: new Set(),
          modContext
        });
        await syncManagedModsForVersion(modContext.versionId, {
          modContext,
          refreshAll: true,
          refreshDisabledProjects: false
        });
        logger.info('Suspect managed mod repaired through Modrinth before disable', {
          projectId: candidate.projectId,
          title: candidate.title,
          minecraftVersion: modContext.minecraftVersion,
          evidence
        });
        continue;
      } catch (error) {
        logger.warn('Suspect managed mod Modrinth repair failed before disable', {
          projectId: candidate.projectId,
          title: candidate.title,
          minecraftVersion: modContext.minecraftVersion,
          evidence,
          error: serializeError(error)
        });
      }
    } else if (candidate.filePath) {
      const repairResult = await repairLocalModFileWithModrinthBeforeDisable(candidate.filePath, modContext, modContext.minecraftVersion, {
        reason: `launch diagnostics suspect: ${evidence}`
      });
      if (repairResult.repaired) {
        await syncManagedModsForVersion(modContext.versionId, {
          modContext,
          refreshAll: true,
          refreshDisabledProjects: false
        });
        continue;
      }
    }

    const modId = candidate.projectId ? `project:${candidate.projectId}` : `file:${candidate.filePath}`;
    const result = await setInstalledModEnabled(modId, false, {
      automated: true,
      reason: 'Launcher-Diagnose nennt diese Mod in einem technischen Startfehler.',
      technicalEvidence: evidence
    });
    if (result?.success) {
      disabled.push(candidate.title);
    }

    if (disabled.length >= 2) {
      break;
    }
  }

  return disabled;
}

function getSuspectTermEvidence(term, diagnosticsText) {
  const normalizedTerm = String(term || '').trim();
  if (!normalizedTerm) {
    return '';
  }

  const escapedTerm = escapeRegExp(normalizedTerm);
  const boundaryPattern = new RegExp(`(^|[^a-zA-Z0-9_])${escapedTerm}($|[^a-zA-Z0-9_])`, 'i');
  const repairKeywordPattern = /(?:requires|missing|required|not found|could not find|cannot find|failed to load|incompatible|conflict|unsupported|invalid|dependency|version)/i;
  const lines = String(diagnosticsText || '').split(/\r?\n/u);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || '';
    if (!boundaryPattern.test(line)) {
      continue;
    }

    const evidenceWindow = lines
      .slice(Math.max(0, index - 1), Math.min(lines.length, index + 2))
      .join(' ')
      .replace(/\s+/gu, ' ')
      .trim();
    if (repairKeywordPattern.test(evidenceWindow)) {
      return evidenceWindow.slice(0, 600);
    }
  }

  return '';
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSuspectLaunchDiagnosticText(diagnostics) {
  const lines = String(diagnostics || '').split(/\r?\n/);
  const selected = new Set();
  const marker = /exception|error|crash|failed|failure|incompatible|requires|missing|conflict|could not|cannot|mod resolution|net\.fabricmc\.loader|mixin/i;

  for (let index = 0; index < lines.length; index += 1) {
    if (!marker.test(lines[index])) {
      continue;
    }

    const start = Math.max(0, index - 3);
    const end = Math.min(lines.length - 1, index + 6);
    for (let lineIndex = start; lineIndex <= end; lineIndex += 1) {
      selected.add(lines[lineIndex].toLowerCase());
    }
  }

  return Array.from(selected).join('\n');
}

function getLaunchRepairModCandidates(modContext) {
  const state = readModsState(modContext);
  const managedFilesByPath = new Map(
    (state.activeSync?.files || []).map((entry) => [path.resolve(entry.targetPath), entry])
  );

  return fs.readdirSync(modContext.modsDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.jar'))
    .map((fileName) => {
      const filePath = path.join(modContext.modsDir, fileName);
      if (!isPathInsideDirectory(modContext.modsDir, filePath)) {
        return null;
      }

      const managedEntry = managedFilesByPath.get(path.resolve(filePath));
      const projectId = String(managedEntry?.projectId || '').trim();
      const project = projectId ? state.projects?.[projectId] : null;
      const manifestInfo = readFabricModManifest(filePath);
      const manifest = manifestInfo?.manifest || {};
      const manifestId = String(manifest.id || '').trim();
      const manifestName = String(manifest.name || '').trim();
      const title = project?.title || manifestName || manifestId || fileName;
      const baseName = path.basename(fileName, '.jar');
      const terms = uniqueStrings([
        fileName,
        baseName,
        manifestId,
        manifestName,
        projectId,
        project?.slug,
        project?.title
      ])
        .map((term) => term.toLowerCase())
        .filter((term) => term.length >= 3);

      return {
        fileName,
        filePath,
        projectId,
        title,
        terms,
        protected: isRequiredModFileName(fileName) || (projectId && isManagedProjectRemoveLocked(projectId, project))
      };
    })
    .filter(Boolean);
}

function ensureDir(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

function isSafeSettingsFileName(fileName) {
  return /^options.*\.txt$/i.test(String(fileName || '').trim());
}

function listSafeSettingsFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory)
    .filter((fileName) => isSafeSettingsFileName(fileName))
    .filter((fileName) => {
      const filePath = path.join(directory, fileName);
      return isPathInsideDirectory(directory, filePath) && fs.statSync(filePath).isFile();
    });
}

function copySafeSettingsFile(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
  try {
    const stats = fs.statSync(sourcePath);
    fs.utimesSync(targetPath, stats.atime, stats.mtime);
  } catch (_error) {
    // Timestamp preservation is helpful for future sync decisions, but not required.
  }
}

function resolveProfileSettingsDirectory(packId = '') {
  const normalizedPackId = String(packId || '').trim();
  if (!normalizedPackId) {
    return { id: '', name: 'Launcher-Standard', directory: DEFAULT_MINECRAFT_DIR };
  }
  const pack = readPacksState().packs.find((entry) => entry.id === normalizedPackId);
  return pack ? { id: pack.id, name: pack.name, directory: pack.packDir } : null;
}

function copyProfileSettings(packId = '') {
  const profile = resolveProfileSettingsDirectory(packId);
  if (!profile) return { success: false, error: 'Das Profil wurde nicht gefunden.' };
  const fileNames = listSafeSettingsFiles(profile.directory);
  if (!fileNames.length) return { success: false, error: 'Dieses Profil hat noch keine Minecraft-Einstellungen.' };

  ensureDir(PROFILE_SETTINGS_CLIPBOARD_DIR);
  for (const existingName of listSafeSettingsFiles(PROFILE_SETTINGS_CLIPBOARD_DIR)) {
    fs.rmSync(path.join(PROFILE_SETTINGS_CLIPBOARD_DIR, existingName), { force: true });
  }
  for (const fileName of fileNames) {
    copySafeSettingsFile(
      path.join(profile.directory, fileName),
      path.join(PROFILE_SETTINGS_CLIPBOARD_DIR, fileName)
    );
  }
  fs.writeFileSync(path.join(PROFILE_SETTINGS_CLIPBOARD_DIR, 'source.json'), JSON.stringify({
    packId: profile.id,
    profileName: profile.name,
    copiedAt: new Date().toISOString()
  }, null, 2), 'utf8');
  return { success: true, count: fileNames.length, sourceName: profile.name, message: `Einstellungen von ${profile.name} kopiert.` };
}

function pasteProfileSettings(packId = '') {
  const profile = resolveProfileSettingsDirectory(packId);
  if (!profile) return { success: false, error: 'Das Profil wurde nicht gefunden.' };
  const fileNames = listSafeSettingsFiles(PROFILE_SETTINGS_CLIPBOARD_DIR);
  if (!fileNames.length) return { success: false, error: 'Kopiere zuerst die Einstellungen eines Profils.' };

  ensureDir(profile.directory);
  for (const fileName of fileNames) {
    copySafeSettingsFile(
      path.join(PROFILE_SETTINGS_CLIPBOARD_DIR, fileName),
      path.join(profile.directory, fileName)
    );
  }
  return { success: true, count: fileNames.length, targetName: profile.name, message: `Einstellungen in ${profile.name} eingefügt.` };
}

function ensureVisibleChatOptions(minecraftDir) {
  const optionsPath = path.join(minecraftDir, 'options.txt');
  if (!fs.existsSync(optionsPath)) {
    return;
  }

  try {
    const originalContent = fs.readFileSync(optionsPath, 'utf8');
    let updatedContent = originalContent.replace(/^chatScale:(.+)$/m, (_match, value) => {
      const numericValue = Number(String(value || '').trim());
      return Number.isFinite(numericValue) && numericValue <= 0 ? 'chatScale:1.0' : `chatScale:${value}`;
    });

    // `chatVisibility:1` allows only system messages on newer versions, which
    // makes incoming server messages visible while blocking the player's own
    // normal chat input. Force full chat visibility for launcher starts.
    updatedContent = updatedContent.replace(/^chatVisibility:.+$/m, 'chatVisibility:0');
    updatedContent = updatedContent.replace(/^onlyShowSecureChat:.+$/m, 'onlyShowSecureChat:false');

    if (updatedContent !== originalContent) {
      fs.writeFileSync(optionsPath, updatedContent, 'utf8');
    }
  } catch (error) {
    console.warn('Konnte Chat-Optionen nicht anpassen:', error);
  }
}

function cleanupFullbrightResourcePack(minecraftDir) {
  try {
    const resourcePacksDir = path.join(minecraftDir, 'resourcepacks');
    const packPath = path.join(resourcePacksDir, FULLBRIGHT_RESOURCE_PACK_FILE_NAME);
    const legacyPackPath = path.join(resourcePacksDir, 'X Client Fullbright');
    const optionsPath = path.join(minecraftDir, 'options.txt');

    removeLegacyFullbrightResourcePackOptions(optionsPath);
    removeOptionsTextListEntry(optionsPath, 'resourcePacks', FULLBRIGHT_RESOURCE_PACK_ID);

    for (const obsoletePath of [packPath, legacyPackPath]) {
      if (fs.existsSync(obsoletePath)) {
        fs.rmSync(obsoletePath, { recursive: true, force: true });
      }
    }
  } catch (error) {
    console.warn('Konnte Fullbright-Ressourcenpaket nicht entfernen:', error);
  }
}

function writeTextFileIfChanged(filePath, content) {
  const normalizedContent = String(content || '').replace(/\r?\n/g, '\n');
  if (fs.existsSync(filePath)) {
    try {
      if (fs.readFileSync(filePath, 'utf8').replace(/\r?\n/g, '\n') === normalizedContent) {
        return;
      }
    } catch (_error) {
      // Rewrite unreadable managed files below.
    }
  }

  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, normalizedContent, 'utf8');
}

function removeLegacyFullbrightResourcePackOptions(optionsPath) {
  for (const legacyId of LEGACY_FULLBRIGHT_RESOURCE_PACK_IDS) {
    removeOptionsTextListEntry(optionsPath, 'resourcePacks', legacyId);
  }
}

function ensureOptionsTextListEntry(optionsPath, optionName, entry, options = {}) {
  ensureDir(path.dirname(optionsPath));
  const normalizedEntry = String(entry || '').trim();
  if (!normalizedEntry) {
    return;
  }

  const originalContent = fs.existsSync(optionsPath) ? fs.readFileSync(optionsPath, 'utf8') : '';
  const linePattern = new RegExp(`^${escapeRegExp(optionName)}:(.*)$`, 'm');
  const match = originalContent.match(linePattern);
  let entries = match ? parseMinecraftOptionsStringList(match[1]) : [];

  entries = entries
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .filter((item) => item !== normalizedEntry);

  if (options.ensureVanilla && !entries.includes('vanilla')) {
    entries.unshift('vanilla');
  }
  entries.push(normalizedEntry);

  const nextLine = `${optionName}:${JSON.stringify(entries)}`;
  const nextContent = match
    ? originalContent.replace(linePattern, nextLine)
    : `${originalContent.replace(/\s*$/, '')}${originalContent.trim() ? '\n' : ''}${nextLine}\n`;

  if (nextContent !== originalContent) {
    fs.writeFileSync(optionsPath, nextContent, 'utf8');
  }
}

function removeOptionsTextListEntry(optionsPath, optionName, entry) {
  const normalizedEntry = String(entry || '').trim();
  if (!normalizedEntry || !fs.existsSync(optionsPath)) {
    return false;
  }

  const originalContent = fs.readFileSync(optionsPath, 'utf8');
  const linePattern = new RegExp(`^${escapeRegExp(optionName)}:(.*)$`, 'm');
  const match = originalContent.match(linePattern);
  if (!match) {
    return false;
  }

  const entries = parseMinecraftOptionsStringList(match[1])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => item !== normalizedEntry);
  const nextLine = `${optionName}:${JSON.stringify(entries)}`;
  const nextContent = originalContent.replace(linePattern, nextLine);
  if (nextContent !== originalContent) {
    fs.writeFileSync(optionsPath, nextContent, 'utf8');
    return true;
  }
  return false;
}

function parseMinecraftOptionsStringList(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '')) : [];
  } catch (_error) {
    const items = [];
    const pattern = /"((?:\\.|[^"\\])*)"/g;
    let match;
    while ((match = pattern.exec(value)) !== null) {
      try {
        items.push(JSON.parse(`"${match[1]}"`));
      } catch (_decodeError) {
        items.push(match[1]);
      }
    }
    return items;
  }
}

function getDefaultLauncherConfig() {
  return {
    microsoftClientId: '',
    primaryColor: '#00d9ff',
    themeMode: 'manual',
    appearanceMode: 'system',
    backgroundAnimation: 'default',
    minecraftWindowsUserName: DEFAULT_WINDOWS_USER_NAME,
    minecraftFolderName: DEFAULT_MINECRAFT_FOLDER_NAME,
    minecraftPath: '',
    standardModsPath: '',
    debugMode: false,
    selectedVersionId: '',
    languagePreference: 'auto',
    notes: 'Microsoft/Xbox-Login nutzt eine integrierte Standard-Client-ID. Keine eigene Azure-App nötig.'
  };
}

function ensureLauncherConfig() {
  ROBUSTNESS.readJsonFile(LAUNCHER_CONFIG_FILE, getDefaultLauncherConfig(), {
    label: 'launcher-config',
    normalize: (value) => ({
      ...getDefaultLauncherConfig(),
      ...(value && typeof value === 'object' ? value : {})
    })
  });
}

function readLauncherConfig() {
  return ROBUSTNESS.readJsonFile(LAUNCHER_CONFIG_FILE, getDefaultLauncherConfig(), {
    label: 'launcher-config',
    normalize: (value) => ({
      ...getDefaultLauncherConfig(),
      ...(value && typeof value === 'object' ? value : {})
    })
  });
}

function writeLauncherConfig(config) {
  const currentConfig = readLauncherConfig();
  const nextConfig = {
    ...currentConfig,
    ...config
  };
  const changedKeys = Object.keys(config || {});
  const isCriticalConfigChange = changedKeys.some((key) => !['primaryColor', 'themeMode', 'appearanceMode', 'backgroundAnimation', 'debugMode', 'languagePreference'].includes(key));
  ROBUSTNESS.writeJsonFileAtomic(LAUNCHER_CONFIG_FILE, nextConfig, {
    label: 'launcher-config',
    backup: isCriticalConfigChange,
    metadata: { operation: 'writeLauncherConfig' }
  });
  const nextDebugMode = parseBooleanEnv(nextConfig.debugMode);
  if (logger.isDebugEnabled() !== nextDebugMode) {
    logger.setDebugEnabled(nextDebugMode);
  }
  return nextConfig;
}

function normalizeLanguagePreference(languagePreference) {
  const normalized = String(languagePreference || '').trim().toLowerCase();
  return ['auto', 'de', 'en'].includes(normalized) ? normalized : 'auto';
}

function getSystemLauncherLanguage() {
  const locale = String(app?.getLocale?.() || Intl.DateTimeFormat().resolvedOptions().locale || '').toLowerCase();
  return locale.startsWith('de') ? 'de' : 'en';
}

function resolveLauncherLanguage(languagePreference = readLauncherConfig().languagePreference) {
  const normalizedPreference = normalizeLanguagePreference(languagePreference);
  return normalizedPreference === 'auto' ? getSystemLauncherLanguage() : normalizedPreference;
}

function getLanguageConfig() {
  const preference = normalizeLanguagePreference(readLauncherConfig().languagePreference);
  return {
    success: true,
    preference,
    language: resolveLauncherLanguage(preference)
  };
}

function setLanguagePreference(languagePreference) {
  const preference = normalizeLanguagePreference(languagePreference);
  writeLauncherConfig({ languagePreference: preference });
  return getLanguageConfig();
}

function isDebugModeEnabled() {
  try {
    return parseBooleanEnv(readLauncherConfig().debugMode);
  } catch (_error) {
    return parseBooleanEnv(process.env.X_LAUNCHER_DEBUG);
  }
}

function normalizeMinecraftDirectory(minecraftDir) {
  const normalized = path.normalize(String(minecraftDir || '').trim());
  if (!normalized || !path.isAbsolute(normalized)) {
    return '';
  }
  return normalized;
}

function normalizeConfiguredMinecraftDirectory(minecraftDir) {
  const normalized = normalizeMinecraftDirectory(minecraftDir);
  if (!normalized) {
    return '';
  }

  const folderName = path.basename(normalized).toLowerCase();
  if (folderName !== 'versions') {
    return normalized;
  }

  const parentDir = path.dirname(normalized);
  const parentName = path.basename(parentDir).toLowerCase();
  if (parentName === DEFAULT_MINECRAFT_FOLDER_NAME) {
    return parentDir;
  }

  if (parentName === 'roaming') {
    return path.join(parentDir, DEFAULT_MINECRAFT_FOLDER_NAME);
  }

  return normalized;
}

function normalizeMinecraftFolderName(folderName) {
  const normalized = String(folderName || '').trim();
  if (!normalized || normalized === '.' || normalized === '..') {
    return '';
  }

  if (path.isAbsolute(normalized) || normalized !== path.basename(normalized)) {
    return '';
  }

  if (/[<>:"/\\|?*\x00-\x1F]/.test(normalized)) {
    return '';
  }

  return normalized.slice(0, 80);
}

function normalizeWindowsUserName(userName) {
  const normalized = String(userName || '').trim();
  if (!normalized || normalized === '.' || normalized === '..') {
    return '';
  }

  if (path.isAbsolute(normalized) || normalized !== path.basename(normalized)) {
    return '';
  }

  if (/[<>:"/\\|?*\x00-\x1F]/.test(normalized)) {
    return '';
  }

  return normalized.slice(0, 80);
}

function getConfiguredWindowsUserName() {
  const config = readLauncherConfig();
  const configuredUserName = normalizeWindowsUserName(config.minecraftWindowsUserName);
  if (configuredUserName) {
    return configuredUserName;
  }

  const legacyPath = normalizeConfiguredMinecraftDirectory(config.minecraftPath);
  const legacyParts = legacyPath.split(/[\\/]/).filter(Boolean);
  const usersIndex = legacyParts.findIndex((part) => part.toLowerCase() === 'users');
  if (usersIndex >= 0 && legacyParts[usersIndex + 1]) {
    return normalizeWindowsUserName(legacyParts[usersIndex + 1]) || DEFAULT_WINDOWS_USER_NAME;
  }

  return DEFAULT_WINDOWS_USER_NAME;
}

function getConfiguredMinecraftDirectory() {
  return FALLBACK_MINECRAFT_DIR;
}

function setActiveMinecraftDirectory(minecraftDir) {
  DEFAULT_MINECRAFT_DIR = FALLBACK_MINECRAFT_DIR;
  RESOURCEPACKS_DIR = path.join(DEFAULT_MINECRAFT_DIR, 'resourcepacks');
  SHADERPACKS_DIR = path.join(DEFAULT_MINECRAFT_DIR, 'shaderpacks');
}

function getNormalMinecraftModsDir() {
  return path.join(DEFAULT_MINECRAFT_DIR, 'mods');
}

function normalizeStandardModsDirectory(modsDir) {
  const normalized = path.normalize(String(modsDir || '').trim());
  if (!normalized || !path.isAbsolute(normalized)) {
    return '';
  }

  return normalized;
}

function getConfiguredStandardModsDir() {
  return getNormalMinecraftModsDir();
}

function getStandardModsPathInfo() {
  const modsPath = getConfiguredStandardModsDir();
  const defaultModsPath = getNormalMinecraftModsDir();
  return {
    success: true,
    modsPath,
    defaultModsPath,
    custom: getComparablePath(modsPath) !== getComparablePath(defaultModsPath)
  };
}

function getSelectedVersionId() {
  const config = readLauncherConfig();
  return String(config.selectedVersionId || '').trim();
}

function getDefaultPacksState() {
  return {
    activePackId: '',
    packs: []
  };
}

function ensurePacksState() {
  ensureDir(PACKS_DIR);
  if (!fs.existsSync(PACKS_STATE_FILE)) {
    ROBUSTNESS.writeJsonFileAtomic(PACKS_STATE_FILE, getDefaultPacksState(), {
      label: 'packs-state',
      backup: false,
      metadata: { createdDefault: true }
    });
  }
}

function normalizePackName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 48);
}

function createPackId(name, existingPackIds = []) {
  const normalized = normalizePackName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'pack';
  const reservedIds = new Set((existingPackIds || []).map((entry) => String(entry || '').trim()).filter(Boolean));

  let candidate = '';
  do {
    candidate = `${normalized}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  } while (
    reservedIds.has(candidate)
    || fs.existsSync(path.join(PACKS_DIR, sanitizePathSegment(candidate)))
  );

  return candidate;
}

function normalizePacksState(rawState) {
  const rawPacks = Array.isArray(rawState?.packs) ? rawState.packs : [];
  const packs = rawPacks
    .map((pack) => {
      const id = String(pack?.id || '').trim();
      const name = normalizePackName(pack?.name);
      const versionId = String(pack?.versionId || '').trim();
      if (!id || !name || !versionId) {
        return null;
      }

      const packDir = path.join(PACKS_DIR, sanitizePathSegment(id));
      const modsDir = path.join(packDir, 'mods');
      const resourcepacksDir = path.join(packDir, 'resourcepacks');
      const shaderpacksDir = path.join(packDir, 'shaderpacks');
      return {
        id,
        name,
        versionId,
        createdAt: String(pack?.createdAt || '').trim() || new Date().toISOString(),
        updatedAt: String(pack?.updatedAt || '').trim() || new Date().toISOString(),
        packDir,
        modsDir,
        resourcepacksDir,
        shaderpacksDir
      };
    })
    .filter(Boolean);
  const activePackId = String(rawState?.activePackId || '').trim();

  return {
    activePackId: packs.some((pack) => pack.id === activePackId) ? activePackId : '',
    packs
  };
}

function readPacksState() {
  ensurePacksState();
  return ROBUSTNESS.readJsonFile(PACKS_STATE_FILE, getDefaultPacksState(), {
    label: 'packs-state',
    normalize: normalizePacksState
  });
}

function writePacksState(state) {
  ensurePacksState();
  const normalizedState = normalizePacksState(state);
  ROBUSTNESS.writeJsonFileAtomic(PACKS_STATE_FILE, {
    activePackId: normalizedState.activePackId,
    packs: normalizedState.packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      versionId: pack.versionId,
      createdAt: pack.createdAt,
      updatedAt: pack.updatedAt
    }))
  }, {
    label: 'packs-state',
    metadata: { operation: 'writePacksState' }
  });
  return normalizedState;
}

function getOfficialLauncherProfilesPath() {
  return path.join(DEFAULT_MINECRAFT_DIR, OFFICIAL_LAUNCHER_PROFILES_FILE_NAME);
}

function readOfficialLauncherProfiles() {
  const profilesPath = getOfficialLauncherProfilesPath();
  if (!fs.existsSync(profilesPath)) {
    return {
      profiles: {},
      settings: {}
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
    return parsed && typeof parsed === 'object'
      ? {
          ...parsed,
          profiles: parsed.profiles && typeof parsed.profiles === 'object' ? parsed.profiles : {}
        }
      : {
          profiles: {},
          settings: {}
        };
  } catch (error) {
    logger.warn('Official launcher profiles could not be read', {
      path: profilesPath,
      error: serializeError(error)
    });
    return {
      profiles: {},
      settings: {}
    };
  }
}

function writeOfficialLauncherProfiles(profilesData) {
  ensureDir(DEFAULT_MINECRAFT_DIR);
  const profilesPath = getOfficialLauncherProfilesPath();
  ROBUSTNESS.writeJsonFileAtomic(profilesPath, profilesData, {
    label: 'official-launcher-profiles',
    metadata: { operation: 'syncOfficialLauncherProfiles' }
  });
}

function getOfficialLauncherProfileIdForContext(modContext) {
  return modContext?.type === 'pack' && modContext.packId
    ? `x-launcher-pack-${sanitizePathSegment(modContext.packId)}`
    : 'x-launcher-standard';
}

function createOfficialLauncherProfileEntry(modContext) {
  const now = new Date().toISOString();
  return {
    created: now,
    gameDir: modContext.gameDir || DEFAULT_MINECRAFT_DIR,
    icon: 'Grass',
    javaArgs: '',
    lastUsed: now,
    lastVersionId: modContext.versionId,
    name: modContext?.type === 'pack'
      ? `X Launcher - ${normalizeMinecraftWindowTitle(modContext.name) || 'Profil'}`
      : 'X Launcher - Standard',
    type: 'custom'
  };
}

function syncOfficialLauncherProfiles() {
  try {
    const profilesData = readOfficialLauncherProfiles();
    const profiles = profilesData.profiles && typeof profilesData.profiles === 'object'
      ? profilesData.profiles
      : {};
    const contexts = [];
    const standardVersionId = getSelectedVersionId();
    if (standardVersionId) {
      contexts.push(getStandardModContext(standardVersionId));
    }
    for (const pack of readPacksState().packs || []) {
      contexts.push(getPackModContext(pack));
    }
    const currentProfileIds = new Set(contexts.map((modContext) => getOfficialLauncherProfileIdForContext(modContext)));
    for (const profileId of Object.keys(profiles)) {
      if (profileId.startsWith('x-launcher-pack-') && !currentProfileIds.has(profileId)) {
        delete profiles[profileId];
      }
    }

    for (const modContext of contexts) {
      ensureDir(modContext.gameDir || DEFAULT_MINECRAFT_DIR);
      ensureDir(modContext.modsDir);
      ensureDir(modContext.resourcepacksDir || path.join(modContext.gameDir || DEFAULT_MINECRAFT_DIR, 'resourcepacks'));
      ensureDir(modContext.shaderpacksDir || path.join(modContext.gameDir || DEFAULT_MINECRAFT_DIR, 'shaderpacks'));

      const profileId = getOfficialLauncherProfileIdForContext(modContext);
      const previousProfile = profiles[profileId] && typeof profiles[profileId] === 'object'
        ? profiles[profileId]
        : {};
      profiles[profileId] = {
        ...previousProfile,
        ...createOfficialLauncherProfileEntry(modContext),
        created: previousProfile.created || new Date().toISOString()
      };
    }

    profilesData.profiles = profiles;
    writeOfficialLauncherProfiles(profilesData);
    return true;
  } catch (error) {
    logger.warn('Official launcher profile sync failed', { error: serializeError(error) });
    return false;
  }
}

function getActivePack() {
  const state = readPacksState();
  return state.packs.find((pack) => pack.id === state.activePackId) || null;
}

function getEffectiveSelectedVersionId() {
  return getActivePack()?.versionId || getSelectedVersionId();
}

function persistEffectiveSelectedVersionId(versionId) {
  const normalizedVersionId = String(versionId || '').trim();
  const activePack = getActivePack();
  if (activePack) {
    const state = readPacksState();
    state.packs = state.packs.map((pack) => (
      pack.id === activePack.id
        ? {
            ...pack,
            versionId: normalizedVersionId,
            updatedAt: new Date().toISOString()
          }
        : pack
    ));
    writePacksState(state);
    return normalizedVersionId;
  }

  writeLauncherConfig({ selectedVersionId: normalizedVersionId });
  return normalizedVersionId;
}

function persistStandardSelectedVersionId(versionId) {
  const normalizedVersionId = String(versionId || '').trim();
  writeLauncherConfig({ selectedVersionId: normalizedVersionId });
  return normalizedVersionId;
}

async function getLatestStandardFabricVersion() {
  const remoteVersions = await getRemoteFabricVersions({ limit: FABRIC_LATEST_FALLBACK_LIMIT });
  return remoteVersions
    .filter((version) => isSupportedMinecraftVersion(version.minecraftVersion))
    .slice()
    .sort((left, right) => getVersionTimestamp(right.releaseTime) - getVersionTimestamp(left.releaseTime))[0] || null;
}

async function checkStandardLauncherUpdates(options = {}) {
  const refreshAll = options.refreshAll !== false;
  const configuredVersionId = getSelectedVersionId();
  const hasConfiguredVersion = isFullFabricReleaseVersionId(configuredVersionId);
  const configuredVersion = hasConfiguredVersion
    ? {
        id: configuredVersionId,
        minecraftVersion: getMinecraftVersionName(configuredVersionId, readLocalVersion(configuredVersionId)?.data)
      }
    : null;
  let latestVersion = null;

  try {
    latestVersion = await getLatestStandardFabricVersion();
  } catch (_error) {
    latestVersion = null;
  }

  let latestLocalVersion = null;
  if (!latestVersion?.id) {
    latestLocalVersion = getPreferredLocalFabricVersion('');
    if (latestLocalVersion?.id
        && !isSupportedMinecraftVersion(getMinecraftVersionName(latestLocalVersion.id, latestLocalVersion.data))) {
      latestLocalVersion = null;
    }
  }
  const latestLocalStandardVersion = latestLocalVersion?.id
    ? {
        id: latestLocalVersion.id,
        minecraftVersion: getMinecraftVersionName(latestLocalVersion.id, latestLocalVersion.data)
      }
    : null;
  let standardVersion = latestVersion || latestLocalStandardVersion || configuredVersion;

  if (!standardVersion?.id) {
    return {
      success: false,
      changed: false,
      error: 'Keine Fabric-Release-Version gefunden.'
    };
  }

  const previousVersionId = getSelectedVersionId();
  const previousMinecraftVersion = previousVersionId
    ? getMinecraftVersionName(previousVersionId, readLocalVersion(previousVersionId)?.data)
    : '';
  const changed = previousVersionId !== standardVersion.id;
  if (changed) {
    persistStandardSelectedVersionId(standardVersion.id);
  }

  const standardContext = getStandardModContext(standardVersion.id);
  const syncResult = await syncManagedModsForVersion(standardVersion.id, {
    modContext: standardContext,
    refreshAll,
    refreshDisabledProjects: true
  });
  const resourcePackResult = await updateDownloadableModrinthProjects(['resourcepack'], standardContext);

  return {
    success: true,
    changed,
    previousVersionId,
    selectedVersionId: standardVersion.id,
    minecraftVersion: standardVersion.minecraftVersion,
    syncedMods: syncResult.synced,
    syncedResourcepacks: resourcePackResult.updated,
    disabledProjects: syncResult.disabledProjects || [],
    warnings: uniqueStrings([...(syncResult.warnings || []), ...(resourcePackResult.warnings || [])]),
    message: changed
      ? `Launcher-Standard wurde ${previousMinecraftVersion ? `von Minecraft ${previousMinecraftVersion} ` : ''}auf Minecraft ${standardVersion.minecraftVersion} aktualisiert.`
      : `Launcher-Standard nutzt Minecraft ${standardVersion.minecraftVersion}.`
  };
}

async function syncPackManagedModsForStartup(options = {}) {
  const refreshAll = Boolean(options.refreshAll);
  const results = [];
  const packsState = readPacksState();

  for (const pack of packsState.packs || []) {
    if (!isFullFabricReleaseVersionId(pack.versionId) || !isProfileFabricVersionAllowed(pack.versionId)) {
      continue;
    }

    const modContext = getPackModContext(pack);
    try {
      const syncResult = await syncManagedModsForVersion(pack.versionId, {
        modContext,
        refreshAll,
        refreshDisabledProjects: true
      });
      const resourcePackResult = await updateDownloadableModrinthProjects(['resourcepack'], modContext);
      results.push({
        success: true,
        packId: pack.id,
        name: pack.name,
        versionId: pack.versionId,
        minecraftVersion: modContext.minecraftVersion,
        syncedMods: syncResult.synced,
        syncedResourcepacks: resourcePackResult.updated,
        disabledProjects: syncResult.disabledProjects || [],
        warnings: uniqueStrings([...(syncResult.warnings || []), ...(resourcePackResult.warnings || [])])
      });
    } catch (error) {
      logger.warn('Startup pack mod sync failed', {
        packId: pack.id,
        versionId: pack.versionId,
        error: serializeError(error)
      });
      results.push({
        success: false,
        packId: pack.id,
        name: pack.name,
        versionId: pack.versionId,
        minecraftVersion: modContext.minecraftVersion,
        error: error.message,
        warnings: [error.message]
      });
    }
  }

  return results;
}

async function runStartupManagedModsCheck(options = {}) {
  const refreshAll = Boolean(options.refreshAll);
  let standardResult = {
    success: true,
    changed: false,
    warnings: []
  };

  try {
    standardResult = await checkStandardLauncherUpdates({ refreshAll });
  } catch (error) {
    logger.warn('Startup standard mod sync failed', { error: serializeError(error) });
    standardResult = {
      success: false,
      changed: false,
      error: error.message,
      warnings: [error.message]
    };
  }

  const packResults = await syncPackManagedModsForStartup({ refreshAll });
  const warnings = uniqueStrings([
    ...(standardResult.warnings || []),
    ...packResults.flatMap((result) => result.warnings || [])
  ]);

  return {
    ...standardResult,
    startupModCheck: true,
    packResults,
    warnings
  };
}

async function ensureStandardLauncherUpdatedForLaunch() {
  startupUpdatePromise = null;
  return null;
}

function getPacksConfig() {
  const state = readPacksState();
  return {
    success: true,
    settingsClipboardAvailable: listSafeSettingsFiles(PROFILE_SETTINGS_CLIPBOARD_DIR).length > 0,
    standardVersionId: getSelectedVersionId(),
    activePackId: state.activePackId,
    packs: state.packs
      .slice()
      .sort((left, right) => getVersionTimestamp(right.updatedAt) - getVersionTimestamp(left.updatedAt))
  };
}

async function createPack(name, versionId) {
  const normalizedName = normalizePackName(name);
  const normalizedVersionId = String(versionId || '').trim();
  if (!normalizedName) {
    return {
      success: false,
      error: 'Bitte gib einen Profil-Namen ein.'
    };
  }

  if (!isFabricVersionId(normalizedVersionId)) {
    return {
      success: false,
      error: 'Ein Profil braucht genau eine Fabric-Version.'
    };
  }

  if (!isFullFabricReleaseVersionId(normalizedVersionId)) {
    return {
      success: false,
      error: 'Bitte wähle eine normale Minecraft-Vollversion aus.'
    };
  }

  if (!isProfileFabricVersionAllowed(normalizedVersionId)) {
    return {
      success: false,
      error: getProfileMinecraftVersionsError()
    };
  }

  await resolveSelectedVersion(normalizedVersionId, { allowProfileVersions: true });

  const state = readPacksState();
  const packId = createPackId(normalizedName, state.packs.map((pack) => pack.id));
  const packDir = path.join(PACKS_DIR, sanitizePathSegment(packId));
  const modsDir = path.join(packDir, 'mods');
  const resourcepacksDir = path.join(packDir, 'resourcepacks');
  const shaderpacksDir = path.join(packDir, 'shaderpacks');

  ensureDir(packDir);
  ensureDir(modsDir);
  ensureDir(resourcepacksDir);
  ensureDir(shaderpacksDir);

  state.packs.push({
    id: packId,
    name: normalizedName,
    versionId: normalizedVersionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    packDir,
    modsDir,
    resourcepacksDir,
    shaderpacksDir
  });
  state.activePackId = packId;
  writePacksState(state);
  syncOfficialLauncherProfiles();

  const packModContext = {
    type: 'pack',
    name: normalizedName,
    packId,
    versionId: normalizedVersionId,
    minecraftVersion: parseFabricVersionId(normalizedVersionId)?.minecraftVersion || '',
    gameDir: packDir,
    modsDir,
    resourcepacksDir,
    shaderpacksDir,
    stateFile: path.join(packDir, 'mods-state.json'),
    libraryDir: path.join(packDir, 'mods-library')
  };

  let warning = '';
  let message = `Profil ${normalizedName} wurde erstellt und die Pflichtmods wurden installiert.`;

  try {
    const installWarnings = [];

    for (const projectReference of DEFAULT_PACK_PROJECTS) {
      const projectId = getModrinthProjectId(projectReference);
      if (isManagedProjectHiddenForMinecraftVersion(projectId, packModContext.minecraftVersion)) {
        continue;
      }

      const installResult = await installManagedProjectVersion(
        projectReference,
        packModContext.minecraftVersion,
        {
          visitedProjects: new Set(),
          modContext: packModContext
        }
      );
      installWarnings.push(...(installResult.warnings || []));
    }

    const syncResult = await syncManagedModsForVersion(normalizedVersionId, {
      modContext: packModContext
    });
    warning = formatManagedModsWarning([...(installWarnings || []), ...(syncResult.warnings || [])]);
    if (warning) {
      message = `Profil ${normalizedName} wurde erstellt. Pflichtmods haben Hinweise: ${warning}`;
    }
  } catch (error) {
    warning = `Pflichtmods konnten nicht automatisch installiert werden: ${error.message}`;
    message = `Profil ${normalizedName} wurde erstellt. ${warning}`;
  }

  return {
    success: true,
    activePackId: packId,
    packs: getPacksConfig().packs,
    warning,
    message
  };
}

function setActivePack(packId) {
  const normalizedPackId = String(packId || '').trim();
  const state = readPacksState();

  if (!normalizedPackId) {
    state.activePackId = '';
    writePacksState(state);
    syncOfficialLauncherProfiles();
    return {
      success: true,
      activePackId: '',
      packs: getPacksConfig().packs,
      message: 'Launcher-Standard wurde aktiviert.'
    };
  }

  const packExists = state.packs.some((pack) => pack.id === normalizedPackId);
  if (!packExists) {
    return {
      success: false,
      error: 'Das Profil wurde nicht gefunden.'
    };
  }

  state.activePackId = normalizedPackId;
  state.packs = state.packs.map((pack) => (
    pack.id === normalizedPackId
      ? { ...pack, updatedAt: new Date().toISOString() }
      : pack
  ));
  writePacksState(state);
  syncOfficialLauncherProfiles();

  const activePack = getActivePack();
  return {
    success: true,
    activePackId: normalizedPackId,
    packs: getPacksConfig().packs,
    message: `${activePack?.name || 'Profil'} wurde aktiviert.`
  };
}

function deletePack(packId) {
  const normalizedPackId = String(packId || '').trim();
  if (!normalizedPackId) {
    return {
      success: false,
      error: 'Kein Profil ausgewählt.'
    };
  }

  const state = readPacksState();
  const pack = state.packs.find((entry) => entry.id === normalizedPackId);
  if (!pack) {
    return {
      success: false,
      error: 'Das Profil wurde nicht gefunden.'
    };
  }

  state.packs = state.packs.filter((entry) => entry.id !== normalizedPackId);
  if (state.activePackId === normalizedPackId) {
    state.activePackId = '';
  }
  writePacksState(state);
  syncOfficialLauncherProfiles();

  let cleanupPending = false;
  if (isPathInsideDirectory(PACKS_DIR, pack.packDir) && fs.existsSync(pack.packDir)) {
    cleanupPending = true;
    fs.promises.rm(pack.packDir, { recursive: true, force: true }).catch((error) => {
      logger.warn('Deleted profile directory cleanup will be retried later', {
        packId: normalizedPackId,
        packDir: pack.packDir,
        error: serializeError(error)
      });
    });
  }

  return {
    success: true,
    activePackId: state.activePackId,
    packs: getPacksConfig().packs,
    cleanupPending,
    message: `${pack.name} wurde gelöscht.`
  };
}

function getAuthConfig() {
  const microsoftClientId = getMicrosoftClientId();

  return {
    success: true,
    microsoftClientId,
    configured: false,
    usesDefaultClientId: true,
    forcedOfflineMode: FORCE_OFFLINE_MODE,
    requiresManualToken: false,
    allowOfficialLauncherFallback: ALLOW_OFFICIAL_LAUNCHER_FALLBACK,
    configPath: LAUNCHER_CONFIG_FILE
  };
}

function normalizePrimaryColor(primaryColor) {
  const normalized = String(primaryColor || '').trim();
  return /^#[0-9a-fA-F]{6}$/u.test(normalized) ? normalized.toLowerCase() : '';
}

function normalizeThemeMode(themeMode) {
  const normalized = String(themeMode || '').trim().toLowerCase();
  return normalized === 'rgb' ? 'rgb' : 'manual';
}

function normalizeAppearanceMode(appearanceMode) {
  const normalized = String(appearanceMode || '').trim().toLowerCase();
  return ['system', 'light', 'dark'].includes(normalized) ? normalized : 'system';
}

function normalizeBackgroundAnimation(backgroundAnimation) {
  const normalized = String(backgroundAnimation || '').trim().toLowerCase();
  const legacyMap = {
    mountains: 'galaxy',
    rain: 'grid',
    stars: 'galaxy',
    waves: 'silk',
    lightning: 'grid'
  };
  const mappedValue = legacyMap[normalized] || normalized;
  return ['default', 'aurora', 'grid', 'galaxy', 'silk', 'hyperspeed'].includes(mappedValue) ? mappedValue : 'default';
}

function getEffectiveAppearanceMode(appearanceMode) {
  const normalized = normalizeAppearanceMode(appearanceMode);
  if (normalized !== 'system') {
    return normalized;
  }

  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

function getThemeConfig() {
  const config = readLauncherConfig();
  const primaryColor = normalizePrimaryColor(config.primaryColor) || '#00d9ff';
  const themeMode = normalizeThemeMode(config.themeMode);
  const appearanceMode = normalizeAppearanceMode(config.appearanceMode);
  const effectiveAppearanceMode = getEffectiveAppearanceMode(appearanceMode);
  const backgroundAnimation = normalizeBackgroundAnimation(config.backgroundAnimation);

  return {
    success: true,
    configured: Boolean(normalizePrimaryColor(config.primaryColor)),
    primaryColor,
    themeMode,
    rgbMode: themeMode === 'rgb',
    appearanceMode,
    effectiveAppearanceMode,
    lightMode: effectiveAppearanceMode === 'light',
    backgroundAnimation
  };
}

function setPrimaryColor(primaryColor) {
  const normalizedColor = normalizePrimaryColor(primaryColor);
  if (!normalizedColor) {
    return {
      success: false,
      error: 'Die Farbe muss als Hexwert wie #00d9ff gespeichert werden.'
    };
  }

  writeLauncherConfig({ primaryColor: normalizedColor });

  return {
    success: true,
    primaryColor: normalizedColor
  };
}

function setThemeMode(themeMode) {
  const normalizedMode = normalizeThemeMode(themeMode);
  writeLauncherConfig({ themeMode: normalizedMode });

  return {
    success: true,
    themeMode: normalizedMode,
    rgbMode: normalizedMode === 'rgb'
  };
}

function setAppearanceMode(appearanceMode) {
  const normalizedMode = normalizeAppearanceMode(appearanceMode);
  writeLauncherConfig({ appearanceMode: normalizedMode });
  const effectiveAppearanceMode = getEffectiveAppearanceMode(normalizedMode);

  return {
    success: true,
    appearanceMode: normalizedMode,
    effectiveAppearanceMode,
    lightMode: effectiveAppearanceMode === 'light'
  };
}

function setBackgroundAnimation(backgroundAnimation) {
  const normalizedAnimation = normalizeBackgroundAnimation(backgroundAnimation);
  writeLauncherConfig({ backgroundAnimation: normalizedAnimation });

  return {
    success: true,
    backgroundAnimation: normalizedAnimation
  };
}

function writeLiveThemeState(primaryColor, appearanceMode) {
  const normalizedColor = normalizePrimaryColor(primaryColor);
  if (!normalizedColor) {
    throw new Error('Die Live-Farbe muss als Hexwert wie #00d9ff gespeichert werden.');
  }
  const normalizedAppearanceMode = normalizeAppearanceMode(appearanceMode);
  const effectiveAppearanceMode = getEffectiveAppearanceMode(normalizedAppearanceMode);

  ensureDir(CONFIG_DIR);
  fs.writeFileSync(LAUNCHER_LIVE_THEME_FILE, `${JSON.stringify({
    primaryColor: normalizedColor,
    appearanceMode: effectiveAppearanceMode,
    appearancePreference: normalizedAppearanceMode,
    lightMode: effectiveAppearanceMode === 'light',
    updatedAt: new Date().toISOString()
  })}\n`, 'utf8');
}

function setLiveThemeColor(primaryColor, appearanceMode) {
  const normalizedColor = normalizePrimaryColor(primaryColor);
  if (!normalizedColor) {
    return {
      success: false,
      error: 'Die Live-Farbe muss als Hexwert wie #00d9ff gespeichert werden.'
    };
  }

  const normalizedAppearanceMode = normalizeAppearanceMode(appearanceMode);
  const effectiveAppearanceMode = getEffectiveAppearanceMode(normalizedAppearanceMode);
  try {
    writeLiveThemeState(normalizedColor, effectiveAppearanceMode);
  } catch (error) {
    return {
      success: false,
      error: `Live-Farbe konnte nicht gespeichert werden: ${error.message || 'Unbekannter Fehler.'}`
    };
  }
  return {
    success: true,
    primaryColor: normalizedColor,
    appearanceMode: effectiveAppearanceMode,
    appearancePreference: normalizedAppearanceMode,
    liveThemePath: LAUNCHER_LIVE_THEME_FILE
  };
}

function setMicrosoftClientId(clientId) {
  // Keep this IPC for backwards compatibility, but custom IDs are no longer required.
  if (String(clientId || '').trim()) {
    return {
      success: false,
      error: 'Eigene Client-IDs werden nicht mehr verwendet. Der Launcher nutzt automatisch die integrierte Xbox/Microsoft-Client-ID.'
    };
  }

  writeLauncherConfig({ microsoftClientId: '' });
  return getAuthConfig();
}

async function openLauncherConfig() {
  const openError = await shell.openPath(LAUNCHER_CONFIG_FILE);
  if (openError) {
    return {
      success: false,
      error: openError,
      configPath: LAUNCHER_CONFIG_FILE
    };
  }

  return {
    success: true,
    configPath: LAUNCHER_CONFIG_FILE
  };
}

async function chooseMinecraftPath() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: fs.existsSync(DEFAULT_MINECRAFT_DIR) ? DEFAULT_MINECRAFT_DIR : ROAMING_APPDATA_DIR
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true, minecraftPath: DEFAULT_MINECRAFT_DIR };
  }

  const selectedPath = normalizeConfiguredMinecraftDirectory(result.filePaths[0]);
  if (!selectedPath) {
    return { success: false, error: 'Ungültiger Minecraft-Pfad.' };
  }

  writeLauncherConfig({ minecraftPath: selectedPath });
  setActiveMinecraftDirectory(selectedPath);
  ensureDir(DEFAULT_MINECRAFT_DIR);
  syncOfficialLauncherProfiles();

  return { success: true, minecraftPath: DEFAULT_MINECRAFT_DIR };
}

async function chooseStandardModsPath() {
  const currentModsPath = getConfiguredStandardModsDir();
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: fs.existsSync(currentModsPath) ? currentModsPath : DEFAULT_MINECRAFT_DIR
  });

  if (result.canceled || result.filePaths.length === 0) {
    return {
      ...getStandardModsPathInfo(),
      canceled: true
    };
  }

  const selectedPath = normalizeStandardModsDirectory(result.filePaths[0]);
  if (!selectedPath) {
    return { success: false, error: 'Ungültiger Mods-Ordner.' };
  }

  ensureDir(selectedPath);
  writeLauncherConfig({ standardModsPath: selectedPath });
  syncOfficialLauncherProfiles();
  return getStandardModsPathInfo();
}

function resetStandardModsPath() {
  writeLauncherConfig({ standardModsPath: '' });
  ensureDir(getNormalMinecraftModsDir());
  syncOfficialLauncherProfiles();
  return getStandardModsPathInfo();
}

function setMinecraftFolderName(folderName) {
  const minecraftFolderName = normalizeMinecraftFolderName(folderName);
  if (!minecraftFolderName) {
    return { success: false, error: 'Ungültiger Ordnername. Bitte nur einen Namen ohne Pfad-Zeichen eingeben.' };
  }

  writeLauncherConfig({
    minecraftFolderName,
    minecraftPath: ''
  });
  setActiveMinecraftDirectory(path.join(ROAMING_APPDATA_DIR, minecraftFolderName));
  ensureDir(DEFAULT_MINECRAFT_DIR);
  syncOfficialLauncherProfiles();

  return { success: true, minecraftPath: DEFAULT_MINECRAFT_DIR, minecraftFolderName };
}

function setMinecraftWindowsUserName(windowsUserName) {
  const minecraftWindowsUserName = normalizeWindowsUserName(windowsUserName);
  if (!minecraftWindowsUserName) {
    return { success: false, error: 'Ungültiger Windows-Name. Bitte nur den Benutzernamen ohne Pfad-Zeichen eingeben.' };
  }

  writeLauncherConfig({
    minecraftWindowsUserName,
    minecraftFolderName: DEFAULT_MINECRAFT_FOLDER_NAME,
    minecraftPath: ''
  });
  setActiveMinecraftDirectory(path.join(WINDOWS_USERS_DIR, minecraftWindowsUserName, 'AppData', 'Roaming', DEFAULT_MINECRAFT_FOLDER_NAME));
  ensureDir(DEFAULT_MINECRAFT_DIR);
  syncOfficialLauncherProfiles();

  return { success: true, minecraftPath: DEFAULT_MINECRAFT_DIR, minecraftWindowsUserName };
}

function readSkinSelectionMeta() {
  const config = readLauncherConfig();
  return {
    sourcePath: String(config.skinSourcePath || ''),
    originalFileName: String(config.skinOriginalFileName || ''),
    selectedAt: String(config.skinSelectedAt || '')
  };
}

function writeSkinSelectionMeta(meta = {}) {
  return writeLauncherConfig({
    skinSourcePath: String(meta.sourcePath || ''),
    skinOriginalFileName: String(meta.originalFileName || ''),
    skinSelectedAt: String(meta.selectedAt || '')
  });
}

function readPngMetadataFromBuffer(fileBuffer) {
  const pngSignature = '89504e470d0a1a0a';

  if (fileBuffer.length < 24 || fileBuffer.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error('Die Datei ist keine gültige PNG-Datei.');
  }

  return {
    width: fileBuffer.readUInt32BE(16),
    height: fileBuffer.readUInt32BE(20),
    fileSize: fileBuffer.length
  };
}

function readPngMetadata(filePath) {
  return readPngMetadataFromBuffer(fs.readFileSync(filePath));
}

function readPngChunks(fileBuffer) {
  const chunks = [];
  let offset = 8;

  while (offset + 12 <= fileBuffer.length) {
    const length = fileBuffer.readUInt32BE(offset);
    const type = fileBuffer.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > fileBuffer.length) {
      break;
    }

    chunks.push({
      type,
      data: fileBuffer.subarray(dataStart, dataEnd)
    });
    offset = dataEnd + 4;

    if (type === 'IEND') {
      break;
    }
  }

  return chunks;
}

function getPngChannelCount(colorType) {
  if (colorType === 0 || colorType === 3) {
    return 1;
  }
  if (colorType === 2) {
    return 3;
  }
  if (colorType === 4) {
    return 2;
  }
  if (colorType === 6) {
    return 4;
  }
  return 0;
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  return upDistance <= upLeftDistance ? up : upLeft;
}

function decodePngImage(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const metadata = readPngMetadata(filePath);
  const chunks = readPngChunks(fileBuffer);
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR')?.data;
  if (!ihdr || ihdr.length < 13) {
    return null;
  }

  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const interlaceMethod = ihdr[12];
  const channels = getPngChannelCount(colorType);
  if (bitDepth !== 8 || !channels || interlaceMethod !== 0) {
    return null;
  }

  const idatChunks = chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data);
  if (!idatChunks.length) {
    return null;
  }

  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const rowLength = metadata.width * channels;
  const bytesPerPixel = Math.max(1, channels);
  const pixels = Buffer.alloc(rowLength * metadata.height);
  let sourceOffset = 0;
  let previousRow = Buffer.alloc(rowLength);

  for (let y = 0; y < metadata.height; y += 1) {
    if (sourceOffset >= inflated.length) {
      return null;
    }

    const filterType = inflated[sourceOffset];
    sourceOffset += 1;
    const row = Buffer.alloc(rowLength);

    for (let x = 0; x < rowLength; x += 1) {
      if (sourceOffset >= inflated.length) {
        return null;
      }

      const rawValue = inflated[sourceOffset];
      sourceOffset += 1;
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previousRow[x] || 0;
      const upLeft = x >= bytesPerPixel ? previousRow[x - bytesPerPixel] || 0 : 0;
      let value = rawValue;

      if (filterType === 1) {
        value += left;
      } else if (filterType === 2) {
        value += up;
      } else if (filterType === 3) {
        value += Math.floor((left + up) / 2);
      } else if (filterType === 4) {
        value += paethPredictor(left, up, upLeft);
      } else if (filterType !== 0) {
        return null;
      }

      row[x] = value & 0xff;
    }

    row.copy(pixels, y * rowLength);
    previousRow = row;
  }

  const paletteAlpha = Buffer.alloc(256, 255);
  const transparency = chunks.find((chunk) => chunk.type === 'tRNS')?.data || null;
  if (colorType === 3 && transparency) {
    transparency.copy(paletteAlpha, 0, 0, Math.min(transparency.length, paletteAlpha.length));
  }

  return {
    width: metadata.width,
    height: metadata.height,
    colorType,
    channels,
    rowLength,
    pixels,
    transparency,
    paletteAlpha
  };
}

function getDecodedPngAlpha(decodedPng, x, y) {
  if (!decodedPng || x < 0 || y < 0 || x >= decodedPng.width || y >= decodedPng.height) {
    return 255;
  }

  const offset = (y * decodedPng.width + x) * decodedPng.channels;
  if (decodedPng.colorType === 6) {
    return decodedPng.pixels[offset + 3];
  }
  if (decodedPng.colorType === 4) {
    return decodedPng.pixels[offset + 1];
  }
  if (decodedPng.colorType === 3) {
    return decodedPng.paletteAlpha[decodedPng.pixels[offset]] ?? 255;
  }

  return 255;
}

function getTransparentPixelRatio(decodedPng, region) {
  let transparentPixels = 0;
  let totalPixels = 0;

  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      totalPixels += 1;
      if (getDecodedPngAlpha(decodedPng, x, y) < 16) {
        transparentPixels += 1;
      }
    }
  }

  return totalPixels ? transparentPixels / totalPixels : 0;
}

function detectSkinVariantFromPixels(filePath, skinInfo) {
  if (skinInfo?.height !== 64) {
    return skinInfo?.height === 32 ? 'classic' : '';
  }

  try {
    const decodedPng = decodePngImage(filePath);
    if (!decodedPng) {
      return '';
    }

    const slimUnusedRegions = [
      { x: 54, y: 16, width: 2, height: 16 },
      { x: 46, y: 48, width: 2, height: 16 }
    ];
    const usedArmRegions = [
      { x: 52, y: 20, width: 2, height: 12 },
      { x: 44, y: 52, width: 2, height: 12 }
    ];
    const unusedTransparent = slimUnusedRegions
      .map((region) => getTransparentPixelRatio(decodedPng, region))
      .filter((ratio) => ratio >= 0.85).length;
    const usedTransparent = usedArmRegions
      .map((region) => getTransparentPixelRatio(decodedPng, region))
      .filter((ratio) => ratio >= 0.85).length;

    if (unusedTransparent >= 1 && usedTransparent === 0) {
      return 'slim';
    }
  } catch (_error) {
    return '';
  }

  return '';
}

function isSupportedMinecraftSkinSize(width, height) {
  return width === 64 && (height === 64 || height === 32);
}

function createSkinPreviewDataUrl(filePath) {
  return `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function sanitizeSkinVariant(variant) {
  return String(variant || '').trim().toLowerCase() === 'slim' ? 'slim' : 'classic';
}

function sanitizeSkinName(name) {
  const compact = String(name || '')
    .replace(/\.[^.]+$/u, '')
    .replace(/[_-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  return compact.slice(0, 48) || 'Skin';
}

function inferSkinVariant(fileName, skinInfo) {
  if (skinInfo?.height === 32) {
    return 'classic';
  }

  const pixelVariant = skinInfo?.sourcePath ? detectSkinVariantFromPixels(skinInfo.sourcePath, skinInfo) : '';
  if (pixelVariant) {
    return pixelVariant;
  }

  const normalizedName = String(fileName || '').toLowerCase();
  return normalizedName.includes('slim') || normalizedName.includes('alex') ? 'slim' : 'classic';
}

function detectSkinVariant(filePath, skinInfo, fileName) {
  if (skinInfo?.height === 32) {
    return 'classic';
  }

  return detectSkinVariantFromPixels(filePath, skinInfo)
    || inferSkinVariant(fileName, { ...skinInfo, sourcePath: '' });
}

function createSkinId() {
  return `skin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSkinLibraryFilePath(fileName) {
  return path.join(SKIN_LIBRARY_DIR, String(fileName || '').trim());
}

function normalizeSavedSkinEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const id = String(entry.id || '').trim();
  const fileName = String(entry.fileName || '').trim();
  if (!id || !fileName) {
    return null;
  }

  return {
    id,
    name: sanitizeSkinName(entry.name || fileName),
    fileName,
    variant: sanitizeSkinVariant(entry.variant),
    sourcePath: String(entry.sourcePath || ''),
    createdAt: String(entry.createdAt || entry.selectedAt || new Date().toISOString()),
    updatedAt: String(entry.updatedAt || entry.selectedAt || entry.createdAt || new Date().toISOString()),
    width: Number(entry.width) || 64,
    height: Number(entry.height) || 64,
    fileSize: Number(entry.fileSize) || 0
  };
}

function persistSkinLibraryState(skins, activeSkinId) {
  writeLauncherConfig({
    savedSkins: skins,
    activeSkinId: String(activeSkinId || '').trim()
  });
}

function migrateLegacySelectedSkin() {
  if (!fs.existsSync(SELECTED_SKIN_FILE)) {
    return null;
  }

  ensureDir(SKIN_LIBRARY_DIR);

  const legacyMeta = readSkinSelectionMeta();
  const skinInfo = readPngMetadata(SELECTED_SKIN_FILE);
  const id = createSkinId();
  const fileName = `${id}.png`;
  const destinationPath = getSkinLibraryFilePath(fileName);

  fs.copyFileSync(SELECTED_SKIN_FILE, destinationPath);
  fs.unlinkSync(SELECTED_SKIN_FILE);

  const savedAt = legacyMeta.selectedAt || new Date().toISOString();
  const migratedSkin = {
    id,
    name: sanitizeSkinName(legacyMeta.originalFileName || 'Gespeicherter Skin'),
    fileName,
    variant: inferSkinVariant(legacyMeta.originalFileName || fileName, skinInfo),
    sourcePath: legacyMeta.sourcePath,
    createdAt: savedAt,
    updatedAt: savedAt,
    width: skinInfo.width,
    height: skinInfo.height,
    fileSize: skinInfo.fileSize
  };

  writeSkinSelectionMeta({
    sourcePath: '',
    originalFileName: '',
    selectedAt: ''
  });

  persistSkinLibraryState([migratedSkin], migratedSkin.id);

  return {
    skins: [migratedSkin],
    activeSkinId: migratedSkin.id,
    activeSkin: migratedSkin
  };
}

function readSkinLibraryState() {
  ensureDir(SKINS_DIR);
  ensureDir(SKIN_LIBRARY_DIR);

  const config = readLauncherConfig();
  let skins = Array.isArray(config.savedSkins)
    ? config.savedSkins.map((entry) => normalizeSavedSkinEntry(entry)).filter(Boolean)
    : [];
  let activeSkinId = String(config.activeSkinId || '').trim();

  if (!skins.length) {
    const migratedState = migrateLegacySelectedSkin();
    if (migratedState) {
      return migratedState;
    }
  }

  let changed = false;
  skins = skins.filter((entry) => {
    const exists = fs.existsSync(getSkinLibraryFilePath(entry.fileName));
    if (!exists) {
      changed = true;
    }
    return exists;
  });

  if (activeSkinId && !skins.some((entry) => entry.id === activeSkinId)) {
    activeSkinId = '';
    changed = true;
  }

  if (!activeSkinId && skins.length) {
    activeSkinId = skins[0].id;
    changed = true;
  }

  if (changed) {
    persistSkinLibraryState(skins, activeSkinId);
  }

  return {
    skins,
    activeSkinId,
    activeSkin: skins.find((entry) => entry.id === activeSkinId) || null
  };
}

function serializeSavedSkin(entry, activeSkinId) {
  const filePath = getSkinLibraryFilePath(entry.fileName);
  const metadata = readPngMetadata(filePath);

  return {
    ...entry,
    width: metadata.width,
    height: metadata.height,
    fileSize: metadata.fileSize,
    skinPath: filePath,
    previewDataUrl: createSkinPreviewDataUrl(filePath),
    active: entry.id === activeSkinId
  };
}

function getSkinConfig() {
  const skinState = readSkinLibraryState();
  let skins;
  try {
    skins = skinState.skins.map((entry) => serializeSavedSkin(entry, skinState.activeSkinId));
  } catch (error) {
    return {
      success: true,
      configured: false,
      skins: [],
      activeSkinId: '',
      activeSkin: null,
      warning: `Gespeicherter Skin konnte nicht gelesen werden: ${error.message}`
    };
  }

  const activeSkin = skins.find((entry) => entry.id === skinState.activeSkinId) || null;

  return {
    success: true,
    configured: Boolean(activeSkin),
    skins,
    activeSkinId: skinState.activeSkinId,
    activeSkin,
    skinCount: skins.length
  };
}

async function getSkinConfigWithAccountImport() {
  const currentConfig = getSkinConfig();
  if (!currentConfig.success || (currentConfig.skins || []).length) {
    return currentConfig;
  }

  let savedUser = null;
  try {
    savedUser = readSavedUserFile();
  } catch (_error) {
    return currentConfig;
  }

  const uuid = normalizeMinecraftUuid(savedUser?.uuid);
  const username = normalizeMinecraftProfileName(savedUser?.username);
  const loginSource = String(savedUser?.loginSource || '').trim().toLowerCase();
  if (!uuid || !username || loginSource === 'offline') {
    return currentConfig;
  }

  try {
    // NameMC shows the same current texture published by Minecraft's signed
    // session profile. Using the source texture avoids scraping NameMC pages.
    const texture = await fetchMinecraftProfileTexture(uuid);
    if (!texture?.sourceUrl) {
      return currentConfig;
    }
    const skinBuffer = await fetchBinary(texture.sourceUrl, {
      maxBytes: ONLINE_SKIN_MAX_BYTES,
      allowedHosts: TRUSTED_MINECRAFT_TEXTURE_HOSTS
    });
    const imported = saveDownloadedSkinBuffer({
      skinBuffer,
      displayName: `${username} - aktueller Skin`,
      sourcePath: texture.sourceUrl,
      variantHint: texture.variant
    });
    if (imported?.success) {
      return {
        ...imported,
        message: `Der aktuelle Skin von ${username} wurde automatisch importiert.`,
        autoImportedAccountSkin: true
      };
    }
    return {
      ...currentConfig,
      warning: imported?.error || 'Der aktuelle Account-Skin konnte nicht importiert werden.'
    };
  } catch (error) {
    logger.warn('Automatic account skin import skipped', {
      username,
      error: serializeError(error)
    });
    return currentConfig;
  }
}

function normalizeSkinSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSkinNameTerms(value) {
  return normalizeSkinSearchText(
    String(value || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\d+/g, ' ')
  )
    .split(' ')
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

function addUniqueSkinTerm(terms, seen, value) {
  const normalized = normalizeSkinSearchText(value);
  if (!normalized || seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  terms.push(normalized);
}

function getNameHashByte(value, offset) {
  const digest = crypto.createHash('sha1').update(String(value || 'skin')).digest();
  return digest[offset % digest.length];
}

function getNameBasedSkinTerms(query) {
  const normalizedQuery = normalizeSkinSearchText(query);
  const tokens = splitSkinNameTerms(query);
  const terms = [];
  const seen = new Set();

  if (normalizedQuery.length >= 2) {
    addUniqueSkinTerm(terms, seen, tokens.length > 1 ? tokens.join(' ') : normalizedQuery);
  }

  tokens.forEach((token) => {
    if (NAME_SKIN_DIRECT_TAGS.has(token)) {
      addUniqueSkinTerm(terms, seen, token);
    }
  });

  const hashSource = normalizedQuery || 'x launcher';
  const color = NAME_SKIN_COLOR_TAGS[getNameHashByte(hashSource, 0) % NAME_SKIN_COLOR_TAGS.length];
  const style = NAME_SKIN_STYLE_TAGS[getNameHashByte(hashSource, 1) % NAME_SKIN_STYLE_TAGS.length];
  const theme = NAME_SKIN_THEME_TAGS[getNameHashByte(hashSource, 2) % NAME_SKIN_THEME_TAGS.length];

  addUniqueSkinTerm(terms, seen, `${color} ${style}`);
  addUniqueSkinTerm(terms, seen, `${theme} ${style}`);
  addUniqueSkinTerm(terms, seen, theme);
  addUniqueSkinTerm(terms, seen, style);
  addUniqueSkinTerm(terms, seen, color);

  if (!terms.length) {
    addUniqueSkinTerm(terms, seen, 'pvp');
    addUniqueSkinTerm(terms, seen, 'hoodie');
  }

  return terms.slice(0, ONLINE_SKIN_PAGE_LIMIT);
}

function getSkinMcRawSkinUrl(skinId) {
  return `${SKINMC_BASE_URL}/api/v1/renders/skins/${encodeURIComponent(skinId)}/skin`;
}

function normalizeSkinMcSkinId(value) {
  const match = String(value || '').match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return match ? match[0].toLowerCase() : '';
}

function getSkinMcSearchPages(query) {
  const terms = getNameBasedSkinTerms(query);
  const pages = [];
  const seen = new Set();

  const addPage = (url, label, matchLabel) => {
    const key = String(url || '').trim();
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    pages.push({
      url: key,
      label: sanitizeSkinName(`${label} Skin`),
      matchLabel
    });
  };

  terms.forEach((term, index) => {
    const searchUrl = new URL('/s', SKINMC_BASE_URL);
    searchUrl.searchParams.set('search', term);
    addPage(
      searchUrl.toString(),
      term,
      index === 0 ? 'Skin-Vorschlag' : 'Namensstil'
    );

    if (term.indexOf(' ') === -1 && NAME_SKIN_DIRECT_TAGS.has(term)) {
      addPage(
        `${SKINMC_BASE_URL}/skins/tagged/${encodeURIComponent(term)}`,
        term,
        'Skin-Tag'
      );
    }
  });

  return pages.slice(0, ONLINE_SKIN_PAGE_LIMIT);
}

function extractSkinMcSkinIds(html) {
  const ids = [];
  const seen = new Set();
  const matcher = /\/skins\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/g;
  let match;

  while ((match = matcher.exec(String(html || ''))) !== null) {
    const skinId = normalizeSkinMcSkinId(match[1]);
    if (!skinId || seen.has(skinId)) {
      continue;
    }

    seen.add(skinId);
    ids.push(skinId);
  }

  return ids;
}

async function fetchText(url, options = {}) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      headers: {
        ...SKIN_LIBRARY_API_HEADERS,
        ...(options.headers || {})
      }
    });
  } catch (error) {
    const detail = error?.cause?.message || error?.message || String(error);
    throw new Error(`Netzwerkfehler für ${url}: ${detail}`);
  }

  const body = await safeReadText(response);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} für ${url}${body ? `: ${body}` : ''}`);
  }

  return body;
}

async function fetchBinary(url, options = {}) {
  const { maxBytes: configuredMaxBytes, headers = {}, allowedHosts = null, ...fetchOptions } = options;
  if (allowedHosts) {
    assertTrustedHttpsUrl(url, allowedHosts);
  }

  let response;
  try {
    response = await fetchImpl(url, {
      ...fetchOptions,
      headers: {
        ...SKIN_LIBRARY_API_HEADERS,
        ...headers
      }
    });
  } catch (error) {
    const detail = error?.cause?.message || error?.message || String(error);
    throw new Error(`Download-Fehler für ${url}: ${detail}`);
  }

  if (!response.ok) {
    const body = await safeReadText(response);
    throw new Error(`Download fehlgeschlagen (${response.status}) für ${url}${body ? `: ${body}` : ''}`);
  }

  const buffer = typeof response.arrayBuffer === 'function'
    ? Buffer.from(await response.arrayBuffer())
    : await response.buffer();
  const maxBytes = Number(configuredMaxBytes) || 0;
  if (maxBytes > 0 && buffer.length > maxBytes) {
    throw new Error('Skin-Datei ist zu groß.');
  }

  return buffer;
}

function buildOnlineSkinResultFromSkinMc({ skinId, label, matchLabel, skinBuffer, index }) {
  const skinInfo = readPngMetadataFromBuffer(skinBuffer);
  if (!isSupportedMinecraftSkinSize(skinInfo.width, skinInfo.height)) {
    return null;
  }

  const rawSkinUrl = getSkinMcRawSkinUrl(skinId);
  const resultName = sanitizeSkinName(`${label || 'SkinMC Skin'} ${index || ''}`.trim());

  return {
    id: `skinmc-${skinId}`,
    skinId,
    name: resultName,
    sourceLabel: 'SkinMC',
    variant: skinInfo.height === 32 ? 'classic' : detectSkinVariantFromPixelsBufferSafe(skinBuffer, skinInfo),
    width: skinInfo.width,
    height: skinInfo.height,
    fileSize: skinInfo.fileSize,
    sourceUrl: rawSkinUrl,
    detailUrl: `${SKINMC_BASE_URL}/skins/${skinId}`,
    matchLabel: matchLabel || 'Skin-Treffer',
    previewDataUrl: `data:image/png;base64,${skinBuffer.toString('base64')}`
  };
}

function normalizeMinecraftProfileName(value) {
  const name = String(value || '').trim();
  return /^[A-Za-z0-9_]{3,16}$/.test(name) ? name : '';
}

function normalizeMinecraftTextureUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) {
    return '';
  }

  try {
    const parsed = new URL(value);
    if (parsed.hostname.toLowerCase() !== 'textures.minecraft.net') {
      return '';
    }
    parsed.protocol = 'https:';
    return parsed.toString();
  } catch (_error) {
    return '';
  }
}

async function fetchMinecraftProfileByName(username) {
  const normalizedName = normalizeMinecraftProfileName(username);
  if (!normalizedName) {
    return null;
  }

  const encodedName = encodeURIComponent(normalizedName);
  const lookupUrls = [
    `https://api.minecraftservices.com/minecraft/profile/lookup/name/${encodedName}`,
    `https://api.mojang.com/users/profiles/minecraft/${encodedName}`
  ];
  let lastError = null;

  for (const lookupUrl of lookupUrls) {
    try {
      const profile = await fetchJson(lookupUrl, {
        allowedHosts: TRUSTED_MINECRAFT_PROFILE_HOSTS,
        retries: 0,
        headers: { Accept: 'application/json' }
      });
      const uuid = normalizeMinecraftUuid(profile?.id);
      const name = normalizeMinecraftProfileName(profile?.name) || normalizedName;
      if (uuid && name) {
        return { id: uuid, name };
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }
  return null;
}

async function fetchMinecraftProfileTexture(profileId) {
  const uuid = normalizeMinecraftUuid(profileId);
  if (!uuid) {
    return null;
  }

  const profile = await fetchJson(`https://sessionserver.mojang.com/session/minecraft/profile/${encodeURIComponent(uuid)}?unsigned=false`, {
    allowedHosts: TRUSTED_MINECRAFT_PROFILE_HOSTS,
    retries: 0,
    headers: { Accept: 'application/json' }
  });
  const texturesProperty = Array.isArray(profile?.properties)
    ? profile.properties.find((property) => property?.name === 'textures' && property?.value)
    : null;
  if (!texturesProperty?.value) {
    return null;
  }

  const texturePayload = JSON.parse(Buffer.from(String(texturesProperty.value), 'base64').toString('utf8'));
  const skin = texturePayload?.textures?.SKIN;
  const sourceUrl = normalizeMinecraftTextureUrl(skin?.url);
  if (!sourceUrl) {
    return null;
  }

  return {
    sourceUrl,
    variant: String(skin?.metadata?.model || '').toLowerCase() === 'slim' ? 'slim' : 'classic'
  };
}

async function buildOnlineSkinResultFromMinecraftProfile(query) {
  const profile = await fetchMinecraftProfileByName(query);
  if (!profile) {
    return null;
  }

  const texture = await fetchMinecraftProfileTexture(profile.id);
  if (!texture?.sourceUrl) {
    return null;
  }

  const skinBuffer = await fetchBinary(texture.sourceUrl, {
    maxBytes: ONLINE_SKIN_MAX_BYTES,
    allowedHosts: TRUSTED_MINECRAFT_TEXTURE_HOSTS
  });
  const skinInfo = readPngMetadataFromBuffer(skinBuffer);
  if (!isSupportedMinecraftSkinSize(skinInfo.width, skinInfo.height)) {
    return null;
  }

  return {
    id: `minecraft-${profile.id}`,
    skinId: '',
    profileId: profile.id,
    name: sanitizeSkinName(`${profile.name} Skin`),
    sourceLabel: 'Minecraft',
    variant: skinInfo.height === 32 ? 'classic' : (texture.variant || detectSkinVariantFromPixelsBufferSafe(skinBuffer, skinInfo)),
    width: skinInfo.width,
    height: skinInfo.height,
    fileSize: skinInfo.fileSize,
    sourceUrl: texture.sourceUrl,
    detailUrl: '',
    matchLabel: 'Minecraft-Profil',
    previewDataUrl: `data:image/png;base64,${skinBuffer.toString('base64')}`
  };
}

function detectSkinVariantFromPixelsBufferSafe(skinBuffer, skinInfo) {
  if (skinInfo?.height === 32) {
    return 'classic';
  }

  const tempFilePath = path.join(SKINS_DIR, `variant-check-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  try {
    ensureDir(SKINS_DIR);
    fs.writeFileSync(tempFilePath, skinBuffer);
    return detectSkinVariant(tempFilePath, skinInfo, '') || 'classic';
  } catch (_error) {
    return 'classic';
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (_error) {
      // ignore cleanup failure
    }
  }
}

async function searchOnlineSkins(query) {
  const normalizedQuery = String(query || '').trim();
  const searchPages = getSkinMcSearchPages(normalizedQuery);
  const results = [];
  const seenSkinIds = new Set();
  const seenSourceUrls = new Set();
  let firstError = null;

  if (normalizeMinecraftProfileName(normalizedQuery)) {
    try {
      const minecraftResult = await buildOnlineSkinResultFromMinecraftProfile(normalizedQuery);
      if (minecraftResult) {
        results.push(minecraftResult);
        seenSourceUrls.add(String(minecraftResult.sourceUrl || '').trim());
      }
    } catch (error) {
      firstError = firstError || error;
      console.warn(`Minecraft-Skin-Suche fehlgeschlagen (${normalizedQuery}):`, error.message);
    }
  }

  for (const page of searchPages) {
    if (results.length >= ONLINE_SKIN_SEARCH_LIMIT) {
      break;
    }

    try {
      const html = await fetchText(page.url);
      const skinIds = extractSkinMcSkinIds(html);
      for (const skinId of skinIds) {
        if (results.length >= ONLINE_SKIN_SEARCH_LIMIT) {
          break;
        }
        if (seenSkinIds.has(skinId)) {
          continue;
        }

        seenSkinIds.add(skinId);
        const skinBuffer = await fetchBinary(getSkinMcRawSkinUrl(skinId), { maxBytes: ONLINE_SKIN_MAX_BYTES });
        const sourceUrl = getSkinMcRawSkinUrl(skinId);
        if (seenSourceUrls.has(sourceUrl)) {
          continue;
        }
        const result = buildOnlineSkinResultFromSkinMc({
          skinId,
          label: page.label,
          matchLabel: page.matchLabel,
          skinBuffer,
          index: results.length + 1
        });
        if (result) {
          results.push(result);
          seenSourceUrls.add(sourceUrl);
        }
      }
    } catch (error) {
      firstError = firstError || error;
      console.warn(`SkinMC-Suche fehlgeschlagen (${page.url}):`, error.message);
    }
  }

  if (!results.length && firstError) {
    return {
      success: false,
      error: `Online-Skins konnten nicht geladen werden: ${firstError.message}`,
      query: normalizedQuery,
      results: []
    };
  }

  return {
    success: true,
    query: normalizedQuery,
    source: results.some((entry) => entry?.sourceLabel === 'Minecraft') ? 'minecraft+skinmc' : 'skinmc',
    results
  };
}

function saveDownloadedSkinBuffer({ skinBuffer, displayName, sourcePath, variantHint }) {
  ensureDir(SKINS_DIR);
  ensureDir(SKIN_LIBRARY_DIR);

  const skinInfo = readPngMetadataFromBuffer(skinBuffer);
  if (!isSupportedMinecraftSkinSize(skinInfo.width, skinInfo.height)) {
    return {
      success: false,
      error: 'Der heruntergeladene Skin ist keine Minecraft-Skin in 64x64 oder 64x32 Pixeln.'
    };
  }

  const skinState = readSkinLibraryState();
  const id = createSkinId();
  const fileName = `${id}.png`;
  const destinationPath = getSkinLibraryFilePath(fileName);
  fs.writeFileSync(destinationPath, skinBuffer);

  const variant = skinInfo.height === 32
    ? 'classic'
    : (String(variantHint || '').toLowerCase() === 'slim' ? 'slim' : detectSkinVariant(destinationPath, skinInfo, displayName));
  const savedAt = new Date().toISOString();
  const skinEntry = {
    id,
    name: sanitizeSkinName(displayName),
    fileName,
    variant,
    sourcePath: String(sourcePath || ''),
    createdAt: savedAt,
    updatedAt: savedAt,
    width: skinInfo.width,
    height: skinInfo.height,
    fileSize: skinInfo.fileSize
  };
  const sourceKey = String(sourcePath || '').trim();
  const skins = [
    skinEntry,
    ...skinState.skins.filter((entry) => !sourceKey || String(entry.sourcePath || '').trim() !== sourceKey)
  ];

  persistSkinLibraryState(skins, id);

  return {
    ...getSkinConfig(),
    message: `Skin ${skinEntry.name} heruntergeladen und aktiviert.`
  };
}

async function downloadOnlineSkin(onlineSkin) {
  const reference = onlineSkin && typeof onlineSkin === 'object' ? onlineSkin : {};
  const minecraftTextureUrl = normalizeMinecraftTextureUrl(reference.sourceUrl || '');
  if (minecraftTextureUrl) {
    try {
      const skinBuffer = await fetchBinary(minecraftTextureUrl, {
        maxBytes: ONLINE_SKIN_MAX_BYTES,
        allowedHosts: TRUSTED_MINECRAFT_TEXTURE_HOSTS
      });
      return saveDownloadedSkinBuffer({
        skinBuffer,
        displayName: reference.name || 'Minecraft Skin',
        sourcePath: minecraftTextureUrl,
        variantHint: reference.variant
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  const skinId = normalizeSkinMcSkinId(reference.skinId || reference.id || reference.sourceUrl || '');
  if (!skinId) {
    return { success: false, error: 'Keine gültige Skin-ID übergeben.' };
  }

  try {
    const sourceUrl = getSkinMcRawSkinUrl(skinId);
    const skinBuffer = await fetchBinary(sourceUrl, { maxBytes: ONLINE_SKIN_MAX_BYTES });
    return saveDownloadedSkinBuffer({
      skinBuffer,
      displayName: reference.name || 'SkinMC Skin',
      sourcePath: sourceUrl,
      variantHint: reference.variant
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function chooseSkinFile() {
  ensureDir(SKINS_DIR);
  ensureDir(SKIN_LIBRARY_DIR);

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    defaultPath: fs.existsSync(DEFAULT_DOWNLOADS_DIR) ? DEFAULT_DOWNLOADS_DIR : DEFAULT_MINECRAFT_DIR,
    filters: [
      { name: 'Minecraft Skin PNG', extensions: ['png'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const sourcePath = result.filePaths[0];
  const skinInfo = readPngMetadata(sourcePath);
  if (!isSupportedMinecraftSkinSize(skinInfo.width, skinInfo.height)) {
    return {
      success: false,
      error: 'Bitte wähle eine Minecraft-Skin in 64x64 oder 64x32 Pixeln.'
    };
  }

  const variant = detectSkinVariant(sourcePath, skinInfo, path.basename(sourcePath));
  const skinState = readSkinLibraryState();
  const id = createSkinId();
  const fileName = `${id}.png`;
  fs.copyFileSync(sourcePath, getSkinLibraryFilePath(fileName));

  const savedAt = new Date().toISOString();
  const skinEntry = {
    id,
    name: sanitizeSkinName(path.basename(sourcePath)),
    fileName,
    variant,
    sourcePath,
    createdAt: savedAt,
    updatedAt: savedAt,
    width: skinInfo.width,
    height: skinInfo.height,
    fileSize: skinInfo.fileSize
  };

  const skins = [skinEntry, ...skinState.skins];
  persistSkinLibraryState(skins, id);

  return {
    ...getSkinConfig(),
    message: `Skin ${skinEntry.name} gespeichert und als ${variant === 'slim' ? 'Slim' : 'Wide'} erkannt.`
  };
}

function clearSkinFile() {
  const skinState = readSkinLibraryState();
  if (!skinState.activeSkin) {
    return {
      success: false,
      error: 'Es ist kein aktiver Skin gespeichert.'
    };
  }

  return removeSkinFile(skinState.activeSkin.id);
}

function setActiveSkin(skinId) {
  const normalizedId = String(skinId || '').trim();
  if (!normalizedId) {
    return { success: false, error: 'Keine Skin-ID übergeben.' };
  }

  const skinState = readSkinLibraryState();
  const skinEntry = skinState.skins.find((entry) => entry.id === normalizedId);
  if (!skinEntry) {
    return { success: false, error: 'Skin wurde nicht gefunden.' };
  }

  persistSkinLibraryState(skinState.skins, normalizedId);

  return {
    ...getSkinConfig(),
    message: `Skin ${skinEntry.name} ist jetzt aktiv.`
  };
}

function removeSkinFile(skinId) {
  const normalizedId = String(skinId || '').trim();
  if (!normalizedId) {
    return { success: false, error: 'Keine Skin-ID übergeben.' };
  }

  const skinState = readSkinLibraryState();
  const skinEntry = skinState.skins.find((entry) => entry.id === normalizedId);
  if (!skinEntry) {
    return { success: false, error: 'Skin wurde nicht gefunden.' };
  }

  const nextSkins = skinState.skins.filter((entry) => entry.id !== normalizedId);
  const filePath = getSkinLibraryFilePath(skinEntry.fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  const nextActiveSkinId = skinState.activeSkinId === normalizedId
    ? (nextSkins[0]?.id || '')
    : skinState.activeSkinId;

  persistSkinLibraryState(nextSkins, nextActiveSkinId);

  return {
    ...getSkinConfig(),
    message: `Skin ${skinEntry.name} entfernt.`
  };
}

function setSkinVariant(skinId, variant) {
  const normalizedId = String(skinId || '').trim();
  if (!normalizedId) {
    return { success: false, error: 'Keine Skin-ID übergeben.' };
  }

  const skinState = readSkinLibraryState();
  const skinIndex = skinState.skins.findIndex((entry) => entry.id === normalizedId);
  if (skinIndex === -1) {
    return { success: false, error: 'Skin wurde nicht gefunden.' };
  }

  const currentSkin = skinState.skins[skinIndex];
  if (currentSkin.height !== 64) {
    return { success: false, error: '64x32-Skins unterstützen nur das Wide-Modell.' };
  }

  const nextVariant = sanitizeSkinVariant(variant);
  const nextSkins = [...skinState.skins];
  nextSkins[skinIndex] = {
    ...currentSkin,
    variant: nextVariant,
    updatedAt: new Date().toISOString()
  };

  persistSkinLibraryState(nextSkins, skinState.activeSkinId);

  return {
    ...getSkinConfig(),
    message: `Modell für ${currentSkin.name} auf ${nextVariant === 'slim' ? 'Slim' : 'Wide'} gesetzt.`
  };
}

function formatSkinApiError(statusCode, responseText) {
  if (!responseText) {
    return `HTTP ${statusCode}`;
  }

  try {
    const parsed = JSON.parse(responseText);
    const detail = parsed.errorMessage || parsed.message || parsed.error || parsed.detail || responseText;
    return `HTTP ${statusCode}: ${detail}`;
  } catch (_error) {
    return `HTTP ${statusCode}: ${responseText}`;
  }
}

async function uploadMinecraftSkin(accessToken, skinEntry) {
  const skinPath = getSkinLibraryFilePath(skinEntry.fileName);
  const skinBuffer = fs.readFileSync(skinPath);
  const boundary = `----XLauncherSkin${Date.now().toString(16)}`;
  const variant = sanitizeSkinVariant(skinEntry.variant);
  const headerBuffer = Buffer.from(
    `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="variant"\r\n\r\n`
      + `${variant}\r\n`
      + `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="file"; filename="${path.basename(skinPath)}"\r\n`
      + `Content-Type: image/png\r\n\r\n`,
    'utf8'
  );
  const footerBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const bodyBuffer = Buffer.concat([headerBuffer, skinBuffer, footerBuffer]);

  await new Promise((resolve, reject) => {
    const request = https.request(MINECRAFT_SKIN_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
        'User-Agent': 'XLauncher/1.0.0'
      }
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const responseText = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve();
          return;
        }

        reject(new Error(formatSkinApiError(response.statusCode, responseText)));
      });
    });

    request.on('error', reject);
    request.write(bodyBuffer);
    request.end();
  });
}

async function syncActiveSkinForLaunch({ accessToken, isOfflineMode }) {
  const skinState = readSkinLibraryState();
  if (!skinState.activeSkin) {
    return null;
  }

  if (isOfflineMode || !accessToken || accessToken === '0') {
    return {
      localApplied: true,
      skinName: skinState.activeSkin.name
    };
  }

  try {
    await uploadMinecraftSkin(accessToken, skinState.activeSkin);
    return {
      applied: true,
      localApplied: true,
      skinName: skinState.activeSkin.name
    };
  } catch (error) {
    console.warn('Skin sync warning:', error);
    return {
      localApplied: true,
      warning: `Der aktive Skin "${skinState.activeSkin.name}" konnte nicht auf dein Konto hochgeladen werden, wird aber lokal im X Client gesetzt: ${error.message}`
    };
  }
}

function formatSkinLaunchMessage(skinSyncResult) {
  if (!skinSyncResult) {
    return '';
  }

  if (skinSyncResult.applied) {
    return ` Skin "${skinSyncResult.skinName}" wurde vor dem Start auf dein Konto gesetzt und lokal im X Client vorbereitet.`;
  }

  if (skinSyncResult.localApplied && skinSyncResult.skinName) {
    return ` Skin "${skinSyncResult.skinName}" wird lokal im X Client gesetzt.`;
  }

  if (skinSyncResult.warning) {
    return ` Hinweis: ${skinSyncResult.warning}`;
  }

  return '';
}

function getActiveSkinLaunchConfig() {
  const skinState = readSkinLibraryState();
  const activeSkin = skinState.activeSkin;
  if (!activeSkin) {
    return null;
  }

  const skinPath = getSkinLibraryFilePath(activeSkin.fileName);
  if (!fs.existsSync(skinPath)) {
    return null;
  }

  return {
    id: activeSkin.id,
    name: activeSkin.name,
    model: sanitizeSkinVariant(activeSkin.variant) === 'slim' ? 'slim' : 'classic',
    path: skinPath
  };
}

async function setSelectedVersion(versionId) {
  const requestedVersionId = String(versionId || '').trim();
  if (!requestedVersionId) {
    return { success: false, error: 'Keine Version ausgewählt.' };
  }

  if (!isFabricVersionId(requestedVersionId)) {
    return { success: false, error: 'Es können nur Fabric-Versionen ausgewählt werden.' };
  }

  if (!isFullFabricReleaseVersionId(requestedVersionId)) {
    return { success: false, error: 'Es können nur normale Minecraft-Vollversionen ausgewählt werden.' };
  }

  const activePack = getActivePack();
  if (!isProfileFabricVersionAllowed(requestedVersionId)) {
    return { success: false, error: getProfileMinecraftVersionsError() };
  }

  persistEffectiveSelectedVersionId(requestedVersionId);
  const localVersion = readLocalVersion(requestedVersionId);
  const syncResult = await syncManagedModsForVersion(requestedVersionId, {
    refreshAll: true,
    refreshDisabledProjects: true,
    preserveMods: true
  });

  return {
    success: true,
    selectedVersionId: requestedVersionId,
    installed: Boolean(localVersion),
    syncPending: false,
    warning: formatManagedModsWarning(syncResult.warnings)
  };
}

async function setStandardVersion(versionId) {
  const requestedVersionId = String(versionId || '').trim();
  if (!requestedVersionId) {
    return { success: false, error: 'Keine Version ausgewählt.' };
  }

  if (!isFabricVersionId(requestedVersionId)) {
    return { success: false, error: 'Es können nur Fabric-Versionen ausgewählt werden.' };
  }

  if (!isFullFabricReleaseVersionId(requestedVersionId)) {
    return { success: false, error: 'Es können nur normale Minecraft-Vollversionen ausgewählt werden.' };
  }

  if (!isSupportedFabricVersionAllowed(requestedVersionId)) {
    return { success: false, error: getSupportedMinecraftVersionsError() };
  }

  persistStandardSelectedVersionId(requestedVersionId);
  const localVersion = readLocalVersion(requestedVersionId);
  const standardContext = getStandardModContext(requestedVersionId);
  const syncResult = await syncManagedModsForVersion(requestedVersionId, {
    modContext: standardContext,
    refreshDisabledProjects: true
  });

  return {
    success: true,
    selectedVersionId: requestedVersionId,
    installed: Boolean(localVersion),
    syncPending: false,
    warning: formatManagedModsWarning(syncResult.warnings)
  };
}

function scheduleManagedModsSync(versionId, options = {}) {
  const normalizedVersionId = String(versionId || '').trim();
  if (!normalizedVersionId) {
    return;
  }

  setTimeout(() => {
    syncManagedModsForVersion(normalizedVersionId, options).catch((error) => {
      logger.warn('Background managed mod sync failed after version change', {
        versionId: normalizedVersionId,
        error: serializeError(error)
      });
    });
  }, 0);
}

async function selectPreferredFabricVersion() {
  const localFabricVersion = getPreferredLocalFabricVersion(getEffectiveSelectedVersionId());
  if (!localFabricVersion) {
    return {
      success: false,
      error: 'Es wurde keine lokale Fabric-Version gefunden.'
    };
  }

  const fabricJarPath = path.join(
    DEFAULT_MINECRAFT_DIR,
    'versions',
    localFabricVersion.id,
    `${localFabricVersion.id}.jar`
  );

  if (!fs.existsSync(fabricJarPath)) {
    return {
      success: false,
      error: `Fabric-JAR fehlt: ${fabricJarPath}`
    };
  }

  const modContext = getActiveModContext(localFabricVersion.id);
  const minecraftVersion = String(modContext.minecraftVersion || '').trim();
  if (!minecraftVersion) {
    return {
      success: false,
      error: `Minecraft-Version konnte nicht aus ${localFabricVersion.id} gelesen werden.`
    };
  }

  try {
    await ensureFabricApiForMod(modContext, minecraftVersion, { forceRefresh: true });
  } catch (error) {
    return {
      success: false,
      error: `Fabric API konnte nicht für Minecraft ${minecraftVersion} installiert werden: ${error.message}`
    };
  }

  persistEffectiveSelectedVersionId(localFabricVersion.id);
  const syncResult = await syncManagedModsForVersion(localFabricVersion.id);

  return {
    success: true,
    selectedVersionId: localFabricVersion.id,
    jarPath: fabricJarPath,
    warning: formatManagedModsWarning(syncResult.warnings),
    message: `Fabric ${getMinecraftVersionName(localFabricVersion.id, localFabricVersion.data)} wurde ausgewählt. Pfad: ${fabricJarPath}`
  };
}

function getMicrosoftClientId() {
  return DEFAULT_MICROSOFT_CLIENT_ID;
}

function readSavedUserFile() {
  if (!fs.existsSync(USER_FILE)) {
    clearCurrentUser();
    return null;
  }

  try {
    const savedUser = JSON.parse(fs.readFileSync(USER_FILE, 'utf8'));
    return savedUser && typeof savedUser === 'object' ? setCurrentUser(savedUser) : null;
  } catch (error) {
    logger.warn('Could not read user session, backing up corrupt file', {
      filePath: USER_FILE,
      error: serializeError(error)
    });
    try {
      ROBUSTNESS.createFileBackup(USER_FILE, 'corrupt-user-session', {
        error: serializeError(error)
      });
      fs.unlinkSync(USER_FILE);
    } catch (cleanupError) {
      logger.warn('Could not remove corrupt user session', {
        filePath: USER_FILE,
        error: serializeError(cleanupError)
      });
    }
    return null;
  }
}

function writeSavedUserFile(userInfo, reason = 'write-user-session') {
  const persistedUser = { ...userInfo };
  delete persistedUser.isAdmin;
  ROBUSTNESS.writeJsonFileAtomic(USER_FILE, persistedUser, {
    label: 'user-session',
    metadata: { reason }
  });
  upsertSavedAccount(persistedUser);
  return setCurrentUser(persistedUser);
}

function getDefaultAccountsState() {
  return {
    activeAccountId: '',
    accounts: []
  };
}

function accountIdForUser(userInfo) {
  const loginSource = String(userInfo?.loginSource || userInfo?.userType || '').trim().toLowerCase();
  const userType = String(userInfo?.userType || '').trim().toLowerCase();
  const username = String(userInfo?.username || '').trim();
  const uuid = normalizeMinecraftUuid(userInfo?.uuid || '');
  if (loginSource === 'offline') {
    return `offline:${username.toLowerCase() || 'player'}`;
  }
  if (loginSource === 'official-launcher' || userType === 'launcher-import') {
    return `launcher:${uuid || username.toLowerCase() || 'player'}`;
  }
  if (uuid) {
    return `msa:${uuid}`;
  }
  if (String(userInfo?.accessToken || '') === 'offline-token') {
    return `offline:${username.toLowerCase() || 'player'}`;
  }
  const fingerprint = crypto.createHash('sha1')
    .update(`${loginSource}:${username}:${String(userInfo?.email || '')}`)
    .digest('hex')
    .slice(0, 16);
  return `account:${fingerprint}`;
}

function shouldRegenerateStoredAccountId(rawId, user) {
  const id = String(rawId || '').trim();
  if (!id) {
    return true;
  }
  const loginSource = String(user?.loginSource || '').trim().toLowerCase();
  const userType = String(user?.userType || '').trim().toLowerCase();
  return id.startsWith('offline:')
    && (loginSource === 'official-launcher' || userType === 'launcher-import');
}

function normalizeAccountEntry(rawAccount) {
  const rawUser = rawAccount?.user && typeof rawAccount.user === 'object'
    ? rawAccount.user
    : rawAccount;
  let username = String(rawUser?.username || rawAccount?.username || '').trim().slice(0, 32);
  if (!username) {
    return null;
  }
  const user = {
    ...rawUser,
    username,
    uuid: String(rawUser?.uuid || rawAccount?.uuid || '').trim(),
    accessToken: String(rawUser?.accessToken || rawAccount?.accessToken || '').trim(),
    microsoftAccessToken: String(rawUser?.microsoftAccessToken || rawAccount?.microsoftAccessToken || '').trim(),
    userType: String(rawUser?.userType || rawAccount?.userType || '').trim() || 'msa',
    loginSource: String(rawUser?.loginSource || rawAccount?.loginSource || '').trim(),
    tokenSource: String(rawUser?.tokenSource || rawAccount?.tokenSource || '').trim(),
    authCacheId: String(rawUser?.authCacheId || rawAccount?.authCacheId || '').trim()
  };
  delete user.isAdmin;
  if (String(user.loginSource || '').trim().toLowerCase() === 'offline') {
    username = normalizeOfflineUsername(username, 'OfflinePlayer');
    user.username = username;
    user.uuid = createOfflineUuid(username);
    user.accessToken = 'offline-token';
    user.userType = 'legacy';
    user.loginSource = 'offline';
  }
  const generatedId = accountIdForUser(user);
  const rawId = String(rawAccount?.id || '').trim();
  const id = shouldRegenerateStoredAccountId(rawId, user) ? generatedId : rawId || generatedId;
  if (!id) {
    return null;
  }
  return {
    id,
    user,
    username,
    uuid: user.uuid,
    userType: user.userType,
    loginSource: user.loginSource,
    addedAt: String(rawAccount?.addedAt || rawUser?.loginTime || '').trim() || new Date().toISOString(),
    updatedAt: String(rawAccount?.updatedAt || rawUser?.loginTime || '').trim() || new Date().toISOString()
  };
}

function normalizeAccountsState(rawState) {
  const accounts = (Array.isArray(rawState?.accounts) ? rawState.accounts : [])
    .map(normalizeAccountEntry)
    .filter(Boolean);
  const seen = new Set();
  const uniqueAccounts = [];
  for (const account of accounts) {
    if (seen.has(account.id)) {
      continue;
    }
    seen.add(account.id);
    uniqueAccounts.push(account);
  }
  const activeAccountId = String(rawState?.activeAccountId || '').trim();
  return {
    activeAccountId: uniqueAccounts.some((account) => account.id === activeAccountId) ? activeAccountId : '',
    accounts: uniqueAccounts
  };
}

function readAccountsState() {
  return ROBUSTNESS.readJsonFile(ACCOUNTS_STATE_FILE, getDefaultAccountsState(), {
    label: 'accounts-state',
    normalize: normalizeAccountsState
  });
}

function writeAccountsState(state) {
  const normalizedState = normalizeAccountsState(state);
  ROBUSTNESS.writeJsonFileAtomic(ACCOUNTS_STATE_FILE, {
    activeAccountId: normalizedState.activeAccountId,
    accounts: normalizedState.accounts
  }, {
    label: 'accounts-state',
    metadata: { operation: 'writeAccountsState' }
  });
  return normalizedState;
}

function accountForUi(account) {
  const user = deriveCurrentUser(account.user);
  return {
    id: account.id,
    username: account.username,
    uuid: account.uuid,
    userType: account.userType,
    loginSource: account.loginSource,
    addedAt: account.addedAt,
    updatedAt: account.updatedAt,
    isAdmin: user?.isAdmin === true
  };
}

function accountsConfigFromState(state) {
  const normalizedState = normalizeAccountsState(state);
  return {
    success: true,
    activeAccountId: normalizedState.activeAccountId,
    accounts: normalizedState.accounts
      .slice()
      .sort((left, right) => getVersionTimestamp(right.updatedAt) - getVersionTimestamp(left.updatedAt))
      .map(accountForUi)
  };
}

function getAccountsConfig() {
  const savedUser = readSavedUserFile();
  if (savedUser?.username) {
    upsertSavedAccount(savedUser);
  }
  return accountsConfigFromState(readAccountsState());
}

function upsertSavedAccount(userInfo) {
  const account = normalizeAccountEntry({
    user: userInfo,
    updatedAt: new Date().toISOString()
  });
  if (!account) {
    return readAccountsState();
  }
  const state = readAccountsState();
  const existing = state.accounts.find((entry) => entry.id === account.id);
  const nextAccount = {
    ...(existing || {}),
    ...account,
    addedAt: existing?.addedAt || account.addedAt,
    updatedAt: new Date().toISOString()
  };
  state.accounts = [
    nextAccount,
    ...state.accounts.filter((entry) => entry.id !== account.id)
  ];
  state.activeAccountId = account.id;
  return writeAccountsState(state);
}

function setActiveAccountId(accountId) {
  const state = readAccountsState();
  state.activeAccountId = state.accounts.some((account) => account.id === accountId) ? accountId : '';
  return writeAccountsState(state);
}

function switchAccount(accountId) {
  const normalizedAccountId = String(accountId || '').trim();
  const state = readAccountsState();
  const account = state.accounts.find((entry) => entry.id === normalizedAccountId);
  if (!account) {
    return { success: false, error: 'Account wurde nicht gefunden.' };
  }
  const user = writeSavedUserFile(account.user, 'switch-account');
  return {
    success: true,
    activeAccountId: normalizedAccountId,
    user,
    accounts: getAccountsConfig().accounts,
    message: `${account.username} ist jetzt aktiv.`
  };
}

function removeAccount(accountId) {
  const normalizedAccountId = String(accountId || '').trim();
  const state = readAccountsState();
  const removed = state.accounts.find((entry) => entry.id === normalizedAccountId);
  if (!removed) {
    return { success: false, error: 'Account wurde nicht gefunden.' };
  }
  const savedUser = readSavedUserFile();
  const savedUserAccountId = savedUser?.username ? accountIdForUser(savedUser) : '';
  const removedActive = state.activeAccountId === normalizedAccountId || savedUserAccountId === normalizedAccountId;
  state.accounts = state.accounts.filter((entry) => entry.id !== normalizedAccountId);
  let nextUser = removedActive ? null : savedUser;

  if (removedActive) {
    const nextActiveAccount = state.accounts[0] || null;
    state.activeAccountId = nextActiveAccount?.id || '';
    let writtenState = writeAccountsState(state);
    if (nextActiveAccount) {
      nextUser = writeSavedUserFile(nextActiveAccount.user, 'remove-account-activate-next');
      writtenState = readAccountsState();
    } else if (fs.existsSync(USER_FILE)) {
      fs.unlinkSync(USER_FILE);
      clearCurrentUser();
    } else {
      clearCurrentUser();
    }
    const config = accountsConfigFromState(writtenState);
    return {
      success: true,
      removedActive,
      user: nextUser,
      activeAccountId: config.activeAccountId,
      accounts: config.accounts,
      message: `${removed.username} wurde entfernt.`
    };
  }

  if (!state.activeAccountId && savedUserAccountId && state.accounts.some((entry) => entry.id === savedUserAccountId)) {
    state.activeAccountId = savedUserAccountId;
  }
  const writtenState = writeAccountsState(state);
  const config = accountsConfigFromState(writtenState);
  return {
    success: true,
    removedActive,
    user: nextUser,
    activeAccountId: config.activeAccountId,
    accounts: config.accounts,
    message: `${removed.username} wurde entfernt.`
  };
}

function createOfflineAccount(username) {
  const requestedUsername = String(username || '').trim();
  if (!isValidOfflineUsername(requestedUsername)) {
    return {
      success: false,
      error: 'Offline-Spielername muss 3 bis 16 Zeichen lang sein und darf nur Buchstaben, Zahlen und Unterstriche enthalten.'
    };
  }
  const existingUser = readSavedUserFile();
  const offlineUser = writeSavedUserFile(createOfflineUser(requestedUsername, existingUser), 'offline-account-login');
  const config = accountsConfigFromState(readAccountsState());
  return {
    success: true,
    user: offlineUser,
    accounts: config.accounts,
    activeAccountId: config.activeAccountId,
    warning: 'Offline-Account aktiv. Multiplayer geht damit nur auf Offline-Mode-Servern.'
  };
}

function getDefaultServerFavoritesState() {
  return {
    servers: []
  };
}

function normalizeServerPort(port = 25565) {
  const normalizedPort = Math.round(Number(port) || 25565);
  return Math.min(65535, Math.max(1, normalizedPort));
}

function normalizeServerHost(value) {
  let host = String(value || '').trim();
  host = host.replace(/^minecraft:\/\//iu, '').replace(/^https?:\/\//iu, '');
  host = host.split(/[/?#]/u)[0] || host;
  return host.replace(/[\s<>"]/gu, '').slice(0, 253);
}

function sanitizeServerIconDataUrl(value) {
  const dataUrl = String(value || '').trim();
  if (!dataUrl || dataUrl.length > MAX_SERVER_ICON_DATA_URL_LENGTH) {
    return '';
  }
  if (!/^data:image\/png;base64,[a-z0-9+/=]+$/iu.test(dataUrl)) {
    return '';
  }
  return dataUrl;
}

function sanitizeServerText(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim().slice(0, 180);
}

function parseServerAddress(rawHost, _rawPort = '') {
  let host = normalizeServerHost(rawHost);
  let port = normalizeServerPort(_rawPort);
  const bracketMatch = host.match(/^\[([^\]]+)\]:(\d+)$/u);
  if (bracketMatch) {
    host = bracketMatch[1];
    port = normalizeServerPort(bracketMatch[2]);
  } else {
    const colonParts = host.split(':');
    if (colonParts.length === 2 && /^\d+$/u.test(colonParts[1])) {
      host = colonParts[0];
      port = normalizeServerPort(colonParts[1]);
    }
  }
  return { host: normalizeServerHost(host), port };
}

function serverIdFor(host, port) {
  return crypto.createHash('sha1')
    .update(`${String(host || '').toLowerCase()}:${normalizeServerPort(port)}`)
    .digest('hex')
    .slice(0, 18);
}

function normalizeServerFavorite(rawServer) {
  const parsed = parseServerAddress(rawServer?.host || rawServer?.address || '', rawServer?.port);
  if (!parsed.host) {
    return null;
  }
  const id = String(rawServer?.id || serverIdFor(parsed.host, parsed.port)).trim();
  const name = String(rawServer?.name || parsed.host).trim().replace(/\s+/gu, ' ').slice(0, 42) || parsed.host;
  return {
    id,
    name,
    host: parsed.host,
    port: parsed.port,
    iconDataUrl: sanitizeServerIconDataUrl(rawServer?.iconDataUrl || rawServer?.favicon),
    motd: sanitizeServerText(rawServer?.motd || rawServer?.descriptionText),
    iconUpdatedAt: String(rawServer?.iconUpdatedAt || '').trim(),
    createdAt: String(rawServer?.createdAt || '').trim() || new Date().toISOString(),
    updatedAt: String(rawServer?.updatedAt || '').trim() || new Date().toISOString()
  };
}

function normalizeServerFavoritesState(rawState) {
  const servers = (Array.isArray(rawState?.servers) ? rawState.servers : [])
    .map(normalizeServerFavorite)
    .filter(Boolean);
  const seen = new Set();
  return {
    servers: servers.filter((server) => {
      if (seen.has(server.id)) {
        return false;
      }
      seen.add(server.id);
      return true;
    })
  };
}

function readServerFavoritesState() {
  return ROBUSTNESS.readJsonFile(SERVER_FAVORITES_STATE_FILE, getDefaultServerFavoritesState(), {
    label: 'server-favorites-state',
    normalize: normalizeServerFavoritesState
  });
}

function writeServerFavoritesState(state) {
  const normalizedState = normalizeServerFavoritesState(state);
  ROBUSTNESS.writeJsonFileAtomic(SERVER_FAVORITES_STATE_FILE, normalizedState, {
    label: 'server-favorites-state',
    metadata: { operation: 'writeServerFavoritesState' }
  });
  return normalizedState;
}

function encodeMinecraftVarInt(value) {
  const bytes = [];
  let nextValue = Number(value) | 0;
  do {
    let byte = nextValue & 0x7F;
    nextValue >>>= 7;
    if (nextValue !== 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (nextValue !== 0);
  return Buffer.from(bytes);
}

function decodeMinecraftVarInt(buffer, offset = 0) {
  let result = 0;
  let shift = 0;
  let cursor = offset;
  while (cursor < buffer.length) {
    const byte = buffer[cursor];
    result |= (byte & 0x7F) << shift;
    cursor += 1;
    if ((byte & 0x80) === 0) {
      return { value: result, nextOffset: cursor };
    }
    shift += 7;
    if (shift > 35) {
      throw new Error('Serverstatus-VarInt ist ungültig.');
    }
  }
  return null;
}

function encodeMinecraftString(value) {
  const bytes = Buffer.from(String(value || ''), 'utf8');
  return Buffer.concat([encodeMinecraftVarInt(bytes.length), bytes]);
}

function encodeMinecraftPacket(payload) {
  return Buffer.concat([encodeMinecraftVarInt(payload.length), payload]);
}

function createMinecraftStatusRequest(host, port) {
  const portBuffer = Buffer.allocUnsafe(2);
  portBuffer.writeUInt16BE(normalizeServerPort(port), 0);
  const handshake = encodeMinecraftPacket(Buffer.concat([
    encodeMinecraftVarInt(0),
    encodeMinecraftVarInt(-1),
    encodeMinecraftString(host),
    portBuffer,
    encodeMinecraftVarInt(1)
  ]));
  const statusRequest = encodeMinecraftPacket(encodeMinecraftVarInt(0));
  return Buffer.concat([handshake, statusRequest]);
}

function parseMinecraftStatusResponse(buffer) {
  const packetLength = decodeMinecraftVarInt(buffer, 0);
  if (!packetLength) {
    return null;
  }
  const packetEnd = packetLength.nextOffset + packetLength.value;
  if (buffer.length < packetEnd) {
    return null;
  }
  const packetId = decodeMinecraftVarInt(buffer, packetLength.nextOffset);
  if (!packetId) {
    return null;
  }
  const jsonLength = decodeMinecraftVarInt(buffer, packetId.nextOffset);
  if (!jsonLength) {
    return null;
  }
  const jsonStart = jsonLength.nextOffset;
  const jsonEnd = jsonStart + jsonLength.value;
  if (buffer.length < jsonEnd) {
    return null;
  }
  return JSON.parse(buffer.toString('utf8', jsonStart, jsonEnd));
}

function minecraftDescriptionToText(description) {
  if (!description) {
    return '';
  }
  if (typeof description === 'string') {
    return description;
  }
  if (Array.isArray(description)) {
    return description.map(minecraftDescriptionToText).join('');
  }
  if (typeof description === 'object') {
    return [
      description.text || '',
      ...(Array.isArray(description.extra) ? description.extra.map(minecraftDescriptionToText) : [])
    ].join('');
  }
  return '';
}

function pingMinecraftServerStatus(host, port) {
  return new Promise((resolve, reject) => {
    const normalizedHost = normalizeServerHost(host);
    const normalizedPort = normalizeServerPort(port);
    if (!normalizedHost) {
      reject(new Error('Server-Adresse fehlt.'));
      return;
    }

    const chunks = [];
    let settled = false;
    const socket = net.createConnection({ host: normalizedHost, port: normalizedPort });
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      reject(new Error('Serverstatus-Timeout.'));
    }, MINECRAFT_SERVER_STATUS_TIMEOUT_MS);

    const finish = (error, value = null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };

    socket.on('connect', () => {
      socket.write(createMinecraftStatusRequest(normalizedHost, normalizedPort));
    });
    socket.on('data', (chunk) => {
      chunks.push(chunk);
      try {
        const parsed = parseMinecraftStatusResponse(Buffer.concat(chunks));
        if (parsed) {
          finish(null, parsed);
        }
      } catch (error) {
        finish(error);
      }
    });
    socket.on('error', (error) => finish(error));
    socket.on('end', () => {
      if (!settled) {
        finish(new Error('Serverstatus konnte nicht gelesen werden.'));
      }
    });
  });
}

async function enrichServerFavoriteMetadata(server, { force = false } = {}) {
  const normalizedServer = normalizeServerFavorite(server);
  if (!normalizedServer) {
    return server;
  }
  if (!force && normalizedServer.iconDataUrl) {
    return normalizedServer;
  }
  try {
    const status = await pingMinecraftServerStatus(normalizedServer.host, normalizedServer.port);
    const iconDataUrl = sanitizeServerIconDataUrl(status?.favicon);
    const motd = sanitizeServerText(minecraftDescriptionToText(status?.description));
    return {
      ...normalizedServer,
      ...(iconDataUrl ? { iconDataUrl } : {}),
      ...(motd ? { motd } : {}),
      iconUpdatedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.warn('Could not read Minecraft server icon', {
      host: normalizedServer.host,
      port: normalizedServer.port,
      error: serializeError(error)
    });
    return normalizedServer;
  }
}

async function refreshServerFavoriteIcons(state, { force = false } = {}) {
  const normalizedState = normalizeServerFavoritesState(state);
  let changed = false;
  const servers = await Promise.all(normalizedState.servers.map(async (server) => {
    const enriched = await enrichServerFavoriteMetadata(server, { force });
    if (enriched.iconDataUrl !== server.iconDataUrl || enriched.motd !== server.motd || enriched.iconUpdatedAt !== server.iconUpdatedAt) {
      changed = true;
    }
    return enriched;
  }));
  const nextState = { servers };
  if (changed) {
    writeServerFavoritesState(nextState);
  }
  return nextState;
}

async function getServerFavoritesConfig() {
  const state = readServerFavoritesState();
  const enrichedState = await refreshServerFavoriteIcons(state);
  return {
    success: true,
    // Only explicitly saved favorites belong in the launcher favorites UI.
    // Minecraft's servers.dat may contain many normal multiplayer entries and
    // must not be merged into this list automatically.
    servers: enrichedState.servers
      .slice()
      .sort((left, right) => getVersionTimestamp(right.updatedAt) - getVersionTimestamp(left.updatedAt))
  };
}

async function addServerFavorite(server) {
  const favorite = normalizeServerFavorite(server);
  if (!favorite) {
    return { success: false, error: 'Bitte gib eine gültige Server-Adresse ein.' };
  }
  const state = readServerFavoritesState();
  const existing = state.servers.find((entry) => entry.id === favorite.id);
  const nextServer = await enrichServerFavoriteMetadata({
    ...(existing || {}),
    ...favorite,
    iconDataUrl: favorite.iconDataUrl || existing?.iconDataUrl || '',
    motd: favorite.motd || existing?.motd || '',
    iconUpdatedAt: favorite.iconUpdatedAt || existing?.iconUpdatedAt || '',
    createdAt: existing?.createdAt || favorite.createdAt,
    updatedAt: new Date().toISOString()
  }, { force: true });
  state.servers = [
    nextServer,
    ...state.servers.filter((entry) => entry.id !== favorite.id)
  ];
  writeServerFavoritesState(state);
  return {
    success: true,
    server: nextServer,
    servers: (await getServerFavoritesConfig()).servers,
    message: `${nextServer.name} wurde gespeichert.`
  };
}

async function removeServerFavorite(serverId) {
  const normalizedServerId = String(serverId || '').trim();
  const state = readServerFavoritesState();
  const removed = state.servers.find((server) => server.id === normalizedServerId);
  if (!removed) {
    return { success: false, error: 'Server wurde nicht gefunden.' };
  }
  state.servers = state.servers.filter((server) => server.id !== normalizedServerId);
  writeServerFavoritesState(state);
  return {
    success: true,
    servers: (await getServerFavoritesConfig()).servers,
    message: `${removed.name} wurde entfernt.`
  };
}

function resolveLaunchServer(launchOptions = {}) {
  const serverId = String(launchOptions?.serverId || '').trim();
  if (serverId) {
    const favorite = readServerFavoritesState().servers.find((server) => server.id === serverId);
    if (favorite) {
      return favorite;
    }
    if (serverId.startsWith('official-')) {
      try {
        const officialServer = listServers(DEFAULT_MINECRAFT_DIR).map((server) => normalizeServerFavorite({
          name: server.name,
          address: server.address
        })).find((server) => server && `official-${serverIdFor(server.host, server.port)}` === serverId);
        if (officialServer) return officialServer;
      } catch (_error) {
        // A malformed servers.dat entry must not break normal launching.
      }
    }
  }
  const direct = normalizeServerFavorite(launchOptions?.server || launchOptions);
  return direct ? {
    id: direct.id,
    name: direct.name,
    host: direct.host,
    port: direct.port
  } : null;
}

function createHostedServerId(name = '') {
  return crypto.createHash('sha1')
    .update(`${Date.now()}:${crypto.randomBytes(8).toString('hex')}:${name}`)
    .digest('hex')
    .slice(0, 14);
}

function normalizeHostedServerName(value) {
  let normalized = String(value || '').trim().toLowerCase();
  normalized = normalized.replace(/^https?:\/\//u, '');
  normalized = normalized.replace(/:\d+$/u, '');
  return normalized
    .replace(/[^a-z0-9-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .replace(/-{2,}/gu, '-')
    .slice(0, 32);
}

function getHostedServerHostName(serverName) {
  return normalizeHostedServerName(serverName);
}

function getHostedServerDomain(server) {
  const customDomain = String(server?.customDomain || '').trim();
  if (customDomain) {
    return customDomain;
  }
  const hostName = getHostedServerHostName(server?.hostName || server?.name || '');
  return hostName ? `${hostName}.x.gg` : '';
}

function getHostedServerAutoDnsDomain(server, publicIp = '') {
  const hostName = getHostedServerHostName(server?.hostName || server?.name || 'server') || 'server';
  const ip = String(publicIp || '').trim();
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(ip) || isPrivateIpv4Address(ip)) {
    return '';
  }
  return `${hostName}-${ip.replace(/\./gu, '-')}.${HOSTED_SERVER_AUTO_DNS_SUFFIX}`;
}

function getDefaultHostedServer(name = '') {
  const now = new Date().toISOString();
  const normalizedName = normalizeHostedServerName(name);
  return {
    id: createHostedServerId(normalizedName),
    name: normalizedName,
    hostName: getHostedServerHostName(normalizedName),
    directoryName: normalizedName,
    minecraftVersion: 'latest',
    edition: 'java',
    software: 'vanilla',
    serverSoftware: 'vanilla',
    softwareLabel: 'Vanilla',
    networkProtocol: 'TCP',
    fabricLoaderVersion: '',
    ramGb: 2,
    port: 25565,
    maxPlayers: 20,
    difficulty: 'normal',
    gamemode: 'survival',
    motd: '',
    pvp: true,
    whitelist: false,
    onlineMode: true,
    enableCommandBlock: false,
    spawnProtection: 16,
    viewDistance: 10,
    simulationDistance: 10,
    eulaAccepted: false,
    ownerUsername: '',
    ownerUuid: '',
    createdAt: now,
    updatedAt: now,
    installedAt: '',
    resolvedMinecraftVersion: '',
    resolvedLoaderVersion: '',
    resolvedInstallerVersion: ''
  };
}

function getDefaultHostedServerState() {
  return {
    activeServerId: '',
    servers: []
  };
}

function normalizeHostedServerPort(value, fallback = 25565) {
  const port = Math.round(Number(value) || fallback);
  return Math.min(65535, Math.max(1024, port));
}

function normalizeHostedServerInt(value, fallback, min, max) {
  const number = Math.round(Number(value) || fallback);
  return Math.min(max, Math.max(min, number));
}

function normalizeHostedServerBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeHostedServerEdition(value = 'java') {
  return String(value || '').trim().toLowerCase() === 'bedrock' ? 'bedrock' : 'java';
}

function normalizeHostedServerSoftware(value = 'vanilla', edition = 'java') {
  const normalizedEdition = normalizeHostedServerEdition(edition);
  const normalized = String(value || '').trim().toLowerCase();
  if (normalizedEdition === 'bedrock') {
    return 'bedrock';
  }
  return normalized === 'paper' ? 'paper' : 'vanilla';
}

function getHostedServerDefaultPort(serverOrEdition = 'java') {
  const edition = typeof serverOrEdition === 'object'
    ? normalizeHostedServerEdition(serverOrEdition?.edition)
    : normalizeHostedServerEdition(serverOrEdition);
  return edition === 'bedrock' ? 19132 : 25565;
}

function getHostedServerProtocol(serverOrEdition = 'java') {
  const edition = typeof serverOrEdition === 'object'
    ? normalizeHostedServerEdition(serverOrEdition?.edition)
    : normalizeHostedServerEdition(serverOrEdition);
  return edition === 'bedrock' ? 'UDP' : 'TCP';
}

function isHostedServerBedrock(server) {
  return normalizeHostedServerEdition(server?.edition) === 'bedrock';
}

function isHostedServerJava(server) {
  return !isHostedServerBedrock(server);
}

function getHostedServerSoftwareLabel(server) {
  const software = normalizeHostedServerSoftware(server?.software || server?.serverSoftware, server?.edition);
  if (software === 'paper') {
    return 'Paper';
  }
  if (software === 'bedrock') {
    return 'Bedrock Dedicated Server';
  }
  return 'Vanilla';
}

function normalizeHostedServerEntry(rawServer = {}, fallbackPort = 25565) {
  const name = normalizeHostedServerName(rawServer.name);
  const id = String(rawServer.id || createHostedServerId(name)).replace(/[^\w.-]/gu, '').slice(0, 40) || createHostedServerId(name);
  const edition = normalizeHostedServerEdition(rawServer.edition || rawServer.serverEdition || 'java');
  const software = normalizeHostedServerSoftware(rawServer.software || rawServer.serverSoftware || rawServer.type || 'vanilla', edition);
  const defaultPort = normalizeHostedServerPort(fallbackPort || getHostedServerDefaultPort(edition), getHostedServerDefaultPort(edition));
  const minecraftVersion = String(rawServer.minecraftVersion || rawServer.versionId || 'latest').trim().slice(0, 24) || 'latest';
  const difficulty = ['peaceful', 'easy', 'normal', 'hard'].includes(String(rawServer.difficulty || '').toLowerCase())
    ? String(rawServer.difficulty).toLowerCase()
    : 'normal';
  const gamemode = ['survival', 'creative', 'adventure', 'spectator'].includes(String(rawServer.gamemode || '').toLowerCase())
    ? String(rawServer.gamemode).toLowerCase()
    : 'survival';
  return {
    id,
    name,
    hostName: getHostedServerHostName(name),
    directoryName: String(rawServer.directoryName || rawServer.folderName || (rawServer.installedAt ? id : getHostedServerHostName(name)) || id)
      .replace(/[^\w.-]/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 40) || id,
    minecraftVersion,
    edition,
    software,
    serverSoftware: software,
    softwareLabel: getHostedServerSoftwareLabel({ edition, software }),
    networkProtocol: getHostedServerProtocol(edition),
    fabricLoaderVersion: String(rawServer.fabricLoaderVersion || '').trim().slice(0, 32),
    ramGb: Math.min(16, Math.max(1, Math.round(Number(rawServer.ramGb) || 2))),
    port: normalizeHostedServerPort(rawServer.port, defaultPort),
    maxPlayers: Math.min(100, Math.max(1, Math.round(Number(rawServer.maxPlayers) || 20))),
    difficulty,
    gamemode,
    motd: String(rawServer.motd || '').trim().slice(0, 120),
    pvp: normalizeHostedServerBoolean(rawServer.pvp, true),
    whitelist: normalizeHostedServerBoolean(rawServer.whitelist, false),
    onlineMode: normalizeHostedServerBoolean(rawServer.onlineMode, true),
    enableCommandBlock: normalizeHostedServerBoolean(rawServer.enableCommandBlock, false),
    spawnProtection: normalizeHostedServerInt(rawServer.spawnProtection, 16, 0, 64),
    viewDistance: normalizeHostedServerInt(rawServer.viewDistance, 10, 2, 32),
    simulationDistance: normalizeHostedServerInt(rawServer.simulationDistance, 10, 2, 32),
    eulaAccepted: Boolean(rawServer.eulaAccepted),
    ownerUsername: String(rawServer.ownerUsername || '').trim().slice(0, 16),
    ownerUuid: normalizeMinecraftUuid(rawServer.ownerUuid || ''),
    createdAt: String(rawServer.createdAt || '').trim() || new Date().toISOString(),
    updatedAt: String(rawServer.updatedAt || '').trim() || new Date().toISOString(),
    installedAt: String(rawServer.installedAt || '').trim(),
    resolvedMinecraftVersion: String(rawServer.resolvedMinecraftVersion || '').trim(),
    resolvedLoaderVersion: String(rawServer.resolvedLoaderVersion || '').trim(),
    resolvedInstallerVersion: String(rawServer.resolvedInstallerVersion || '').trim()
  };
}

function normalizeHostedServerState(rawState = {}) {
  let rawServers = Array.isArray(rawState.servers) ? rawState.servers : [];
  if (!rawServers.length && (rawState.name || rawState.ramGb || rawState.eulaAccepted || rawState.versionId)) {
    rawServers = [{
      id: 'default',
      name: rawState.name,
      minecraftVersion: rawState.versionId || 'latest',
      ramGb: rawState.ramGb,
      port: rawState.port,
      eulaAccepted: rawState.eulaAccepted,
      maxPlayers: rawState.maxPlayers,
      difficulty: rawState.difficulty,
      gamemode: rawState.gamemode,
      installedAt: rawState.installedAt,
      updatedAt: rawState.updatedAt
    }];
  }

  const seen = new Set();
  const seenPorts = new Set();
  const servers = rawServers
    .map((server, index) => {
      const edition = normalizeHostedServerEdition(server?.edition || server?.serverEdition || 'java');
      return normalizeHostedServerEntry(server, getHostedServerDefaultPort(edition) + index);
    })
    .filter((server) => server.name)
    .filter((server) => !(server.name === 'x-server' && !server.installedAt && !server.eulaAccepted))
    .filter((server) => {
      const key = server.hostName.toLowerCase();
      if (seen.has(server.id) || seen.has(key)) {
        return false;
      }
      seen.add(server.id);
      seen.add(key);
      return true;
    })
    .map((server) => {
      let port = normalizeHostedServerPort(server.port);
      while (seenPorts.has(port) && port < 65535) {
        port += 1;
      }
      seenPorts.add(port);
      return port === server.port ? server : { ...server, port };
    });

  const activeServerId = servers.some((server) => server.id === rawState.activeServerId)
    ? rawState.activeServerId
    : servers[0]?.id || '';
  return { activeServerId, servers };
}

function readHostedServerState() {
  return ROBUSTNESS.readJsonFile(HOSTED_SERVER_STATE_FILE, getDefaultHostedServerState(), {
    label: 'hosted-server-state',
    normalize: normalizeHostedServerState
  });
}

function writeHostedServerState(state) {
  ensureDir(HOSTED_SERVER_DIR);
  ensureDir(HOSTED_SERVER_INSTANCES_DIR);
  const normalizedState = normalizeHostedServerState(state);
  ROBUSTNESS.writeJsonFileAtomic(HOSTED_SERVER_STATE_FILE, normalizedState, {
    label: 'hosted-server-state',
    metadata: { operation: 'writeHostedServerState' }
  });
  return normalizedState;
}

function getHostedServerById(state, serverId = '') {
  const normalizedId = String(serverId || state.activeServerId || '').trim();
  return state.servers.find((server) => server.id === normalizedId) || state.servers[0] || null;
}

function getHostedServerDir(server) {
  const folderName = String(server?.directoryName || server?.hostName || server?.id || 'default')
    .replace(/[^\w.-]/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 40) || 'default';
  return path.join(HOSTED_SERVER_INSTANCES_DIR, folderName);
}

function getHostedServerJarPath(server) {
  return path.join(getHostedServerDir(server), 'server.jar');
}

function getHostedServerBedrockExecutablePath(server) {
  return path.join(getHostedServerDir(server), process.platform === 'win32' ? 'bedrock_server.exe' : 'bedrock_server');
}

function getHostedServerModsDir(server) {
  return path.join(getHostedServerDir(server), 'mods');
}

function getHostedServerLogPath(server) {
  return path.join(getHostedServerDir(server), 'server.log');
}

function isHostedServerRuntimeAlive(runtime) {
  return Boolean(runtime?.process && !runtime.process.killed && runtime.process.exitCode === null);
}

function getHostedServerRuntime(serverId = '') {
  const id = String(serverId || hostedServerRunningId || '').trim();
  if (!id) {
    return null;
  }
  const runtime = hostedServerProcesses.get(id) || null;
  return isHostedServerRuntimeAlive(runtime) ? runtime : null;
}

function getHostedServerRunningIds() {
  for (const [serverId, runtime] of hostedServerProcesses.entries()) {
    if (!isHostedServerRuntimeAlive(runtime)) {
      hostedServerProcesses.delete(serverId);
    }
  }
  return Array.from(hostedServerProcesses.keys());
}

function syncLegacyHostedServerRuntime() {
  const runningIds = getHostedServerRunningIds();
  const preferredId = hostedServerRunningId && runningIds.includes(hostedServerRunningId)
    ? hostedServerRunningId
    : runningIds[0] || '';
  const runtime = preferredId ? hostedServerProcesses.get(preferredId) : null;
  hostedServerProcess = runtime?.process || null;
  hostedServerStartedAt = runtime?.startedAt || '';
  hostedServerRunningId = preferredId;
  if (!runningIds.length) {
    stopHostedServerPowerBlocker();
  }
  return runtime || null;
}

function readHostedServerConsoleTail(server, maxChars = 12000) {
  if (!server) {
    return '';
  }
  const logPath = getHostedServerLogPath(server);
  try {
    if (!fs.existsSync(logPath)) {
      return '';
    }
    const stats = fs.statSync(logPath);
    const size = Math.min(stats.size, maxChars);
    const buffer = Buffer.alloc(size);
    const fd = fs.openSync(logPath, 'r');
    try {
      fs.readSync(fd, buffer, 0, size, Math.max(0, stats.size - size));
    } finally {
      fs.closeSync(fd);
    }
    return buffer.toString('utf8').replace(/\u0000/gu, '').trim();
  } catch (error) {
    logger.warn('Could not read hosted server log', { error: serializeError(error) });
    return '';
  }
}

function hasHostedServerReadyLog(consoleOutput = '', server = null) {
  const output = String(consoleOutput || '');
  if (isHostedServerBedrock(server)) {
    return /Server started\.|IPv4 supported, port:|IPv4 supported/iu.test(output);
  }
  return /Done \([\d.]+s\)! For help, type "help"/iu.test(output);
}

function readHostedServerProperties(server) {
  if (!server) {
    return { exists: false, serverIp: '', serverPort: 0, protocol: 'TCP' };
  }
  const propertiesPath = path.join(getHostedServerDir(server), 'server.properties');
  try {
    if (!fs.existsSync(propertiesPath)) {
      return { exists: false, serverIp: '', serverPort: 0, path: propertiesPath, protocol: getHostedServerProtocol(server) };
    }
    const raw = fs.readFileSync(propertiesPath, 'utf8');
    const values = {};
    String(raw || '').split(/\r?\n/u).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }
      const separator = trimmed.indexOf('=');
      if (separator < 0) {
        return;
      }
      values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
    });
    return {
      exists: true,
      path: propertiesPath,
      serverIp: isHostedServerBedrock(server) ? '' : (values['server-ip'] || ''),
      serverPort: normalizeHostedServerPort(values['server-port'] || server.port, getHostedServerDefaultPort(server)),
      serverPortV6: normalizeHostedServerPort(values['server-portv6'] || (Number(server.port) + 1), getHostedServerDefaultPort(server) + 1),
      protocol: getHostedServerProtocol(server),
      raw
    };
  } catch (error) {
    logger.warn('Could not read hosted server.properties', { error: serializeError(error) });
    return { exists: false, serverIp: '', serverPort: 0, path: propertiesPath, protocol: getHostedServerProtocol(server), error: error.message || String(error) };
  }
}

function getHostedServerProcessStats(runtime = syncLegacyHostedServerRuntime()) {
  const processRef = runtime?.process || null;
  if (!processRef || !processRef.pid) {
    return { memoryMb: 0, cpuTime: '', cpuSeconds: 0, pid: null };
  }
  if (process.platform !== 'win32') {
    return { memoryMb: 0, cpuTime: '', cpuSeconds: 0, pid: processRef.pid };
  }
  try {
    const output = execFileSync('tasklist', [
      '/FI',
      `PID eq ${processRef.pid}`,
      '/FO',
      'CSV',
      '/NH'
    ], { encoding: 'utf8', windowsHide: true, timeout: 2500 }).trim();
    const match = output.match(/^"[^"]*","[^"]*","[^"]*","[^"]*","([^"]*)"/u);
    const memoryKb = match ? Number(String(match[1]).replace(/[^\d]/gu, '')) : 0;
    let cpuSeconds = 0;
    try {
      const cpuOutput = execFileSync('powershell', [
        '-NoProfile',
        '-Command',
        `(Get-Process -Id ${processRef.pid} -ErrorAction SilentlyContinue).CPU`
      ], { encoding: 'utf8', windowsHide: true, timeout: 2500 }).trim();
      cpuSeconds = Math.max(0, Number(cpuOutput.replace(',', '.')) || 0);
    } catch (_cpuError) {
      cpuSeconds = 0;
    }
    return {
      memoryMb: memoryKb ? Math.round(memoryKb / 1024) : 0,
      cpuTime: cpuSeconds ? `${Math.round(cpuSeconds)}s` : '',
      cpuSeconds,
      pid: processRef.pid
    };
  } catch (_error) {
    return { memoryMb: 0, cpuTime: '', cpuSeconds: 0, pid: processRef.pid };
  }
}

function parseHostedServerPlayerCount(consoleOutput = '') {
  const matches = Array.from(String(consoleOutput || '').matchAll(/There are (\d+) of a max of (\d+) players online/giu));
  const last = matches[matches.length - 1];
  if (!last) {
    return null;
  }
  return {
    online: Number(last[1]) || 0,
    max: Number(last[2]) || 0
  };
}

function requestHostedServerPlayerList(runtime) {
  if (!isHostedServerRuntimeAlive(runtime) || !runtime.process?.stdin) {
    return;
  }
  const now = Date.now();
  if (runtime.lastPlayerListAt && now - runtime.lastPlayerListAt < 30000) {
    return;
  }
  runtime.lastPlayerListAt = now;
  try {
    runtime.process.stdin.write('list\n');
  } catch (_error) {
    // Player polling is best-effort; server process monitoring continues without it.
  }
}

function listHostedServerMods(server) {
  const modsDir = getHostedServerModsDir(server);
  if (!fs.existsSync(modsDir)) {
    return [];
  }
  return fs.readdirSync(modsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.jar$/iu.test(entry.name))
    .map((entry) => {
      const filePath = path.join(modsDir, entry.name);
      let size = 0;
      try {
        size = fs.statSync(filePath).size;
      } catch (_error) {
        size = 0;
      }
      return { fileName: entry.name, size };
    })
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

function getLocalLanIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal && entry.address) {
        return entry.address;
      }
    }
  }
  return '';
}

function getLocalLanAddress(port = 25565) {
  const address = getLocalLanIpAddress();
  return address ? `${address}:${normalizeHostedServerPort(port)}` : '';
}

function isPrivateIpv4Address(value = '') {
  const parts = String(value || '').trim().split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [first, second] = parts;
  return first === 10
    || first === 127
    || first === 192 && second === 168
    || first === 172 && second >= 16 && second <= 31
    || first === 169 && second === 254;
}

async function fetchPublicIpAddress() {
  try {
    const url = 'https://api.ipify.org?format=json';
    assertTrustedHttpsUrl(url, TRUSTED_PUBLIC_IP_HOSTS);
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      timeout: 4000
    });
    if (!response.ok) {
      return '';
    }
    const body = await response.json();
    const ip = String(body?.ip || '').trim();
    return /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(ip) && !isPrivateIpv4Address(ip) ? ip : '';
  } catch (error) {
    logger.warn('Could not read public IP for hosted server', { error: serializeError(error) });
    return '';
  }
}

function withTimeout(promise, timeoutMs, fallbackValue) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs))
  ]);
}

function checkTcpPortOpen(host, port = 25565, timeoutMs = 1800) {
  return new Promise((resolve) => {
    const normalizedHost = String(host || '').trim();
    if (!normalizedHost) {
      resolve(false);
      return;
    }
    const socket = new net.Socket();
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(Boolean(open));
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(normalizeHostedServerPort(port), normalizedHost);
  });
}

function getHostedServerPortListeners(port = 25565, protocol = 'TCP') {
  if (process.platform !== 'win32') {
    return [];
  }
  const normalizedPort = normalizeHostedServerPort(port);
  const normalizedProtocol = String(protocol || 'TCP').toUpperCase() === 'UDP' ? 'UDP' : 'TCP';
  try {
    const output = execFileSync('netstat', ['-ano', '-p', normalizedProtocol.toLowerCase()], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 3000
    });
    return String(output || '').split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.startsWith(normalizedProtocol))
      .map((line) => line.split(/\s+/u))
      .filter((parts) => normalizedProtocol === 'UDP' ? parts.length >= 4 : parts.length >= 5)
      .map((parts) => normalizedProtocol === 'UDP'
        ? {
          protocol: parts[0],
          localAddress: parts[1],
          state: '',
          pid: Number(parts[3]) || null
        }
        : {
          protocol: parts[0],
          localAddress: parts[1],
          state: parts[3],
          pid: Number(parts[4]) || null
        })
      .filter((entry) => {
        const portMatch = entry.localAddress.match(/:(\d+)$/u);
        return portMatch
          && Number(portMatch[1]) === normalizedPort
          && (normalizedProtocol === 'UDP' || entry.state === 'LISTENING');
      });
  } catch (error) {
    logger.warn('Could not inspect hosted server port listeners', { port: normalizedPort, protocol: normalizedProtocol, error: serializeError(error) });
    return [];
  }
}

function isHostedServerListeningOnAllInterfaces(listeners = []) {
  return listeners.some((entry) => {
    const address = String(entry.localAddress || '').toLowerCase();
    return address.startsWith('0.0.0.0:') || address.startsWith('[::]:') || address.startsWith(':::');
  });
}

async function checkHostedServerPublicPort(publicIp = '', port = 25565, protocol = 'TCP') {
  const normalizedProtocol = String(protocol || 'TCP').toUpperCase() === 'UDP' ? 'UDP' : 'TCP';
  const normalizedPort = normalizeHostedServerPort(port);
  if (!publicIp || isPrivateIpv4Address(publicIp)) {
    return { attempted: false, open: false, port: normalizedPort, protocol: normalizedProtocol, reason: 'Keine öffentliche IPv4 vorhanden.' };
  }
  if (normalizedProtocol === 'UDP') {
    return {
      attempted: true,
      open: false,
      port: normalizedPort,
      protocol: normalizedProtocol,
      reason: 'UDP-Port wird über den externen Bedrock-Verbindungstest geprüft.'
    };
  }
  const open = await checkTcpPortOpen(publicIp, normalizedPort, 1800);
  return {
    attempted: true,
    open,
    port: normalizedPort,
    protocol: normalizedProtocol,
    reason: open ? 'TCP-Port ist über die öffentliche IPv4 erreichbar.' : 'TCP-Port ist über die öffentliche IPv4 nicht erreichbar.'
  };
}

function splitHostedServerAddress(address = '', fallbackPort = 25565) {
  const normalized = String(address || '').trim();
  if (!normalized) {
    return { host: '', port: normalizeHostedServerPort(fallbackPort) };
  }
  const match = normalized.match(/^([^:]+):(\d+)$/u);
  if (match) {
    return { host: match[1], port: normalizeHostedServerPort(match[2], fallbackPort) };
  }
  return { host: normalized, port: normalizeHostedServerPort(fallbackPort) };
}

async function checkHostedServerJoinAddress(address = '', server = null, options = {}) {
  const fallbackPort = normalizeHostedServerPort(server?.port, getHostedServerDefaultPort(server));
  const { host, port } = splitHostedServerAddress(address, fallbackPort);
  if (!host) {
    return { attempted: false, open: false, address: '', reason: 'Keine Adresse vorhanden.' };
  }
  const protocol = getHostedServerProtocol(server);
  if (protocol === 'TCP') {
    const open = await checkTcpPortOpen(host, port, options.timeoutMs || 1200);
    return {
      attempted: true,
      open,
      online: open,
      address: `${host}:${port}`,
      protocol,
      reason: open ? 'TCP-Verbindung erfolgreich.' : 'TCP-Verbindung fehlgeschlagen.'
    };
  }
  const localHosts = new Set(['localhost', '127.0.0.1', getLocalLanIpAddress()]);
  if (localHosts.has(host)) {
    const open = getHostedServerPortListeners(port, 'UDP').length > 0;
    return {
      attempted: true,
      open,
      online: open,
      address: `${host}:${port}`,
      protocol,
      reason: open ? 'UDP-Port lauscht lokal.' : 'UDP-Port lauscht lokal nicht.'
    };
  }
  const external = await checkExternalMinecraftStatus(`${host}:${port}`, server);
  return {
    attempted: external.attempted,
    open: Boolean(external.online),
    online: Boolean(external.online),
    address: `${host}:${port}`,
    protocol,
    reason: external.reason
  };
}

async function buildHostedServerConnectionTests(server, { running, publicIp, domainInfo } = {}) {
  if (!server) {
    return [];
  }
  const port = normalizeHostedServerPort(server.port, getHostedServerDefaultPort(server));
  const lanIp = getLocalLanIpAddress();
  const tests = [
    { name: 'localhost', address: `localhost:${port}` },
    { name: 'LAN', address: lanIp ? `${lanIp}:${port}` : '' },
    { name: 'öffentliche IP', address: publicIp ? `${publicIp}:${port}` : '' },
    { name: 'Domain', address: domainInfo?.joinAddress || domainInfo?.domain || '' }
  ];
  const results = [];
  for (const test of tests) {
    if (!running || !test.address) {
      results.push({
        name: test.name,
        address: test.address,
        attempted: false,
        open: false,
        reason: !running ? 'Server läuft nicht.' : 'Adresse nicht verfügbar.'
      });
      continue;
    }
    results.push({
      name: test.name,
      ...(await checkHostedServerJoinAddress(test.address, server))
    });
  }
  return results;
}

async function checkExternalMinecraftStatus(address = '', server = null) {
  const target = String(address || '').trim();
  if (!target) {
    return { attempted: false, online: false, reason: 'Keine externe Join-Adresse vorhanden.' };
  }
  try {
    const editionPath = isHostedServerBedrock(server) ? 'bedrock/3' : '3';
    const url = `https://api.mcsrvstat.us/${editionPath}/${encodeURIComponent(target)}`;
    const result = await fetchJson(url, {
      allowedHosts: TRUSTED_MINECRAFT_STATUS_HOSTS,
      retries: 0,
      timeoutMs: 4500,
      headers: { Accept: 'application/json' }
    });
    return {
      attempted: true,
      online: Boolean(result?.online),
      address: target,
      ip: result?.ip || '',
      port: result?.port || null,
      edition: isHostedServerBedrock(server) ? 'bedrock' : 'java',
      players: result?.players || null,
      reason: result?.online ? 'Externer Minecraft-Statusdienst sieht den Server.' : 'Externer Minecraft-Statusdienst sieht den Server nicht online.'
    };
  } catch (error) {
    return {
      attempted: true,
      online: false,
      address: target,
      reason: `Externe Minecraft-Prüfung fehlgeschlagen: ${error.message || String(error)}`
    };
  }
}

async function resolveHostedServerDomain(server, publicIp = '') {
  const domain = getHostedServerDomain(server);
  const autoDomain = getHostedServerAutoDnsDomain(server, publicIp);
  const port = normalizeHostedServerPort(server?.port, getHostedServerDefaultPort(server));
  const protocol = getHostedServerProtocol(server);
  const srvProtocol = protocol === 'UDP' ? 'udp' : 'tcp';
  const defaultPort = getHostedServerDefaultPort(server);
  if (!domain) {
    return {
      domain,
      joinAddress: '',
      status: 'Keine Domain vergeben.',
      ok: false
    };
  }

  const result = {
    domain,
    joinAddress: domain,
    status: `${domain} ist noch nicht verbunden. Erforderlich: A-Record ${domain} -> öffentliche IPv4, Port ${port} ${protocol} zum PC weiterleiten.${port === defaultPort ? '' : ` Für Port ungleich ${defaultPort} zusätzlich SRV _minecraft._${srvProtocol}.${domain}.`}`,
    ok: false,
    aRecords: [],
    srvRecords: [],
    requiredRecords: [],
    protocol,
    port,
    configuredDomain: domain,
    autoDomain,
    autoDns: false
  };
  if (publicIp) {
    result.requiredRecords.push({ type: 'A', name: domain, value: publicIp });
  }
  if (port !== defaultPort) {
    result.requiredRecords.push({ type: 'SRV', name: `_minecraft._${srvProtocol}.${domain}`, value: `0 5 ${port} ${domain}` });
  }

  try {
    const srvRecords = await withTimeout(dns.resolveSrv(`_minecraft._${srvProtocol}.${domain}`), 1800, []);
    result.srvRecords = Array.isArray(srvRecords) ? srvRecords : [];
    const matchingSrv = result.srvRecords.find((entry) => normalizeHostedServerPort(entry.port) === port && String(entry.name || '').replace(/\.$/u, '') === domain);
    if (matchingSrv) {
      result.joinAddress = domain;
      result.status = `${domain} nutzt einen Minecraft-SRV-Record für Port ${port} ${protocol}.`;
      result.ok = Boolean(publicIp);
    }
  } catch (_error) {
    result.srvRecords = [];
  }

  try {
    const aRecords = await withTimeout(dns.resolve4(domain), 1800, []);
    result.aRecords = Array.isArray(aRecords) ? aRecords : [];
    const matchesPublicIp = publicIp && result.aRecords.includes(publicIp);
    if (matchesPublicIp && port === defaultPort) {
      result.status = `${domain} zeigt auf deine öffentliche IP. Minecraft kann ohne Port beitreten.`;
      result.ok = true;
      return result;
    }
    if (matchesPublicIp && result.ok) {
      result.joinAddress = domain;
      result.status = `${domain} zeigt auf deine öffentliche IP und SRV nutzt Port ${port}.`;
      result.ok = true;
      return result;
    }
    if (matchesPublicIp) {
      result.joinAddress = `${domain}:${port}`;
      result.status = `${domain} zeigt auf deine öffentliche IP. Ohne SRV-Record braucht Minecraft den Port: ${result.joinAddress}`;
      result.ok = true;
      return result;
    }
  } catch (_error) {
    result.aRecords = [];
  }

  if (!publicIp) {
    result.status = `${domain} kann noch nicht geprüft werden. Erforderlich: öffentliche IPv4 ermitteln, A-Record ${domain} darauf setzen, Port ${port} ${protocol} zum PC weiterleiten.`;
  } else {
    if (!server?.customDomain && autoDomain) {
      try {
        const autoARecords = await withTimeout(dns.resolve4(autoDomain), 1800, []);
        const autoMatchesPublicIp = Array.isArray(autoARecords) && autoARecords.includes(publicIp);
        if (autoMatchesPublicIp) {
          result.domain = autoDomain;
          result.joinAddress = port === defaultPort ? autoDomain : `${autoDomain}:${port}`;
          result.status = `DNS automatisch verbunden. ${autoDomain} zeigt auf ${publicIp}.`;
          result.ok = true;
          result.autoDns = true;
          result.aRecords = autoARecords;
          result.requiredRecords = [];
          return result;
        }
      } catch (_error) {
        // Automatic wildcard DNS is best-effort. Manual DNS guidance remains below.
      }
    }
    result.status = `${domain} ist nicht aktiv verbunden. Erforderlich: A-Record ${domain} -> ${publicIp}; Port ${port} ${protocol} im Router auf diesen PC;${port === defaultPort ? '' : ` SRV _minecraft._${srvProtocol}.${domain} -> ${domain}:${port};`} danach extern mit mobilen Daten testen.`;
  }
  return result;
}

function checkLocalPortOpen(port = 25565, timeoutMs = 750, protocol = 'TCP') {
  if (String(protocol || 'TCP').toUpperCase() === 'UDP') {
    return Promise.resolve(getHostedServerPortListeners(port, 'UDP').length > 0);
  }
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(Boolean(open));
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(normalizeHostedServerPort(port), '127.0.0.1');
  });
}

function ensureHostedServerFirewallRule(server) {
  if (process.platform !== 'win32' || !server) {
    return { attempted: false, success: false };
  }
  const port = normalizeHostedServerPort(server.port, getHostedServerDefaultPort(server));
  const protocol = getHostedServerProtocol(server);
  const ruleName = `X Launcher Minecraft ${getHostedServerSoftwareLabel(server)} ${protocol} ${port}`;
  try {
    const result = spawnSync('netsh', [
      'advfirewall',
      'firewall',
      'add',
      'rule',
      `name=${ruleName}`,
      'dir=in',
      'action=allow',
      `protocol=${protocol}`,
      `localport=${port}`
    ], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    const success = result.status === 0 || /ok|exists|vorhanden|bereits/iu.test(output);
    if (!success) {
      logger.warn('Could not add hosted server firewall rule', { port, output });
    }
    return { attempted: true, success, protocol, port, output };
  } catch (error) {
    logger.warn('Could not add hosted server firewall rule', { port, protocol, error: serializeError(error) });
    return { attempted: true, success: false, protocol, port, error: error.message || String(error) };
  }
}

function ensureHostedServerUpnpPortMapping(server) {
  if (process.platform !== 'win32' || !server) {
    return { attempted: false, success: false, reason: 'UPnP wird nur unter Windows automatisch versucht.' };
  }
  const port = normalizeHostedServerPort(server.port, getHostedServerDefaultPort(server));
  const protocol = getHostedServerProtocol(server);
  const localIp = getLocalLanIpAddress();
  if (!localIp) {
    return { attempted: false, success: false, reason: 'Keine LAN-IP gefunden.' };
  }
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(localIp)) {
    return { attempted: false, success: false, reason: 'LAN-IP ist nicht IPv4.' };
  }

  const description = `X Launcher Minecraft ${getHostedServerSoftwareLabel(server)} ${protocol} ${port}`.replace(/'/gu, '');
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$port = ${port}`,
    `$client = '${localIp}'`,
    `$protocol = '${protocol}'`,
    `$description = '${description}'`,
    "$nat = New-Object -ComObject HNetCfg.NATUPnP",
    "$maps = $nat.StaticPortMappingCollection",
    "if ($null -eq $maps) { throw 'Router-UPnP ist nicht verfügbar oder deaktiviert.' }",
    "$existingOk = $false",
    "foreach ($mapping in $maps) {",
    "  if ($mapping.ExternalPort -eq $port -and $mapping.Protocol -eq $protocol) {",
    "    if ($mapping.InternalClient -eq $client -and $mapping.InternalPort -eq $port) { $existingOk = $true }",
    "  }",
    "}",
    "if ($existingOk) { Write-Output 'UPNP_EXISTS'; exit 0 }",
    "$maps.Add($port, $protocol, $port, $client, $true, $description) | Out-Null",
    "Write-Output 'UPNP_ADDED'"
  ].join('; ');

  try {
    const result = spawnSync('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script
    ], { encoding: 'utf8', windowsHide: true, timeout: 8000 });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    const success = result.status === 0 && /UPNP_(?:ADDED|EXISTS)/u.test(output);
    if (!success) {
      logger.warn('Could not add hosted server UPnP mapping', { port, protocol, localIp, output });
    }
    return { attempted: true, success, port, protocol, localIp, output };
  } catch (error) {
    logger.warn('Could not add hosted server UPnP mapping', { port, protocol, localIp, error: serializeError(error) });
    return { attempted: true, success: false, port, protocol, localIp, error: error.message || String(error) };
  }
}

function getRouterWanIpViaUpnp() {
  if (process.platform !== 'win32') {
    return { attempted: false, ip: '', reason: 'Router-WAN-IP wird automatisch nur unter Windows-UPnP geprüft.' };
  }
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$nat = New-Object -ComObject HNetCfg.NATUPnP",
    "$ip = ''",
    "try { if ($nat.NATEventManager -and $nat.NATEventManager.ExternalIPAddress) { $ip = [string]$nat.NATEventManager.ExternalIPAddress } } catch {}",
    "if (-not $ip -and $nat.StaticPortMappingCollection) {",
    "  foreach ($mapping in $nat.StaticPortMappingCollection) {",
    "    try { if ($mapping.ExternalIPAddress) { $ip = [string]$mapping.ExternalIPAddress; break } } catch {}",
    "  }",
    "}",
    "if ($ip) { Write-Output $ip; exit 0 }",
    "Write-Output 'NO_WAN_IP'; exit 2"
  ].join('; ');
  try {
    const result = spawnSync('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script
    ], { encoding: 'utf8', windowsHide: true, timeout: 6000 });
    const output = String(result.stdout || '').trim().split(/\r?\n/u).pop() || '';
    const ip = /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(output) ? output : '';
    return {
      attempted: true,
      ip,
      cgnatLikely: Boolean(ip && isPrivateIpv4Address(ip)),
      reason: ip ? 'Router-WAN-IP per UPnP erkannt.' : 'Router-WAN-IP konnte per UPnP nicht gelesen werden.',
      output: `${result.stdout || ''}\n${result.stderr || ''}`.trim()
    };
  } catch (error) {
    return {
      attempted: true,
      ip: '',
      cgnatLikely: false,
      reason: `Router-WAN-IP konnte nicht gelesen werden: ${error.message || String(error)}`
    };
  }
}

function getHostedServerNetworkStatus({ running, domainInfo, publicIp, publicPort, externalMinecraft, firewall, upnp, localReachable, protocol = 'TCP' }) {
  const normalizedProtocol = String(protocol || 'TCP').toUpperCase() === 'UDP' ? 'UDP' : 'TCP';
  if (!running) {
    return {
      code: 'offline',
      label: 'Offline',
      detail: 'Server ist nicht gestartet.'
    };
  }
  if (!publicIp) {
    return {
      code: 'lan-only',
      label: 'Nur LAN erreichbar',
      detail: 'Keine öffentliche IPv4 erkannt. Bei CGNAT/DS-Lite brauchst du einen Tunnel oder Hoster.'
    };
  }
  if (!domainInfo?.ok) {
    return {
      code: 'dns-missing',
      label: 'DNS fehlt',
      detail: domainInfo?.status || 'Domain zeigt nicht auf deine öffentliche IP.'
    };
  }
  if (externalMinecraft?.online) {
    return {
      code: 'internet-ok',
      label: 'Internet erreichbar',
      detail: `${externalMinecraft.address} wurde extern als Minecraft-Server erkannt.`
    };
  }
  if (firewall?.attempted && firewall.success === false) {
    return {
      code: 'firewall-blocked',
      label: 'Firewall blockiert',
      detail: `Windows-Firewall-Regel für Port ${publicPort?.port || domainInfo?.port || 'unbekannt'} ${normalizedProtocol} konnte nicht automatisch erstellt werden.`
    };
  }
  if (publicPort?.attempted && !publicPort.open && !upnp?.success) {
    return {
      code: 'port-closed',
      label: 'Port geschlossen',
      detail: `Port ${publicPort.port || 25565} ${normalizedProtocol} ist nicht öffentlich erreichbar. Router-Portfreigabe auf diesen PC einrichten.`
    };
  }
  if (publicPort?.open || upnp?.success) {
    return {
      code: 'internet-ok',
      label: 'Internet erreichbar',
      detail: externalMinecraft?.online
        ? `${externalMinecraft.address} wurde extern als Minecraft-Server erkannt.`
        : (domainInfo?.joinAddress ? `${domainInfo.joinAddress} ist die Join-Adresse.` : 'Server ist über das Internet erreichbar.')
    };
  }
  return {
    code: localReachable ? 'lan-only' : 'port-closed',
    label: localReachable ? 'Nur LAN erreichbar' : 'Port geschlossen',
    detail: localReachable
      ? 'Server läuft lokal. Externe Portprüfung konnte Internet-Erreichbarkeit nicht bestätigen.'
      : 'Server-Port ist lokal noch nicht erreichbar.'
  };
}

function buildHostedServerDiagnostics({
  activeServer,
  running,
  runtime,
  serverReady,
  properties,
  listeners,
  bindsAllInterfaces,
  localReachable,
  publicIp,
  publicPort,
  externalMinecraft,
  domainInfo,
  firewall,
  upnp,
  networkStatus,
  routerWan,
  connectionTests = []
}) {
  const port = normalizeHostedServerPort(activeServer?.port || getHostedServerDefaultPort(activeServer), getHostedServerDefaultPort(activeServer));
  const protocol = getHostedServerProtocol(activeServer);
  const findings = [];
  const requiredChanges = [];
  const checks = {
    processRunning: Boolean(running && runtime?.process && !runtime.process.killed),
    serverReady: Boolean(serverReady),
    serverPropertiesExists: Boolean(properties?.exists),
    serverIpBlank: properties?.exists ? !properties.serverIp : false,
    portListening: listeners.length > 0,
    bindsAllInterfaces,
    localPortReachable: Boolean(localReachable),
    firewallConfigured: firewall?.success === true || firewall?.attempted === true && firewall?.success === true,
    publicIpDetected: Boolean(publicIp),
    domainPointsToPublicIp: Boolean(domainInfo?.ok),
    publicPortReachable: Boolean(publicPort?.open),
    upnpPortMapping: Boolean(upnp?.success),
    externalMinecraftClientVerified: Boolean(externalMinecraft?.online),
    routerWanIpDetected: Boolean(routerWan?.ip),
    cgnatDetected: Boolean(routerWan?.ip && publicIp && routerWan.ip !== publicIp) || Boolean(routerWan?.ip && isPrivateIpv4Address(routerWan.ip))
  };

  if (!checks.processRunning) {
    findings.push('Minecraft-Server-Prozess läuft nicht.');
    requiredChanges.push('Server starten und EULA akzeptieren.');
  }
  if (checks.processRunning && !checks.serverReady) {
    findings.push('Serverlog enthält noch kein "Done (...s)! For help, type \"help\"".');
    requiredChanges.push('Warten bis der Server vollständig gestartet ist oder Konsolenfehler prüfen.');
  }
  if (isHostedServerJava(activeServer) && properties?.exists && properties.serverIp) {
    findings.push(`server.properties server-ip ist nicht leer: ${properties.serverIp}`);
    requiredChanges.push('server.properties muss server-ip= leer enthalten.');
  }
  if (properties?.exists && properties.serverPort !== port) {
    findings.push(`server.properties server-port ist ${properties.serverPort}, erwartet ${port}.`);
    requiredChanges.push(`server.properties server-port=${port} setzen.`);
  }
  if (running && !checks.portListening) {
    findings.push(`Port ${port} lauscht nicht.`);
    requiredChanges.push(`Server muss auf Port ${port} starten; server.properties server-port prüfen.`);
  }
  if (checks.portListening && !checks.bindsAllInterfaces) {
    findings.push(`Server lauscht nicht auf 0.0.0.0, sondern auf: ${listeners.map((entry) => entry.localAddress).join(', ')}`);
    requiredChanges.push(isHostedServerJava(activeServer)
      ? 'server.properties: server-ip leer lassen, damit Minecraft auf allen Interfaces lauscht.'
      : 'Bedrock muss server-port auf dem UDP-Port dieses Servers nutzen und darf nicht durch Firewall/Router geblockt werden.');
  }
  if (!checks.publicIpDetected) {
    findings.push('Keine öffentliche IPv4 erkannt.');
    requiredChanges.push('Bei CGNAT/DS-Lite öffentliche IPv4 beim ISP buchen oder Tunnel/Hosting nutzen.');
  }
  if (publicIp && isPrivateIpv4Address(publicIp)) {
    findings.push('Erkannte WAN-IP ist privat. Hinweis auf CGNAT/Double NAT.');
    requiredChanges.push('Router-WAN-IP mit öffentlicher IP vergleichen; bei CGNAT Tunnel/öffentliche IPv4 nötig.');
  }
  if (checks.cgnatDetected) {
    findings.push('CGNAT erkannt. Direkte Portweiterleitung wahrscheinlich nicht möglich.');
    requiredChanges.push('Öffentliche IPv4 beim Anbieter buchen oder Tunnel/VPS/Hosting verwenden.');
  } else if (routerWan?.attempted && !routerWan.ip) {
    findings.push(`Router-WAN-IP konnte nicht automatisch verglichen werden: ${routerWan.reason || 'UPnP liefert keine WAN-IP.'}`);
  }
  if (domainInfo?.domain && !checks.domainPointsToPublicIp) {
    findings.push(`DNS fehlt oder ist falsch für ${domainInfo.domain}.`);
    (domainInfo.requiredRecords || []).forEach((record) => {
      requiredChanges.push(`DNS ${record.type}: ${record.name} -> ${record.value}`);
    });
  }
  if (running && publicIp && !checks.publicPortReachable && !checks.upnpPortMapping) {
    findings.push(`Port ${port} ist von außen nicht bestätigt erreichbar.`);
    requiredChanges.push(`Router-Portweiterleitung: ${protocol} extern ${port} -> ${getLocalLanIpAddress() || 'LAN-IP dieses PCs'}:${port}`);
    requiredChanges.push(`Windows-Firewall muss eingehend ${protocol} erlauben.`);
  }
  if (upnp?.attempted && !upnp.success) {
    findings.push(`Automatische UPnP-Portfreigabe fehlgeschlagen: ${upnp.reason || upnp.output || upnp.error || 'unbekannt'}`);
    requiredChanges.push('UPnP im Router aktivieren oder Port manuell weiterleiten.');
  }
  if (externalMinecraft?.attempted && !externalMinecraft.online) {
    findings.push(externalMinecraft.reason);
  }
  if (!findings.length && (networkStatus?.code === 'internet-ok' || checks.externalMinecraftClientVerified)) {
    findings.push('Keine Netzwerkfehler gefunden. Internet-Erreichbarkeit ist bestätigt oder automatisch freigegeben.');
  }

  return {
    checks,
    status: networkStatus,
    externalMinecraft,
    findings,
    requiredChanges,
    listeners,
    connectionTests,
    properties: properties ? {
      exists: properties.exists,
      path: properties.path,
      serverIp: properties.serverIp,
      serverPort: properties.serverPort,
      protocol: properties.protocol
    } : null,
    affectedFiles: ['src/main.js', 'app.js', 'index.html'],
    testedAddress: domainInfo?.ok ? domainInfo.joinAddress : (domainInfo?.domain || ''),
    publicAddress: publicIp ? `${publicIp}:${port}` : '',
    routerWanIp: routerWan?.ip || '',
    cgnatDetected: checks.cgnatDetected,
    router: {
      protocol,
      externalPort: port,
      internalAddress: getLocalLanIpAddress(),
      internalPort: port
    }
  };
}

async function getHostedServerStatus() {
  ensureDir(HOSTED_SERVER_DIR);
  const state = readHostedServerState();
  const activeServer = getHostedServerById(state);
  syncLegacyHostedServerRuntime();
  const activeRuntime = activeServer ? getHostedServerRuntime(activeServer.id) : null;
  const runningIds = getHostedServerRunningIds();
  const running = Boolean(activeRuntime);
  const upnp = activeServer ? (hostedServerUpnpMappings.get(activeServer.id) || null) : null;
  const firewall = activeServer ? (hostedServerFirewallRules.get(activeServer.id) || null) : null;
  const protocol = activeServer ? getHostedServerProtocol(activeServer) : 'TCP';
  const publicIp = activeServer ? await fetchPublicIpAddress() : '';
  const routerWan = activeServer ? getRouterWanIpViaUpnp() : { attempted: false, ip: '' };
  if (running && activeRuntime) {
    requestHostedServerPlayerList(activeRuntime);
  }
  const consoleOutput = readHostedServerConsoleTail(activeServer);
  const serverReady = hasHostedServerReadyLog(consoleOutput, activeServer);
  const properties = readHostedServerProperties(activeServer);
  const players = parseHostedServerPlayerCount(consoleOutput) || {
    online: 0,
    max: activeServer?.maxPlayers || 0
  };
  const processStats = getHostedServerProcessStats(activeRuntime);
  const localReachable = running && activeServer ? await checkLocalPortOpen(activeServer.port, 750, protocol) : false;
  const listeners = activeServer ? getHostedServerPortListeners(activeServer.port, protocol) : [];
  const bindsAllInterfaces = isHostedServerListeningOnAllInterfaces(listeners);
  const localAddress = activeServer ? `localhost:${activeServer.port}` : '';
  const lanAddress = activeServer ? getLocalLanAddress(activeServer.port) : '';
  const publicAddress = publicIp && activeServer ? `${publicIp}:${activeServer.port}` : '';
  const domainInfo = activeServer ? await resolveHostedServerDomain(activeServer, publicIp) : null;
  const publicPort = running && activeServer ? await checkHostedServerPublicPort(publicIp, activeServer.port, protocol) : { attempted: false, open: false, protocol };
  const address = activeServer
    ? (domainInfo?.joinAddress || domainInfo?.domain || publicAddress || (running ? (lanAddress || localAddress) : localAddress))
    : '';
  const externalMinecraft = running && activeServer && (domainInfo?.domain || publicAddress)
    ? await checkExternalMinecraftStatus(domainInfo?.joinAddress || domainInfo?.domain || publicAddress, activeServer)
    : { attempted: false, online: false, reason: 'Server läuft nicht oder keine externe Adresse vorhanden.' };
  const connectionTests = activeServer ? await buildHostedServerConnectionTests(activeServer, {
    running,
    publicIp,
    domainInfo
  }) : [];
  const networkStatus = getHostedServerNetworkStatus({
    running,
    domainInfo,
    publicIp,
    publicPort,
    externalMinecraft,
    firewall,
    upnp,
    localReachable,
    protocol
  });
  const diagnostics = buildHostedServerDiagnostics({
    activeServer,
    running,
    runtime: activeRuntime,
    serverReady,
    properties,
    listeners,
    bindsAllInterfaces,
    localReachable,
    publicIp,
    publicPort,
    externalMinecraft,
    domainInfo,
    firewall,
    upnp,
    networkStatus,
    routerWan,
    connectionTests
  });
  const portForwardingRequired = running && activeServer
    ? ['dns-missing', 'port-closed', 'lan-only', 'firewall-blocked'].includes(networkStatus.code)
    : true;
  const servers = state.servers.map((server) => ({
    ...server,
    domain: getHostedServerDomain(server),
    joinAddress: getHostedServerDomain(server) || `localhost:${server.port}`,
    softwareLabel: getHostedServerSoftwareLabel(server),
    networkProtocol: getHostedServerProtocol(server)
  }));
  return {
    success: true,
    activeServerId: state.activeServerId,
    activeServer,
    servers,
    mods: activeServer && isHostedServerJava(activeServer) ? listHostedServerMods(activeServer) : [],
    running,
    runningServerId: running ? activeServer.id : '',
    runningServerIds: runningIds,
    pid: running ? activeRuntime.process.pid : null,
    startedAt: running ? activeRuntime.startedAt : '',
    uptimeMs: running && activeRuntime.startedAt ? Math.max(0, Date.now() - Date.parse(activeRuntime.startedAt)) : 0,
    resources: running ? processStats : { memoryMb: 0, cpuTime: '', cpuSeconds: 0, pid: null },
    localReachable,
    serverReady,
    serverProperties: properties ? {
      exists: properties.exists,
      path: properties.path,
      serverIp: properties.serverIp,
      serverPort: properties.serverPort,
      protocol: properties.protocol
    } : null,
    players,
    consoleOutput,
    installed: activeServer
      ? (isHostedServerBedrock(activeServer) ? fs.existsSync(getHostedServerBedrockExecutablePath(activeServer)) : fs.existsSync(getHostedServerJarPath(activeServer)))
      : false,
    address,
    localAddress,
    lanAddress,
    rawPublicAddress: publicAddress,
    publicAddress,
    domain: domainInfo?.domain || '',
    domainAddress: domainInfo?.joinAddress || '',
    domainStatus: domainInfo?.status || '',
    domainReady: Boolean(domainInfo?.ok),
    networkStatus,
    diagnostics,
    publicPort,
    externalMinecraft,
    connectionTests,
    firewall,
    requiredDnsRecords: domainInfo?.requiredRecords || [],
    requiredRouterSettings: activeServer ? {
      protocol,
      externalPort: activeServer.port,
      internalPort: activeServer.port,
      internalAddress: getLocalLanIpAddress()
    } : null,
    upnp,
    publicIp,
    routerWanIp: routerWan.ip || '',
    routerWan,
    cgnatDetected: diagnostics.cgnatDetected,
    networkAddresses: {
      local: localAddress,
      lan: lanAddress,
      public: publicAddress,
      domain: domainInfo?.domain || '',
      recommended: address
    },
    portForwardingRequired,
    folder: activeServer ? getHostedServerDir(activeServer) : HOSTED_SERVER_DIR,
    modsFolder: activeServer && isHostedServerJava(activeServer) ? getHostedServerModsDir(activeServer) : ''
  };
}

async function getHostedServerVanillaInfo(server) {
  const requestedMinecraftVersion = String(server.minecraftVersion || 'latest').trim();
  const manifest = await fetchJson(VERSION_MANIFEST_URL, { allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS });
  const minecraftVersion = requestedMinecraftVersion.toLowerCase() === 'latest'
    ? manifest.latest?.release
    : requestedMinecraftVersion;
  const versionMeta = (manifest.versions || []).find((entry) => entry.id === minecraftVersion);
  if (!versionMeta?.id) {
    throw new Error(`Minecraft-Version ${requestedMinecraftVersion} wurde nicht gefunden.`);
  }
  const versionData = await fetchJson(versionMeta.url, { allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS });
  const serverDownload = versionData.downloads?.server;
  if (!serverDownload?.url) {
    throw new Error(`Für Minecraft ${versionMeta.id} wurde keine Vanilla-Server-JAR gefunden.`);
  }
  return {
    minecraftVersion: versionMeta.id,
    url: serverDownload.url,
    sha1: serverDownload.sha1 || '',
    size: serverDownload.size || 0,
    javaComponent: versionData.javaVersion?.component || '',
    requiredJava: versionData.javaVersion?.majorVersion || 21
  };
}

async function getHostedServerPaperInfo(server) {
  const requestedMinecraftVersion = String(server.minecraftVersion || 'latest').trim();
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'XLauncher/1.0 (Minecraft Hosting)'
  };
  const project = await fetchJson(`${PAPER_API_BASE_URL}/projects/paper`, {
    allowedHosts: TRUSTED_PAPER_DOWNLOAD_HOSTS,
    headers
  });
  const availableVersions = Array.isArray(project?.versions) ? project.versions : [];
  const minecraftVersion = requestedMinecraftVersion.toLowerCase() === 'latest'
    ? availableVersions[availableVersions.length - 1]
    : requestedMinecraftVersion;
  if (!minecraftVersion || !availableVersions.includes(minecraftVersion)) {
    throw new Error(`Paper unterstützt Minecraft ${requestedMinecraftVersion} aktuell nicht über die PaperMC-API.`);
  }
  const versionInfo = await fetchJson(`${PAPER_API_BASE_URL}/projects/paper/versions/${encodeURIComponent(minecraftVersion)}`, {
    allowedHosts: TRUSTED_PAPER_DOWNLOAD_HOSTS,
    headers
  });
  const builds = Array.isArray(versionInfo?.builds) ? versionInfo.builds : [];
  const build = builds[builds.length - 1];
  const buildNumber = typeof build === 'object' ? build.build : build;
  if (!buildNumber) {
    throw new Error(`Für Paper ${minecraftVersion} wurde kein Build gefunden.`);
  }
  const buildInfo = await fetchJson(`${PAPER_API_BASE_URL}/projects/paper/versions/${encodeURIComponent(minecraftVersion)}/builds/${encodeURIComponent(buildNumber)}`, {
    allowedHosts: TRUSTED_PAPER_DOWNLOAD_HOSTS,
    headers
  });
  const downloadName = buildInfo?.downloads?.application?.name || `paper-${minecraftVersion}-${buildNumber}.jar`;
  return {
    minecraftVersion,
    build: buildNumber,
    url: `${PAPER_API_BASE_URL}/projects/paper/versions/${encodeURIComponent(minecraftVersion)}/builds/${encodeURIComponent(buildNumber)}/downloads/${encodeURIComponent(downloadName)}`,
    sha256: buildInfo?.downloads?.application?.sha256 || '',
    size: buildInfo?.downloads?.application?.size || 0,
    javaComponent: '',
    requiredJava: 21
  };
}

async function fetchTrustedText(url, options = {}) {
  const {
    allowedHosts = null,
    timeoutMs = 30000,
    ...fetchOptions
  } = options;
  if (allowedHosts) {
    assertTrustedHttpsUrl(url, allowedHosts);
  } else {
    assertTrustedHttpsUrl(url);
  }
  const response = await fetchWithTimeout(url, fetchOptions, timeoutMs);
  if (!response.ok) {
    const body = await safeReadText(response);
    throw new Error(`HTTP ${response.status} für ${url}${body ? `: ${body}` : ''}`);
  }
  return response.text();
}

async function getHostedServerBedrockInfo(_server) {
  if (process.platform !== 'win32') {
    throw new Error('Bedrock Dedicated Server wird in diesem Launcher automatisch für Windows verwaltet.');
  }
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'XLauncher/1.0 (Minecraft Hosting)'
  };
  try {
    const downloadLinks = await fetchJson(BEDROCK_DOWNLOAD_LINKS_URL, {
      allowedHosts: TRUSTED_BEDROCK_DOWNLOAD_HOSTS,
      headers,
      timeoutMs: 15000
    });
    const links = Array.isArray(downloadLinks?.result?.links) ? downloadLinks.result.links : [];
    const windowsLink = links.find((entry) => entry?.downloadType === 'serverBedrockWindows' && entry?.downloadUrl);
    const downloadUrl = String(windowsLink?.downloadUrl || '').trim();
    if (downloadUrl) {
      assertTrustedHttpsUrl(downloadUrl, TRUSTED_BEDROCK_DOWNLOAD_HOSTS);
      const versionMatch = downloadUrl.match(/bedrock-server-([0-9.]+)\.zip/iu);
      return {
        minecraftVersion: versionMatch?.[1] || 'latest',
        url: downloadUrl,
        requiredJava: 0
      };
    }
  } catch (error) {
    logger.warn('Could not read Bedrock download links API, falling back to download page', { error: serializeError(error) });
  }
  const page = await fetchTrustedText(BEDROCK_SERVER_DOWNLOAD_PAGE_URL, {
    allowedHosts: TRUSTED_BEDROCK_DOWNLOAD_HOSTS,
    timeoutMs: 15000,
    headers: {
      Accept: 'text/html',
      'User-Agent': 'XLauncher/1.0 (Minecraft Hosting)'
    }
  });
  const matches = Array.from(String(page || '').matchAll(/https:\/\/(?:www\.minecraft\.net\/bedrockdedicatedserver|minecraft\.azureedge\.net)\/bin-win\/bedrock-server-[^"'<>\s]+\.zip/giu));
  const downloadUrl = matches[matches.length - 1]?.[0] || '';
  if (!downloadUrl) {
    throw new Error('Der offizielle Bedrock-Downloadlink konnte nicht automatisch gelesen werden. Öffne https://www.minecraft.net/en-us/download/server/bedrock, lade die Windows-ZIP herunter und entpacke sie in den Serverordner. Danach muss bedrock_server.exe im Serverordner liegen.');
  }
  const versionMatch = downloadUrl.match(/bedrock-server-([0-9.]+)\.zip/iu);
  return {
    minecraftVersion: versionMatch?.[1] || 'latest',
    url: downloadUrl,
    requiredJava: 0
  };
}

async function ensureHostedServerJar(server) {
  const vanillaInfo = normalizeHostedServerSoftware(server?.software, server?.edition) === 'paper'
    ? await getHostedServerPaperInfo(server)
    : await getHostedServerVanillaInfo(server);
  const jarPath = getHostedServerJarPath(server);
  await downloadFile(vanillaInfo.url, jarPath, {
    allowedHosts: normalizeHostedServerSoftware(server?.software, server?.edition) === 'paper'
      ? TRUSTED_PAPER_DOWNLOAD_HOSTS
      : TRUSTED_MOJANG_DOWNLOAD_HOSTS,
    maxBytes: 120 * 1024 * 1024,
    minBytes: 1024 * 1024,
    retries: 2,
    expectedSha256: vanillaInfo.sha256 || '',
    headers: normalizeHostedServerSoftware(server?.software, server?.edition) === 'paper'
      ? { 'User-Agent': 'XLauncher/1.0 (Minecraft Hosting)' }
      : {}
  });
  return vanillaInfo;
}

async function ensureHostedServerBedrock(server) {
  const bedrockInfo = await getHostedServerBedrockInfo(server);
  const serverDir = getHostedServerDir(server);
  ensureDir(serverDir);
  const zipPath = path.join(serverDir, 'bedrock-server.zip');
  await downloadFile(bedrockInfo.url, zipPath, {
    allowedHosts: TRUSTED_BEDROCK_DOWNLOAD_HOSTS,
    maxBytes: 1024 * 1024 * 1024,
    minBytes: 5 * 1024 * 1024,
    retries: 2,
    headers: { 'User-Agent': 'XLauncher/1.0 (Minecraft Hosting)' }
  });
  const result = spawnSync('powershell', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/gu, "''")}' -DestinationPath '${serverDir.replace(/'/gu, "''")}' -Force`
  ], { encoding: 'utf8', windowsHide: true, timeout: 120000 });
  if (result.status !== 0) {
    throw new Error(`Bedrock-Server-ZIP konnte nicht entpackt werden: ${result.stderr || result.stdout || 'unbekannter Fehler'}`);
  }
  const exePath = getHostedServerBedrockExecutablePath(server);
  if (!fs.existsSync(exePath)) {
    throw new Error('bedrock_server.exe wurde nach dem Entpacken nicht gefunden.');
  }
  return bedrockInfo;
}

function writeHostedServerFiles(state) {
  const serverDir = getHostedServerDir(state);
  ensureDir(serverDir);
  if (isHostedServerJava(state)) {
    ensureDir(getHostedServerModsDir(state));
  }
  fs.writeFileSync(path.join(serverDir, 'eula.txt'), `# Accepted through X Launcher\n# ${new Date().toISOString()}\neula=${state.eulaAccepted ? 'true' : 'false'}\n`, 'utf8');
  const propertiesPath = path.join(serverDir, 'server.properties');
  const properties = isHostedServerBedrock(state)
    ? [
      `server-name=${state.motd || state.hostName || state.name}`,
      `gamemode=${['survival', 'creative', 'adventure'].includes(state.gamemode) ? state.gamemode : 'survival'}`,
      `difficulty=${state.difficulty}`,
      'allow-cheats=false',
      `max-players=${state.maxPlayers}`,
      `online-mode=${state.onlineMode ? 'true' : 'false'}`,
      `allow-list=${state.whitelist ? 'true' : 'false'}`,
      `server-port=${state.port}`,
      `server-portv6=${Math.min(65535, Number(state.port) + 1)}`,
      `view-distance=${state.viewDistance}`,
      `tick-distance=${state.simulationDistance}`,
      `texturepack-required=false`,
      'default-player-permission-level=member'
    ].join('\n')
    : [
      `motd=${state.motd || state.hostName || state.name}`,
      'server-ip=',
      `server-port=${state.port}`,
      `max-players=${state.maxPlayers}`,
      `difficulty=${state.difficulty}`,
      `gamemode=${state.gamemode}`,
      `pvp=${state.pvp ? 'true' : 'false'}`,
      `white-list=${state.whitelist ? 'true' : 'false'}`,
      `enforce-whitelist=${state.whitelist ? 'true' : 'false'}`,
      `online-mode=${state.onlineMode ? 'true' : 'false'}`,
      `enable-command-block=${state.enableCommandBlock ? 'true' : 'false'}`,
      `spawn-protection=${state.spawnProtection}`,
      `view-distance=${state.viewDistance}`,
      `simulation-distance=${state.simulationDistance}`
    ].join('\n');
  fs.writeFileSync(propertiesPath, `${properties}\n`, 'utf8');

  if (isHostedServerJava(state) && state.ownerUsername) {
    const ownerUuid = normalizeMinecraftUuid(state.ownerUuid) || createOfflineUuid(state.ownerUsername);
    const opEntry = {
      uuid: ownerUuid,
      name: state.ownerUsername,
      level: 4,
      bypassesPlayerLimit: true
    };
    fs.writeFileSync(path.join(serverDir, 'ops.json'), `${JSON.stringify([opEntry], null, 2)}\n`, 'utf8');
  }
}

function updateHostedServerInState(state, serverId, updates) {
  const servers = state.servers.map((server) => server.id === serverId
    ? normalizeHostedServerEntry({ ...server, ...updates, updatedAt: new Date().toISOString() }, server.port)
    : server);
  return writeHostedServerState({ ...state, servers });
}

function startHostedServerPowerBlocker() {
  if (hostedServerPowerSaveBlockerId !== null && powerSaveBlocker.isStarted(hostedServerPowerSaveBlockerId)) {
    return;
  }
  hostedServerPowerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
}

function stopHostedServerPowerBlocker() {
  if (getHostedServerRunningIds().length > 0) {
    return;
  }
  if (hostedServerPowerSaveBlockerId === null) {
    return;
  }
  try {
    if (powerSaveBlocker.isStarted(hostedServerPowerSaveBlockerId)) {
      powerSaveBlocker.stop(hostedServerPowerSaveBlockerId);
    }
  } catch (_error) {
    // ignore power blocker cleanup failures
  }
  hostedServerPowerSaveBlockerId = null;
}

async function checkHostedServerNameAvailable(hostName, state, currentServerId = '') {
  const normalizedHostName = String(hostName || '').trim().toLowerCase();
  if (!normalizedHostName) {
    return { available: false, error: 'Bitte gib einen Servernamen ein.' };
  }
  const duplicate = state.servers.find((server) => (
    server.id !== currentServerId && String(server.hostName || '').toLowerCase() === normalizedHostName
  ));
  if (duplicate) {
    return { available: false, error: `${normalizedHostName} ist schon in deinem Launcher vergeben.` };
  }
  return { available: true };
}

function checkHostedServerPortAvailable(port, state, currentServerId = '') {
  const normalizedPort = normalizeHostedServerPort(port);
  const duplicate = state.servers.find((server) => (
    server.id !== currentServerId && normalizeHostedServerPort(server.port) === normalizedPort
  ));
  if (duplicate) {
    return {
      available: false,
      error: `Port ${normalizedPort} wird bereits von ${duplicate.name} verwendet. Bitte wähle einen freien Port.`
    };
  }
  return { available: true };
}

function getNextHostedServerPort(state, preferredPort = 25565, currentServerId = '') {
  let port = normalizeHostedServerPort(preferredPort);
  while (!checkHostedServerPortAvailable(port, state, currentServerId).available && port < 65535) {
    port += 1;
  }
  return port;
}

async function createHostedServer(options = {}) {
  const state = readHostedServerState();
  const normalizedName = normalizeHostedServerName(options.name);
  if (!normalizedName) {
    return { success: false, error: 'Bitte gib einen Servernamen ein, z. B. pizza.' };
  }
  const hostName = getHostedServerHostName(normalizedName);
  const availability = await checkHostedServerNameAvailable(hostName, state);
  if (!availability.available) {
    return { success: false, error: availability.error };
  }
  const edition = normalizeHostedServerEdition(options.edition || 'java');
  const software = normalizeHostedServerSoftware(options.software || 'vanilla', edition);
  const preferredPort = options.port || (getHostedServerDefaultPort(edition) + state.servers.length);
  const nextPort = getNextHostedServerPort(state, preferredPort);
  const portAvailability = checkHostedServerPortAvailable(nextPort, state);
  if (!portAvailability.available) {
    return { success: false, error: portAvailability.error };
  }
  const server = normalizeHostedServerEntry({
    ...getDefaultHostedServer(normalizedName),
    edition,
    software,
    serverSoftware: software,
    minecraftVersion: options.minecraftVersion || 'latest',
    ramGb: options.ramGb || 2,
    port: nextPort,
    maxPlayers: options.maxPlayers,
    difficulty: options.difficulty,
    gamemode: options.gamemode,
    motd: options.motd,
    pvp: options.pvp,
    whitelist: options.whitelist,
    onlineMode: options.onlineMode,
    enableCommandBlock: options.enableCommandBlock,
    spawnProtection: options.spawnProtection,
    viewDistance: options.viewDistance,
    simulationDistance: options.simulationDistance,
    ownerUsername: options.ownerUsername,
    ownerUuid: options.ownerUuid,
    eulaAccepted: Boolean(options.acceptEula)
  }, nextPort);
  const nextState = writeHostedServerState({
    activeServerId: server.id,
    servers: [...state.servers, server]
  });
  ensureDir(getHostedServerDir(server));
  ensureDir(getHostedServerModsDir(server));
  writeHostedServerFiles(server);
  return {
    ...(await getHostedServerStatus()),
    activeServerId: nextState.activeServerId,
    message: `${server.name} wurde erstellt.${availability.warning ? ` Hinweis: ${availability.warning}` : ''}`
  };
}

async function selectHostedServer(serverId) {
  const state = readHostedServerState();
  const normalizedId = String(serverId || '').trim();
  const selected = state.servers.find((server) => server.id === normalizedId) || null;
  if (!selected) {
    return { success: false, error: 'Server wurde nicht gefunden.' };
  }
  const nextState = writeHostedServerState({ ...state, activeServerId: selected.id });
  return {
    ...(await getHostedServerStatus()),
    activeServerId: nextState.activeServerId,
    message: `${selected.name} ist ausgewählt.`
  };
}

async function deleteHostedServer(serverId) {
  const state = readHostedServerState();
  const normalizedId = String(serverId || '').trim();
  const removed = state.servers.find((server) => server.id === normalizedId);
  if (!removed) {
    return { success: false, error: 'Server wurde nicht gefunden.' };
  }
  if (getHostedServerRuntime(removed.id)) {
    return { success: false, error: 'Dieser Server läuft gerade. Stoppe ihn zuerst.' };
  }
  const removedServerDir = getHostedServerDir(removed);
  if (!isPathInsideDirectory(HOSTED_SERVER_INSTANCES_DIR, removedServerDir)) {
    return { success: false, error: 'Serverordner liegt außerhalb des Hosting-Verzeichnisses.' };
  }
  const remaining = state.servers.filter((server) => server.id !== removed.id);
  const nextServer = remaining[0] || null;
  writeHostedServerState({
    activeServerId: state.activeServerId === removed.id ? (nextServer?.id || '') : state.activeServerId,
    servers: remaining
  });
  if (fs.existsSync(removedServerDir)) {
    fs.rmSync(removedServerDir, { recursive: true, force: true });
  }
  return {
    ...(await getHostedServerStatus()),
    message: `${removed.name} und der Serverordner wurden gelöscht.`
  };
}

async function applyHostedServerOptions(options = {}) {
  let state = readHostedServerState();
  let selectedServer = getHostedServerById(state, options.serverId);
  if (!selectedServer) {
    return { success: false, error: 'Bitte wähle zuerst einen Server aus.' };
  }
  const normalizedName = normalizeHostedServerName(options.name || selectedServer.name);
  if (!normalizedName) {
    return { success: false, error: 'Bitte gib einen Servernamen ein, z. B. pizza.' };
  }
  const hostName = getHostedServerHostName(normalizedName);
  const availability = await checkHostedServerNameAvailable(hostName, state, selectedServer.id);
  if (!availability.available) {
    return { success: false, error: availability.error };
  }
  const edition = normalizeHostedServerEdition(options.edition || selectedServer.edition || 'java');
  const software = normalizeHostedServerSoftware(options.software || selectedServer.software || 'vanilla', edition);
  const portAvailability = checkHostedServerPortAvailable(options.port || selectedServer.port, state, selectedServer.id);
  if (!portAvailability.available) {
    return { success: false, error: portAvailability.error };
  }
  const nextState = normalizeHostedServerState({
    ...state,
    activeServerId: selectedServer.id,
    servers: state.servers.map((server) => server.id === selectedServer.id ? {
      ...server,
      name: normalizedName,
      edition,
      software,
      serverSoftware: software,
      minecraftVersion: options.minecraftVersion,
      ramGb: options.ramGb,
      port: options.port,
      maxPlayers: options.maxPlayers,
      difficulty: options.difficulty,
      gamemode: options.gamemode,
      motd: options.motd,
      pvp: options.pvp,
      whitelist: options.whitelist,
      onlineMode: options.onlineMode,
      enableCommandBlock: options.enableCommandBlock,
      spawnProtection: options.spawnProtection,
      viewDistance: options.viewDistance,
      simulationDistance: options.simulationDistance,
      ownerUsername: server.ownerUsername || options.ownerUsername,
      ownerUuid: server.ownerUuid || options.ownerUuid,
      eulaAccepted: Boolean(options.acceptEula)
    } : server)
  });
  state = writeHostedServerState(nextState);
  selectedServer = getHostedServerById(state, selectedServer.id);
  return { success: true, state, selectedServer, warning: availability.warning || '' };
}

async function saveHostedServer(options = {}) {
  const result = await applyHostedServerOptions(options);
  if (!result.success) {
    return result;
  }
  writeHostedServerFiles(result.selectedServer);
  return {
    ...(await getHostedServerStatus()),
    message: `${result.selectedServer.name} wurde gespeichert.${result.warning ? ` Hinweis: ${result.warning}` : ''}`
  };
}

async function startHostedServer(options = {}) {
  const applied = await applyHostedServerOptions(options);
  if (!applied.success) {
    return applied;
  }
  const { state, selectedServer } = applied;
  if (getHostedServerRuntime(selectedServer.id)) {
    return {
      ...(await getHostedServerStatus()),
      message: `${selectedServer.name} läuft bereits.`
    };
  }
  if (!selectedServer.eulaAccepted) {
    return { success: false, error: 'Bitte akzeptiere zuerst die Minecraft Server EULA.' };
  }

  const protocol = getHostedServerProtocol(selectedServer);
  const softwareLabel = getHostedServerSoftwareLabel(selectedServer);
  const portInUse = await checkLocalPortOpen(selectedServer.port, 750, protocol);
  if (portInUse) {
    return {
      success: false,
      error: `Port ${selectedServer.port} ${protocol} ist bereits belegt. Bitte wähle einen anderen Port oder stoppe die andere Anwendung.`
    };
  }

  ensureDir(getHostedServerDir(selectedServer));
  if (isHostedServerJava(selectedServer)) {
    ensureDir(getHostedServerModsDir(selectedServer));
  }
  const installInfo = isHostedServerBedrock(selectedServer)
    ? await ensureHostedServerBedrock(selectedServer)
    : await ensureHostedServerJar(selectedServer);
  const javaInfo = isHostedServerJava(selectedServer)
    ? getJavaDetails(installInfo.javaComponent, installInfo.requiredJava)
    : null;
  const updatedState = updateHostedServerInState(state, selectedServer.id, {
    resolvedMinecraftVersion: installInfo.minecraftVersion,
    resolvedLoaderVersion: installInfo.build ? String(installInfo.build) : '',
    resolvedInstallerVersion: '',
    installedAt: selectedServer.installedAt || new Date().toISOString()
  });
  const savedState = getHostedServerById(updatedState, selectedServer.id);
  writeHostedServerFiles(savedState);
  const firewallResult = ensureHostedServerFirewallRule(savedState);
  const upnpResult = ensureHostedServerUpnpPortMapping(savedState);
  hostedServerFirewallRules.set(savedState.id, firewallResult);
  hostedServerUpnpMappings.set(savedState.id, upnpResult);

  const serverDir = getHostedServerDir(savedState);
  const logPath = path.join(serverDir, 'server.log');
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n\n[${new Date().toISOString()}] Starting ${softwareLabel} server ${installInfo.minecraftVersion}\n`);
  const processRef = isHostedServerBedrock(savedState)
    ? spawn(getHostedServerBedrockExecutablePath(savedState), [], {
      cwd: serverDir,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    })
    : spawn(javaInfo.path, [
      `-Xmx${savedState.ramGb}G`,
      `-Xms${Math.min(savedState.ramGb, 2)}G`,
      '-jar',
      getHostedServerJarPath(savedState),
      'nogui'
    ], {
      cwd: serverDir,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  const startedAt = new Date().toISOString();
  hostedServerProcesses.set(savedState.id, {
    process: processRef,
    startedAt,
    logStream,
    edition: savedState.edition,
    software: savedState.software,
    protocol
  });
  hostedServerProcess = processRef;
  hostedServerStartedAt = startedAt;
  hostedServerRunningId = savedState.id;
  startHostedServerPowerBlocker();
  processRef.stdout.on('data', (chunk) => logStream.write(chunk));
  processRef.stderr.on('data', (chunk) => logStream.write(chunk));
  processRef.on('error', (error) => {
    logStream.write(`\n[${new Date().toISOString()}] Server konnte nicht gestartet werden: ${error.message || String(error)}\n`);
    logStream.end();
    hostedServerProcesses.delete(savedState.id);
    hostedServerUpnpMappings.delete(savedState.id);
    hostedServerFirewallRules.delete(savedState.id);
    syncLegacyHostedServerRuntime();
    stopHostedServerPowerBlocker();
  });
  processRef.on('exit', (code, signal) => {
    logStream.write(`\n[${new Date().toISOString()}] Server exited code=${code ?? 'null'} signal=${signal ?? 'null'}\n`);
    logStream.end();
    hostedServerProcesses.delete(savedState.id);
    hostedServerUpnpMappings.delete(savedState.id);
    hostedServerFirewallRules.delete(savedState.id);
    syncLegacyHostedServerRuntime();
    stopHostedServerPowerBlocker();
  });

  return {
    ...(await getHostedServerStatus()),
    javaVersion: javaInfo?.majorVersion || null,
    logPath,
    firewall: firewallResult,
    upnp: upnpResult,
    message: upnpResult.success
      ? `${softwareLabel} läuft. Freunde können mit der Domain joinen.`
      : `${softwareLabel} läuft lokal. Router-Portfreigabe ist nötig.`
  };
}

function stopHostedServerProcess(serverId = '') {
  const runtime = getHostedServerRuntime(serverId);
  const processRef = runtime?.process || null;
  if (!processRef || processRef.killed) {
    syncLegacyHostedServerRuntime();
    stopHostedServerPowerBlocker();
    return false;
  }
  try {
    processRef.stdin.write('stop\n');
  } catch (_error) {
    try {
      processRef.kill();
    } catch (__error) {
      // ignore shutdown failures
    }
  }
  const processToStop = processRef;
  setTimeout(() => {
    if (processToStop && !processToStop.killed) {
      try {
        processToStop.kill();
      } catch (_error) {
        // ignore shutdown failures
      }
    }
  }, 8000);
  return true;
}

function stopAllHostedServerProcesses() {
  const runningIds = getHostedServerRunningIds();
  let stopped = false;
  runningIds.forEach((serverId) => {
    stopped = stopHostedServerProcess(serverId) || stopped;
  });
  return stopped;
}

function waitForHostedServerExit(timeoutMs = 10000, serverId = '') {
  const processToWaitFor = getHostedServerRuntime(serverId)?.process || null;
  if (!processToWaitFor || processToWaitFor.killed) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    processToWaitFor.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function stopHostedServer(serverId = '') {
  const state = readHostedServerState();
  const targetServer = getHostedServerById(state, serverId);
  const stopped = stopHostedServerProcess(targetServer?.id || serverId);
  const status = await getHostedServerStatus();
  return {
    ...status,
    stopping: stopped,
    message: stopped ? 'Server wird gestoppt und speichert die Welt.' : 'Der lokale Server läuft nicht.'
  };
}

async function restartHostedServer(options = {}) {
  const requestedId = String(options.serverId || '').trim();
  const runtime = getHostedServerRuntime(requestedId);
  if (!runtime) {
    return startHostedServer(options);
  }
  stopHostedServerProcess(requestedId);
  await waitForHostedServerExit(12000, requestedId);
  if (getHostedServerRuntime(requestedId)) {
    return {
      ...(await getHostedServerStatus()),
      success: false,
      error: 'Server konnte nicht rechtzeitig gestoppt werden.'
    };
  }
  return startHostedServer(options);
}

async function sendHostedServerCommand(serverId = '', command = '') {
  const state = readHostedServerState();
  const targetServer = getHostedServerById(state, serverId);
  if (!targetServer) {
    return { success: false, error: 'Bitte wähle zuerst einen Server aus.' };
  }
  const cleanCommand = String(command || '').replace(/[\r\n]+/gu, ' ').trim();
  if (!cleanCommand) {
    return { success: false, error: 'Bitte gib einen Server-Befehl ein.' };
  }
  const runtime = getHostedServerRuntime(targetServer.id);
  if (!runtime?.process?.stdin) {
    return { success: false, error: 'Dieser Server läuft nicht.' };
  }
  try {
    runtime.process.stdin.write(`${cleanCommand}\n`);
    const logPath = getHostedServerLogPath(targetServer);
    fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] > ${cleanCommand}\n`, 'utf8');
    return {
      ...(await getHostedServerStatus()),
      message: `Befehl gesendet: ${cleanCommand}`
    };
  } catch (error) {
    return { success: false, error: `Befehl konnte nicht gesendet werden: ${error.message || String(error)}` };
  }
}

async function openHostedServerFolder() {
  const state = readHostedServerState();
  const server = getHostedServerById(state);
  const serverDir = server ? getHostedServerDir(server) : HOSTED_SERVER_DIR;
  ensureDir(serverDir);
  const openError = await shell.openPath(serverDir);
  if (openError) {
    return { success: false, error: `Server-Ordner konnte nicht geöffnet werden: ${openError}` };
  }
  return { success: true, path: serverDir };
}

async function openHostedServerModsFolder() {
  const state = readHostedServerState();
  const server = getHostedServerById(state);
  if (!server) {
    return { success: false, error: 'Bitte wähle zuerst einen Server aus.' };
  }
  const modsDir = getHostedServerModsDir(server);
  ensureDir(modsDir);
  const openError = await shell.openPath(modsDir);
  if (openError) {
    return { success: false, error: `Mods-Ordner konnte nicht geöffnet werden: ${openError}` };
  }
  return { success: true, path: modsDir };
}

async function importHostedServerMods(filePaths = []) {
  const state = readHostedServerState();
  const server = getHostedServerById(state);
  if (!server) {
    return { success: false, error: 'Bitte wähle zuerst einen Server aus.' };
  }
  const modsDir = getHostedServerModsDir(server);
  ensureDir(modsDir);
  let imported = 0;
  for (const sourcePath of Array.isArray(filePaths) ? filePaths : []) {
    const normalizedSource = String(sourcePath || '').trim();
    if (!normalizedSource || !/\.jar$/iu.test(normalizedSource) || !fs.existsSync(normalizedSource)) {
      continue;
    }
    const fileName = path.basename(normalizedSource).replace(/[^\w .+()[\]-]/gu, '_').slice(0, 160);
    const targetPath = path.join(modsDir, fileName);
    if (!isPathInsideDirectory(modsDir, targetPath)) {
      continue;
    }
    fs.copyFileSync(normalizedSource, targetPath);
    imported += 1;
  }
  return {
    ...(await getHostedServerStatus()),
    message: imported ? `${imported} Server-Mod${imported === 1 ? '' : 's'} hinzugefügt.` : 'Keine JAR-Mods importiert.'
  };
}

async function resolveHostedServerMinecraftVersion(server) {
  const requestedMinecraftVersion = String(server?.minecraftVersion || 'latest').trim();
  if (requestedMinecraftVersion.toLowerCase() !== 'latest') {
    return requestedMinecraftVersion;
  }
  if (server?.resolvedMinecraftVersion) {
    return server.resolvedMinecraftVersion;
  }
  const manifest = await fetchJson(VERSION_MANIFEST_URL, { allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS });
  return String(manifest.latest?.release || '').trim();
}

async function installHostedServerModrinthMod(projectReference) {
  const state = readHostedServerState();
  const server = getHostedServerById(state);
  if (!server) {
    return { success: false, error: 'Bitte erstelle oder wähle zuerst einen Hosting-Server aus.' };
  }
  const projectId = getModrinthProjectId(projectReference);
  if (!projectId) {
    return { success: false, error: 'Modrinth-Projekt konnte nicht gelesen werden.' };
  }
  const minecraftVersion = await resolveHostedServerMinecraftVersion(server);
  if (!minecraftVersion) {
    return { success: false, error: 'Minecraft-Version des Servers konnte nicht bestimmt werden.' };
  }
  const compatibleVersion = await getCompatibleModrinthProjectVersion(projectId, minecraftVersion, {
    projectType: 'mod',
    strictMinecraftVersion: true
  });
  if (!compatibleVersion) {
    return { success: false, error: `Keine passende Fabric-Mod-Version für Minecraft ${minecraftVersion} gefunden.` };
  }
  const primaryFile = getPrimaryProjectFile(compatibleVersion, 'mod');
  if (!primaryFile?.url) {
    return { success: false, error: 'Keine herunterladbare Mod-Datei gefunden.' };
  }
  const modsDir = getHostedServerModsDir(server);
  ensureDir(modsDir);
  const fileName = sanitizeDownloadedFileName(primaryFile.filename, '.jar');
  const destinationPath = path.join(modsDir, fileName);
  await downloadFile(primaryFile.url, destinationPath, {
    expectedSha1: String(primaryFile.hashes?.sha1 || '').trim(),
    expectedSha512: String(primaryFile.hashes?.sha512 || '').trim(),
    expectedSize: Number(primaryFile.size || 0),
    allowedHosts: TRUSTED_MODRINTH_DOWNLOAD_HOSTS,
    backupExisting: false
  });
  const title = getModrinthProjectTitle(projectReference) || projectId;
  return {
    ...(await getHostedServerStatus()),
    message: `${title} wurde zu ${server.hostName || server.name} hinzugefügt.`
  };
}

async function removeHostedServerMod(fileName) {
  const state = readHostedServerState();
  const server = getHostedServerById(state);
  if (!server) {
    return { success: false, error: 'Bitte wähle zuerst einen Server aus.' };
  }
  const modsDir = getHostedServerModsDir(server);
  const safeName = path.basename(String(fileName || '').trim());
  const targetPath = path.join(modsDir, safeName);
  if (!safeName || !isPathInsideDirectory(modsDir, targetPath) || !fs.existsSync(targetPath)) {
    return { success: false, error: 'Mod wurde nicht gefunden.' };
  }
  fs.unlinkSync(targetPath);
  return {
    ...(await getHostedServerStatus()),
    message: `${safeName} wurde entfernt.`
  };
}

async function getHostedServerStatus() {
  return LOCAL_DIRECT_HOSTING.getHostedServerStatus();
}

async function createHostedServer(options = {}) {
  return LOCAL_DIRECT_HOSTING.createHostedServer(options);
}

async function selectHostedServer(serverId) {
  return LOCAL_DIRECT_HOSTING.selectHostedServer(serverId);
}

async function saveHostedServer(options = {}) {
  return LOCAL_DIRECT_HOSTING.saveHostedServer(options);
}

async function startHostedServer(options = {}) {
  return LOCAL_DIRECT_HOSTING.startHostedServer(options);
}

async function stopHostedServer(serverId = '') {
  return LOCAL_DIRECT_HOSTING.stopHostedServer(serverId);
}

async function restartHostedServer(options = {}) {
  return LOCAL_DIRECT_HOSTING.restartHostedServer(options);
}

async function deleteHostedServer(serverId = '') {
  return LOCAL_DIRECT_HOSTING.deleteHostedServer(serverId);
}

async function sendHostedServerCommand(serverId = '', command = '') {
  return LOCAL_DIRECT_HOSTING.sendHostedServerCommand(serverId, command);
}

async function openHostedServerFolder() {
  return LOCAL_DIRECT_HOSTING.openHostedServerFolder();
}

async function openHostedServerModsFolder() {
  return LOCAL_DIRECT_HOSTING.openHostedServerModsFolder();
}

async function importHostedServerMods(filePaths = []) {
  return LOCAL_DIRECT_HOSTING.importHostedServerMods(filePaths);
}

async function installHostedServerModrinthMod(projectReference) {
  return { success: false, error: 'Installiere Server-Plugins bitte im Hosting-Tab über Plugin hochladen.' };
}

async function removeHostedServerMod(fileName = '') {
  return LOCAL_DIRECT_HOSTING.removeHostedServerMod(fileName);
}

async function readSavedUser() {
  if (!fs.existsSync(USER_FILE)) {
    if (FORCE_OFFLINE_MODE) {
      return setCurrentUser(createOfflineUser('', null));
    }
    clearCurrentUser();
    return null;
  }

  try {
    const savedUser = readSavedUserFile();
    if (!savedUser) {
      return null;
    }
    if (FORCE_OFFLINE_MODE) {
      return setCurrentUser(createOfflineUser(savedUser?.username || savedUser?.email || '', savedUser));
    }

    return savedUser;
  } catch (error) {
    clearCurrentUser();
    logger.error('Konnte user.json nicht lesen', { error: serializeError(error) });
    return null;
  }
}

function parseBooleanEnv(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function isOfflineOnlySession(user) {
  const accessToken = String(user?.accessToken || '').trim();
  if (accessToken !== 'offline-token') {
    return false;
  }

  const loginSource = String(user?.loginSource || '').trim().toLowerCase();
  const userType = String(user?.userType || '').trim().toLowerCase();
  if (loginSource === 'offline' || loginSource === 'official-launcher') {
    return true;
  }

  return userType === 'legacy' || userType === 'launcher-import';
}

function shouldLaunchOfflineSession(user, passedAccessToken = '') {
  if (FORCE_OFFLINE_MODE || String(passedAccessToken || '').trim() === 'offline-token') {
    return true;
  }

  const loginSource = String(user?.loginSource || '').trim().toLowerCase();
  const userType = String(user?.userType || '').trim().toLowerCase();
  if (loginSource === 'offline') {
    return true;
  }

  return userType === 'legacy' && String(user?.accessToken || '').trim() === 'offline-token';
}

function readOfficialLauncherAccountProfile() {
  const launcherAccountsPath = path.join(DEFAULT_MINECRAFT_DIR, 'launcher_accounts_microsoft_store.json');
  if (!fs.existsSync(launcherAccountsPath)) {
    return null;
  }

  try {
    const launcherAccounts = JSON.parse(fs.readFileSync(launcherAccountsPath, 'utf8'));
    const activeId = launcherAccounts.activeAccountLocalId;
    const activeAccount = launcherAccounts.accounts?.[activeId];
    if (!activeAccount?.minecraftProfile?.name || !activeAccount.minecraftProfile.id) {
      return null;
    }

    return {
      username: activeAccount.minecraftProfile.name,
      uuid: normalizeMinecraftUuid(activeAccount.minecraftProfile.id)
    };
  } catch (_error) {
    return null;
  }
}

function normalizeMinecraftUuid(uuid) {
  return String(uuid || '').replace(/-/g, '').trim();
}

function normalizeOfflineUsername(loginInput, fallbackUsername = 'OfflinePlayer') {
  const rawValue = String(loginInput || '').trim();
  const preferred = rawValue.includes('@') ? rawValue.split('@')[0] : rawValue;
  const sanitized = preferred.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
  if (sanitized.length >= 3) {
    return sanitized;
  }
  const fallbackSanitized = String(fallbackUsername || '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 16);
  return fallbackSanitized.length >= 3 ? fallbackSanitized : 'OfflinePlayer';
}

function isValidOfflineUsername(username) {
  return /^[a-zA-Z0-9_]{3,16}$/u.test(String(username || '').trim());
}

function createOfflineUuid(username) {
  const normalizedUsername = normalizeOfflineUsername(username, 'OfflinePlayer');
  const hash = crypto.createHash('md5')
    .update(`OfflinePlayer:${normalizedUsername}`, 'utf8')
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return hash.toString('hex');
}

function createOfflineUser(loginInput, sourceUser = null) {
  const fallbackUsername = sourceUser?.username || sourceUser?.email || 'OfflinePlayer';
  const username = normalizeOfflineUsername(loginInput, fallbackUsername);
  return {
    username,
    email: null,
    uuid: createOfflineUuid(username),
    loginTime: new Date().toISOString(),
    accessToken: 'offline-token',
    microsoftAccessToken: '',
    userType: 'legacy',
    loginSource: 'offline'
  };
}

async function fetchJson(url, options = {}) {
  const {
    allowedHosts = null,
    retries = 2,
    retryDelayMs = 600,
    timeoutMs = 30000,
    ...fetchOptions
  } = options;

  if (allowedHosts) {
    assertTrustedHttpsUrl(url, allowedHosts);
  }

  let lastError = null;
  const attempts = Math.max(1, Number(retries) + 1);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions, timeoutMs);
      if (!response.ok) {
        const body = await safeReadText(response);
        const error = new Error(`HTTP ${response.status} für ${url}${body ? `: ${body}` : ''}`);
        error.statusCode = response.status;
        if (!isRetryableHttpStatus(response.status) || attempt >= attempts) {
          throw error;
        }
        lastError = error;
      } else {
        return response.json();
      }
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || (!isNetworkFetchError(error) && !isRetryableHttpStatus(error?.statusCode))) {
        const detail = error?.cause?.message || error?.message || String(error);
        throw new Error(`Netzwerkfehler für ${url}: ${detail}`);
      }
    }

    logger.warn('Fetch retry scheduled', {
      url,
      attempt,
      attempts,
      error: serializeError(lastError)
    });
    await delay(retryDelayMs * attempt);
  }

  const detail = lastError?.cause?.message || lastError?.message || String(lastError);
  throw new Error(`Netzwerkfehler für ${url}: ${detail}`);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const externalSignal = options.signal;
  const abortFromExternal = () => controller?.abort();
  if (externalSignal) {
    if (externalSignal.aborted) abortFromExternal();
    else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
  }
  const timeout = setTimeout(() => {
    if (controller) {
      controller.abort();
    }
  }, Math.max(1000, Number(timeoutMs) || 30000));

  try {
    return await fetchImpl(url, {
      ...options,
      ...(controller ? { signal: controller.signal } : {})
    });
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener?.('abort', abortFromExternal);
  }
}

function isRetryableHttpStatus(statusCode) {
  const status = Number(statusCode || 0);
  return status === 408 || status === 429 || status >= 500;
}

function isNetworkFetchError(error) {
  const message = `${error?.message || ''} ${error?.cause?.message || ''}`.toLowerCase();
  return message.includes('fetch failed')
    || message.includes('aborted')
    || message.includes('aborterror')
    || message.includes('netzwerkfehler')
    || message.includes('econnreset')
    || message.includes('etimedout')
    || message.includes('enotfound')
    || message.includes('eai_again')
    || message.includes('socket');
}

async function checkServiceHealth() {
  const checkedAt = new Date().toISOString();
  const serviceResults = await Promise.all(SERVICE_HEALTH_CHECKS.map((service) => checkSingleServiceHealth(service)));
  const statuses = [...serviceResults];

  if (FORCE_OFFLINE_MODE) {
    statuses.push({
      id: 'downloads-disabled',
      ok: false,
      level: 'warning',
      message: 'Downloads sind derzeit deaktiviert.',
      checkedAt
    });
  } else {
    statuses.push({
      id: 'downloads-disabled',
      ok: true,
      level: 'ok',
      message: 'Downloads verfügbar.',
      checkedAt
    });
  }

  return {
    success: true,
    checkedAt,
    statuses
  };
}

async function checkSingleServiceHealth(service) {
  try {
    const response = await fetchWithTimeout(service.url, {
      method: service.method || 'GET',
      headers: service.headers || {}
    }, SERVICE_HEALTH_TIMEOUT_MS);
    const okStatus = typeof service.okStatus === 'function'
      ? service.okStatus(response.status)
      : response.ok;

    return {
      id: service.id,
      ok: Boolean(okStatus),
      level: okStatus ? 'ok' : service.level,
      message: okStatus ? 'Dienst erreichbar.' : service.message,
      statusCode: response.status,
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      id: service.id,
      ok: false,
      level: service.level,
      message: service.message,
      error: error?.cause?.message || error?.message || String(error),
      checkedAt: new Date().toISOString()
    };
  }
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch (_error) {
    return '';
  }
}

async function loginWithOfficialMicrosoftXboxLogin(options = {}) {
  ensureDir(AUTH_CACHE_DIR);
  const openedUrls = new Set();
  const forceRefresh = Boolean(options.forceRefresh);
  const authCacheId = String(options.authCacheId || '').trim() || 'x-launcher';

  const openUrlOnce = async (url) => {
    const normalizedUrl = String(url || '').trim();
    if (!normalizedUrl || openedUrls.has(normalizedUrl)) {
      return;
    }

    openedUrls.add(normalizedUrl);
    try {
      await shell.openExternal(normalizedUrl);
    } catch (error) {
      console.warn(`Konnte Browser-URL nicht öffnen (${normalizedUrl}):`, error.message);
    }
  };

  const authFlow = new Authflow(
    authCacheId,
    AUTH_CACHE_DIR,
    {
      flow: 'sisu',
      authTitle: Titles.MinecraftJava,
      deviceType: 'Win32',
      forceRefresh
    },
    (deviceCodeResponse) => {
      const verificationUri = String(deviceCodeResponse?.verification_uri || '').trim();
      const userCode = String(deviceCodeResponse?.user_code || '').trim();
      if (verificationUri.includes('microsoft.com/link') && userCode) {
        openUrlOnce(`${verificationUri}${verificationUri.includes('?') ? '&' : '?'}otc=${encodeURIComponent(userCode)}`);
      } else if (verificationUri) {
        openUrlOnce(verificationUri);
      }
    }
  );

  const javaToken = await authFlow.getMinecraftJavaToken({
    fetchProfile: true,
    fetchEntitlements: true
  });

  const accessToken = String(javaToken?.token || '').trim();
  if (!accessToken) {
    throw new Error('Minecraft-Login fehlgeschlagen: Kein Access Token erhalten.');
  }

  const profile = javaToken?.profile;
  if (profile?.id && profile?.name) {
    return {
      accessToken,
      uuid: profile.id,
      username: profile.name,
      microsoftAccessToken: ''
    };
  }

  const fallbackProfile = await fetchMinecraftProfile(accessToken);
  return {
    accessToken,
    uuid: fallbackProfile.uuid,
    username: fallbackProfile.username,
    microsoftAccessToken: ''
  };
}

function isMinecraftUnauthorizedError(error) {
  const message = String(error?.message || '');
  return message.includes('HTTP 401')
    && message.includes('api.minecraftservices.com/minecraft/profile');
}

async function refreshOfficialMinecraftSession(savedUser = null) {
  try {
    const authCacheId = String(savedUser?.authCacheId || '').trim() || 'x-launcher';
    const profile = await loginWithOfficialMicrosoftXboxLogin({ forceRefresh: false, authCacheId });
    const userInfo = {
      username: profile.username,
      email: savedUser?.email || null,
      uuid: profile.uuid,
      loginTime: new Date().toISOString(),
      accessToken: profile.accessToken,
      microsoftAccessToken: profile.microsoftAccessToken || '',
      userType: 'msa',
      loginSource: 'official-sisu',
      tokenSource: 'prismarine-auth',
      authCacheId
    };

    return writeSavedUserFile(userInfo, 'refresh-official-session');
  } catch (refreshError) {
    throw new Error(`Deine Microsoft-Sitzung ist abgelaufen. Bitte melde dich im Launcher neu an. (${refreshError.message})`);
  }
}

async function fetchMinecraftProfile(accessToken) {
  const profile = await fetchJson('https://api.minecraftservices.com/minecraft/profile', {
    allowedHosts: TRUSTED_MINECRAFT_SERVICE_HOSTS,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });

  if (!profile.id || !profile.name) {
    throw new Error('Dieser Microsoft-Account besitzt kein Minecraft Java Edition Profil.');
  }

  return {
    uuid: profile.id,
    username: profile.name,
    accessToken
  };
}

async function getPreferredVersionMeta(javaMajorVersion) {
  const manifest = await fetchJson(VERSION_MANIFEST_URL, { allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS });
  const releaseVersions = (manifest.versions || []).filter((entry) => entry.type === 'release');

  for (const version of releaseVersions) {
    const versionData = await fetchJson(version.url, { allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS });
    const requiredJava = versionData.javaVersion?.majorVersion || 8;
    if (requiredJava <= javaMajorVersion) {
      return version;
    }
  }

  throw new Error(`Keine kompatible Minecraft-Version für Java ${javaMajorVersion} gefunden.`);
}

async function getAvailableVersions() {
  const configuredVersionId = getEffectiveSelectedVersionId();
  let releaseMetaByVersion = new Map();
  try {
    releaseMetaByVersion = await fetchMinecraftReleaseMetaByVersion();
  } catch (_error) {
    releaseMetaByVersion = new Map();
  }

  const localVersions = readAllLocalVersions().filter((localVersion) => isFabricVersionId(localVersion.id));
  const localVersionsByGameVersion = new Map();

  for (const localVersion of localVersions) {
    const minecraftVersion = getMinecraftVersionName(localVersion.id, localVersion.data);
    if (!minecraftVersion || !isFullMinecraftReleaseName(minecraftVersion) || !isProfileMinecraftVersion(minecraftVersion)) {
      continue;
    }

    const releaseMeta = releaseMetaByVersion.get(minecraftVersion) || {};
    const entry = {
      id: localVersion.id,
      name: minecraftVersion,
      minecraftVersion,
      loaderVersion: getFabricLoaderVersion(localVersion.id),
      type: 'fabric',
      releaseTime: releaseMeta.releaseTime || localVersion.data.releaseTime || localVersion.data.time || '',
      releaseOrder: Number.isFinite(releaseMeta.releaseOrder) ? releaseMeta.releaseOrder : Number.MAX_SAFE_INTEGER,
      installed: true,
      source: 'local',
      inheritsFrom: localVersion.data.inheritsFrom || minecraftVersion,
      javaMajorVersion: localVersion.data.javaVersion?.majorVersion || null
    };
    const existing = localVersionsByGameVersion.get(minecraftVersion);
    if (!existing || isPreferredFabricEntry(entry, existing, configuredVersionId)) {
      localVersionsByGameVersion.set(minecraftVersion, entry);
    }
  }

  const versions = [];

  try {
    const remoteVersions = await getRemoteFabricVersions({ releaseMetaByVersion });
    for (const remoteVersion of remoteVersions) {
      const localVersion = localVersionsByGameVersion.get(remoteVersion.minecraftVersion);
      versions.push(localVersion
        ? {
            ...localVersion,
            releaseTime: remoteVersion.releaseTime || localVersion.releaseTime,
            releaseOrder: Number.isFinite(remoteVersion.releaseOrder) ? remoteVersion.releaseOrder : localVersion.releaseOrder,
            javaMajorVersion: remoteVersion.javaMajorVersion || localVersion.javaMajorVersion
          }
        : remoteVersion);
      localVersionsByGameVersion.delete(remoteVersion.minecraftVersion);
    }
  } catch (_error) {
    // If remote loading fails, local Fabric versions are still enough.
  }

  versions.push(...Array.from(localVersionsByGameVersion.values()));
  if (isProfileFabricVersionAllowed(configuredVersionId) && !versions.some((version) => version.id === configuredVersionId)) {
    const configuredFabricVersion = parseFabricVersionId(configuredVersionId);
    const localVersion = readLocalVersion(configuredVersionId);
    const releaseMeta = releaseMetaByVersion.get(configuredFabricVersion.minecraftVersion) || {};
    versions.push({
      id: configuredVersionId,
      name: configuredFabricVersion.minecraftVersion,
      minecraftVersion: configuredFabricVersion.minecraftVersion,
      loaderVersion: configuredFabricVersion.loaderVersion,
      type: 'fabric',
      releaseTime: releaseMeta.releaseTime || localVersion?.data?.releaseTime || localVersion?.data?.time || '',
      releaseOrder: Number.isFinite(releaseMeta.releaseOrder) ? releaseMeta.releaseOrder : Number.MAX_SAFE_INTEGER,
      installed: Boolean(localVersion),
      source: localVersion ? 'local' : 'selected',
      inheritsFrom: localVersion?.data?.inheritsFrom || configuredFabricVersion.minecraftVersion,
      javaMajorVersion: localVersion?.data?.javaVersion?.majorVersion || null
    });
  }

  const annotatedVersions = versions
    .filter((version) => isProfileMinecraftVersion(version.minecraftVersion || getMinecraftVersionName(version.id)))
    .map((version) => {
      const minecraftVersion = version.minecraftVersion || getMinecraftVersionName(version.id);
      return {
        ...version,
        standardSupported: isSupportedMinecraftVersion(minecraftVersion),
        profileSupported: isProfileMinecraftVersion(minecraftVersion)
      };
    });
  const activePack = getActivePack();
  const selectionVersions = activePack
    ? annotatedVersions
    : annotatedVersions.filter((version) => version.standardSupported);
  const selectedVersionId = resolveAvailableVersionSelection(configuredVersionId, selectionVersions);
  if (!activePack && selectedVersionId && selectedVersionId !== configuredVersionId) {
    persistStandardSelectedVersionId(selectedVersionId);
  }

  const sortedVersions = annotatedVersions.sort(compareAvailableFabricVersions);

  return {
    success: true,
    supportedMinecraftVersions: [getSupportedMinecraftVersionsLabel()],
    profileMinimumMinecraftVersion: PROFILE_MIN_MINECRAFT_VERSION,
    selectedVersionId,
    versions: sortedVersions
  };
}

async function downloadVersion(versionId) {
  const selectedVersionId = String(versionId || '').trim();
  if (!selectedVersionId) {
    return { success: false, error: 'Keine Version ausgewählt.' };
  }

  if (!isFabricVersionId(selectedVersionId)) {
    return { success: false, error: 'Es können nur Fabric-Versionen heruntergeladen werden.' };
  }

  if (!isFullFabricReleaseVersionId(selectedVersionId)) {
    return { success: false, error: 'Es können nur normale Minecraft-Vollversionen heruntergeladen werden.' };
  }

  const activePack = getActivePack();
  if (activePack ? !isProfileFabricVersionAllowed(selectedVersionId) : !isSupportedFabricVersionAllowed(selectedVersionId)) {
    return { success: false, error: activePack ? getProfileMinecraftVersionsError() : getSupportedMinecraftVersionsError() };
  }

  const localVersion = readLocalVersion(selectedVersionId);
  if (localVersion) {
    persistEffectiveSelectedVersionId(selectedVersionId);
    const syncResult = await syncManagedModsForVersion(selectedVersionId, {
      refreshAll: true,
      refreshDisabledProjects: !getActivePack()
    });
    return {
      success: true,
      selectedVersionId,
      warning: formatManagedModsWarning(syncResult.warnings),
      message: `Fabric ${getMinecraftVersionName(selectedVersionId, localVersion.data)} ist bereits installiert.`
    };
  }

  const fabricVersion = parseFabricVersionId(selectedVersionId);
  if (!fabricVersion) {
    return {
      success: false,
      error: `Fabric-Version ${selectedVersionId} konnte nicht gelesen werden.`
    };
  }

  const versionData = await fetchFabricProfileVersionData(fabricVersion.minecraftVersion, fabricVersion.loaderVersion);
  await prepareVersion(selectedVersionId, versionData);
  persistEffectiveSelectedVersionId(selectedVersionId);
  const syncResult = await syncManagedModsForVersion(selectedVersionId, {
    refreshAll: true,
    refreshDisabledProjects: !getActivePack()
  });

  return {
    success: true,
    selectedVersionId,
    warning: formatManagedModsWarning(syncResult.warnings),
    message: `Fabric ${fabricVersion.minecraftVersion} wurde heruntergeladen und ausgewählt.`
  };
}

async function resolveSelectedVersion(versionId, options = {}) {
  let requestedVersionId = String(versionId || '').trim();
  const allowProfileVersions = Boolean(options.allowProfileVersions || getActivePack());
  const versionIsAllowed = allowProfileVersions
    ? isProfileFabricVersionAllowed(requestedVersionId)
    : isSupportedFabricVersionAllowed(requestedVersionId);
  if (requestedVersionId && !versionIsAllowed) {
    requestedVersionId = '';
  }

  const localVersion = requestedVersionId ? readLocalVersion(requestedVersionId) : null;
  if (localVersion && isFullFabricReleaseVersionId(requestedVersionId)) {
    return {
      id: requestedVersionId,
      data: localVersion.data,
      installed: true,
      source: 'local'
    };
  }

  if (isFullFabricReleaseVersionId(requestedVersionId)) {
    const fabricVersion = parseFabricVersionId(requestedVersionId);
    return {
      id: requestedVersionId,
      data: await fetchFabricProfileVersionData(fabricVersion.minecraftVersion, fabricVersion.loaderVersion),
      installed: false,
      source: 'remote'
    };
  }

  const preferredLocalFabricVersion = getPreferredLocalFabricVersion(requestedVersionId);
  if (preferredLocalFabricVersion
      && (allowProfileVersions
        ? isProfileMinecraftVersion(getMinecraftVersionName(preferredLocalFabricVersion.id, preferredLocalFabricVersion.data))
        : isSupportedMinecraftVersion(getMinecraftVersionName(preferredLocalFabricVersion.id, preferredLocalFabricVersion.data)))) {
    return {
      id: preferredLocalFabricVersion.id,
      data: preferredLocalFabricVersion.data,
      installed: true,
      source: 'local'
    };
  }

  const availableVersions = await getAvailableVersions();
  const fallbackCandidates = allowProfileVersions
    ? (availableVersions.versions || []).filter((version) => version?.profileSupported !== false)
    : (availableVersions.versions || []).filter((version) => version?.standardSupported !== false);
  const fallbackVersionId = resolveAvailableVersionSelection(requestedVersionId, fallbackCandidates);
  if (!fallbackVersionId) {
    throw new Error('Keine Fabric-Version gefunden.');
  }

  const fallbackVersion = parseFabricVersionId(fallbackVersionId);
  return {
    id: fallbackVersionId,
    data: await fetchFabricProfileVersionData(fallbackVersion.minecraftVersion, fallbackVersion.loaderVersion),
    installed: false,
    source: 'remote'
  };
}

async function getLauncherStatus() {
  try {
    const selectedVersion = await resolveSelectedVersion(getEffectiveSelectedVersionId());
    const activePack = getActivePack();
    const versionData = await mergeInheritedVersion(selectedVersion.data);
    const selectedVersionId = selectedVersion.id;
    const javaInfo = getJavaDetails(versionData.javaVersion?.component);
    const requiredJava = versionData.javaVersion?.majorVersion || 8;

    return {
      success: true,
      javaFound: true,
      javaMajorVersion: javaInfo.majorVersion,
      recommendedJavaVersion: requiredJava,
      selectedMinecraftVersion: selectedVersionId,
      selectedVersionName: getMinecraftVersionName(selectedVersionId, selectedVersion.data),
      activePackId: activePack?.id || '',
      activePackName: activePack?.name || '',
      selectedVersionRequiredJava: requiredJava,
      selectedVersionInstalled: selectedVersion.installed,
      selectedVersionSource: selectedVersion.source,
      needsJavaUpgrade: javaInfo.majorVersion < requiredJava,
      debugMode: logger.isDebugEnabled(),
      logFile: logger.getLogFilePath(),
      backupDir: BACKUP_DIR,
      diagnosticsDir: DIAGNOSTICS_DIR
    };
  } catch (error) {
    return {
      success: false,
      javaFound: false,
      recommendedJavaVersion: 21,
      debugMode: logger.isDebugEnabled(),
      logFile: logger.getLogFilePath(),
      backupDir: BACKUP_DIR,
      diagnosticsDir: DIAGNOSTICS_DIR,
      error: error.message
    };
  }
}

function setDebugMode(enabled) {
  const debugMode = Boolean(enabled);
  writeLauncherConfig({ debugMode });
  logger.info(`Debug mode changed by user: ${debugMode ? 'enabled' : 'disabled'}`);
  return {
    success: true,
    debugMode,
    message: debugMode
      ? 'Debug-Modus aktiviert. Ausführliche Logs werden geschrieben.'
      : 'Debug-Modus deaktiviert.'
  };
}

async function runLauncherDiagnostics() {
  const report = {
    success: true,
    generatedAt: new Date().toISOString(),
    debugMode: logger.isDebugEnabled(),
    configDir: CONFIG_DIR,
    minecraftDir: DEFAULT_MINECRAFT_DIR,
    logFile: logger.getLogFilePath(),
    backupDir: BACKUP_DIR,
    checks: [],
    issues: [],
    warnings: [],
    repairs: []
  };

  const runCheck = async (name, callback) => {
    try {
      await callback();
      report.checks.push({ name, success: true });
    } catch (error) {
      report.checks.push({ name, success: false, error: error.message });
      report.issues.push(`${name}: ${error.message}`);
      logger.error(`Diagnostic check failed: ${name}`, { error: serializeError(error) });
    }
  };

  await runCheck('Launcher-Konfiguration', async () => {
    const config = readLauncherConfig();
    const configuredMinecraftDir = normalizeConfiguredMinecraftDirectory(config.minecraftPath);
    if (config.minecraftPath && !configuredMinecraftDir) {
      report.warnings.push('Konfigurierter Minecraft-Pfad ist ungültig und wird ignoriert.');
    }
    ensureLauncherConfig();
    report.repairs.push('Launcher-Konfiguration geprüft und bei Bedarf repariert.');
  });

  await runCheck('Profil- und Mod-State', async () => {
    ensurePacksState();
    const modContext = getActiveModContext();
    ensureDir(modContext.modsDir);
    ensureModsState(modContext);
    readPacksState();
    readModsState(modContext);
    report.repairs.push('Profil- und Mod-State-Dateien geprüft.');
  });

  await runCheck('Mod-Dateien', async () => {
    const modContext = getActiveModContext();
    const state = readModsState(modContext);
    const activeFiles = Array.isArray(state.activeSync?.files) ? state.activeSync.files : [];
    const corrupted = [];
    const incompatible = [];
    if (fs.existsSync(modContext.modsDir)) {
      for (const fileName of fs.readdirSync(modContext.modsDir).filter((entry) => entry.toLowerCase().endsWith('.jar'))) {
        const filePath = path.join(modContext.modsDir, fileName);
        if (!isPathInsideDirectory(modContext.modsDir, filePath)) {
          continue;
        }
        if (isJarFileCorrupted(filePath)) {
          corrupted.push(fileName);
          continue;
        }
        const compatibility = getJarMinecraftCompatibility(filePath, modContext.minecraftVersion);
        if (compatibility.compatible === false) {
          incompatible.push(`${fileName} verlangt ${compatibility.requirement || 'eine andere Version'}`);
        }
      }
    }

    for (const fileName of corrupted) {
      report.issues.push(`${fileName}: beschädigte JAR erkannt.`);
    }
    for (const item of incompatible) {
      report.warnings.push(item);
    }
    for (const [projectId, project] of Object.entries(state.projects || {})) {
      const versionEntry = project?.versions?.[modContext.minecraftVersion];
      if (!versionEntry) {
        continue;
      }
      const integrityIssue = getManagedVersionIntegrityIssue(versionEntry);
      if (integrityIssue) {
        report.issues.push(`${project?.title || projectId}: verwaltete Library-Datei ist beschädigt (${integrityIssue}).`);
      }
    }
    report.warnings.push(...detectKnownModConflictWarnings(modContext, state, activeFiles));
  });

  await runCheck('Crash-Report-Analyse', async () => {
    const analysis = analyzeMinecraftCrashReports(DEFAULT_MINECRAFT_DIR, getActiveModContext());
    report.crashAnalysis = analysis;
    if (!analysis.found) {
      report.repairs.push('Keine Minecraft-Crashreports gefunden.');
      return;
    }

    report.repairs.push(`Crash-Analyse geprüft: ${analysis.sourceName}`);
    for (const finding of analysis.findings) {
      const text = `${finding.title}: ${finding.message}`;
      if (finding.severity === 'error') {
        report.issues.push(text);
      } else {
        report.warnings.push(text);
      }
    }
  });

  await runCheck('Java und Speicher', async () => {
    const javaInfo = getJavaDetails();
    const memory = process.memoryUsage();
    if (!javaInfo?.path) {
      report.warnings.push('Java konnte nicht eindeutig erkannt werden.');
    }
    if (memory.heapUsed > memory.heapTotal * 0.9) {
      report.warnings.push('Node/Electron Heap ist fast vollständig belegt. Details stehen im Log.');
    }
    report.memory = memory;
    report.java = {
      path: javaInfo?.path || '',
      majorVersion: javaInfo?.majorVersion || 0
    };
  });

  report.issues = uniqueStrings(report.issues);
  report.warnings = uniqueStrings(report.warnings);
  report.repairs = uniqueStrings(report.repairs);
  report.reportPath = writeDiagnosticsReport(report);
  logger.info('Launcher diagnostics completed', {
    issues: report.issues.length,
    warnings: report.warnings.length,
    repairs: report.repairs.length,
    reportPath: report.reportPath
  });
  return report;
}

function analyzeMinecraftCrashReports(minecraftDir, modContext = getActiveModContext()) {
  const newestCrashReportPath = getNewestCrashReportPath(minecraftDir);
  const latestLogPath = path.join(minecraftDir, 'logs', 'latest.log');
  const lastLaunchLogPath = path.join(CONFIG_DIR, 'last-launch.log');
  const sourcePath = newestCrashReportPath || (fs.existsSync(latestLogPath) ? latestLogPath : lastLaunchLogPath);
  const content = readTextTail(sourcePath, 220000);
  const findings = [];

  const addFinding = (id, severity, title, message, evidence = '') => {
    if (findings.some((finding) => finding.id === id)) {
      return;
    }
    findings.push({
      id,
      severity,
      title,
      message,
      evidence: String(evidence || '').replace(/\s+/gu, ' ').trim().slice(0, 500)
    });
  };

  if (!content) {
    return {
      found: false,
      sourcePath: '',
      sourceName: '',
      findings: []
    };
  }

  const lowerContent = content.toLowerCase();
  const suspectText = extractSuspectLaunchDiagnosticText(content);
  const sourceName = path.basename(sourcePath);

  if (/unsupportedclassversionerror|has been compiled by a more recent version of the java runtime/iu.test(content)) {
    addFinding(
      'java-version',
      'error',
      'Falsche Java-Version',
      'Minecraft oder eine Mod braucht eine neuere Java-Version. Prüfe Java in den Einstellungen und nutze für aktuelle Versionen Java 21.',
      getFirstMatchingLine(content, /unsupportedclassversionerror|more recent version of the java runtime/iu)
    );
  }

  if (/mod resolution failed|depends on|requires|missing.*dependenc|could not find required mod/iu.test(content)) {
    addFinding(
      'missing-dependency',
      'error',
      'Fehlende Mod-Abhängigkeit',
      'Mindestens eine Mod braucht eine weitere Mod oder eine andere Version. Nutze im Mods-Tab "Alle prüfen", damit verwaltete Modrinth-Mods neu aufgelöst werden.',
      getFirstMatchingLine(content, /mod resolution failed|depends on|requires|missing.*dependenc|could not find required mod/iu)
    );
  }

  if (/incompatible mod|incompatible mods|breaks with|conflict|conflicting/iu.test(content)) {
    addFinding(
      'mod-conflict',
      'error',
      'Mod-Konflikt',
      'Zwei oder mehr Mods sind wahrscheinlich nicht kompatibel. Entferne zuletzt installierte Mods oder lasse den Launcher die Modliste prüfen.',
      getFirstMatchingLine(content, /incompatible mod|incompatible mods|breaks with|conflict|conflicting/iu)
    );
  }

  if (/mixin apply failed|mixin transformation|mixin config|injection failure/iu.test(content)) {
    addFinding(
      'mixin',
      'error',
      'Mixin-Fehler',
      'Eine Mod patcht Minecraft-Code an einer Stelle, die nicht zur installierten Version passt. Aktualisiere oder entferne die genannte Mod.',
      getFirstMatchingLine(content, /mixin apply failed|mixin transformation|mixin config|injection failure/iu)
    );
  }

  if (/failed to load pack|pack\.mcmeta|resource\s*pack|incompatibleresourcepacks/iu.test(content)) {
    addFinding(
      'resourcepack',
      'warning',
      'Ressourcenpack-Problem',
      'Ein Ressourcenpaket ist beschädigt oder nicht passend. Entferne es im Mods-Tab oder leere die Ressourcenpack-Auswahl in Minecraft.',
      getFirstMatchingLine(content, /failed to load pack|pack\.mcmeta|resource\s*pack|incompatibleresourcepacks/iu)
    );
  }

  if (/shader|opengl|glfw|could not create window|failed to create window/iu.test(content)) {
    addFinding(
      'shader-render',
      'warning',
      'Shader/Grafik-Problem',
      'Ein Shader oder Grafiktreiber kann den Start blockieren. Starte testweise ohne Shader und prüfe den shaderpacks-Ordner.',
      getFirstMatchingLine(content, /shader|opengl|glfw|could not create window|failed to create window/iu)
    );
  }

  const suspectMods = getCrashSuspectMods(modContext, suspectText || lowerContent);
  if (suspectMods.length) {
    addFinding(
      'suspect-mods',
      'warning',
      'Verdächtige Mods',
      `Im Log tauchen diese Mods in Fehlernähe auf: ${suspectMods.slice(0, 5).join(', ')}.`,
      suspectMods.join(', ')
    );
  }

  if (!findings.length) {
    addFinding(
      'unknown',
      'warning',
      'Crash gefunden',
      'Es wurde ein Crashreport gefunden, aber kein bekanntes Muster erkannt. Öffne den Diagnose-Ordner und prüfe den Report manuell.',
      getFirstMatchingLine(content, /exception|error|crash|failed/iu)
    );
  }

  return {
    found: true,
    sourcePath,
    sourceName,
    generatedAt: new Date().toISOString(),
    findings
  };
}

function getFirstMatchingLine(text, pattern) {
  return String(text || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => pattern.test(line)) || '';
}

function getCrashSuspectMods(modContext, diagnosticsText) {
  if (!diagnosticsText || !fs.existsSync(modContext.modsDir)) {
    return [];
  }

  const candidates = getLaunchRepairModCandidates(modContext);
  const suspects = [];
  for (const candidate of candidates) {
    const matched = candidate.terms.some((term) => getSuspectTermEvidence(term, diagnosticsText));
    if (matched) {
      suspects.push(candidate.title);
    }
  }
  return uniqueStrings(suspects);
}

function writeDiagnosticsReport(report) {
  ensureDir(DIAGNOSTICS_DIR);
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(DIAGNOSTICS_DIR, `diagnostics-${safeTimestamp}.json`);
  const reportWithPath = {
    ...report,
    reportPath
  };
  ROBUSTNESS.writeJsonFileAtomic(reportPath, reportWithPath, {
    label: 'diagnostics-report',
    backup: false,
    metadata: { operation: 'writeDiagnosticsReport' }
  });
  ROBUSTNESS.writeJsonFileAtomic(path.join(DIAGNOSTICS_DIR, 'latest-diagnostics.json'), reportWithPath, {
    label: 'latest-diagnostics-report',
    backup: false,
    metadata: { operation: 'writeDiagnosticsReport' }
  });
  return reportPath;
}

function parseFabricVersionId(versionId) {
  const normalizedVersionId = String(versionId || '').trim();
  const match = normalizedVersionId.match(/^fabric-loader-([^-]+)-(.+)$/u);
  if (!match) {
    return null;
  }

  return {
    id: normalizedVersionId,
    loaderVersion: match[1],
    minecraftVersion: match[2]
  };
}

function isFabricVersionId(versionId) {
  return Boolean(parseFabricVersionId(versionId));
}

function getFabricLoaderVersion(versionId) {
  return parseFabricVersionId(versionId)?.loaderVersion || '';
}

function getMinecraftVersionName(versionId, versionData = null) {
  const inheritedVersion = String(versionData?.inheritsFrom || '').trim();
  if (inheritedVersion) {
    return inheritedVersion;
  }

  return parseFabricVersionId(versionId)?.minecraftVersion || String(versionId || '').trim();
}

function isLikelyMinecraftVersionName(versionName) {
  const normalizedVersionName = String(versionName || '').trim();
  return /^1\.\d+(?:\.\d+){0,2}$/u.test(normalizedVersionName)
    || /^\d{2}w\d{2}[a-z]$/iu.test(normalizedVersionName);
}

function isFullMinecraftReleaseName(versionName) {
  return /^\d+(?:\.\d+){1,3}$/u.test(String(versionName || '').trim());
}

function isFullFabricReleaseVersionId(versionId) {
  const fabricVersion = parseFabricVersionId(versionId);
  return Boolean(fabricVersion && isFullMinecraftReleaseName(fabricVersion.minecraftVersion));
}

function isSupportedMinecraftVersion(minecraftVersion) {
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  if (!normalizedMinecraftVersion) {
    return false;
  }

  return SUPPORTED_MINECRAFT_VERSION_SET.has(normalizedMinecraftVersion)
    || (isFullMinecraftReleaseName(normalizedMinecraftVersion)
      && compareMinecraftVersionNames(normalizedMinecraftVersion, STANDARD_MIN_MINECRAFT_VERSION) >= 0);
}

function isProfileMinecraftVersion(minecraftVersion) {
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  return isFullMinecraftReleaseName(normalizedMinecraftVersion)
    && compareVersionStrings(normalizedMinecraftVersion, PROFILE_MIN_MINECRAFT_VERSION) >= 0;
}

function isSupportedFabricVersionAllowed(versionId) {
  const fabricVersion = parseFabricVersionId(versionId);
  return Boolean(fabricVersion && isSupportedMinecraftVersion(fabricVersion.minecraftVersion));
}

function isProfileFabricVersionAllowed(versionId) {
  const fabricVersion = parseFabricVersionId(versionId);
  return Boolean(fabricVersion && isProfileMinecraftVersion(fabricVersion.minecraftVersion));
}

function getSupportedMinecraftVersionsLabel() {
  return STANDARD_SUPPORTED_MINECRAFT_VERSIONS_LABEL;
}

function getSupportedMinecraftVersionsError() {
  return `Dieser Launcher unterstützt Minecraft ${getSupportedMinecraftVersionsLabel()}.`;
}

function getProfileMinecraftVersionsError() {
  return `Profile unterstützen Fabric-Versionen ab Minecraft ${PROFILE_MIN_MINECRAFT_VERSION}.`;
}

function isFabricApiHiddenForMinecraftVersion(minecraftVersion) {
  return HIDDEN_FABRIC_API_MINECRAFT_VERSIONS.has(String(minecraftVersion || '').trim());
}

function isManagedProjectHiddenForMinecraftVersion(projectId, minecraftVersion) {
  const normalizedProjectId = String(projectId || '').trim();
  return normalizedProjectId === FABRIC_API_PROJECT_ID && isFabricApiHiddenForMinecraftVersion(minecraftVersion);
}

function isPreferredFabricEntry(candidate, current, selectedVersionId) {
  if (candidate.id === selectedVersionId && current.id !== selectedVersionId) {
    return true;
  }
  if (current.id === selectedVersionId && candidate.id !== selectedVersionId) {
    return false;
  }
  return getVersionTimestamp(candidate.releaseTime) > getVersionTimestamp(current.releaseTime);
}

function getVersionTimestamp(releaseTime) {
  const timestamp = new Date(releaseTime || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildMinecraftReleaseMetaByVersion(manifest) {
  const releaseEntries = (manifest?.versions || [])
    .filter((entry) => entry?.type === 'release' && isFullMinecraftReleaseName(entry.id));
  return new Map(releaseEntries.map((entry, index) => [
    String(entry.id || '').trim(),
    {
      releaseTime: String(entry.releaseTime || '').trim(),
      releaseOrder: index
    }
  ]));
}

async function fetchMinecraftReleaseMetaByVersion() {
  return buildMinecraftReleaseMetaByVersion(await fetchJson(VERSION_MANIFEST_URL, { allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS }));
}

function getReleaseOrderValue(versionEntry) {
  const releaseOrder = Number(versionEntry?.releaseOrder);
  return Number.isFinite(releaseOrder) ? releaseOrder : Number.MAX_SAFE_INTEGER;
}

function compareAvailableFabricVersions(left, right) {
  const releaseOrderDiff = getReleaseOrderValue(left) - getReleaseOrderValue(right);
  if (releaseOrderDiff) {
    return releaseOrderDiff;
  }

  const releaseTimeDiff = getVersionTimestamp(right?.releaseTime) - getVersionTimestamp(left?.releaseTime);
  if (releaseTimeDiff) {
    return releaseTimeDiff;
  }

  const versionDiff = compareMinecraftVersionNames(
    right?.minecraftVersion || getMinecraftVersionName(right?.id),
    left?.minecraftVersion || getMinecraftVersionName(left?.id)
  );
  if (versionDiff) {
    return versionDiff;
  }

  return String(left?.id || '').localeCompare(String(right?.id || ''), 'de', {
    numeric: true,
    sensitivity: 'base'
  });
}

function getMinecraftVersionSortParts(versionName) {
  const numericParts = String(versionName || '')
    .trim()
    .split(/[^0-9]+/u)
    .filter(Boolean)
    .map((part) => Number(part));
  return numericParts.filter((part) => Number.isFinite(part));
}

function compareMinecraftVersionNames(leftVersion, rightVersion) {
  const leftParts = getMinecraftVersionSortParts(leftVersion);
  const rightParts = getMinecraftVersionSortParts(rightVersion);
  const partCount = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < partCount; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff) {
      return diff;
    }
  }

  return String(leftVersion || '').localeCompare(String(rightVersion || ''), 'de', {
    numeric: true,
    sensitivity: 'base'
  });
}

function resolveAvailableVersionSelection(requestedVersionId, versions) {
  const normalizedRequestedVersionId = String(requestedVersionId || '').trim();
  if (versions.some((version) => version.id === normalizedRequestedVersionId)) {
    return normalizedRequestedVersionId;
  }

  const requestedMinecraftVersion = getMinecraftVersionName(normalizedRequestedVersionId);
  if (requestedMinecraftVersion) {
    const sameMinecraftVersion = versions.find((version) => version.minecraftVersion === requestedMinecraftVersion);
    if (sameMinecraftVersion) {
      return sameMinecraftVersion.id;
    }
  }

  return versions.find((version) => version.installed)?.id || versions[0]?.id || '';
}

function getPreferredLocalFabricVersion(preferredVersionId = '') {
  const localFabricVersions = readAllLocalVersions()
    .filter((version) => isFullFabricReleaseVersionId(version.id))
    .sort((a, b) => getVersionTimestamp(b.data.releaseTime || b.data.time) - getVersionTimestamp(a.data.releaseTime || a.data.time));

  if (localFabricVersions.length === 0) {
    return null;
  }

  const exactMatch = localFabricVersions.find((version) => version.id === preferredVersionId);
  if (exactMatch) {
    return exactMatch;
  }

  const preferredMinecraftVersion = getMinecraftVersionName(preferredVersionId);
  if (preferredMinecraftVersion) {
    const sameMinecraftVersion = localFabricVersions.find((version) => getMinecraftVersionName(version.id, version.data) === preferredMinecraftVersion);
    if (sameMinecraftVersion) {
      return sameMinecraftVersion;
    }
  }

  return localFabricVersions[0];
}

function normalizeFabricReleaseLimit(limit) {
  const parsedLimit = Number(limit);
  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    return FABRIC_RELEASE_LIMIT;
  }

  return Math.max(1, Math.floor(parsedLimit));
}

async function getRemoteFabricVersions(options = {}) {
  const releaseLimit = normalizeFabricReleaseLimit(options.limit);
  let releaseMetaByVersion = options.releaseMetaByVersion instanceof Map
    ? options.releaseMetaByVersion
    : null;
  const fabricGameVersions = await fetchJson(FABRIC_GAME_VERSIONS_URL, { allowedHosts: TRUSTED_FABRIC_META_HOSTS });
  if (!releaseMetaByVersion || releaseMetaByVersion.size === 0) {
    releaseMetaByVersion = await fetchMinecraftReleaseMetaByVersion();
  }

  const stableFabricVersions = (fabricGameVersions || [])
    .filter((entry) => entry.stable
      && releaseMetaByVersion.has(entry.version)
      && isFullMinecraftReleaseName(entry.version)
      && isProfileMinecraftVersion(entry.version))
    .sort((left, right) => getReleaseOrderValue(releaseMetaByVersion.get(left.version)) - getReleaseOrderValue(releaseMetaByVersion.get(right.version)))
    .slice(0, releaseLimit);

  const fabricEntries = await Promise.all(stableFabricVersions.map(async (entry) => {
    try {
      const loaders = await fetchJson(`${FABRIC_LOADER_VERSIONS_URL}/${encodeURIComponent(entry.version)}`, { allowedHosts: TRUSTED_FABRIC_META_HOSTS });
      const selectedLoader = (loaders || []).find((loaderEntry) => loaderEntry.loader?.stable) || loaders[0];
      if (!selectedLoader?.loader?.version) {
        return null;
      }

      const releaseMeta = releaseMetaByVersion.get(entry.version) || {};
      return {
        id: `fabric-loader-${selectedLoader.loader.version}-${entry.version}`,
        name: entry.version,
        minecraftVersion: entry.version,
        loaderVersion: selectedLoader.loader.version,
        type: 'fabric',
        releaseTime: releaseMeta?.releaseTime || '',
        releaseOrder: Number.isFinite(releaseMeta.releaseOrder) ? releaseMeta.releaseOrder : Number.MAX_SAFE_INTEGER,
        installed: false,
        source: 'remote',
        inheritsFrom: entry.version,
        javaMajorVersion: null
      };
    } catch (_error) {
      return null;
    }
  }));

  return fabricEntries.filter(Boolean);
}

async function fetchFabricProfileVersionData(minecraftVersion, loaderVersion) {
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  const normalizedLoaderVersion = String(loaderVersion || '').trim();
  if (!normalizedMinecraftVersion || !normalizedLoaderVersion) {
    throw new Error('Fabric-Version konnte nicht aufgelöst werden.');
  }

  const profileUrl = `${FABRIC_LOADER_VERSIONS_URL}/${encodeURIComponent(normalizedMinecraftVersion)}/${encodeURIComponent(normalizedLoaderVersion)}/profile/json`;
  return fetchJson(profileUrl, { allowedHosts: TRUSTED_FABRIC_META_HOSTS });
}

async function prepareVersion(versionId, versionData, options = {}) {
  const forceRefresh = Boolean(options.forceRefresh);
  const mergedData = sanitizeVersionData(await mergeInheritedVersion(versionData));
  const versionDir = path.join(DEFAULT_MINECRAFT_DIR, 'versions', versionId);
  const versionJsonPath = path.join(versionDir, `${versionId}.json`);
  const nativesDir = path.join(versionDir, 'natives');

  ensureDir(versionDir);
  ensureDir(nativesDir);
  if (forceRefresh || !readLocalVersion(versionId)) {
    fs.writeFileSync(versionJsonPath, JSON.stringify(mergedData, null, 2), 'utf8');
  }

  // A normal launch should not hash every library and every asset again. That can
  // mean reading several gigabytes from disk before Java is even spawned. The
  // complete preparation below still performs the integrity checks on installs
  // and repairs; this fast path only accepts a locally complete runtime layout.
  if (!forceRefresh && isPreparedVersionReusable(versionId, mergedData, nativesDir)) {
    return {
      id: versionId,
      data: mergedData,
      nativesDir,
      loggingConfigPath: getExistingLoggingConfigurationPath(mergedData)
    };
  }

  const loggingConfigPath = await prepareLoggingConfiguration(mergedData, { force: forceRefresh });

  await ensureVersionJarFiles(versionId, versionData, mergedData, new Set(), { force: forceRefresh });
  await installLibraries(mergedData, nativesDir, { force: forceRefresh });
  await downloadAssets(mergedData.assetIndex, { forceIndex: forceRefresh });

  return {
    id: versionId,
    data: mergedData,
    nativesDir,
    loggingConfigPath
  };
}

function getExistingLoggingConfigurationPath(versionData) {
  const fileId = String(versionData?.logging?.client?.file?.id || '').trim();
  if (!fileId) {
    return '';
  }
  return path.join(DEFAULT_MINECRAFT_DIR, 'assets', 'log_configs', fileId);
}

function isPreparedVersionReusable(versionId, versionData, nativesDir) {
  try {
    const classpathEntries = buildClasspath(versionId, versionData)
      .split(path.delimiter)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    if (!classpathEntries.length || classpathEntries.some((entry) => !fs.existsSync(entry))) {
      return false;
    }

    const assetIndexId = String(versionData?.assetIndex?.id || '').trim();
    if (assetIndexId) {
      const assetIndexPath = path.join(DEFAULT_MINECRAFT_DIR, 'assets', 'indexes', `${assetIndexId}.json`);
      if (!isAssetIndexComplete(assetIndexPath)) {
        return false;
      }
    }

    const loggingConfigPath = getExistingLoggingConfigurationPath(versionData);
    if (loggingConfigPath && !fs.existsSync(loggingConfigPath)) {
      return false;
    }

    const needsNatives = (versionData.libraries || []).some((library) => (
      isLibraryAllowed(library.rules) && Boolean(resolveNativeDownload(library))
    ));
    if (needsNatives && (!fs.existsSync(nativesDir) || fs.readdirSync(nativesDir).length === 0)) {
      return false;
    }

    return true;
  } catch (_error) {
    return false;
  }
}

function isAssetIndexComplete(assetIndexPath) {
  if (!fs.existsSync(assetIndexPath)) {
    return false;
  }

  try {
    const indexData = JSON.parse(fs.readFileSync(assetIndexPath, 'utf8'));
    for (const asset of Object.values(indexData.objects || {})) {
      const hash = String(asset?.hash || '').trim();
      if (!/^[a-f0-9]{40}$/iu.test(hash)) {
        return false;
      }
      const objectPath = path.join(DEFAULT_MINECRAFT_DIR, 'assets', 'objects', hash.slice(0, 2), hash);
      if (!fs.existsSync(objectPath)) {
        return false;
      }
      const expectedSize = Number(asset.size || 0);
      if (expectedSize > 0 && fs.statSync(objectPath).size !== expectedSize) {
        return false;
      }
    }
    return true;
  } catch (_error) {
    return false;
  }
}

async function ensureVersionJarFiles(versionId, versionData, mergedData, visited = new Set(), options = {}) {
  const effectiveVersionId = String(versionId || versionData?.id || '').trim();
  if (!effectiveVersionId || visited.has(effectiveVersionId)) {
    return;
  }

  visited.add(effectiveVersionId);

  const versionDir = path.join(DEFAULT_MINECRAFT_DIR, 'versions', effectiveVersionId);
  const versionJarPath = path.join(versionDir, `${effectiveVersionId}.jar`);
  const clientDownload = versionData?.downloads?.client
    || (!versionData?.inheritsFrom ? mergedData?.downloads?.client : null);
  const clientDownloadUrl = clientDownload?.url || '';

  ensureDir(versionDir);

  if (clientDownloadUrl) {
    await downloadFile(clientDownloadUrl, versionJarPath, {
      expectedSha1: String(clientDownload?.sha1 || '').trim(),
      expectedSize: Number(clientDownload?.size || 0),
      force: Boolean(options.force),
      allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS
    });
  }

  const parentJarVersionId = getJarBaseVersionId(effectiveVersionId, versionData);
  if (!parentJarVersionId) {
    return;
  }

  const parentVersionData = await loadVersionData(parentJarVersionId);
  if (!parentVersionData) {
    throw new Error(`Basis-JAR für ${effectiveVersionId} wurde nicht gefunden.`);
  }

  await ensureVersionJarFiles(parentJarVersionId, parentVersionData, parentVersionData, visited, options);
}

async function mergeInheritedVersion(versionData) {
  const currentVersionData = sanitizeVersionData(versionData);
  if (!currentVersionData.inheritsFrom) {
    return currentVersionData;
  }

  const localParent = readLocalVersion(currentVersionData.inheritsFrom);
  if (localParent) {
    return mergeVersionData(await mergeInheritedVersion(localParent.data), currentVersionData);
  }

  const manifest = await fetchJson(VERSION_MANIFEST_URL, { allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS });
  const parentMeta = manifest.versions.find((entry) => entry.id === currentVersionData.inheritsFrom);
  if (!parentMeta) {
    throw new Error(`Basisversion ${currentVersionData.inheritsFrom} wurde nicht gefunden.`);
  }

  return mergeVersionData(await mergeInheritedVersion(await fetchJson(parentMeta.url, { allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS })), currentVersionData);
}

function mergeVersionData(parentVersionData, childVersionData) {
  const mergedParent = sanitizeVersionData(parentVersionData);
  const currentVersionData = sanitizeVersionData(childVersionData);

  return sanitizeVersionData({
    ...mergedParent,
    ...currentVersionData,
    libraries: dedupeLibraries([...(mergedParent.libraries || []), ...(currentVersionData.libraries || [])]),
    arguments: {
      ...(mergedParent.arguments || {}),
      ...(currentVersionData.arguments || {}),
      game: dedupeStructuredEntries([
        ...((mergedParent.arguments && mergedParent.arguments.game) || legacyArgumentsToArray(mergedParent.minecraftArguments)),
        ...((currentVersionData.arguments && currentVersionData.arguments.game) || [])
      ]),
      jvm: dedupeStructuredEntries([
        ...((mergedParent.arguments && mergedParent.arguments.jvm) || defaultJvmArguments()),
        ...((currentVersionData.arguments && currentVersionData.arguments.jvm) || [])
      ]),
      'default-user-jvm': dedupeStructuredEntries([
        ...((mergedParent.arguments && mergedParent.arguments['default-user-jvm']) || []),
        ...((currentVersionData.arguments && currentVersionData.arguments['default-user-jvm']) || [])
      ])
    }
  });
}

function sanitizeVersionData(versionData) {
  if (!versionData || typeof versionData !== 'object') {
    return versionData;
  }

  return {
    ...versionData,
    libraries: dedupeLibraries(versionData.libraries || []),
    arguments: versionData.arguments
      ? {
          ...versionData.arguments,
          game: dedupeStructuredEntries(versionData.arguments.game || []),
          jvm: dedupeStructuredEntries(versionData.arguments.jvm || []),
          'default-user-jvm': dedupeStructuredEntries(versionData.arguments['default-user-jvm'] || [])
        }
      : versionData.arguments
  };
}

function dedupeStructuredEntries(entries) {
  const seen = new Set();
  const result = [];

  for (const entry of entries || []) {
    const key = JSON.stringify(entry);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(entry);
  }

  return result;
}

function dedupeLibraries(libraries) {
  const seen = new Set();
  const result = [];

  for (const library of libraries || []) {
    const key = library?.downloads?.artifact?.path
      || library?.name
      || JSON.stringify(library);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(library);
  }

  return result;
}

function readLocalVersion(versionId) {
  const versionJsonPath = path.join(DEFAULT_MINECRAFT_DIR, 'versions', versionId, `${versionId}.json`);
  if (!fs.existsSync(versionJsonPath)) {
    return null;
  }

  try {
    const rawContent = fs.readFileSync(versionJsonPath, 'utf8');
    const sanitizedData = sanitizeVersionData(JSON.parse(rawContent));
    const normalizedContent = `${JSON.stringify(sanitizedData, null, 2)}\n`;
    if (normalizedContent !== rawContent) {
      fs.writeFileSync(versionJsonPath, normalizedContent, 'utf8');
    }

    return {
      id: versionId,
      data: sanitizedData
    };
  } catch (_error) {
    return null;
  }
}

function createOfficialLauncherImportedUser(loginInput) {
  const launcherAccount = readOfficialLauncherAccountProfile();
  if (!launcherAccount) {
    return null;
  }

  const email = typeof loginInput === 'string' && loginInput.includes('@') ? loginInput.trim() : null;
  return {
    username: launcherAccount.username,
    email,
    uuid: launcherAccount.uuid,
    loginTime: new Date().toISOString(),
    accessToken: 'offline-token',
    microsoftAccessToken: '',
    userType: 'launcher-import',
    loginSource: 'official-launcher'
  };
}

function shouldUseOfficialLauncherFallback(error) {
  const message = String(error?.message || '');
  return [
    'Microsoft Login ist noch nicht konfiguriert',
    'AADSTS700016',
    'AADSTS70002',
    'invalid_client',
    'unauthorized_client',
    'Public Client',
    'Mobile & Desktop Flow'
  ].some((fragment) => message.includes(fragment));
}

function readAllLocalVersions() {
  const versionsDir = path.join(DEFAULT_MINECRAFT_DIR, 'versions');
  if (!fs.existsSync(versionsDir)) {
    return [];
  }

  return fs.readdirSync(versionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readLocalVersion(entry.name))
    .filter(Boolean);
}

function getLocalPreferredVersion() {
  return getPreferredLocalFabricVersion();
}

function legacyArgumentsToArray(argumentString = '') {
  return argumentString.split(' ').filter(Boolean);
}

function defaultJvmArguments() {
  return [
    '-Djava.library.path=${natives_directory}',
    '-Dminecraft.launcher.brand=XLauncher',
    '-Dminecraft.launcher.version=1.0.0',
    '-cp',
    '${classpath}'
  ];
}

async function installLibraries(versionData, nativesDir, options = {}) {
  for (const library of versionData.libraries || []) {
    if (!isLibraryAllowed(library.rules)) {
      continue;
    }

    const artifactInfo = resolveLibraryArtifact(library);
    if (artifactInfo?.url && artifactInfo.path) {
      const artifactPath = path.join(DEFAULT_MINECRAFT_DIR, 'libraries', artifactInfo.path);
      await downloadFile(artifactInfo.url, artifactPath, {
        expectedSha1: String(artifactInfo.sha1 || '').trim(),
        expectedSize: Number(artifactInfo.size || 0),
        force: Boolean(options.force),
        allowedHosts: TRUSTED_LIBRARY_DOWNLOAD_HOSTS
      });
    }

    const nativeDownload = resolveNativeDownload(library);
    if (nativeDownload?.url && nativeDownload.path) {
      const archivePath = path.join(DEFAULT_MINECRAFT_DIR, 'libraries', nativeDownload.path);
      await downloadFile(nativeDownload.url, archivePath, {
        expectedSha1: String(nativeDownload.sha1 || '').trim(),
        expectedSize: Number(nativeDownload.size || 0),
        force: Boolean(options.force),
        allowedHosts: TRUSTED_LIBRARY_DOWNLOAD_HOSTS
      });
      await extractNativeArchive(archivePath, nativesDir, library.extract?.exclude || []);
    }
  }
}

async function downloadAssets(assetIndex, options = {}) {
  if (!assetIndex?.url) {
    return;
  }

  const assetIndexPath = path.join(DEFAULT_MINECRAFT_DIR, 'assets', 'indexes', `${assetIndex.id}.json`);
  await downloadFile(assetIndex.url, assetIndexPath, {
    expectedSha1: String(assetIndex.sha1 || '').trim(),
    expectedSize: Number(assetIndex.size || 0),
    force: Boolean(options.forceIndex),
    allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS
  });

  const indexData = JSON.parse(fs.readFileSync(assetIndexPath, 'utf8'));
  const assetsByHash = new Map();
  for (const asset of Object.values(indexData.objects || {})) {
    const hash = String(asset?.hash || '').trim();
    if (/^[a-f0-9]{40}$/iu.test(hash)) {
      assetsByHash.set(hash, asset);
    }
  }

  const pendingAssets = [...assetsByHash.entries()].filter(([hash, asset]) => {
    const objectPath = path.join(DEFAULT_MINECRAFT_DIR, 'assets', 'objects', hash.slice(0, 2), hash);
    if (!fs.existsSync(objectPath)) {
      return true;
    }
    const expectedSize = Number(asset.size || 0);
    return Boolean(options.forceObjects) || (expectedSize > 0 && fs.statSync(objectPath).size !== expectedSize);
  });
  let nextAssetIndex = 0;
  const worker = async () => {
    while (nextAssetIndex < pendingAssets.length) {
      const [hash, asset] = pendingAssets[nextAssetIndex++];
    const objectDir = path.join(DEFAULT_MINECRAFT_DIR, 'assets', 'objects', hash.slice(0, 2));
    const objectPath = path.join(objectDir, hash);
    const url = `https://resources.download.minecraft.net/${hash.slice(0, 2)}/${hash}`;
    await downloadFile(url, objectPath, {
      expectedSha1: hash,
      expectedSize: Number(asset.size || 0),
      force: Boolean(options.forceObjects),
      allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS
    });
    }
  };
  const concurrency = Math.min(16, Math.max(1, pendingAssets.length));
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

async function prepareLoggingConfiguration(versionData, options = {}) {
  if (!versionData.logging?.client?.file?.url || !versionData.logging.client.file.id) {
    return '';
  }

  const logConfigDir = path.join(DEFAULT_MINECRAFT_DIR, 'assets', 'log_configs');
  const logConfigPath = path.join(logConfigDir, versionData.logging.client.file.id);
  await downloadFile(versionData.logging.client.file.url, logConfigPath, {
    expectedSha1: String(versionData.logging.client.file.sha1 || '').trim(),
    expectedSize: Number(versionData.logging.client.file.size || 0),
    force: Boolean(options.force),
    allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS
  });
  return logConfigPath;
}

function isLibraryAllowed(rules = []) {
  if (!rules.length) {
    return true;
  }

  let allowed = false;
  for (const rule of rules) {
    const osNameMatches = !rule.os?.name || rule.os.name === getCurrentOsName();
    const osArchMatches = !rule.os?.arch || matchesOsArch(rule.os.arch);
    const osVersionMatches = !rule.os?.versionRange || matchesOsVersionRange(rule.os.versionRange);
    if (!osNameMatches || !osArchMatches || !osVersionMatches) {
      continue;
    }
    allowed = rule.action === 'allow';
  }
  return allowed;
}

function resolveNativeDownload(library) {
  const natives = library.natives;
  if (!natives) {
    return null;
  }

  const classifierKey = natives.windows || natives['windows-64'];
  if (!classifierKey) {
    return null;
  }

  return library.downloads?.classifiers?.[classifierKey] || null;
}

async function extractNativeArchive(archivePath, destinationDir, excludedPrefixes) {
  const fileBuffer = fs.readFileSync(archivePath);
  let offset = 0;

  while (offset < fileBuffer.length) {
    const signature = fileBuffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      break;
    }

    const compressionMethod = fileBuffer.readUInt16LE(offset + 8);
    const compressedSize = fileBuffer.readUInt32LE(offset + 18);
    const fileNameLength = fileBuffer.readUInt16LE(offset + 26);
    const extraLength = fileBuffer.readUInt16LE(offset + 28);
    const fileName = fileBuffer.slice(offset + 30, offset + 30 + fileNameLength).toString('utf8').replace(/\\/g, '/');
    const dataStart = offset + 30 + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const fileData = fileBuffer.slice(dataStart, dataEnd);

    const unsafeEntry = path.isAbsolute(fileName) || fileName.split('/').includes('..');
    const shouldSkip = unsafeEntry
      || fileName.endsWith('/')
      || excludedPrefixes.some((prefix) => fileName.startsWith(prefix));
    if (!shouldSkip) {
      const targetPath = path.join(destinationDir, fileName);
      if (!isPathInsideDirectory(destinationDir, targetPath)) {
        offset = dataEnd;
        continue;
      }
      ensureDir(path.dirname(targetPath));
      if (compressionMethod === 0) {
        fs.writeFileSync(targetPath, fileData);
      } else if (compressionMethod === 8) {
        fs.writeFileSync(targetPath, zlib.inflateRawSync(fileData));
      }
    }

    offset = dataEnd;
  }
}

function shouldRequireZipIntegrity(filePath) {
  return /\.(?:jar|zip)$/iu.test(String(filePath || '').trim());
}

function getDownloadIntegrityOptions(destinationPath, options = {}) {
  return {
    expectedSize: Number(options.expectedSize || 0),
    expectedSha1: String(options.expectedSha1 || '').trim(),
    expectedSha256: String(options.expectedSha256 || '').trim(),
    expectedSha512: String(options.expectedSha512 || '').trim(),
    expectedHashes: options.expectedHashes,
    requireZipEndRecord: options.requireZipEndRecord ?? shouldRequireZipIntegrity(destinationPath)
  };
}

function formatIntegrityIssues(integrity) {
  return (integrity?.issues || []).filter(Boolean).join(' ');
}

function shouldReuseDownloadedFile(destinationPath, options = {}) {
  if (!fs.existsSync(destinationPath)) {
    return false;
  }

  if (options.force) {
    return false;
  }

  const integrity = verifyFileIntegrity(destinationPath, getDownloadIntegrityOptions(destinationPath, options));
  if (!integrity.ok) {
    logger.warn('Existing download failed integrity check and will be repaired', {
      destinationPath,
      issues: integrity.issues
    });
    return false;
  }

  return true;
}

async function downloadFile(url, destinationPath, options = {}) {
  if (shouldReuseDownloadedFile(destinationPath, options)) {
    return;
  }

  ensureDir(path.dirname(destinationPath));
  const attempts = Math.max(1, Number(options.retries ?? 2) + 1);
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await downloadFileOnce(url, destinationPath, options);
      return;
    } catch (error) {
      lastError = error;
      logger.warn('Download attempt failed', {
        url,
        destinationPath,
        attempt,
        attempts,
        error: serializeError(error)
      });
      if (attempt >= attempts || !isRetryableDownloadError(error)) {
        break;
      }
      await delay((Number(options.retryDelayMs) || 750) * attempt);
    }
  }

  throw lastError || new Error(`Download fehlgeschlagen für ${url}`);
}

async function downloadFileOnce(url, destinationPath, options = {}, redirectCount = 0) {
  const allowedHosts = options.allowedHosts || null;
  if (allowedHosts) {
    assertTrustedHttpsUrl(url, allowedHosts);
  } else {
    assertTrustedHttpsUrl(url);
  }

  if (redirectCount > 5) {
    throw new Error(`Zu viele Weiterleitungen für ${url}`);
  }

  const tempPath = `${destinationPath}.download-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempPath, { flags: 'wx' });
    let settled = false;
    const cleanupAndReject = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      file.close(() => {
        fs.unlink(tempPath, () => reject(error));
      });
    };
    const request = https.get(url, {
      headers: options.headers || {},
      timeout: Math.max(1000, Number(options.timeoutMs) || 30000)
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = new URL(response.headers.location, url).toString();
        response.resume();
        file.close(() => {
          fs.unlink(tempPath, () => {
            downloadFileOnce(redirectUrl, destinationPath, options, redirectCount + 1).then(resolve).catch(reject);
          });
        });
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        const error = new Error(`Download fehlgeschlagen (${response.statusCode}) für ${url}`);
        error.statusCode = response.statusCode;
        cleanupAndReject(error);
        return;
      }

      let downloadedBytes = 0;
      const maxBytes = Number(options.maxBytes || 0);
      const declaredContentLength = Number(response.headers['content-length'] || 0);
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (maxBytes > 0 && downloadedBytes > maxBytes) {
          request.destroy(new Error(`Download überschreitet die maximale Größe für ${path.basename(destinationPath)}.`));
        }
      });
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          if (settled) {
            return;
          }
          const expectedSize = Number(options.expectedSize || 0);
          const requiredSize = expectedSize > 0 ? expectedSize : declaredContentLength;
          if (requiredSize > 0 && downloadedBytes !== requiredSize) {
            settled = true;
            const error = new Error(`Download unvollständig für ${path.basename(destinationPath)}: erwartet ${requiredSize} Bytes, erhalten ${downloadedBytes}.`);
            fs.unlink(tempPath, () => reject(error));
            return;
          }
          settled = true;
          resolve();
        });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error(`Download-Timeout nach ${Number(options.timeoutMs) || 30000}ms für ${url}`));
    });
    request.on('error', cleanupAndReject);
    file.on('error', cleanupAndReject);
  });

  const integrity = verifyFileIntegrity(tempPath, getDownloadIntegrityOptions(destinationPath, options));
  if (!integrity.ok) {
    try {
      fs.unlinkSync(tempPath);
    } catch (_error) {
      // ignore cleanup failure before surfacing the integrity error
    }
    throw new Error(`Download-Integrität fehlgeschlagen für ${path.basename(destinationPath)}: ${formatIntegrityIssues(integrity)}`);
  }

  if (fs.existsSync(destinationPath)) {
    if (options.backupExisting) {
      try {
        ROBUSTNESS.createFileBackup(destinationPath, 'before-download-replace', {
          url,
          expectedSha1: String(options.expectedSha1 || '').trim().toLowerCase(),
          expectedSha512: String(options.expectedSha512 || '').trim().toLowerCase(),
          expectedSize: Number(options.expectedSize || 0)
        });
      } catch (backupError) {
        logger.warn('Could not backup existing download target', {
          destinationPath,
          error: serializeError(backupError)
        });
      }
    }
    fs.unlinkSync(destinationPath);
  }
  fs.renameSync(tempPath, destinationPath);
}

function isRetryableDownloadError(error) {
  if (isRetryableHttpStatus(error?.statusCode)) {
    return true;
  }

  const message = String(error?.message || '').toLowerCase();
  return message.includes('timeout')
    || message.includes('econnreset')
    || message.includes('etimedout')
    || message.includes('enotfound')
    || message.includes('eai_again')
    || message.includes('socket')
    || message.includes('network');
}

function buildClasspath(versionId, versionData) {
  const entries = [];
  for (const library of versionData.libraries || []) {
    if (!isLibraryAllowed(library.rules)) {
      continue;
    }
    const artifactInfo = resolveLibraryArtifact(library);
    if (artifactInfo?.path) {
      entries.push(path.join(DEFAULT_MINECRAFT_DIR, 'libraries', artifactInfo.path));
    }
  }
  entries.push(...collectVersionJarPaths(versionId, versionData));
  return Array.from(new Set(entries)).join(';');
}

function collectVersionJarPaths(versionId, versionData, visited = new Set()) {
  const effectiveVersionId = String(versionId || versionData?.id || '').trim();
  if (!effectiveVersionId || visited.has(effectiveVersionId)) {
    return [];
  }

  visited.add(effectiveVersionId);

  const entries = [];
  const versionJarPath = path.join(DEFAULT_MINECRAFT_DIR, 'versions', effectiveVersionId, `${effectiveVersionId}.jar`);
  if (fs.existsSync(versionJarPath)) {
    entries.push(versionJarPath);
  }

  const parentJarVersionId = getJarBaseVersionId(effectiveVersionId, versionData);
  if (!parentJarVersionId) {
    return entries;
  }

  const parentVersion = readLocalVersion(parentJarVersionId);
  if (parentVersion) {
    entries.push(...collectVersionJarPaths(parentJarVersionId, parentVersion.data, visited));
    return entries;
  }

  const parentJarPath = path.join(DEFAULT_MINECRAFT_DIR, 'versions', parentJarVersionId, `${parentJarVersionId}.jar`);
  if (fs.existsSync(parentJarPath)) {
    entries.push(parentJarPath);
  }

  return entries;
}

function getJarBaseVersionId(versionId, versionData) {
  const jarVersionId = String(versionData?.jar || '').trim();
  if (jarVersionId && jarVersionId !== versionId) {
    return jarVersionId;
  }

  const inheritedVersionId = String(versionData?.inheritsFrom || '').trim();
  if (inheritedVersionId && inheritedVersionId !== versionId) {
    return inheritedVersionId;
  }

  return '';
}

async function loadVersionData(versionId) {
  const localVersion = readLocalVersion(versionId);
  if (localVersion) {
    return localVersion.data;
  }

  const manifest = await fetchJson(VERSION_MANIFEST_URL, { allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS });
  const versionMeta = (manifest.versions || []).find((entry) => entry.id === versionId);
  if (!versionMeta) {
    return null;
  }

  return fetchJson(versionMeta.url, { allowedHosts: TRUSTED_MOJANG_DOWNLOAD_HOSTS });
}

function resolveLibraryArtifact(library) {
  if (library.downloads?.artifact?.path) {
    return library.downloads.artifact;
  }

  if (!library.name || !library.url) {
    return null;
  }

  const pathFromName = getLibraryPathFromName(library.name);
  if (!pathFromName) {
    return null;
  }

  return {
    path: pathFromName,
    url: new URL(pathFromName, ensureTrailingSlash(library.url)).toString()
  };
}

function getLibraryPathFromName(libraryName) {
  const parts = libraryName.split(':');
  if (parts.length < 3) {
    return null;
  }

  const [group, artifact, version, classifier] = parts;
  const groupPath = group.replace(/\./g, '/');
  const fileName = classifier
    ? `${artifact}-${version}-${classifier}.jar`
    : `${artifact}-${version}.jar`;

  return `${groupPath}/${artifact}/${version}/${fileName}`;
}

function ensureTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function getComparablePath(filePath) {
  const resolvedPath = path.resolve(String(filePath || ''));
  return process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;
}

function getDirectoryMtimeMs(directoryPath) {
  try {
    return fs.statSync(directoryPath).mtimeMs;
  } catch (_error) {
    return 0;
  }
}

function moveDirectorySync(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  if (!fs.statSync(sourcePath).isDirectory()) {
    throw new Error(`Quelle ist kein Ordner: ${sourcePath}`);
  }

  if (fs.existsSync(targetPath)) {
    throw new Error(`Zielordner existiert bereits: ${targetPath}`);
  }

  if (isPathInsideDirectory(sourcePath, targetPath)) {
    throw new Error(`Zielordner liegt innerhalb der Quelle: ${targetPath}`);
  }

  ensureDir(path.dirname(targetPath));
  try {
    fs.renameSync(sourcePath, targetPath);
  } catch (error) {
    if (error?.code !== 'EXDEV') {
      throw error;
    }

    fs.cpSync(sourcePath, targetPath, {
      recursive: true,
      errorOnExist: true,
      force: false
    });
    fs.rmSync(sourcePath, { recursive: true, force: true });
  }

  return targetPath;
}

function getWindowsPowerShellPath() {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const bundledPowerShellPath = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return fs.existsSync(bundledPowerShellPath) ? bundledPowerShellPath : 'powershell.exe';
}

function startMinecraftWindowTitleSync(processId, title, launchLogPath) {
  const windowTitle = normalizeMinecraftWindowTitle(title);
  if (process.platform !== 'win32' || !processId || !windowTitle) {
    return;
  }

  const script = `
$targetPid = [int]$env:X_MINECRAFT_WINDOW_PID
$windowTitle = [string]$env:X_MINECRAFT_WINDOW_TITLE
if (-not $targetPid -or -not $windowTitle) { exit 0 }
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class XLauncherWindowTitle {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool SetWindowText(IntPtr hWnd, string text);
}
"@
while ($true) {
  $process = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
  if (-not $process) { break }
  [XLauncherWindowTitle]::EnumWindows({
    param([IntPtr]$handle, [IntPtr]$param)
    [uint32]$windowPid = 0
    [void][XLauncherWindowTitle]::GetWindowThreadProcessId($handle, [ref]$windowPid)
    if ($windowPid -eq $targetPid -and [XLauncherWindowTitle]::IsWindowVisible($handle)) {
      [void][XLauncherWindowTitle]::SetWindowText($handle, $windowTitle)
    }
    return $true
  }, [IntPtr]::Zero) | Out-Null
  Start-Sleep -Milliseconds 1000
}
`;

  try {
    const helper = spawn(
      getWindowsPowerShellPath(),
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: {
          ...process.env,
          X_MINECRAFT_WINDOW_PID: String(processId),
          X_MINECRAFT_WINDOW_TITLE: windowTitle
        }
      }
    );
    helper.unref();
  } catch (error) {
    try {
      fs.appendFileSync(launchLogPath, `\nFenstertitel-Helfer konnte nicht gestartet werden: ${error.message}\n`, 'utf8');
    } catch (_logError) {
      // Launch logging is best-effort only.
    }
  }
}

function getMinecraftRuntimeStatus() {
  if (activeMinecraftProcess && activeMinecraftProcess.exitCode === null && !activeMinecraftProcess.killed) {
    return { state: 'running', running: true, launching: false, pid: activeMinecraftProcess.pid || 0, source: 'launcher' };
  }

  if (minecraftLaunchReserved) {
    return { state: 'launching', running: false, launching: true, pid: 0, source: 'launcher' };
  }

  if (process.platform !== 'win32') {
    return { state: 'idle', running: false, launching: false, pid: 0, source: '' };
  }

  try {
    const script = [
      "$process = Get-CimInstance Win32_Process -Filter \"Name='java.exe' OR Name='javaw.exe'\" |",
      "Where-Object { $_.CommandLine -match 'net\\.minecraft\\.client\\.main\\.Main|minecraft-launcher.*-launch\\.args' } |",
      'Select-Object -First 1 ProcessId;',
      'if ($process) { [Console]::Out.Write($process.ProcessId) }'
    ].join(' ');
    const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 4000
    }).trim();
    const pid = Number(output);
    if (Number.isInteger(pid) && pid > 0) {
      return { state: 'running', running: true, launching: false, pid, source: 'system' };
    }
  } catch (error) {
    logger.warn('Minecraft process detection failed', { error: serializeError(error) });
  }

  return { state: 'idle', running: false, launching: false, pid: 0, source: '' };
}

async function startMinecraftProcess({ javaPath, versionId, versionData, minecraftDir, gameDir = '', modsDir, profile, nativesDir, launchTitle = '', launchServer = null, activeSkinLaunchConfig = null, sourceWindow = null }) {
  sendMinecraftLaunchProgress(sourceWindow, 82, 'Java-Prozess wird gestartet');
  const classpath = buildClasspath(versionId, versionData);
  const gameAssetsDir = path.join(minecraftDir, 'assets');
  const resolvedGameDir = String(gameDir || minecraftDir).trim() || minecraftDir;
  const defaultModsDir = path.join(resolvedGameDir, 'mods');
  const resolvedModsDir = String(modsDir || defaultModsDir).trim() || defaultModsDir;
  const useExternalModsDir = getComparablePath(defaultModsDir) !== getComparablePath(resolvedModsDir);
  const launchLogPath = path.join(CONFIG_DIR, 'last-launch.log');
  const minecraftWindowTitle = normalizeMinecraftWindowTitle(launchTitle) || versionId;
  const quickPlayMultiplayer = launchServer?.host
    ? `${String(launchServer.host)}:${normalizeServerPort(launchServer.port)}`
    : '';
  const quickPlayPath = quickPlayMultiplayer ? createQuickPlayPath(launchServer) : '';
  const argumentFeatures = {
    has_custom_resolution: false,
    has_quick_plays_support: Boolean(quickPlayMultiplayer),
    is_demo_user: false,
    is_quick_play_multiplayer: Boolean(quickPlayMultiplayer),
    is_quick_play_realms: false,
    is_quick_play_singleplayer: false
  };
  const placeholderValues = {
    '${auth_player_name}': profile.username,
    '${version_name}': minecraftWindowTitle,
    '${game_directory}': resolvedGameDir,
    '${assets_root}': gameAssetsDir,
    '${assets_index_name}': versionData.assetIndex.id,
    '${auth_uuid}': profile.uuid,
    '${auth_access_token}': profile.accessToken,
    '${clientid}': '0',
    '${auth_xuid}': '0',
    '${user_type}': profile.userType || 'msa',
    '${version_type}': versionData.type || 'release',
    '${natives_directory}': nativesDir,
    '${launcher_name}': 'XLauncher',
    '${launcher_version}': '1.0.0',
    '${classpath}': classpath,
    '${user_properties}': '{}',
    '${library_directory}': path.join(DEFAULT_MINECRAFT_DIR, 'libraries'),
    '${classpath_separator}': ';',
    '${quickPlayPath}': quickPlayPath,
    '${quickPlayMultiplayer}': quickPlayMultiplayer,
    '${quickPlaySingleplayer}': '',
    '${quickPlayRealms}': '',
    '${path}': versionData.loggingConfigPath || ''
  };

  if (useExternalModsDir) {
    ensureDir(resolvedModsDir);
  }

  ensureDir(resolvedGameDir);
  const activeSkinJvmArgs = activeSkinLaunchConfig?.path
    ? [
        `-Dxlauncher.skin.path=${activeSkinLaunchConfig.path}`,
        `-Dxlauncher.skin.id=${activeSkinLaunchConfig.id || 'active'}`,
        `-Dxlauncher.skin.name=${activeSkinLaunchConfig.name || 'Skin'}`,
        `-Dxlauncher.skin.model=${activeSkinLaunchConfig.model === 'slim' ? 'slim' : 'classic'}`
      ]
    : [];
  const jvmArgSource = [
    ...(useExternalModsDir ? [`-Dfabric.addMods=${resolvedModsDir}`] : []),
    `-Dxclient.accountUuid=${normalizeMinecraftUuid(profile.uuid)}`,
    ...activeSkinJvmArgs,
    ...((versionData.arguments && versionData.arguments['default-user-jvm']) || []),
    ...((versionData.arguments && versionData.arguments.jvm) || defaultJvmArguments())
  ].filter((argument) => {
    const value = typeof argument === 'string' ? argument.trim() : '';
    return value !== '-XX:+AlwaysPreTouch' && !value.startsWith('-Xms');
  });

  const jvmArgs = normalizeArguments(jvmArgSource, placeholderValues);
    const loggingArgs = normalizeArguments(
      versionData.logging?.client?.argument ? [versionData.logging.client.argument] : [],
      placeholderValues
    );
    const rawGameArgs = versionData.arguments?.game || legacyArgumentsToArray(versionData.minecraftArguments);
    const gameArgs = normalizeArguments(
      rawGameArgs,
      placeholderValues,
      argumentFeatures
    );
    // Modern Minecraft profiles already add --quickPlayMultiplayer through a
    // feature-gated argument. Adding the legacy --server/--port pair as well
    // starts two connection attempts and can leave the client on the loading
    // screen. Keep the legacy pair only for profiles without Quick Play args.
    if (launchServer?.host && !hasQuickPlayMultiplayerArgument(rawGameArgs)) {
      gameArgs.push('--server', String(launchServer.host));
      gameArgs.push('--port', String(normalizeServerPort(launchServer.port)));
    }

    const allArgs = [...jvmArgs, ...loggingArgs, versionData.mainClass, ...gameArgs];
    const argFilePath = writeJavaArgumentFile(versionId, allArgs);
    fs.writeFileSync(
      launchLogPath,
      `Java: ${javaPath}\nVersion: ${versionId}\nFenstertitel: ${minecraftWindowTitle}\nZeit: ${new Date().toISOString()}\nArgfile: ${argFilePath}\nSpielordner: ${resolvedGameDir}\nMods: ${resolvedModsDir}\nArgumente: ${allArgs.length}\n\nBefehl:\n${javaPath} @${argFilePath}\n\n--- Prozessausgabe ---\n`,
      'utf8'
    );

    const logFd = fs.openSync(launchLogPath, 'a');
    const child = spawn(javaPath, [`@${argFilePath}`], {
      cwd: resolvedGameDir,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true
    });

    activeMinecraftProcess = child;
    minecraftLaunchReserved = false;
    sendMinecraftLifecycleEvent('minecraft-process-created', {
      pid: child.pid,
      startedAt: new Date().toISOString()
    }, sourceWindow);
    child.unref();
    startMinecraftWindowTitleSync(child.pid, minecraftWindowTitle, launchLogPath);
    sendMinecraftLaunchProgress(sourceWindow, 90, 'Minecraft-Fenster wird aufgebaut');
    const readyResult = await waitForMinecraftReady(child, launchLogPath, resolvedGameDir, logFd);
    monitorMinecraftExit(child, launchLogPath, resolvedGameDir, sourceWindow);
    sendMinecraftLifecycleEvent('minecraft-started', {
      pid: child.pid,
      startedAt: new Date().toISOString()
    }, sourceWindow);
  return readyResult;
}

function monitorMinecraftExit(child, launchLogPath, minecraftDir, sourceWindow = null) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.once('exit', (code, signal) => {
    if (activeMinecraftProcess === child) {
      activeMinecraftProcess = null;
    }
    minecraftLaunchReserved = false;
    sendMinecraftLifecycleEvent('minecraft-closed', {
      pid: child.pid,
      code,
      signal,
      exitedAt: new Date().toISOString()
    }, sourceWindow);

    const latestLogPath = path.join(minecraftDir, 'logs', 'latest.log');
    const exitLabel = signal ? `Signal ${signal}` : `Code ${code ?? 'unbekannt'}`;
    const latestExcerpt = readLaunchLogExcerpt(latestLogPath);
    try {
      fs.appendFileSync(
        launchLogPath,
        `\n--- Minecraft beendet nach Startfreigabe ---\nZeit: ${new Date().toISOString()}\nExit: ${exitLabel}${latestExcerpt ? `\nLatest.log Ende: ${latestExcerpt}` : ''}\n`,
        'utf8'
      );
    } catch (_error) {
      // The game has already exited; missing diagnostics should not affect the launcher.
    } finally {
      restoreDefaultModsOnce();
    }
  });
  child.once('error', () => {
    if (activeMinecraftProcess === child) {
      activeMinecraftProcess = null;
    }
    minecraftLaunchReserved = false;
  });
}

function normalizeArguments(argumentsList, replacements, features = {}) {
  return normalizeArgumentsWithFeatures(argumentsList, replacements, features);
}

function hasQuickPlayMultiplayerArgument(argumentsList = []) {
  return argumentsList.some((entry) => {
    const values = typeof entry === 'string'
      ? [entry]
      : (Array.isArray(entry?.value) ? entry.value : [entry?.value]);
    return values.some((value) => (
      typeof value === 'string'
      && (value === '--quickPlayMultiplayer' || value.includes('${quickPlayMultiplayer}'))
    ));
  });
}

function createQuickPlayPath(launchServer) {
  const quickPlayDir = path.join(CONFIG_DIR, 'quick-play');
  ensureDir(quickPlayDir);
  const host = String(launchServer?.host || 'server').replace(/[^\w.-]+/g, '_').slice(0, 80) || 'server';
  return path.join(quickPlayDir, `${Date.now()}-${host}.json`);
}

function normalizeArgumentsWithFeatures(argumentsList, replacements, features) {
  const normalized = [];

  for (const entry of argumentsList) {
    if (typeof entry === 'string') {
      normalized.push(replacePlaceholders(entry, replacements));
      continue;
    }

    if (entry && typeof entry === 'object' && Array.isArray(entry.value) && isRuleAllowed(entry.rules, features)) {
      for (const value of entry.value) {
        normalized.push(replacePlaceholders(value, replacements));
      }
      continue;
    }

    if (entry && typeof entry === 'object' && typeof entry.value === 'string' && isRuleAllowed(entry.rules, features)) {
      normalized.push(replacePlaceholders(entry.value, replacements));
    }
  }

  return normalized.filter((value) => value && !value.includes('${'));
}

function writeJavaArgumentFile(versionId, args) {
  const safeVersionId = String(versionId || 'minecraft').replace(/[^\w.-]+/g, '_');
  const argFilePath = path.join(CONFIG_DIR, `${safeVersionId}-launch.args`);
  const content = args.map((arg) => formatJavaArgFileArgument(arg)).join('\n');
  fs.writeFileSync(argFilePath, `${content}\n`, 'utf8');
  return argFilePath;
}

function formatJavaArgFileArgument(arg) {
  const value = String(arg ?? '');
  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')}"`;
}

async function waitForMinecraftReady(child, launchLogPath, minecraftDir, logFd) {
  const launchStartedAt = Date.now();
  const latestLogPath = path.join(minecraftDir, 'logs', 'latest.log');
  const readyPatterns = [
    /Reloading ResourceManager:/i,
    /OpenAL initialized/i,
    /Created: .*blocks\.png-atlas/i,
    /Sound engine started/i
  ];

  let childError = null;
  const onError = (error) => {
    childError = error;
  };
  const onExit = (code) => {
    childError = new Error(
      `Minecraft wurde beendet (Code ${code ?? 'unbekannt'}). Log: ${launchLogPath}${readLaunchLogExcerpt(launchLogPath) ? ` | ${readLaunchLogExcerpt(launchLogPath)}` : ''}`
    );
  };

  child.once('error', onError);
  child.once('exit', onExit);

  try {
    const timeoutAt = Date.now() + 90000;
    while (Date.now() < timeoutAt) {
      if (childError) {
        throw childError;
      }

      if (hasReadySignal(launchLogPath, readyPatterns, launchStartedAt) || hasReadySignal(latestLogPath, readyPatterns, launchStartedAt)) {
        return { pid: child.pid, logPath: launchLogPath };
      }

      await delay(1000);
    }

    if (childError) {
      throw childError;
    }

    throw new Error(`Minecraft-Prozess läuft, hat aber innerhalb von 90 Sekunden kein Bereitschaftssignal geliefert. Fortschritt bleibt unter 100 %. Log: ${launchLogPath}`);
  } finally {
    child.removeListener('error', onError);
    child.removeListener('exit', onExit);
    try {
      fs.closeSync(logFd);
    } catch (_error) {
      // ignore
    }
  }
}

function hasReadySignal(logPath, readyPatterns, launchStartedAt) {
  try {
    if (!fs.existsSync(logPath)) {
      return false;
    }

    const stats = fs.statSync(logPath);
    if (stats.mtimeMs + 1000 < launchStartedAt) {
      return false;
    }

    const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-80);
    return lines.some((line) => readyPatterns.some((pattern) => pattern.test(line)));
  } catch (_error) {
    return false;
  }
}

function isRuleAllowed(rules = [], features = {}) {
  if (!rules || rules.length === 0) {
    return true;
  }

  let allowed = false;
  for (const rule of rules) {
    const osNameMatches = !rule.os?.name || rule.os.name === getCurrentOsName();
    const osArchMatches = !rule.os?.arch || matchesOsArch(rule.os.arch);
    const osVersionMatches = !rule.os?.versionRange || matchesOsVersionRange(rule.os.versionRange);
    const featureMatches = !rule.features || Object.entries(rule.features).every(([key, value]) => Boolean(features[key]) === Boolean(value));

    if (!osNameMatches || !osArchMatches || !osVersionMatches || !featureMatches) {
      continue;
    }
    allowed = rule.action === 'allow';
  }
  return allowed;
}

function getCurrentOsName() {
  if (process.platform === 'win32') {
    return 'windows';
  }
  if (process.platform === 'darwin') {
    return 'osx';
  }
  return 'linux';
}

function matchesOsArch(expectedArch) {
  if (expectedArch === 'x86') {
    return process.arch === 'ia32';
  }
  if (expectedArch === 'x86_64') {
    return process.arch === 'x64';
  }
  if (expectedArch === 'arm64') {
    return process.arch === 'arm64';
  }
  return true;
}

function matchesOsVersionRange(versionRange) {
  if (getCurrentOsName() !== 'windows') {
    return true;
  }

  const currentVersion = os.release();
  if (versionRange.min && compareVersionStrings(currentVersion, versionRange.min) < 0) {
    return false;
  }
  if (versionRange.max && compareVersionStrings(currentVersion, versionRange.max) > 0) {
    return false;
  }
  return true;
}

function compareVersionStrings(a, b) {
  const aParts = String(a).split('.').map((value) => parseInt(value, 10) || 0);
  const bParts = String(b).split('.').map((value) => parseInt(value, 10) || 0);
  const length = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < length; index += 1) {
    const aValue = aParts[index] || 0;
    const bValue = bParts[index] || 0;
    if (aValue > bValue) {
      return 1;
    }
    if (aValue < bValue) {
      return -1;
    }
  }

  return 0;
}

function replacePlaceholders(value, replacements) {
  let result = value;
  for (const [placeholder, replacement] of Object.entries(replacements)) {
    result = result.split(placeholder).join(replacement);
  }
  return result;
}

function readLaunchLogExcerpt(logPath) {
  try {
    const content = fs.readFileSync(logPath, 'utf8').trim();
    if (!content) {
      return '';
    }

    const lines = content.split(/\r?\n/).filter(Boolean);
    return lines.slice(-3).join(' | ');
  } catch (_error) {
    return '';
  }
}

function getJavaDetails(preferredRuntimeComponent = '', requiredMajorVersion = 0) {
  const requiredVersion = Number(requiredMajorVersion) || 0;
  const candidates = collectJavaCandidates(preferredRuntimeComponent);
  const checked = [];
  const failed = [];

  for (const binary of candidates) {
    if (!binary || !fs.existsSync(binary)) {
      continue;
    }

    try {
      const versionOutput = readJavaVersionOutput(binary);
      const majorVersion = parseJavaMajorVersion(versionOutput);
      if (!majorVersion) {
        failed.push({ binary, reason: versionOutput.trim() });
        continue;
      }

      checked.push({
        path: binary,
        majorVersion,
        rawVersion: versionOutput.trim()
      });
    } catch (error) {
      failed.push({ binary, reason: error.message });
    }
  }

  const compatible = checked.find((entry) => !requiredVersion || entry.majorVersion >= requiredVersion);
  if (compatible) {
    return compatible;
  }

  if (checked.length) {
    const best = [...checked].sort((left, right) => right.majorVersion - left.majorVersion)[0];
    if (requiredVersion) {
      throw new Error(`Java ${requiredVersion} wird benötigt, gefunden wurde Java ${best.majorVersion} (${best.path}). Bitte installiere Java ${requiredVersion} oder neuer.`);
    }
    return best;
  }

  if (failed.length) {
    const detail = failed[0].reason ? ` Ausgabe: ${failed[0].reason}` : '';
    throw new Error(`Java-Version konnte nicht erkannt werden.${detail}`);
  }

  throw new Error('Java wurde nicht gefunden. Bitte installiere Java 21 oder setze JAVA_HOME.');
}

function collectJavaCandidates(preferredRuntimeComponent = '') {
  const candidates = [];
  const addCandidate = (candidate) => {
    const normalized = String(candidate || '').trim();
    if (!normalized) {
      return;
    }

    candidates.push(normalized);
  };

  addCandidate(getBundledMinecraftJava(preferredRuntimeComponent));

  const javaHome = process.env.JAVA_HOME;
  if (javaHome) {
    addCandidate(path.join(javaHome, 'bin', 'java.exe'));
    addCandidate(path.join(javaHome, 'bin', 'javaw.exe'));
  }

  for (const binaryName of ['java', 'javaw']) {
    try {
      const binaries = execFileSync('where', [binaryName], { encoding: 'utf8' })
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      binaries.forEach(addCandidate);
    } catch (_error) {
      // ignore
    }
  }

  const commonRoots = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs') : ''
  ];

  for (const root of commonRoots) {
    collectJavaCandidatesFromRoot(root).forEach(addCandidate);
  }

  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = process.platform === 'win32' ? candidate.toLowerCase() : candidate;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function collectJavaCandidatesFromRoot(rootDir) {
  const root = String(rootDir || '').trim();
  if (!root || !fs.existsSync(root)) {
    return [];
  }

  const candidates = [];
  const queue = [{ dir: root, depth: 0 }];
  const interestingName = /java|jdk|jre|adoptium|temurin|eclipse|microsoft|zulu|azul|oracle|corretto|semeru|bellsoft/i;

  while (queue.length && candidates.length < 80) {
    const current = queue.shift();
    const javaPath = path.join(current.dir, 'bin', 'java.exe');
    const javawPath = path.join(current.dir, 'bin', 'javaw.exe');
    if (fs.existsSync(javaPath)) {
      candidates.push(javaPath);
    }
    if (fs.existsSync(javawPath)) {
      candidates.push(javawPath);
    }

    if (current.depth >= 3) {
      continue;
    }

    let entries = [];
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true });
    } catch (_error) {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || (!interestingName.test(entry.name) && current.depth === 0)) {
        continue;
      }

      queue.push({
        dir: path.join(current.dir, entry.name),
        depth: current.depth + 1
      });
    }
  }

  return candidates;
}

function getBundledMinecraftJava(preferredRuntimeComponent = '') {
  const runtimeBase = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
    'Packages',
    'Microsoft.4297127D64EC6_8wekyb3d8bbwe',
    'LocalCache',
    'Local',
    'runtime'
  );

  if (!fs.existsSync(runtimeBase)) {
    return null;
  }

  const runtimeDirs = fs.readdirSync(runtimeBase, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const ordered = [
    ...(preferredRuntimeComponent ? [preferredRuntimeComponent] : []),
    ...runtimeDirs.filter((name) => name !== preferredRuntimeComponent)
  ];

  for (const runtimeName of ordered) {
    const javaPath = path.join(runtimeBase, runtimeName, 'windows-x64', runtimeName, 'bin', 'java.exe');
    if (fs.existsSync(javaPath)) {
      return javaPath;
    }
  }

  return null;
}

function readJavaVersionOutput(binary) {
  const result = spawnSync(binary, ['-version'], {
    encoding: 'utf8',
    windowsHide: true
  });

  if (result.error) {
    throw result.error;
  }

  const stdout = result.stdout ? String(result.stdout) : '';
  const stderr = result.stderr ? String(result.stderr) : '';
  return `${stdout}\n${stderr}`.trim();
}

function parseJavaMajorVersion(versionOutput) {
  const match = versionOutput.match(/version "([^"]+)"/i);
  if (!match) {
    return null;
  }

  const rawVersion = match[1];
  if (rawVersion.startsWith('1.')) {
    const legacy = parseInt(rawVersion.split('.')[1], 10);
    return Number.isFinite(legacy) ? legacy : null;
  }

  const modern = parseInt(rawVersion.split('.')[0], 10);
  return Number.isFinite(modern) ? modern : null;
}

function getActiveModContext(versionId = getEffectiveSelectedVersionId()) {
  const activePack = getActivePack();
  if (activePack) {
    return getPackModContext(activePack);
  }

  return getStandardModContext(versionId);
}

function getModrinthInstallContext(target = {}) {
  const requestedPackId = String(target?.packId || '').trim();
  const requestedVersionId = String(target?.versionId || '').trim();

  if (requestedPackId) {
    const pack = readPacksState().packs.find((entry) => entry.id === requestedPackId);
    if (!pack) {
      throw new Error('Das Ziel-Profil wurde nicht gefunden. Bitte suche im Modrinth-Tab erneut.');
    }

    if (requestedVersionId && pack.versionId !== requestedVersionId) {
      throw new Error(`Das Ziel-Profil nutzt inzwischen Minecraft ${getMinecraftVersionName(pack.versionId) || 'eine andere Version'}. Bitte suche im Modrinth-Tab erneut.`);
    }

    return getPackModContext(pack);
  }

  if (requestedVersionId) {
    return getStandardModContext(requestedVersionId);
  }

  return getActiveModContext();
}

function normalizeMinecraftWindowTitle(title) {
  return String(title || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function getLaunchProfileWindowTitle(modContext = getActiveModContext()) {
  if (modContext?.type === 'pack') {
    return normalizeMinecraftWindowTitle(modContext.name) || 'Profil';
  }

  return 'Launcher-Standard';
}

function getStandardModContext(versionId = getSelectedVersionId()) {
  const resolvedVersionId = String(versionId || getSelectedVersionId()).trim();
  return {
    type: 'global',
    name: 'Launcher-Standard',
    packId: '',
    versionId: resolvedVersionId,
    minecraftVersion: getMinecraftVersionName(resolvedVersionId),
    gameDir: DEFAULT_MINECRAFT_DIR,
    modsDir: getConfiguredStandardModsDir(),
    resourcepacksDir: RESOURCEPACKS_DIR,
    shaderpacksDir: SHADERPACKS_DIR,
    disabledModsDir: path.join(CONFIG_DIR, DISABLED_MODS_DIR_NAME),
    stateFile: MODS_STATE_FILE,
    libraryDir: MODS_LIBRARY_DIR
  };
}

function getPackModContext(pack) {
  const packDir = pack.packDir || path.join(PACKS_DIR, sanitizePathSegment(pack.id));
  const modsDir = pack.modsDir || path.join(packDir, 'mods');
  const resourcepacksDir = pack.resourcepacksDir || path.join(packDir, 'resourcepacks');
  const shaderpacksDir = pack.shaderpacksDir || path.join(packDir, 'shaderpacks');
  return {
    type: 'pack',
    name: pack.name,
    packId: pack.id,
    versionId: pack.versionId,
    minecraftVersion: getMinecraftVersionName(pack.versionId),
    gameDir: DEFAULT_MINECRAFT_DIR,
    modsDir,
    resourcepacksDir: RESOURCEPACKS_DIR,
    shaderpacksDir: SHADERPACKS_DIR,
    disabledModsDir: path.join(packDir, DISABLED_MODS_DIR_NAME),
    stateFile: path.join(packDir, 'mods-state.json'),
    libraryDir: path.join(packDir, 'mods-library')
  };
}

function repairInstalledBundledMods() {
  const contexts = [];
  const selectedVersionId = getSelectedVersionId();
  if (selectedVersionId) {
    contexts.push(getStandardModContext(selectedVersionId));
  }

  for (const modContext of contexts) {
    if (!modContext.minecraftVersion || !fs.existsSync(modContext.modsDir)) {
      continue;
    }

    try {
      ensureModsState(modContext);
      ensureBundledRequiredModsForContext(modContext, modContext.minecraftVersion);
    } catch (_error) {
      // Keep startup resilient; launch-time sync will surface warnings.
    }

    const state = readModsState(modContext);
    const disabledProjects = new Set(state.disabledProjects || []);
    for (const requiredMod of REQUIRED_BUNDLED_MODS) {
      if (disabledProjects.has(requiredMod.projectId)) {
        continue;
      }

      const assetPath = getRequiredBundledModAssetPath(requiredMod, modContext.minecraftVersion);
      if (!assetPath || !fs.existsSync(assetPath)) {
        continue;
      }

      const targetPath = path.join(modContext.modsDir, getRequiredBundledModFileName(requiredMod, modContext.minecraftVersion));
      if (!isPathInsideDirectory(modContext.modsDir, targetPath) || !fs.existsSync(targetPath)) {
        continue;
      }

      try {
        if (getFileSha1(assetPath) !== getFileSha1(targetPath)) {
          fs.copyFileSync(assetPath, targetPath);
        }
      } catch (_error) {
        // The regular mod sync can still repair this before launch.
      }
    }
  }
}

function getFileSha1(filePath) {
  return hashFile(filePath, 'sha1');
}

function getDefaultModsState() {
  return {
    projects: {},
    disabledProjects: [],
    autoDisabledProjects: [],
    disabledProjectReasons: {},
    disabledFileReasons: {},
    ignoredDefaultProjects: [],
    keptLocalMods: [],
    keptLocalProjectIds: [],
    unavailableProjectChecks: {},
    activeSync: {
      minecraftVersion: '',
      files: []
    }
  };
}

function normalizeManagedProjectId(projectId) {
  const normalizedProjectId = String(projectId || '').trim();
  const alias = MODRINTH_PROJECT_ID_ALIASES[normalizedProjectId.toLowerCase()];
  return alias || normalizedProjectId;
}

function isProtectedManagedProject(projectId, project = null) {
  const normalizedProjectId = String(projectId || project?.projectId || '').trim();
  if (normalizedProjectId && PROTECTED_MOD_PROJECT_IDS.has(normalizedProjectId)) {
    return true;
  }

  const normalizedSlug = String(project?.slug || '').trim().toLowerCase();
  return Boolean(normalizedSlug && PROTECTED_MOD_SLUGS.has(normalizedSlug));
}

function isToggleableRequiredBundledProject(projectId, project = null) {
  const bundledMod = getRequiredBundledMod(projectId, project);
  return Boolean(bundledMod?.canDisable);
}

function isManagedProjectDisableLocked(projectId, project = null) {
  return isProtectedManagedProject(projectId, project)
    && !isToggleableRequiredBundledProject(projectId, project);
}

function isManagedProjectRemoveLocked(projectId, project = null) {
  if (isManagedProjectHiddenInModsTab(projectId, project)) {
    return true;
  }

  const bundledMod = getRequiredBundledMod(projectId, project);
  return Boolean(bundledMod && !bundledMod.canDisable);
}

function isManagedProjectHiddenInModsTab(projectId, project = null) {
  const bundledMod = getRequiredBundledMod(projectId, project);
  if (bundledMod?.showInModsTab) {
    return false;
  }

  const normalizedProjectId = String(projectId || project?.projectId || '').trim();
  if (normalizedProjectId && HIDDEN_MODS_TAB_PROJECT_IDS.has(normalizedProjectId)) {
    return true;
  }

  const normalizedSlug = String(project?.slug || '').trim().toLowerCase();
  return Boolean(normalizedSlug && HIDDEN_MODS_TAB_PROJECT_SLUGS.has(normalizedSlug));
}

function isRequiredModFileHiddenInModsTab(fileName) {
  const normalized = String(fileName || '')
    .trim()
    .toLowerCase()
    .replace(new RegExp(`${DISABLED_MOD_SUFFIX}$`, 'i'), '');
  const bundledMod = getRequiredBundledModByFileName(normalized);
  if (bundledMod?.showInModsTab) {
    return false;
  }

  return isRequiredModFileName(normalized);
}

function isRequiredDefaultManagedProject(projectId) {
  const normalizedProjectId = String(projectId || '').trim();
  return Boolean(normalizedProjectId && REQUIRED_MANAGED_PROJECT_IDS.has(normalizedProjectId));
}

function markManagedProjectAutoDisabled(autoDisabledProjects, projectId, project = null, disabledProjects = new Set()) {
  const normalizedProjectId = String(projectId || project?.projectId || '').trim();
  if (!normalizedProjectId
      || disabledProjects.has(normalizedProjectId)
      || isProtectedManagedProject(normalizedProjectId, project)) {
    return false;
  }

  autoDisabledProjects.add(normalizedProjectId);
  return true;
}

function isUnavailableAutoDisableReason(reasonEntry) {
  const source = String(reasonEntry?.source || '').trim();
  if (source !== 'auto-repair') {
    return false;
  }

  const reasonText = [
    reasonEntry?.reason,
    reasonEntry?.technicalEvidence
  ].join(' ');
  return /keine (?:exakt passende |passende |kompatible )?(?:modrinth-version|fabric-version|version)|nicht kompatibel|jar fehlt/iu.test(reasonText);
}

function restoreUnavailableAutoDisabledProjectsForRetry(state) {
  const disabledProjects = new Set(state.disabledProjects || []);
  const autoDisabledProjects = new Set(state.autoDisabledProjects || []);
  let changed = false;

  for (const projectId of [...disabledProjects]) {
    const project = state.projects?.[projectId];
    const reasonEntry = state.disabledProjectReasons?.[projectId];
    if (isProtectedManagedProject(projectId, project)
        || (!autoDisabledProjects.has(projectId) && !isUnavailableAutoDisableReason(reasonEntry))) {
      continue;
    }

    disabledProjects.delete(projectId);
    autoDisabledProjects.add(projectId);
    changed = true;
  }

  if (!changed) {
    return false;
  }

  state.disabledProjects = [...disabledProjects];
  state.autoDisabledProjects = [...autoDisabledProjects].filter((projectId) => !disabledProjects.has(projectId));
  return true;
}

function getManagedProjectUnavailableKey(projectId, minecraftVersion, projectType = 'mod') {
  const selectedLoader = getPreferredModrinthLoaders(projectType).join(',') || 'any';
  return [
    String(projectId || '').trim(),
    String(minecraftVersion || '').trim(),
    selectedLoader
  ].join('|');
}

function getUnavailableManagedProjectCheck(state, projectId, minecraftVersion, projectType = 'mod') {
  const key = getManagedProjectUnavailableKey(projectId, minecraftVersion, projectType);
  const entry = state?.unavailableProjectChecks?.[key];
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  return entry;
}

function isUnavailableManagedProjectCheckFresh(state, projectId, minecraftVersion, projectType = 'mod') {
  const entry = getUnavailableManagedProjectCheck(state, projectId, minecraftVersion, projectType);
  const checkedAt = getVersionTimestamp(entry?.checkedAt);
  return checkedAt > 0 && (Date.now() - checkedAt) < MODRINTH_UNAVAILABLE_RETRY_INTERVAL_MS;
}

function rememberUnavailableManagedProjectCheck(state, projectId, minecraftVersion, reason = '', projectType = 'mod') {
  if (!state || !projectId || !minecraftVersion) {
    return;
  }
  state.unavailableProjectChecks = state.unavailableProjectChecks || {};
  const key = getManagedProjectUnavailableKey(projectId, minecraftVersion, projectType);
  state.unavailableProjectChecks[key] = {
    projectId: String(projectId || '').trim(),
    minecraftVersion: String(minecraftVersion || '').trim(),
    loader: getPreferredModrinthLoaders(projectType).join(',') || 'any',
    reason: String(reason || '').trim(),
    checkedAt: new Date().toISOString()
  };
}

function clearUnavailableManagedProjectCheck(state, projectId, minecraftVersion, projectType = 'mod') {
  if (!state?.unavailableProjectChecks) {
    return;
  }
  delete state.unavailableProjectChecks[getManagedProjectUnavailableKey(projectId, minecraftVersion, projectType)];
}

function isBundledRequiredProject(projectId, project = null) {
  const normalizedProjectId = String(projectId || project?.projectId || '').trim();
  if (REQUIRED_BUNDLED_MODS.some((entry) => entry.projectId === normalizedProjectId)) {
    return true;
  }

  const normalizedSlug = String(project?.slug || '').trim().toLowerCase();
  return REQUIRED_BUNDLED_MODS.some((entry) => entry.slug === normalizedSlug);
}

function getRequiredBundledMod(projectId, project = null) {
  const normalizedProjectId = String(projectId || project?.projectId || '').trim();
  if (normalizedProjectId) {
    const match = REQUIRED_BUNDLED_MODS.find((entry) => entry.projectId === normalizedProjectId);
    if (match) {
      return match;
    }
  }

  const normalizedSlug = String(project?.slug || '').trim().toLowerCase();
  return normalizedSlug
    ? REQUIRED_BUNDLED_MODS.find((entry) => entry.slug === normalizedSlug) || null
    : null;
}

function getRequiredBundledModFileNames(requiredMod) {
  return uniqueStrings([
    String(requiredMod?.fileName || '').trim(),
    ...Object.values(requiredMod?.fileNameByMinecraftVersion || {})
      .map((fileName) => String(fileName || '').trim())
  ]).filter(Boolean);
}

function getRequiredBundledModFileName(requiredMod, minecraftVersion) {
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  const versionedFileNames = requiredMod?.fileNameByMinecraftVersion || {};
  if (normalizedMinecraftVersion && versionedFileNames[normalizedMinecraftVersion]) {
    return String(versionedFileNames[normalizedMinecraftVersion] || '').trim();
  }

  return String(requiredMod?.fileName || '').trim();
}

function getRequiredBundledModByFileName(fileName) {
  const normalized = String(fileName || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return REQUIRED_BUNDLED_MODS.find((entry) => (
    getRequiredBundledModFileNames(entry).some((entryFileName) => entryFileName.toLowerCase() === normalized)
  )) || null;
}

function isRequiredModFileName(fileName) {
  const normalized = String(fileName || '').trim().toLowerCase();
  return Boolean(getRequiredBundledModByFileName(normalized))
    || isRequiredManualModFileName(normalized);
}

function isRequiredModFileDisableLocked(fileName) {
  const normalized = String(fileName || '').trim().toLowerCase();
  const bundledMod = getRequiredBundledModByFileName(normalized);
  return Boolean(bundledMod && !bundledMod.canDisable)
    || isRequiredManualModFileName(normalized);
}

function getManagedProjectCandidateFileNames(projectId, project = null, minecraftVersion = '') {
  const names = new Set();
  const normalizedProjectId = String(projectId || project?.projectId || '').trim();
  if (normalizedProjectId) {
    names.add(`${sanitizeJarFileName(normalizedProjectId)}.jar`.toLowerCase());
  }
  for (const versionEntry of Object.values(project?.versions || {})) {
    const fileName = String(versionEntry?.fileName || '').trim();
    if (fileName && (!minecraftVersion || versionEntry?.minecraftVersion === minecraftVersion)) {
      names.add(path.basename(fileName).toLowerCase());
    }
  }
  return names;
}

function removeManagedProjectCopiesFromModStorage(modContext, projectId, project = null) {
  const removed = [];
  const normalizedProjectId = normalizeManagedProjectId(projectId);
  const expectedNames = getManagedProjectCandidateFileNames(normalizedProjectId, project);
  const knownFabricIds = new Set(
    Object.entries(KNOWN_FABRIC_MOD_ID_PROJECT_IDS)
      .filter(([, mappedProjectId]) => normalizeManagedProjectId(mappedProjectId) === normalizedProjectId)
      .map(([fabricModId]) => fabricModId.toLowerCase())
  );

  for (const directory of [modContext.modsDir, getDisabledModsDir(modContext)]) {
    if (!fs.existsSync(directory)) {
      continue;
    }

    for (const fileName of fs.readdirSync(directory).filter((entry) => entry.toLowerCase().endsWith('.jar'))) {
      const filePath = path.join(directory, fileName);
      if (!isPathInsideDirectory(directory, filePath) || !fs.existsSync(filePath)) {
        continue;
      }

      let matches = expectedNames.has(fileName.toLowerCase());
      if (!matches) {
        const manifestInfo = readFabricModManifest(filePath);
        const fabricModId = String(manifestInfo?.manifest?.id || '').trim().toLowerCase();
        matches = Boolean(fabricModId && knownFabricIds.has(fabricModId));
      }

      if (!matches) {
        continue;
      }

      try {
        fs.unlinkSync(filePath);
        removed.push(filePath);
      } catch (error) {
        logger.warn('Managed mod copy could not be removed', {
          projectId: normalizedProjectId,
          filePath,
          error: serializeError(error)
        });
      }
    }
  }

  return removed;
}

function isRequiredManualModFileName(fileName) {
  const normalized = String(fileName || '')
    .trim()
    .toLowerCase()
    .replace(new RegExp(`${DISABLED_MOD_SUFFIX}$`, 'i'), '')
    .replace(/\.jar$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) {
    return false;
  }

  return [...REQUIRED_MANUAL_MOD_FILE_PREFIXES].some((prefix) => {
    const normalizedPrefix = String(prefix || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized === normalizedPrefix || normalized.startsWith(`${normalizedPrefix}-`);
  });
}

function isRemovedBundledModFileName(fileName) {
  const normalized = String(fileName || '')
    .trim()
    .toLowerCase()
    .replace(new RegExp(`${DISABLED_MOD_SUFFIX}$`, 'i'), '');
  return REMOVED_BUNDLED_MOD_FILE_NAMES.has(normalized)
    || normalized.startsWith('x-launcher-menu-')
    || normalized.startsWith('simplefullbright')
    || normalized.startsWith('verysimplefullbright')
    || normalized.startsWith('very-simple-fullbright')
    || normalized.includes('simple-fullbright');
}

function removeRemovedBundledModsFromContext(modContext = getActiveModContext()) {
  ensureModsState(modContext);
  ensureDir(modContext.modsDir);

  const state = readModsState(modContext);
  let changed = false;

  for (const projectId of REMOVED_BUNDLED_PROJECT_IDS) {
    if (state.projects[projectId]) {
      delete state.projects[projectId];
      changed = true;
    }
  }

  const removedProjectIds = new Set(REMOVED_BUNDLED_PROJECT_IDS);
  const nextDisabledProjects = (state.disabledProjects || []).filter((entry) => !removedProjectIds.has(entry));
  const nextAutoDisabledProjects = (state.autoDisabledProjects || []).filter((entry) => !removedProjectIds.has(entry));
  const nextActiveFiles = [];

  for (const entry of state.activeSync?.files || []) {
    if (removedProjectIds.has(entry.projectId)) {
      if (entry.targetPath && isPathInsideDirectory(modContext.modsDir, entry.targetPath) && fs.existsSync(entry.targetPath)) {
        try {
          fs.unlinkSync(entry.targetPath);
        } catch (_error) {
          // ignore cleanup failures; the stale state entry is still removed
        }
      }
      changed = true;
      continue;
    }

    nextActiveFiles.push(entry);
  }

  if (nextDisabledProjects.length !== (state.disabledProjects || []).length) {
    state.disabledProjects = nextDisabledProjects;
    changed = true;
  }
  if (nextAutoDisabledProjects.length !== (state.autoDisabledProjects || []).length) {
    state.autoDisabledProjects = nextAutoDisabledProjects;
    changed = true;
  }
  if (nextActiveFiles.length !== (state.activeSync?.files || []).length) {
    state.activeSync = {
      minecraftVersion: String(state.activeSync?.minecraftVersion || '').trim(),
      files: nextActiveFiles
    };
    changed = true;
  }

  for (const fileName of fs.readdirSync(modContext.modsDir)) {
    if (!isRemovedBundledModFileName(fileName)) {
      continue;
    }

    const filePath = path.join(modContext.modsDir, fileName);
    if (isPathInsideDirectory(modContext.modsDir, filePath) && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_error) {
        // keep startup and sync resilient
      }
    }
  }

  const disabledModsDir = getDisabledModsDir(modContext);
  for (const fileName of fs.existsSync(disabledModsDir) ? fs.readdirSync(disabledModsDir) : []) {
    if (!isRemovedBundledModFileName(fileName)) {
      continue;
    }

    const filePath = path.join(disabledModsDir, fileName);
    if (isPathInsideDirectory(disabledModsDir, filePath) && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_error) {
        // keep startup and sync resilient
      }
    }
  }

  for (const projectId of REMOVED_BUNDLED_PROJECT_IDS) {
    const projectLibraryDir = path.join(modContext.libraryDir, sanitizePathSegment(projectId));
    if (isPathInsideDirectory(modContext.libraryDir, projectLibraryDir) && fs.existsSync(projectLibraryDir)) {
      try {
        fs.rmSync(projectLibraryDir, { recursive: true, force: true });
      } catch (_error) {
        // ignore cleanup failures
      }
    }
  }

  if (changed) {
    writeModsState(state, modContext);
  }
}

function isRequiredBundledModCompatible(requiredMod, minecraftVersion) {
  const allowedVersions = Array.isArray(requiredMod?.minecraftVersions)
    ? requiredMod.minecraftVersions.map((version) => String(version || '').trim()).filter(Boolean)
    : [];
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  if (allowedVersions.length && !allowedVersions.includes(normalizedMinecraftVersion)) {
    return false;
  }

  return Boolean(getRequiredBundledModAssetPath(requiredMod, normalizedMinecraftVersion));
}

/**
 * Keeps an X Client build from ever reaching Fabric with the wrong game version.
 * This also catches manually copied or stale JARs that are not tracked in
 * activeSync. Incompatible files are moved to the profile's recoverable
 * disabled-mod directory before the normal managed-mod sync runs.
 */
function disableIncompatibleXClientFiles(modContext, minecraftVersion) {
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  const warnings = [];
  if (!normalizedMinecraftVersion || !fs.existsSync(modContext?.modsDir || '')) {
    return warnings;
  }

  for (const fileName of fs.readdirSync(modContext.modsDir)) {
    if (!fileName.toLowerCase().endsWith('.jar')) {
      continue;
    }

    const filePath = path.join(modContext.modsDir, fileName);
    if (!isPathInsideDirectory(modContext.modsDir, filePath) || !fs.existsSync(filePath)) {
      continue;
    }

    const manifestInfo = readFabricModManifest(filePath);
    if (String(manifestInfo?.manifest?.id || '').trim().toLowerCase() !== 'x-client') {
      continue;
    }

    const compatibility = getJarMinecraftCompatibility(filePath, normalizedMinecraftVersion);
    if (compatibility.compatible !== false) {
      continue;
    }

    const requirement = String(compatibility.requirement || '').trim() || 'unbekannt';
    const disabledPath = disableUnmanagedStandardModFile(filePath, modContext, {
      reason: `X Client wurde automatisch deaktiviert, weil diese JAR nicht zu Minecraft ${normalizedMinecraftVersion} passt.`,
      technicalEvidence: `fabric.mod.json depends.minecraft=${requirement}`
    });
    if (!disabledPath) {
      warnings.push(`X Client: Die inkompatible Datei ${fileName} konnte nicht deaktiviert werden.`);
      continue;
    }

    warnings.push(`X Client: ${fileName} wurde für Minecraft ${normalizedMinecraftVersion} automatisch deaktiviert.`);
    logger.warn('Incompatible X Client build auto-disabled', {
      fileName,
      minecraftVersion: normalizedMinecraftVersion,
      requirement,
      disabledPath
    });
  }

  return warnings;
}

function getRequiredBundledModAssetPath(requiredMod, minecraftVersion) {
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  const versionedAssets = requiredMod?.assetPathByMinecraftVersion || {};
  if (normalizedMinecraftVersion && versionedAssets[normalizedMinecraftVersion]) {
    return versionedAssets[normalizedMinecraftVersion];
  }

  return String(requiredMod?.assetPath || '').trim();
}

function getRequiredBundledModSupportedVersions(requiredMod) {
  return Object.keys(requiredMod?.assetPathByMinecraftVersion || {})
    .map((version) => String(version || '').trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function readZipTextEntry(zipPath, entryName) {
  const buffer = fs.readFileSync(zipPath);
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
        return data.toString('utf8');
      }
      if (compressionMethod === 8) {
        return zlib.inflateRawSync(data).toString('utf8');
      }

      return '';
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return '';
}

function getZipCentralDirectoryEntriesFromBuffer(buffer) {
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
    throw new Error('ZIP-Datei ist beschädigt oder unvollständig.');
  }

  const centralDirectorySize = buffer.readUInt32LE(endRecordOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endRecordOffset + 16);
  const centralDirectoryEnd = Math.min(buffer.length, centralDirectoryOffset + centralDirectorySize);
  const entries = [];
  let cursor = centralDirectoryOffset;

  while (cursor + 46 <= centralDirectoryEnd && buffer.readUInt32LE(cursor) === 0x02014b50) {
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileNameStart = cursor + 46;
    const name = buffer.toString('utf8', fileNameStart, fileNameStart + fileNameLength).replace(/\\/g, '/');

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset
    });

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return { buffer, entries };
}

function getZipCentralDirectoryEntries(zipPath) {
  return getZipCentralDirectoryEntriesFromBuffer(fs.readFileSync(zipPath));
}

function readZipEntryBufferFromArchive(archive, entry) {
  const buffer = archive?.buffer;
  if (!buffer || !entry || entry.localHeaderOffset + 30 > buffer.length) {
    throw new Error('ZIP-Eintrag konnte nicht gelesen werden.');
  }

  const localHeaderOffset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error(`ZIP-Eintrag ${entry.name || ''} hat keinen gültigen lokalen Header.`);
  }

  const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataStart > buffer.length || dataEnd > buffer.length) {
    throw new Error(`ZIP-Eintrag ${entry.name || ''} ist unvollständig.`);
  }

  const compressedData = buffer.subarray(dataStart, dataEnd);
  if (entry.compressionMethod === 0) {
    return Buffer.from(compressedData);
  }
  if (entry.compressionMethod === 8) {
    return zlib.inflateRawSync(compressedData);
  }

  throw new Error(`ZIP-Kompressionsmethode ${entry.compressionMethod} wird nicht unterstützt.`);
}

function readZipTextEntryFromBuffer(buffer, entryName) {
  const normalizedEntryName = String(entryName || '').replace(/\\/g, '/');
  if (!buffer || !normalizedEntryName) {
    return '';
  }

  try {
    const archive = getZipCentralDirectoryEntriesFromBuffer(buffer);
    const entry = archive.entries.find((candidate) => candidate.name === normalizedEntryName);
    return entry ? readZipEntryBufferFromArchive(archive, entry).toString('utf8') : '';
  } catch (_error) {
    return '';
  }
}

function bufferHasFabricModManifest(buffer) {
  try {
    const manifestText = readZipTextEntryFromBuffer(buffer, 'fabric.mod.json');
    if (!manifestText) {
      return false;
    }

    const manifest = JSON.parse(manifestText);
    return Boolean(manifest && typeof manifest === 'object' && String(manifest.id || '').trim());
  } catch (_error) {
    return false;
  }
}

function normalizeZipRelativePath(entryName) {
  const normalized = String(entryName || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!normalized
      || path.isAbsolute(normalized)
      || normalized.split('/').some((segment) => !segment || segment === '..')) {
    return '';
  }

  return normalized;
}

function isJarFileCorrupted(jarPath) {
  try {
    if (!fs.existsSync(jarPath)) {
      return false;
    }

    const buffer = fs.readFileSync(jarPath);
    if (buffer.length < 22) {
      return true;
    }

    const minimumEndRecordSize = 22;
    const searchStart = Math.max(0, buffer.length - 0xffff - minimumEndRecordSize);
    for (let offset = buffer.length - minimumEndRecordSize; offset >= searchStart; offset -= 1) {
      if (buffer.readUInt32LE(offset) === 0x06054b50) {
        return false;
      }
    }

    return true;
  } catch (_error) {
    return true;
  }
}

function readFabricModManifest(jarPath) {
  try {
    const manifestText = readZipTextEntry(jarPath, 'fabric.mod.json');
    if (!manifestText) {
      return null;
    }

    const manifest = JSON.parse(manifestText);
    return manifest && typeof manifest === 'object' ? { manifest, manifestText } : null;
  } catch (_error) {
    return null;
  }
}

function formatFabricDependencyRequirement(requirement) {
  if (typeof requirement === 'string') {
    return requirement.trim();
  }

  if (Array.isArray(requirement)) {
    return requirement.map(formatFabricDependencyRequirement).filter(Boolean).join(' oder ');
  }

  if (requirement && typeof requirement === 'object') {
    return Object.values(requirement).map(formatFabricDependencyRequirement).filter(Boolean).join(' ');
  }

  return '';
}

function normalizeMinecraftRequirementVersionName(versionName) {
  return String(versionName || '')
    .trim()
    .replace(/^v(?=\d)/iu, '')
    .replace(/-$/u, '');
}

function compareMinecraftRequirementVersions(leftVersion, rightVersion) {
  const normalizedLeftVersion = normalizeMinecraftRequirementVersionName(leftVersion);
  const normalizedRightVersion = normalizeMinecraftRequirementVersionName(rightVersion);
  const leftParts = getMinecraftVersionSortParts(normalizedLeftVersion);
  const rightParts = getMinecraftVersionSortParts(normalizedRightVersion);
  const partCount = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < partCount; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff) {
      return diff;
    }
  }

  return normalizedLeftVersion.localeCompare(normalizedRightVersion, 'de', {
    numeric: true,
    sensitivity: 'base'
  });
}

function getVersionRequirementPrefix(versionName, partCount) {
  return normalizeMinecraftRequirementVersionName(versionName)
    .split('.')
    .slice(0, partCount)
    .join('.');
}

function minecraftVersionMatchesWildcard(requirement, minecraftVersion) {
  const requirementParts = String(requirement || '').trim().split('.');
  const versionParts = String(minecraftVersion || '').trim().split('.');

  return requirementParts.every((part, index) => {
    const normalizedPart = part.toLowerCase();
    return normalizedPart === '*' || normalizedPart === 'x' || normalizedPart === versionParts[index];
  });
}

function minecraftVersionSatisfiesToken(token, minecraftVersion) {
  const normalizedToken = String(token || '').trim();
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  if (!normalizedToken || normalizedToken === '*' || normalizedToken.toLowerCase() === 'x') {
    return true;
  }

  const mavenRangeMatch = normalizedToken.match(/^([\[(])\s*([^,\])]*?)\s*,\s*([^\])]*)\s*([\])])$/u);
  if (mavenRangeMatch) {
    const [, lowerMode, lowerVersion, upperVersion, upperMode] = mavenRangeMatch;
    const lower = String(lowerVersion || '').trim();
    const upper = String(upperVersion || '').trim();
    if (lower) {
      const lowerDiff = compareMinecraftRequirementVersions(normalizedMinecraftVersion, lower);
      if (lowerMode === '[' ? lowerDiff < 0 : lowerDiff <= 0) {
        return false;
      }
    }
    if (upper) {
      const upperDiff = compareMinecraftRequirementVersions(normalizedMinecraftVersion, upper);
      if (upperMode === ']' ? upperDiff > 0 : upperDiff >= 0) {
        return false;
      }
    }
    return true;
  }

  const tildeMatch = normalizedToken.match(/^~\s*v?(.+)$/u);
  if (tildeMatch) {
    const baseVersion = tildeMatch[1].trim();
    const lowerDiff = compareMinecraftRequirementVersions(normalizedMinecraftVersion, baseVersion);
    const requiredPrefix = getVersionRequirementPrefix(baseVersion, 2);
    return lowerDiff >= 0
      && (!requiredPrefix || getVersionRequirementPrefix(normalizedMinecraftVersion, 2) === requiredPrefix);
  }

  const caretMatch = normalizedToken.match(/^\^\s*v?(.+)$/u);
  if (caretMatch) {
    const baseVersion = caretMatch[1].trim();
    const lowerDiff = compareMinecraftRequirementVersions(normalizedMinecraftVersion, baseVersion);
    const requiredPrefix = getVersionRequirementPrefix(baseVersion, 1);
    return lowerDiff >= 0
      && (!requiredPrefix || getVersionRequirementPrefix(normalizedMinecraftVersion, 1) === requiredPrefix);
  }

  if (/[.*xX]/u.test(normalizedToken)) {
    return minecraftVersionMatchesWildcard(normalizedToken.replace(/^=+/, ''), normalizedMinecraftVersion);
  }

  const comparatorMatch = normalizedToken.match(/^(>=|<=|>|<|=|==)?\s*v?(.+)$/u);
  if (!comparatorMatch) {
    return false;
  }

  const operator = comparatorMatch[1] || '=';
  const requiredVersion = String(comparatorMatch[2] || '').trim();
  const diff = compareMinecraftRequirementVersions(normalizedMinecraftVersion, requiredVersion);

  if (operator === '>' || operator === '>=') {
    return operator === '>' ? diff > 0 : diff >= 0;
  }
  if (operator === '<' || operator === '<=') {
    return operator === '<' ? diff < 0 : diff <= 0;
  }

  return diff === 0;
}

function minecraftVersionSatisfiesRequirement(requirement, minecraftVersion) {
  if (!requirement) {
    return true;
  }

  if (Array.isArray(requirement)) {
    return requirement.some((entry) => minecraftVersionSatisfiesRequirement(entry, minecraftVersion));
  }

  if (requirement && typeof requirement === 'object') {
    const values = Object.values(requirement).filter(Boolean);
    return values.length === 0
      || values.some((entry) => minecraftVersionSatisfiesRequirement(entry, minecraftVersion));
  }

  const expression = String(requirement || '').trim();
  if (!expression || expression === '*') {
    return true;
  }

  return expression
    .split(/\s*\|\|\s*/u)
    .some((alternative) => {
      const normalizedAlternative = alternative.trim();
      if (/^[\[(].*[\])]$/u.test(normalizedAlternative)) {
        return minecraftVersionSatisfiesToken(normalizedAlternative, minecraftVersion);
      }

      return normalizedAlternative
        .replace(/,/gu, ' ')
        .split(/\s+/u)
        .filter(Boolean)
        .every((token) => minecraftVersionSatisfiesToken(token, minecraftVersion));
    });
}

function getJarMinecraftCompatibility(jarPath, minecraftVersion) {
  const manifestInfo = readFabricModManifest(jarPath);
  if (!manifestInfo?.manifest) {
    return {
      compatible: true,
      requirement: '',
      reasonType: '',
      modName: path.basename(jarPath)
    };
  }

  const manifest = manifestInfo.manifest;
  const requiredMinecraft = manifest?.depends?.minecraft;
  const brokenMinecraft = manifest?.breaks?.minecraft;
  const modName = String(manifest.name || manifest.id || path.basename(jarPath)).trim();

  if (requiredMinecraft && !minecraftVersionSatisfiesRequirement(requiredMinecraft, minecraftVersion)) {
    return {
      compatible: false,
      requirement: formatFabricDependencyRequirement(requiredMinecraft),
      reasonType: 'depends',
      modName
    };
  }

  if (brokenMinecraft && minecraftVersionSatisfiesRequirement(brokenMinecraft, minecraftVersion)) {
    return {
      compatible: false,
      requirement: `nicht ${formatFabricDependencyRequirement(brokenMinecraft)}`,
      reasonType: 'breaks',
      modName
    };
  }

  return {
    compatible: true,
    requirement: formatFabricDependencyRequirement(requiredMinecraft),
    reasonType: '',
    modName
  };
}

function isJarCompatibleWithMinecraft(jarPath, minecraftVersion) {
  return getJarMinecraftCompatibility(jarPath, minecraftVersion).compatible !== false;
}

function isGameVersionListDeclaredForMinecraft(gameVersions, minecraftVersion) {
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  if (!normalizedMinecraftVersion || !Array.isArray(gameVersions)) {
    return false;
  }

  const normalizedGameVersions = gameVersions
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

  return normalizedGameVersions.some((entry) => entry === normalizedMinecraftVersion)
    || normalizedGameVersions.some((entry) => minecraftVersionSatisfiesRequirement(entry, normalizedMinecraftVersion));
}

function isManagedVersionDeclaredForMinecraft(versionEntry, minecraftVersion) {
  const storedGameVersions = Array.isArray(versionEntry?.gameVersions)
    ? versionEntry.gameVersions
    : Array.isArray(versionEntry?.game_versions)
      ? versionEntry.game_versions
      : [];

  return isGameVersionListDeclaredForMinecraft(storedGameVersions, minecraftVersion)
    || textContainsExactMinecraftVersion([
      versionEntry?.fileName,
      versionEntry?.versionNumber,
      versionEntry?.versionName
    ].join(' '), minecraftVersion);
}

function getManagedJarMinecraftCompatibility(versionEntry, minecraftVersion) {
  const libraryPath = String(versionEntry?.libraryPath || '').trim();
  const jarCompatibility = getJarMinecraftCompatibility(libraryPath, minecraftVersion);
  if (jarCompatibility.compatible !== false) {
    return jarCompatibility;
  }

  if (jarCompatibility.reasonType === 'depends'
      && isManagedVersionDeclaredForMinecraft(versionEntry, minecraftVersion)) {
    return {
      ...jarCompatibility,
      compatible: true,
      trustedModrinthGameVersions: true
    };
  }

  return jarCompatibility;
}

function isManagedVersionJarCompatibleWithMinecraft(versionEntry, minecraftVersion) {
  return getManagedJarMinecraftCompatibility(versionEntry, minecraftVersion).compatible !== false;
}

function collectStringValues(value, strings = []) {
  if (typeof value === 'string') {
    strings.push(value);
    return strings;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, strings);
    }
    return strings;
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      strings.push(String(key));
      collectStringValues(item, strings);
    }
  }

  return strings;
}

function getLocalModFileNameSearchTerms(fileName) {
  const parsedPath = path.parse(path.basename(String(fileName || '').trim()));
  const baseName = String(parsedPath.name || '').trim();
  if (!baseName) {
    return [];
  }

  const withoutMinecraftTag = baseName.replace(/[-+_.](?:mc|minecraft)[-+_.]?\d+(?:\.\d+){1,3}.*$/iu, '');
  const withoutLoaderSuffix = withoutMinecraftTag.replace(/[-+_.](?:fabric|forge|neoforge|quilt)(?:[-+_.].*)?$/iu, '');
  const withoutVersionSuffix = withoutLoaderSuffix.replace(/[-+_.]v?\d+(?:\.\d+){1,4}(?:[-+_.].*)?$/iu, '');

  return uniqueStrings([
    withoutVersionSuffix,
    withoutLoaderSuffix,
    withoutMinecraftTag,
    baseName,
    withoutVersionSuffix.replace(/[-+_.]+/g, ' '),
    withoutLoaderSuffix.replace(/[-+_.]+/g, ' ')
  ]).filter((entry) => entry.length >= 2);
}

function getLocalModrinthProjectCandidates(manifest, manifestText = '', fileName = '') {
  const candidates = [];
  const addCandidate = (candidate) => {
    const normalized = String(candidate || '')
      .trim()
      .replace(/^@+/, '')
      .replace(/^\/+|\/+$/g, '');
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  const modrinthUrlPattern = /modrinth\.com\/(?:mod|plugin)\/([^/?#"'\\\s]+)/giu;
  const searchableText = [
    manifestText,
    ...collectStringValues(manifest)
  ].join('\n');
  let match;
  while ((match = modrinthUrlPattern.exec(searchableText)) !== null) {
    addCandidate(match[1]);
  }

  const customModrinth = manifest?.custom?.modrinth;
  if (customModrinth && typeof customModrinth === 'object') {
    addCandidate(customModrinth.project_id || customModrinth.projectId || customModrinth.slug);
  }

  addCandidate(manifest?.id);
  for (const term of getLocalModFileNameSearchTerms(fileName)) {
    addCandidate(term);
  }
  return candidates;
}

function normalizeLocalModSearchText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function scoreLocalModrinthSearchHit(hit, manifest, candidates = []) {
  const projectId = String(hit?.project_id || hit?.id || '').trim().toLowerCase();
  const slug = String(hit?.slug || '').trim().toLowerCase();
  const title = String(hit?.title || '').trim().toLowerCase();
  const normalizedTitle = normalizeLocalModSearchText(title);
  const normalizedSlug = normalizeLocalModSearchText(slug);
  const normalizedProjectId = normalizeLocalModSearchText(projectId);
  const normalizedCandidates = candidates
    .map((candidate) => normalizeLocalModSearchText(candidate))
    .filter(Boolean);
  const manifestId = normalizeLocalModSearchText(manifest?.id);
  const manifestName = normalizeLocalModSearchText(manifest?.name);

  let score = 0;
  for (const candidate of normalizedCandidates) {
    if (candidate && (candidate === normalizedProjectId || candidate === normalizedSlug)) {
      score += 100;
    } else if (candidate && normalizedTitle === candidate) {
      score += 80;
    } else if (candidate && normalizedSlug && (normalizedSlug.includes(candidate) || candidate.includes(normalizedSlug))) {
      score += 35;
    } else if (candidate && normalizedTitle && (normalizedTitle.includes(candidate) || candidate.includes(normalizedTitle))) {
      score += 25;
    }
  }

  if (manifestId && (manifestId === normalizedSlug || manifestId === normalizedProjectId)) {
    score += 80;
  } else if (manifestId && normalizedSlug.includes(manifestId)) {
    score += 30;
  }

  if (manifestName && manifestName === normalizedTitle) {
    score += 80;
  } else if (manifestName && (normalizedTitle.includes(manifestName) || manifestName.includes(normalizedTitle))) {
    score += 30;
  }

  return score;
}

async function findModrinthProjectForLocalMod(manifest, manifestText = '', fileName = '') {
  const candidates = getLocalModrinthProjectCandidates(manifest, manifestText, fileName);

  for (const candidate of candidates) {
    try {
      const project = await fetchModrinthProject(candidate);
      if (normalizeModrinthProjectType(project?.project_type || 'mod') === 'mod') {
        return { project, candidates };
      }
    } catch (_error) {
      // Try the next direct id/slug candidate.
    }
  }

  const searchTerms = uniqueStrings([
    ...candidates,
    manifest?.name,
    String(manifest?.id || '').replace(/[-_]+/g, ' '),
    ...getLocalModFileNameSearchTerms(fileName)
  ]).filter((entry) => entry.length >= 2);

  for (const term of searchTerms) {
    try {
      const searchUrl = new URL(`${MODRINTH_API_BASE_URL}/search`);
      searchUrl.searchParams.set('query', term);
      searchUrl.searchParams.set('limit', '10');
      searchUrl.searchParams.set('facets', JSON.stringify([
        ['project_type:mod'],
        ['categories:fabric']
      ]));

      const searchResponse = await fetchJson(searchUrl.toString(), {
        headers: MODRINTH_API_HEADERS,
        allowedHosts: new Set(['api.modrinth.com'])
      });
      const hits = Array.isArray(searchResponse?.hits) ? searchResponse.hits : [];
      const normalizedTerm = term.trim().toLowerCase();
      const exactHit = hits.find((hit) => {
        const projectId = String(hit?.project_id || hit?.id || '').trim().toLowerCase();
        const slug = String(hit?.slug || '').trim().toLowerCase();
        const title = String(hit?.title || '').trim().toLowerCase();
        return projectId === normalizedTerm || slug === normalizedTerm || title === normalizedTerm;
      }) || null;
      const rankedHits = hits
        .map((hit) => ({
          hit,
          score: scoreLocalModrinthSearchHit(hit, manifest, candidates)
        }))
        .sort((left, right) => right.score - left.score);
      const selectedHit = exactHit
        || (rankedHits[0]?.score >= 60 ? rankedHits[0].hit : null)
        || (hits.length === 1 ? hits[0] : null);
      const projectId = String(selectedHit?.project_id || selectedHit?.id || selectedHit?.slug || '').trim();
      if (!projectId) {
        continue;
      }

      const project = await fetchModrinthProject(projectId);
      if (normalizeModrinthProjectType(project?.project_type || 'mod') === 'mod') {
        return { project, candidates };
      }
    } catch (_error) {
      // Search is best-effort; unknown local jars are disabled instead of loaded.
    }
  }

  return { project: null, candidates };
}

function findExistingManagedProjectIdForRemoteProject(state, remoteProject, candidates = []) {
  const remoteId = String(remoteProject?.id || '').trim();
  const remoteSlug = String(remoteProject?.slug || '').trim().toLowerCase();
  const normalizedCandidates = new Set(
    candidates.map((candidate) => String(candidate || '').trim().toLowerCase()).filter(Boolean)
  );

  for (const [projectId, project] of Object.entries(state.projects || {})) {
    const normalizedProjectId = String(projectId || project?.projectId || '').trim().toLowerCase();
    const normalizedSlug = String(project?.slug || '').trim().toLowerCase();

    if ((remoteId && normalizedProjectId === remoteId.toLowerCase())
        || (remoteSlug && normalizedSlug === remoteSlug)
        || normalizedCandidates.has(normalizedProjectId)
        || (normalizedSlug && normalizedCandidates.has(normalizedSlug))) {
      return projectId;
    }
  }

  return '';
}

function discardImportedLocalModFile(filePath, modContext) {
  const isKnownModStoragePath = isPathInsideDirectory(modContext.modsDir, filePath)
    || isPathInsideDirectory(getDisabledModsDir(modContext), filePath);
  if (!filePath || !isKnownModStoragePath || !fs.existsSync(filePath)) {
    return '';
  }

  try {
    fs.unlinkSync(filePath);
    return filePath;
  } catch (_error) {
    return '';
  }
}

function isKeptLocalModFile(state, filePath, fileName = path.basename(filePath || '')) {
  const keptEntries = normalizeKeptLocalModEntries(state?.keptLocalMods);
  if (!keptEntries.length) {
    return false;
  }

  const normalizedFileName = String(fileName || '').trim().toLowerCase();
  let sha1 = '';
  if (filePath && fs.existsSync(filePath)) {
    try {
      sha1 = getFileSha1(filePath).toLowerCase();
    } catch (_error) {
      sha1 = '';
    }
  }

  return keptEntries.some((entry) => (
    (entry.sha1 && sha1 && entry.sha1 === sha1)
    || (entry.fileName && normalizedFileName && entry.fileName.toLowerCase() === normalizedFileName)
  ));
}

function removeManagedProjectFilesFromState(state, modContext, projectId) {
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedProjectId) {
    return false;
  }

  let changed = false;
  for (const entry of state.activeSync?.files || []) {
    if (entry?.projectId !== normalizedProjectId || !entry.targetPath) {
      continue;
    }

    if (isPathInsideDirectory(modContext.modsDir, entry.targetPath) && fs.existsSync(entry.targetPath)) {
      try {
        fs.unlinkSync(entry.targetPath);
      } catch (_error) {
        // Keep the exception even if stale cleanup fails.
      }
    }
  }

  if (state.projects?.[normalizedProjectId] && !isProtectedManagedProject(normalizedProjectId, state.projects[normalizedProjectId])) {
    delete state.projects[normalizedProjectId];
    changed = true;
  }
  const nextDisabledProjects = (state.disabledProjects || []).filter((entry) => entry !== normalizedProjectId);
  const nextAutoDisabledProjects = (state.autoDisabledProjects || []).filter((entry) => entry !== normalizedProjectId);
  const nextActiveFiles = (state.activeSync?.files || []).filter((entry) => entry?.projectId !== normalizedProjectId);
  if (nextDisabledProjects.length !== (state.disabledProjects || []).length) {
    state.disabledProjects = nextDisabledProjects;
    changed = true;
  }
  if (nextAutoDisabledProjects.length !== (state.autoDisabledProjects || []).length) {
    state.autoDisabledProjects = nextAutoDisabledProjects;
    changed = true;
  }
  if (nextActiveFiles.length !== (state.activeSync?.files || []).length) {
    state.activeSync = {
      minecraftVersion: String(state.activeSync?.minecraftVersion || '').trim(),
      files: nextActiveFiles
    };
    changed = true;
  }
  if (state.disabledProjectReasons?.[normalizedProjectId]) {
    delete state.disabledProjectReasons[normalizedProjectId];
    changed = true;
  }

  return changed;
}

async function rememberKeptLocalModException(modContext, filePath, sourceFileName = '') {
  if (!filePath || !fs.existsSync(filePath) || !isModStoragePath(modContext, filePath)) {
    return;
  }

  const fileName = path.basename(filePath);
  let sha1 = '';
  try {
    sha1 = getFileSha1(filePath).toLowerCase();
  } catch (_error) {
    sha1 = '';
  }

  let projectId = '';
  try {
    const manifestInfo = readFabricModManifest(filePath);
    if (manifestInfo?.manifest) {
      const { project: remoteProject, candidates } = await findModrinthProjectForLocalMod(
        manifestInfo.manifest,
        manifestInfo.manifestText,
        fileName
      );
      if (remoteProject) {
        const stateForMatch = readModsState(modContext);
        projectId = findExistingManagedProjectIdForRemoteProject(stateForMatch, remoteProject, candidates)
          || String(remoteProject.id || remoteProject.slug || '').trim();
      }
    }
  } catch (_error) {
    projectId = '';
  }

  const state = readModsState(modContext);
  state.keptLocalMods = normalizeKeptLocalModEntries([
    ...(state.keptLocalMods || []),
    {
      fileName,
      sha1,
      projectId,
      source: sourceFileName || fileName,
      keptAt: new Date().toISOString()
    }
  ]);
  if (projectId) {
    state.keptLocalProjectIds = uniqueStrings([...(state.keptLocalProjectIds || []), projectId]);
    state.ignoredDefaultProjects = uniqueStrings([...(state.ignoredDefaultProjects || []), projectId]);
    removeManagedProjectFilesFromState(state, modContext, projectId);
  }
  writeModsState(state, modContext);
}

async function importStandardLocalModrinthMods(modContext, minecraftVersion) {
  if (!minecraftVersion || !fs.existsSync(modContext.modsDir)) {
    return [];
  }

  let state = readModsState(modContext);
  const warnings = [];
  const activeManagedPaths = new Set(
    (state.activeSync?.files || [])
      .map((entry) => String(entry?.targetPath || '').trim())
      .filter(Boolean)
      .map((targetPath) => path.resolve(targetPath))
  );
  let changed = false;

  const importDirs = uniqueStrings([
    modContext.modsDir,
    getDisabledModsDir(modContext)
  ]).filter((directory) => fs.existsSync(directory));

  for (const importDir of importDirs) {
    for (const fileName of fs.readdirSync(importDir).filter((entry) => entry.toLowerCase().endsWith('.jar'))) {
      const filePath = path.join(importDir, fileName);
      const isActiveModsDir = getComparablePath(importDir) === getComparablePath(modContext.modsDir);
      if (!isPathInsideDirectory(importDir, filePath) || (isActiveModsDir && activeManagedPaths.has(path.resolve(filePath)))) {
        continue;
      }
      if (isKeptLocalModFile(state, filePath, fileName)) {
        continue;
      }

      const manifestInfo = readFabricModManifest(filePath);
      if (!manifestInfo?.manifest) {
        continue;
      }

      const { project: remoteProject, candidates } = await findModrinthProjectForLocalMod(
        manifestInfo.manifest,
        manifestInfo.manifestText,
        fileName
      );

      if (!remoteProject) {
        if (isActiveModsDir) {
          warnings.push(`${fileName}: Konnte nicht automatisch als Modrinth-Mod erkannt werden und bleibt aktiv, solange die lokale JAR zu Minecraft ${minecraftVersion} passt.`);
        } else {
          warnings.push(`${fileName}: Konnte nicht automatisch passend zur Minecraft-Version gefunden werden.`);
        }
        continue;
      }

      state = readModsState(modContext);
      const projectId = String(remoteProject.id || remoteProject.slug || '').trim();
      if (!projectId) {
        continue;
      }

      const existingProjectId = findExistingManagedProjectIdForRemoteProject(state, remoteProject, candidates);
      const targetProjectId = existingProjectId || projectId;
      if ((state.keptLocalProjectIds || []).includes(targetProjectId)) {
        continue;
      }
      const currentProject = state.projects[targetProjectId] || {};
      state.projects[targetProjectId] = {
        projectId: targetProjectId,
        slug: String(remoteProject.slug || currentProject.slug || manifestInfo.manifest.id || '').trim(),
        title: String(remoteProject.title || remoteProject.name || currentProject.title || manifestInfo.manifest.name || targetProjectId).trim(),
        description: String(remoteProject.description || currentProject.description || manifestInfo.manifest.description || '').trim(),
        iconUrl: String(remoteProject.icon_url || currentProject.iconUrl || '').trim(),
        clientSide: String(remoteProject.client_side || currentProject.clientSide || '').trim(),
        serverSide: String(remoteProject.server_side || currentProject.serverSide || '').trim(),
        versions: currentProject.versions || {}
      };

      const archivedPath = discardImportedLocalModFile(filePath, modContext);
      if (archivedPath) {
        warnings.push(`${state.projects[targetProjectId].title}: Lokale JAR wurde übernommen und wird jetzt passend zur Minecraft-Version verwaltet.`);
      } else if (fs.existsSync(filePath)) {
        warnings.push(`${fileName}: Konnte nicht aus dem Mods-Ordner verschoben werden.`);
      }

      changed = true;
      writeModsState(state, modContext);
    }
  }

  if (changed) {
    writeModsState(state, modContext);
  }

  return warnings;
}

async function repairLocalModFileWithModrinthBeforeDisable(filePath, modContext, minecraftVersion, options = {}) {
  const fileName = path.basename(String(filePath || ''));
  const warnings = Array.isArray(options.warnings) ? options.warnings : [];
  const reason = String(options.reason || 'automatic-disable-preflight').trim();
  const isKnownModStoragePath = isPathInsideDirectory(modContext.modsDir, filePath)
    || isPathInsideDirectory(getDisabledModsDir(modContext), filePath);
  if (!filePath || !fileName.toLowerCase().endsWith('.jar') || !isKnownModStoragePath || !fs.existsSync(filePath)) {
    return { repaired: false, reason: 'file is not a safe local mod JAR' };
  }

  if (isJarFileCorrupted(filePath)) {
    return { repaired: false, reason: 'local JAR is corrupted and cannot be identified safely' };
  }

  let remoteProject = null;
  let candidates = [];
  try {
    const sha1 = getFileSha1(filePath);
    const versionData = await fetchModrinthVersionByFileHash(sha1);
    const projectId = String(versionData?.project_id || '').trim();
    if (projectId) {
      const project = await fetchModrinthProject(projectId, { forceRefresh: true });
      if (normalizeModrinthProjectType(project?.project_type || 'mod') === 'mod') {
        remoteProject = project;
        candidates = [projectId, project?.slug].filter(Boolean);
      }
    }
  } catch (_error) {
    remoteProject = null;
  }

  const manifestInfo = readFabricModManifest(filePath);
  if (!remoteProject && manifestInfo?.manifest) {
    try {
      const found = await findModrinthProjectForLocalMod(
        manifestInfo.manifest,
        manifestInfo.manifestText,
        fileName
      );
      remoteProject = found.project || null;
      candidates = found.candidates || [];
    } catch (_error) {
      remoteProject = null;
    }
  }

  if (!remoteProject) {
    logger.warn('Local mod was not disabled until Modrinth lookup was attempted', {
      fileName,
      minecraftVersion,
      reason,
      result: 'no Modrinth project found'
    });
    return { repaired: false, reason: 'no Modrinth project found' };
  }

  let state = readModsState(modContext);
  const remoteProjectId = String(remoteProject.id || remoteProject.project_id || remoteProject.slug || '').trim();
  const targetProjectId = findExistingManagedProjectIdForRemoteProject(state, remoteProject, candidates) || remoteProjectId;
  if (!targetProjectId) {
    return { repaired: false, reason: 'Modrinth project id could not be resolved' };
  }

  const currentProject = state.projects[targetProjectId] || {};
  state.projects[targetProjectId] = {
    projectId: targetProjectId,
    slug: String(remoteProject.slug || currentProject.slug || manifestInfo?.manifest?.id || '').trim(),
    title: String(remoteProject.title || remoteProject.name || currentProject.title || manifestInfo?.manifest?.name || targetProjectId).trim(),
    description: String(remoteProject.description || currentProject.description || manifestInfo?.manifest?.description || '').trim(),
    iconUrl: String(remoteProject.icon_url || currentProject.iconUrl || '').trim(),
    clientSide: String(remoteProject.client_side || currentProject.clientSide || '').trim(),
    serverSide: String(remoteProject.server_side || currentProject.serverSide || '').trim(),
    versions: currentProject.versions || {}
  };
  state.disabledProjects = (state.disabledProjects || []).filter((entry) => entry !== targetProjectId);
  state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((entry) => entry !== targetProjectId);
  if (state.disabledProjectReasons) {
    delete state.disabledProjectReasons[targetProjectId];
  }
  writeModsState(state, modContext);

  try {
    const installResult = await installManagedProjectVersion(state.projects[targetProjectId], minecraftVersion, {
      forceRefresh: true,
      visitedProjects: new Set(),
      modContext
    });
    const archivedPath = discardImportedLocalModFile(filePath, modContext);
    warnings.push(`${state.projects[targetProjectId].title || targetProjectId}: Lokale Mod wurde vor dem Deaktivieren auf Modrinth gefunden und passend ersetzt.`);
    warnings.push(...(installResult.warnings || []));
    logger.info('Local mod repaired through Modrinth before disable', {
      fileName,
      projectId: targetProjectId,
      minecraftVersion,
      archivedPath,
      reason
    });
    return {
      repaired: true,
      projectId: targetProjectId,
      title: state.projects[targetProjectId].title || targetProjectId,
      archivedPath
    };
  } catch (error) {
    logger.warn('Local mod Modrinth repair failed before disable', {
      fileName,
      projectId: targetProjectId,
      minecraftVersion,
      reason,
      error: serializeError(error)
    });
    return { repaired: false, reason: error.message };
  }
}

function disableUnmanagedStandardModFile(filePath, modContext, details = {}) {
  if (!filePath || !isPathInsideDirectory(modContext.modsDir, filePath) || !fs.existsSync(filePath)) {
    return '';
  }

  const disabledPath = getDisabledModPath(filePath, modContext);
  if (!isPathInsideDirectory(getDisabledModsDir(modContext), disabledPath)) {
    return '';
  }

  try {
    ensureDir(path.dirname(disabledPath));
    recordModDisableEntry(modContext, {
      fileName: path.basename(filePath),
      filePath,
      reason: details.reason || 'Technischer Mod-Konflikt oder nachgewiesene Inkompatibilität.',
      technicalEvidence: details.technicalEvidence || ''
    });
    const movedPath = moveFileIfExists(filePath, disabledPath);
    rememberDisabledFileReason(modContext, path.basename(movedPath || disabledPath), {
      reason: details.reason || 'Technischer Mod-Konflikt oder nachgewiesene Inkompatibilität.',
      technicalEvidence: details.technicalEvidence || '',
      automated: true
    });
    return disabledPath;
  } catch (_error) {
    return '';
  }
}

async function disableUnmanagedStandardModFiles(modContext, warnings = [], options = {}) {
  if (!fs.existsSync(modContext.modsDir)) {
    return warnings;
  }

  const strictUnmanaged = Boolean(options.strictUnmanaged);
  const state = readModsState(modContext);
  const activeManagedPaths = new Set(
    (state.activeSync?.files || [])
      .map((entry) => String(entry?.targetPath || '').trim())
      .filter(Boolean)
      .map((targetPath) => path.resolve(targetPath))
  );

  for (const fileName of fs.readdirSync(modContext.modsDir).filter((entry) => entry.toLowerCase().endsWith('.jar'))) {
    const filePath = path.join(modContext.modsDir, fileName);
    if (!isPathInsideDirectory(modContext.modsDir, filePath) || activeManagedPaths.has(path.resolve(filePath))) {
      continue;
    }

    if (isRequiredModFileName(fileName)) {
      continue;
    }

    const compatibility = getJarMinecraftCompatibility(filePath, modContext.minecraftVersion);
    if (compatibility.compatible === false) {
      const repairResult = await repairLocalModFileWithModrinthBeforeDisable(filePath, modContext, modContext.minecraftVersion, {
        warnings,
        reason: `local JAR requires ${compatibility.requirement || 'another Minecraft version'}`
      });
      if (repairResult.repaired) {
        continue;
      }

      const requirement = compatibility.requirement || 'eine andere Minecraft-Version';
      const disabledPath = disableUnmanagedStandardModFile(filePath, modContext, {
        reason: `Minecraft-Version nicht kompatibel: verlangt ${requirement}.`,
        technicalEvidence: `Modrinth-Reparatur wurde zuerst versucht und ist fehlgeschlagen: ${repairResult.reason || 'keine passende Version gefunden'}. fabric.mod.json depends.minecraft=${requirement}`
      });
      if (disabledPath) {
        warnings.push(`${fileName}: Wurde ausgeschaltet, weil die JAR Minecraft ${requirement} verlangt.`);
      } else if (fs.existsSync(filePath)) {
        warnings.push(`${fileName}: Inkompatibel (${requirement}), konnte aber nicht sicher ausgeschaltet werden.`);
      }
      continue;
    }

    if (isKeptLocalModFile(state, filePath, fileName)) {
      warnings.push(`${fileName}: Behaltene lokale Mod bleibt aktiv. Manuelle Ein-/Auswahl hat Vorrang.`);
      continue;
    }

    if (strictUnmanaged && compatibility.compatible === false) {
      const disabledPath = disableUnmanagedStandardModFile(filePath, modContext, {
        reason: 'Nicht vom Launcher verwaltete Mod im Standardprofil.',
        technicalEvidence: `Vorbeugend deaktiviert, damit Minecraft ${modContext.minecraftVersion || 'aktuell'} nicht durch unbekannte Mods crasht.`
      });
      if (disabledPath) {
        warnings.push(`${fileName}: Nicht verwaltet und wurde im Standardprofil vorsorglich ausgeschaltet.`);
      } else if (fs.existsSync(filePath)) {
        warnings.push(`${fileName}: Nicht verwaltet, konnte aber nicht sicher ausgeschaltet werden.`);
      }
      continue;
    }

    warnings.push(`${fileName}: Manuelle Mod bleibt aktiv. Keine eindeutige Beschädigung oder Inkompatibilität nachgewiesen.`);
  }

  return warnings;
}

function getKnownConflictIdentityForFile(filePath, fileName) {
  const manifestInfo = readFabricModManifest(filePath);
  const manifest = manifestInfo?.manifest || {};
  const id = String(manifest.id || '').trim();
  const name = String(manifest.name || '').trim();
  return {
    projectId: '',
    label: fileName,
    haystack: [fileName, id, name].join(' ').toLowerCase()
  };
}

function getActiveModConflictIdentities(modContext, state, activeFiles = []) {
  const identities = [];
  for (const entry of activeFiles || []) {
    const project = state.projects?.[entry.projectId] || {};
    identities.push({
      projectId: String(entry.projectId || ''),
      label: project.title || entry.fileName || entry.projectId,
      haystack: [
        entry.projectId,
        entry.fileName,
        project.slug,
        project.title
      ].join(' ').toLowerCase()
    });
  }

  if (!fs.existsSync(modContext.modsDir)) {
    return identities;
  }

  const activeManagedPaths = new Set(
    (activeFiles || [])
      .map((entry) => String(entry?.targetPath || '').trim())
      .filter(Boolean)
      .map((targetPath) => path.resolve(targetPath))
  );
  for (const fileName of fs.readdirSync(modContext.modsDir).filter((entry) => entry.toLowerCase().endsWith('.jar'))) {
    const filePath = path.join(modContext.modsDir, fileName);
    if (!isPathInsideDirectory(modContext.modsDir, filePath) || activeManagedPaths.has(path.resolve(filePath))) {
      continue;
    }
    identities.push(getKnownConflictIdentityForFile(filePath, fileName));
  }

  return identities;
}

function modIdentityMatchesConflictSide(identity, side) {
  const projectIds = new Set((side.projectIds || []).map((entry) => String(entry || '').trim()).filter(Boolean));
  if (identity.projectId && projectIds.has(identity.projectId)) {
    return true;
  }

  return (side.terms || [])
    .map((term) => String(term || '').trim().toLowerCase())
    .filter(Boolean)
    .some((term) => identity.haystack.includes(term));
}

function detectKnownModConflictWarnings(modContext, state, activeFiles = []) {
  const identities = getActiveModConflictIdentities(modContext, state, activeFiles);
  const warnings = [];
  for (const conflict of KNOWN_MOD_CONFLICTS) {
    const leftMatches = identities.filter((identity) => modIdentityMatchesConflictSide(identity, conflict.left));
    const rightMatches = identities.filter((identity) => modIdentityMatchesConflictSide(identity, conflict.right));
    const hasDistinctMatches = leftMatches.some((left) => rightMatches.some((right) => (
      left.projectId || left.label || left.haystack
    ) !== (
      right.projectId || right.label || right.haystack
    )));
    if (!leftMatches.length || !rightMatches.length || !hasDistinctMatches) {
      continue;
    }

    warnings.push(`${conflict.title}: ${conflict.message}`);
    logger.warn('Known mod conflict detected', {
      conflictId: conflict.id,
      left: leftMatches.map((entry) => entry.label),
      right: rightMatches.map((entry) => entry.label),
      minecraftVersion: modContext.minecraftVersion
    });
  }
  return uniqueStrings(warnings);
}

function ensureBundledRequiredModsForContext(modContext = getActiveModContext(), minecraftVersion = modContext.minecraftVersion) {
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  if (!normalizedMinecraftVersion) {
    return [];
  }

  const state = readModsState(modContext);
  const warnings = [];
  let changed = false;
  const disabledProjects = new Set(state.disabledProjects || []);

  for (const requiredMod of REQUIRED_BUNDLED_MODS) {
    if (!requiredMod.canDisable && disabledProjects.delete(requiredMod.projectId)) {
      changed = true;
    }
  }
  if (changed) {
    state.disabledProjects = [...disabledProjects];
  }

  for (const requiredMod of REQUIRED_BUNDLED_MODS) {
    if (!isRequiredBundledModCompatible(requiredMod, normalizedMinecraftVersion)) {
      warnings.push(`${requiredMod.title}: Für ${normalizedMinecraftVersion} deaktiviert, weil kein passender Release-Build vorhanden ist.`);
      continue;
    }

    const assetPath = getRequiredBundledModAssetPath(requiredMod, normalizedMinecraftVersion);
    const fileName = getRequiredBundledModFileName(requiredMod, normalizedMinecraftVersion);

    if (!fs.existsSync(assetPath)) {
      warnings.push(`${requiredMod.title}: Pflichtmod-Datei fehlt (${fileName}).`);
      continue;
    }

    const stats = fs.statSync(assetPath);
    const currentProject = state.projects[requiredMod.projectId] || {};
    const versions = currentProject.versions || {};
    const currentVersion = versions[normalizedMinecraftVersion] || {};
    const nextVersion = {
      minecraftVersion: normalizedMinecraftVersion,
      versionId: `bundled-${requiredMod.versionNumber}`,
      versionNumber: requiredMod.versionNumber,
      versionName: requiredMod.versionName,
      versionType: 'release',
      publishedAt: '',
      fileName,
      libraryPath: assetPath,
      size: stats.size,
      sha1: '',
      sha512: '',
      gameVersions: [normalizedMinecraftVersion],
      matchScore: 3,
      checkedMinecraftVersion: normalizedMinecraftVersion,
      dependencies: [],
      dependencyDetails: [],
      syncedAt: currentVersion.syncedAt || new Date().toISOString()
    };

    state.projects[requiredMod.projectId] = {
      projectId: requiredMod.projectId,
      slug: requiredMod.slug,
      title: requiredMod.title,
      description: requiredMod.description,
      iconUrl: String(requiredMod.iconUrl || '').trim(),
      clientSide: 'required',
      serverSide: 'optional',
      versions: {
        ...versions,
        [normalizedMinecraftVersion]: nextVersion
      }
    };
    changed = true;
  }

  if (changed) {
    writeModsState(state, modContext);
  }

  return warnings;
}

function ensureDefaultManagedModsForContext(modContext = getActiveModContext(), minecraftVersion = modContext.minecraftVersion) {
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  if (!normalizedMinecraftVersion) {
    return;
  }

  const state = readModsState(modContext);
  const ignoredDefaultProjects = new Set(state.ignoredDefaultProjects || []);
  let changed = false;

  for (const projectReference of DEFAULT_PACK_PROJECTS) {
    const projectId = getModrinthProjectId(projectReference);
    if (!projectId
        || (modContext?.type === 'pack' && projectId !== FABRIC_API_PROJECT_ID)
        || ignoredDefaultProjects.has(projectId)
        || isManagedProjectHiddenForMinecraftVersion(projectId, normalizedMinecraftVersion)) {
      continue;
    }

    const currentProject = state.projects[projectId] || {};
    state.projects[projectId] = {
      projectId,
      slug: String(currentProject.slug || projectReference.slug || '').trim(),
      title: String(currentProject.title || projectReference.title || projectId).trim(),
      description: String(currentProject.description || '').trim(),
      iconUrl: String(currentProject.iconUrl || '').trim(),
      clientSide: String(currentProject.clientSide || 'required').trim(),
      serverSide: String(currentProject.serverSide || 'optional').trim(),
      versions: currentProject.versions || {}
    };
    changed = true;
  }

  if (changed) {
    writeModsState(state, modContext);
  }
}

function resolveFabricDeclaredDefaultConflicts(modContext, warnings = []) {
  const state = readModsState(modContext);
  const records = [];
  for (const [projectId, project] of Object.entries(state.projects || {})) {
    const versions = Object.values(project?.versions || {});
    const preferredVersion = project?.versions?.[modContext.minecraftVersion];
    const versionEntry = preferredVersion?.libraryPath && fs.existsSync(preferredVersion.libraryPath)
      ? preferredVersion
      : versions.find((entry) => entry?.libraryPath && fs.existsSync(entry.libraryPath));
    if (!versionEntry?.libraryPath) {
      continue;
    }
    const manifest = readFabricModManifest(versionEntry.libraryPath)?.manifest;
    const modId = String(manifest?.id || '').trim();
    if (!manifest || !modId) {
      continue;
    }
    records.push({
      projectId,
      project,
      versionEntry,
      manifest,
      modId,
      version: String(manifest.version || versionEntry.versionNumber || '').trim()
    });
  }

  const byModId = new Map(records.map((record) => [record.modId, record]));
  const conflictingProjectIds = new Map();
  for (const breaker of records) {
    for (const [brokenModId, requirement] of Object.entries(breaker.manifest?.breaks || {})) {
      if (brokenModId === 'minecraft' || brokenModId === 'fabricloader' || brokenModId === 'java') {
        continue;
      }
      const broken = byModId.get(brokenModId);
      if (!broken) {
        continue;
      }
      const brokenIdentifiers = [
        broken.projectId,
        broken.project?.slug,
        broken.modId
      ].map((entry) => String(entry || '').trim().toLowerCase());
      if (!broken || broken.projectId === breaker.projectId
          || !brokenIdentifiers.some((entry) => OPTIONAL_DEFAULT_CONFLICT_IDENTIFIERS.has(entry))) {
        continue;
      }
      if (requirement && broken.version
          && !minecraftVersionSatisfiesRequirement(requirement, broken.version)) {
        continue;
      }
      conflictingProjectIds.set(broken.projectId, {
        broken,
        breaker,
        requirement
      });
    }
  }

  if (!conflictingProjectIds.size) {
    return warnings;
  }

  for (const [projectId, conflict] of conflictingProjectIds) {
    for (const activeFile of state.activeSync?.files || []) {
      if (activeFile?.projectId !== projectId || !activeFile.targetPath
          || !isPathInsideDirectory(modContext.modsDir, activeFile.targetPath)) {
        continue;
      }
      try {
        if (fs.existsSync(activeFile.targetPath)) fs.unlinkSync(activeFile.targetPath);
      } catch (_error) {
        // Stale files are removed by the regular sync cleanup below.
      }
    }
    for (const fileName of fs.existsSync(modContext.modsDir) ? fs.readdirSync(modContext.modsDir) : []) {
      if (!fileName.toLowerCase().endsWith('.jar')) {
        continue;
      }
      const filePath = path.join(modContext.modsDir, fileName);
      if (!isPathInsideDirectory(modContext.modsDir, filePath)) {
        continue;
      }
      const fileModId = String(readFabricModManifest(filePath)?.manifest?.id || '').trim();
      if (fileModId !== conflict.broken.modId) {
        continue;
      }
      try {
        fs.unlinkSync(filePath);
      } catch (_error) {
        warnings.push(`${fileName} konnte nicht automatisch aus dem konfliktbehafteten Profil entfernt werden.`);
      }
    }
    delete state.projects[projectId];
    const matchingDefaultProjectIds = DEFAULT_PACK_PROJECTS
      .filter((entry) => [entry?.projectId, entry?.slug]
        .map((value) => String(value || '').trim().toLowerCase())
        .includes(String(conflict.broken.modId || '').trim().toLowerCase()))
      .map((entry) => String(entry.projectId || '').trim())
      .filter(Boolean);
    state.ignoredDefaultProjects = uniqueStrings([
      ...(state.ignoredDefaultProjects || []),
      projectId,
      ...matchingDefaultProjectIds
    ]);
    state.disabledProjects = (state.disabledProjects || []).filter((entry) => entry !== projectId);
    state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((entry) => entry !== projectId);
    state.activeSync.files = (state.activeSync?.files || []).filter((entry) => entry?.projectId !== projectId);
    warnings.push(
      `${conflict.broken.project?.title || conflict.broken.modId} wurde deaktiviert, weil `
      + `${conflict.breaker.project?.title || conflict.breaker.modId} diese Mod ausdrücklich als inkompatibel markiert.`
    );
  }
  writeModsState(state, modContext);
  return warnings;
}

function isDefaultManagedProjectIgnored(modContext, projectId) {
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedProjectId) {
    return false;
  }
  if (isRequiredDefaultManagedProject(normalizedProjectId)) {
    return false;
  }

  const state = readModsState(modContext);
  return (state.ignoredDefaultProjects || []).includes(normalizedProjectId);
}

function ensureModsState(modContext = getActiveModContext()) {
  ensureDir(modContext.libraryDir);
  if (!fs.existsSync(modContext.stateFile)) {
    ROBUSTNESS.writeJsonFileAtomic(modContext.stateFile, getDefaultModsState(), {
      label: 'mods-state',
      backup: false,
      metadata: {
        createdDefault: true,
        contextType: modContext.type,
        minecraftVersion: modContext.minecraftVersion
      }
    });
  }
}

function normalizeDisableReasonEntry(rawEntry = {}) {
  return {
    reason: String(rawEntry?.reason || '').trim(),
    technicalEvidence: String(rawEntry?.technicalEvidence || '').trim(),
    disabledAt: String(rawEntry?.disabledAt || rawEntry?.createdAt || '').trim(),
    source: String(rawEntry?.source || '').trim()
  };
}

function normalizeDisabledReasonMap(rawValue) {
  const normalized = {};
  const rawMap = rawValue && typeof rawValue === 'object' ? rawValue : {};
  for (const [key, rawEntry] of Object.entries(rawMap)) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) {
      continue;
    }

    const entry = normalizeDisableReasonEntry(rawEntry);
    if (entry.reason || entry.technicalEvidence) {
      normalized[normalizedKey] = entry;
    }
  }
  return normalized;
}

function normalizeKeptLocalModEntries(rawValue) {
  return (Array.isArray(rawValue) ? rawValue : [])
    .map((entry) => {
      const fileName = String(entry?.fileName || '').trim();
      const sha1 = String(entry?.sha1 || '').trim().toLowerCase();
      const projectId = String(entry?.projectId || '').trim();
      const source = String(entry?.source || '').trim();
      const keptAt = String(entry?.keptAt || '').trim();
      if (!fileName && !sha1 && !projectId) {
        return null;
      }

      return {
        fileName,
        sha1,
        projectId,
        source,
        keptAt
      };
    })
    .filter(Boolean);
}

function normalizeModsState(rawState) {
  const projects = {};
  const rawProjects = rawState && typeof rawState === 'object' && rawState.projects && typeof rawState.projects === 'object'
    ? rawState.projects
    : {};

  for (const [projectKey, rawProject] of Object.entries(rawProjects)) {
    const projectId = normalizeManagedProjectId(rawProject?.projectId || projectKey || '');
    if (!projectId) {
      continue;
    }

    const versions = {};
    const rawVersions = rawProject?.versions && typeof rawProject.versions === 'object'
      ? rawProject.versions
      : {};

    for (const [minecraftVersionKey, rawVersion] of Object.entries(rawVersions)) {
      const minecraftVersion = String(rawVersion?.minecraftVersion || minecraftVersionKey || '').trim();
      if (!minecraftVersion) {
        continue;
      }

      versions[minecraftVersion] = {
        minecraftVersion,
        versionId: String(rawVersion?.versionId || '').trim(),
        versionNumber: String(rawVersion?.versionNumber || '').trim(),
        versionName: String(rawVersion?.versionName || '').trim(),
        versionType: String(rawVersion?.versionType || '').trim(),
        publishedAt: String(rawVersion?.publishedAt || '').trim(),
        fileName: String(rawVersion?.fileName || '').trim(),
        libraryPath: String(rawVersion?.libraryPath || '').trim(),
        size: Number(rawVersion?.size || 0),
        sha1: String(rawVersion?.sha1 || '').trim().toLowerCase(),
        sha512: String(rawVersion?.sha512 || '').trim().toLowerCase(),
        gameVersions: Array.isArray(rawVersion?.gameVersions)
          ? rawVersion.gameVersions.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [],
        loaders: Array.isArray(rawVersion?.loaders)
          ? rawVersion.loaders.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean)
          : [],
        matchScore: Number(rawVersion?.matchScore || 0),
        checkedMinecraftVersion: String(rawVersion?.checkedMinecraftVersion || '').trim(),
        dependencies: Array.isArray(rawVersion?.dependencies)
          ? rawVersion.dependencies.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [],
        dependencyDetails: Array.isArray(rawVersion?.dependencyDetails)
          ? uniqueManagedDependencyReferences(rawVersion.dependencyDetails)
          : [],
        syncedAt: String(rawVersion?.syncedAt || '').trim()
      };
    }

    projects[projectId] = {
      projectId,
      slug: String(rawProject?.slug || '').trim(),
      title: String(rawProject?.title || '').trim(),
      description: String(rawProject?.description || '').trim(),
      iconUrl: String(rawProject?.iconUrl || '').trim(),
      clientSide: String(rawProject?.clientSide || '').trim(),
      serverSide: String(rawProject?.serverSide || '').trim(),
      versions
    };
  }

  const rawActiveSync = rawState && typeof rawState === 'object' && rawState.activeSync && typeof rawState.activeSync === 'object'
    ? rawState.activeSync
    : {};

  return {
    projects,
    disabledProjects: uniqueStrings(
      Array.isArray(rawState?.disabledProjects)
        ? rawState.disabledProjects.map((entry) => String(entry || '').trim()).filter(Boolean)
        : []
    ),
    autoDisabledProjects: uniqueStrings(
      Array.isArray(rawState?.autoDisabledProjects)
        ? rawState.autoDisabledProjects.map((entry) => String(entry || '').trim()).filter(Boolean)
        : []
    ),
    disabledProjectReasons: normalizeDisabledReasonMap(rawState?.disabledProjectReasons),
    disabledFileReasons: normalizeDisabledReasonMap(rawState?.disabledFileReasons),
    ignoredDefaultProjects: uniqueStrings(
      Array.isArray(rawState?.ignoredDefaultProjects)
        ? rawState.ignoredDefaultProjects.map((entry) => String(entry || '').trim()).filter(Boolean)
        : []
    ).filter((projectId) => !isRequiredDefaultManagedProject(projectId)),
    keptLocalMods: normalizeKeptLocalModEntries(rawState?.keptLocalMods),
    keptLocalProjectIds: uniqueStrings(
      Array.isArray(rawState?.keptLocalProjectIds)
        ? rawState.keptLocalProjectIds.map((entry) => String(entry || '').trim()).filter(Boolean)
        : []
    ),
    unavailableProjectChecks: Object.fromEntries(
      Object.entries(rawState?.unavailableProjectChecks && typeof rawState.unavailableProjectChecks === 'object'
        ? rawState.unavailableProjectChecks
        : {})
        .map(([key, entry]) => [
          String(key || '').trim(),
          {
            projectId: String(entry?.projectId || '').trim(),
            minecraftVersion: String(entry?.minecraftVersion || '').trim(),
            loader: String(entry?.loader || '').trim(),
            reason: String(entry?.reason || '').trim(),
            checkedAt: String(entry?.checkedAt || '').trim()
          }
        ])
        .filter(([key, entry]) => key && entry.projectId && entry.minecraftVersion)
    ),
    activeSync: {
      minecraftVersion: String(rawActiveSync.minecraftVersion || '').trim(),
      files: Array.isArray(rawActiveSync.files)
        ? rawActiveSync.files
          .map((entry) => {
            const projectId = String(entry?.projectId || '').trim();
            const fileName = String(entry?.fileName || '').trim();
            const targetPath = String(entry?.targetPath || '').trim();
            const libraryPath = String(entry?.libraryPath || '').trim();
            const minecraftVersion = String(entry?.minecraftVersion || '').trim();
            if (!projectId || !fileName || !targetPath) {
              return null;
            }

            return {
              projectId,
              fileName,
              targetPath,
              libraryPath,
              minecraftVersion
            };
          })
          .filter(Boolean)
        : []
    }
  };
}

function readModsState(modContext = getActiveModContext()) {
  ensureModsState(modContext);
  return ROBUSTNESS.readJsonFile(modContext.stateFile, getDefaultModsState(), {
    label: 'mods-state',
    normalize: normalizeModsState
  });
}

function writeModsState(state, modContext = getActiveModContext()) {
  ensureModsState(modContext);
  const normalizedState = normalizeModsState(state);
  ROBUSTNESS.writeJsonFileAtomic(modContext.stateFile, normalizedState, {
    label: 'mods-state',
    backup: false,
    metadata: {
      operation: 'writeModsState',
      contextType: modContext.type,
      minecraftVersion: modContext.minecraftVersion
    }
  });
  return normalizedState;
}

function sanitizePathSegment(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
    .replace(/\.+$/g, '')
    .slice(0, 120);
  return normalized || 'item';
}

function sanitizeJarFileName(fileName) {
  const baseName = path.basename(String(fileName || '').trim() || 'mod.jar');
  const normalized = baseName.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_');
  return normalized.toLowerCase().endsWith('.jar') ? normalized : `${normalized}.jar`;
}

function isPathInsideDirectory(parentDir, candidatePath) {
  const resolvedParent = path.resolve(parentDir);
  const resolvedCandidate = path.resolve(candidatePath);
  return resolvedCandidate === resolvedParent || resolvedCandidate.startsWith(`${resolvedParent}${path.sep}`);
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function getManagedLibraryPath(modContext, projectId, versionId, fileName) {
  return path.join(
    modContext.libraryDir,
    sanitizePathSegment(projectId),
    sanitizePathSegment(versionId),
    sanitizeJarFileName(fileName)
  );
}

function allocateManagedModFileName(fileName, projectId, reservedNames) {
  const safeName = sanitizeJarFileName(fileName);
  if (!reservedNames.has(safeName)) {
    return safeName;
  }

  const parsedPath = path.parse(safeName);
  const safeProjectId = sanitizePathSegment(projectId);
  let counter = 1;
  let candidate = `${parsedPath.name}__x_${safeProjectId}${parsedPath.ext}`;
  while (reservedNames.has(candidate)) {
    counter += 1;
    candidate = `${parsedPath.name}__x_${safeProjectId}_${counter}${parsedPath.ext}`;
  }
  return candidate;
}

function getActiveManagedModFileName(versionEntry, projectId, minecraftVersion) {
  const originalFileName = sanitizeJarFileName(versionEntry?.fileName || `${projectId}.jar`);
  if (textContainsExactMinecraftVersion(originalFileName, minecraftVersion)) {
    return originalFileName;
  }

  const parsedPath = path.parse(originalFileName);
  const targetTag = `mc${sanitizePathSegment(minecraftVersion)}`;
  const nameWithTargetVersion = parsedPath.name.replace(
    /(^|[+._-])mc\d+(?:\.\d+){1,3}(?=$|[+._-])/iu,
    `$1${targetTag}`
  );
  const targetName = nameWithTargetVersion === parsedPath.name
    ? `${parsedPath.name}+${targetTag}`
    : nameWithTargetVersion;
  return sanitizeJarFileName(`${targetName}${parsedPath.ext || '.jar'}`);
}

function getCurrentMinecraftVersion(versionId = getEffectiveSelectedVersionId()) {
  return String(getActiveModContext(versionId).minecraftVersion || '').trim();
}

async function getInstalledManagedModProjectIds(versionId = getEffectiveSelectedVersionId(), options = {}) {
  const modContext = options.modContext || getActiveModContext(versionId);
  const minecraftVersion = String(modContext.minecraftVersion || '').trim();
  if (!minecraftVersion) {
    return [];
  }

  if (options.sync !== false) {
    await syncManagedModsForVersion(modContext.versionId || versionId, { modContext });
  } else {
    ensureModsState(modContext);
  }

  const state = readModsState(modContext);
  return Object.keys(state.projects || {})
    .map((projectId) => String(projectId || '').trim())
    .filter((projectId) => projectId && !isManagedProjectHiddenForMinecraftVersion(projectId, minecraftVersion));
}

function getModrinthTargetChangeWarning(target, modContext) {
  const requestedPackId = String(target?.packId || '').trim();
  const requestedVersionId = String(target?.versionId || '').trim();
  const activePackId = String(modContext?.packId || '').trim();
  const activeVersionId = String(modContext?.versionId || '').trim();
  const contextName = String(modContext?.name || 'dem aktiven Profil').trim();

  if (requestedPackId && requestedPackId !== activePackId) {
    return `Das aktive Profil wurde gewechselt; installiert wurde passend zu ${contextName}.`;
  }

  if (requestedVersionId && requestedVersionId !== activeVersionId) {
    return `Die aktive Version wurde gewechselt; installiert wurde passend zu ${contextName}.`;
  }

  return '';
}

function getModrinthProjectId(project) {
  if (!project) {
    return '';
  }

  if (typeof project === 'string') {
    return String(project).trim();
  }

  return String(project.projectId || project.project_id || project.id || '').trim();
}

function getModrinthProjectTitle(project) {
  if (!project || typeof project !== 'object') {
    return '';
  }

  return String(project.title || project.name || project.slug || project.projectId || project.project_id || '').trim();
}

async function fetchModrinthJson(pathOrUrl, options = {}) {
  const url = String(pathOrUrl || '').startsWith('http')
    ? String(pathOrUrl)
    : `${MODRINTH_API_BASE_URL}${pathOrUrl}`;
  assertTrustedHttpsUrl(url, new Set(['api.modrinth.com']));

  const forceRefresh = Boolean(options.forceRefresh);
  const cached = modrinthApiCache.get(url);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.promise;
  }

  const promise = fetchJson(url, {
    headers: MODRINTH_API_HEADERS,
    allowedHosts: new Set(['api.modrinth.com'])
  }).catch((error) => {
    modrinthApiCache.delete(url);
    throw error;
  });
  modrinthApiCache.set(url, {
    expiresAt: Date.now() + MODRINTH_API_CACHE_TTL_MS,
    promise
  });
  return promise;
}

async function fetchModrinthProject(projectId, options = {}) {
  return fetchModrinthJson(`/project/${encodeURIComponent(projectId)}`, options);
}

async function fetchModrinthVersion(versionId, options = {}) {
  return fetchModrinthJson(`/version/${encodeURIComponent(versionId)}`, options);
}

async function fetchModrinthVersionByFileHash(fileHash) {
  const normalizedHash = String(fileHash || '').trim();
  if (!normalizedHash) {
    throw new Error('Keine Datei-Prüfsumme angegeben.');
  }

  return fetchModrinthJson(`/version_file/${encodeURIComponent(normalizedHash)}?algorithm=sha1`);
}

function mapModrinthSearchHit(hit) {
  return {
    projectId: String(hit?.project_id || hit?.id || '').trim(),
    slug: String(hit?.slug || '').trim(),
    projectType: String(hit?.project_type || 'mod').trim(),
    title: String(hit?.title || hit?.slug || '').trim(),
    description: String(hit?.description || '').trim(),
    author: String(hit?.author || '').trim(),
    downloads: Number(hit?.downloads || 0),
    iconUrl: String(hit?.icon_url || '').trim(),
    categories: Array.isArray(hit?.display_categories) && hit.display_categories.length
      ? hit.display_categories
      : (Array.isArray(hit?.categories) ? hit.categories : []),
    versions: Array.isArray(hit?.versions)
      ? hit.versions
      : (Array.isArray(hit?.game_versions) ? hit.game_versions : [])
  };
}

function normalizeModrinthProjectType(projectType) {
  const normalized = String(projectType || '').trim().toLowerCase();
  if (normalized === 'shader' || normalized === 'resourcepack' || normalized === 'modpack') {
    return normalized;
  }
  return 'mod';
}

function getModrinthSearchFacets(projectType, minecraftVersion, options = {}) {
  const normalizedProjectType = normalizeModrinthProjectType(projectType);
  const includeVersions = options.includeVersions !== false;
  const includeFabricCategory = options.includeFabricCategory !== false;
  const facets = [[`project_type:${normalizedProjectType}`]];

  if ((normalizedProjectType === 'mod' || normalizedProjectType === 'modpack') && includeFabricCategory) {
    facets.push(['categories:fabric']);
  }

  if (minecraftVersion && includeVersions) {
    facets.push([`versions:${minecraftVersion}`]);
  }

  return facets;
}

function normalizeModrinthSlug(query) {
  const slug = String(query || '').trim().toLowerCase();
  if (!slug) {
    return '';
  }

  return slug
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

function getDirectModrinthProjectCandidates(query) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    return [];
  }

  const candidates = new Set();
  candidates.add(normalizedQuery);

  const slugCandidate = normalizeModrinthSlug(normalizedQuery);
  if (slugCandidate) {
    candidates.add(slugCandidate);
  }

  if (normalizedQuery.includes(' ')) {
    candidates.add(normalizeModrinthSlug(normalizedQuery.replace(/\s+/g, '-')));
    candidates.add(normalizeModrinthSlug(normalizedQuery.replace(/\s+/g, '')));
  }

  const lastSegmentMatch = normalizedQuery.match(/([^/]+)$/);
  if (lastSegmentMatch) {
    candidates.add(normalizeModrinthSlug(lastSegmentMatch[1]));
  }

  return [...candidates].filter(Boolean);
}

function isFabricApiQuery(query) {
  const normalized = String(query || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return ['fabric api', 'fabricapi', 'fabric-api'].includes(normalized);
}

function normalizeModrinthSearchLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed)) {
    return MODRINTH_SEARCH_LIMIT;
  }
  return Math.min(MODRINTH_MAX_SEARCH_LIMIT, Math.max(MODRINTH_MIN_SEARCH_LIMIT, parsed));
}

function getModrinthCatalogDiskCache() {
  if (modrinthCatalogDiskCache) {
    return modrinthCatalogDiskCache;
  }
  const stored = ROBUSTNESS.readJsonFile(MODRINTH_CATALOG_CACHE_FILE, { version: 1, entries: {} }, {
    label: 'modrinth-catalog-cache'
  });
  modrinthCatalogDiskCache = stored && typeof stored.entries === 'object'
    ? stored
    : { version: 1, entries: {} };
  return modrinthCatalogDiskCache;
}

function persistModrinthCatalogResult(cacheKey, result) {
  const cache = getModrinthCatalogDiskCache();
  cache.entries[cacheKey] = { createdAt: Date.now(), result };
  const newestEntries = Object.entries(cache.entries)
    .sort((left, right) => Number(right[1]?.createdAt || 0) - Number(left[1]?.createdAt || 0))
    .slice(0, 80);
  cache.entries = Object.fromEntries(newestEntries);
  ROBUSTNESS.writeJsonFileAtomic(MODRINTH_CATALOG_CACHE_FILE, cache, {
    label: 'modrinth-catalog-cache'
  });
}

async function searchModrinthMods(query, versionId = getEffectiveSelectedVersionId(), projectType = 'mod', offset = 0, limit = MODRINTH_SEARCH_LIMIT, signal = null, forceRefresh = false) {
  const normalizedQuery = String(query || '').trim();
  const normalizedProjectType = normalizeModrinthProjectType(projectType);
  const normalizedOffset = Math.max(0, Number.parseInt(offset, 10) || 0);
  const normalizedLimit = normalizeModrinthSearchLimit(limit);
  const requestedVersionId = String(versionId || '').trim();
  const modContext = normalizedProjectType === 'modpack'
    ? null
    : getActiveModContext(requestedVersionId);
  const minecraftVersion = normalizedProjectType === 'modpack'
    ? String(getMinecraftVersionName(requestedVersionId) || '').trim()
    : String(modContext.minecraftVersion || '').trim();
  const searchMinecraftVersion = isLikelyMinecraftVersionName(minecraftVersion) ? minecraftVersion : '';
  const targetVersionId = normalizedProjectType === 'modpack'
    ? requestedVersionId
    : modContext.versionId;
  const cacheKey = [
    normalizedProjectType,
    targetVersionId,
    searchMinecraftVersion,
    normalizedQuery.toLowerCase(),
    normalizedOffset,
    normalizedLimit
  ].join('|');
  const cached = modrinthSearchCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.createdAt < MODRINTH_SEARCH_CACHE_TTL_MS) {
    return {
      ...cached.result,
      cached: true
    };
  }
  if (!forceRefresh) {
    const diskEntry = getModrinthCatalogDiskCache().entries[cacheKey];
    if (diskEntry?.result?.success) {
      modrinthSearchCache.set(cacheKey, diskEntry);
      return {
        ...diskEntry.result,
        cached: true,
        diskCache: true
      };
    }
  }

  const buildSearchResult = async (searchQuery, facets) => {
    const searchUrl = new URL(`${MODRINTH_API_BASE_URL}/search`);
    searchUrl.searchParams.set('query', String(searchQuery || '').trim());
    searchUrl.searchParams.set('limit', String(normalizedLimit));
    searchUrl.searchParams.set('offset', String(normalizedOffset));
    searchUrl.searchParams.set('index', normalizedQuery ? 'relevance' : 'downloads');
    searchUrl.searchParams.set('facets', JSON.stringify(facets));
    const loaders = normalizedProjectType === 'modpack'
      ? []
      : getPreferredModrinthLoaders(normalizedProjectType);
    if (loaders.length) {
      searchUrl.searchParams.set('loaders', JSON.stringify(loaders));
    }

    const searchResponse = await fetchJson(searchUrl.toString(), {
      headers: MODRINTH_API_HEADERS,
      ...(signal ? { signal } : {}),
      allowedHosts: new Set(['api.modrinth.com']),
      retries: normalizedQuery ? 0 : 1,
      timeoutMs: normalizedQuery ? 8000 : 12000
    });

    const hits = (searchResponse.hits || [])
      .map(mapModrinthSearchHit)
      .filter((entry) => entry.projectId)
      .map((entry) => ({
        ...entry,
        targetVersionId,
        targetMinecraftVersion: searchMinecraftVersion || minecraftVersion
      }));

    return {
      results: hits,
      totalHits: Number(searchResponse.total_hits || searchResponse.totalHits || hits.length)
    };
  };

  const primaryFacets = getModrinthSearchFacets(normalizedProjectType, minecraftVersion, {
    includeVersions: normalizedProjectType !== 'resourcepack'
      && Boolean(searchMinecraftVersion)
      && (normalizedProjectType !== 'modpack' || Boolean(searchMinecraftVersion))
  });
  let results = [];
  let totalHits = 0;

  if (normalizedProjectType === 'mod' && normalizedOffset === 0 && isFabricApiQuery(normalizedQuery)) {
    try {
      const projectData = await fetchModrinthProject(FABRIC_API_PROJECT_ID);
      if (projectData && projectData.id) {
        const mapped = mapModrinthSearchHit(projectData);
        if (mapped.projectId) {
          results = [{
            ...mapped,
            targetVersionId: modContext.versionId,
            targetMinecraftVersion: searchMinecraftVersion || minecraftVersion
          }];
          totalHits = 1;
        }
      }
    } catch (_error) {
      // ignore direct Fabric API lookup failures
    }
  }

  if (!results.length) {
    const searchResult = await buildSearchResult(normalizedQuery, primaryFacets);
    results = searchResult.results;
    totalHits = searchResult.totalHits;
  }

  if (normalizedProjectType !== 'modpack' && !results.length && normalizedQuery) {
    const versionlessFacets = getModrinthSearchFacets(normalizedProjectType, minecraftVersion, {
      includeVersions: false
    });
    const searchResult = await buildSearchResult(normalizedQuery, versionlessFacets);
    results = searchResult.results;
    totalHits = searchResult.totalHits;
  }

  if (!results.length && normalizedQuery) {
    const broadFacets = getModrinthSearchFacets(normalizedProjectType, minecraftVersion, {
      includeVersions: normalizedProjectType === 'modpack' && Boolean(searchMinecraftVersion),
      includeFabricCategory: false
    });
    const searchResult = await buildSearchResult(normalizedQuery, broadFacets);
    results = searchResult.results;
    totalHits = searchResult.totalHits;
  }

  if (!results.length && normalizedQuery) {
    const exactQuery = `"${normalizedQuery}"`;
    const searchResult = await buildSearchResult(exactQuery, primaryFacets);
    results = searchResult.results;
    totalHits = searchResult.totalHits;
  }

  if (normalizedOffset === 0 && !results.length && normalizedQuery) {
    const slugCandidates = getDirectModrinthProjectCandidates(normalizedQuery);
    for (const candidate of slugCandidates) {
      try {
        const projectData = await fetchModrinthProject(candidate);
        if (projectData && projectData.id) {
          const mapped = mapModrinthSearchHit(projectData);
          if (mapped.projectId && normalizeModrinthProjectType(mapped.projectType) === normalizedProjectType) {
            const matchesRequestedMinecraftVersion = normalizedProjectType === 'resourcepack'
              || !searchMinecraftVersion
              || (Array.isArray(mapped.versions) && mapped.versions.map((entry) => String(entry || '').trim()).includes(searchMinecraftVersion));
            if (matchesRequestedMinecraftVersion) {
              results = [{
                ...mapped,
                targetVersionId,
                targetMinecraftVersion: searchMinecraftVersion || minecraftVersion
              }];
              totalHits = 1;
              break;
            }
          }
        }
      } catch (_error) {
        // ignore direct project lookup failures
      }
    }
  }

  let installedProjectIds = [];
  if (normalizedProjectType === 'mod') {
    try {
      installedProjectIds = await getInstalledManagedModProjectIds(modContext.versionId, { modContext });
    } catch (error) {
      logger.warn('Managed mod sync during Modrinth search failed', {
        versionId: modContext.versionId,
        minecraftVersion: modContext.minecraftVersion,
        error: serializeError(error)
      });
      installedProjectIds = await getInstalledManagedModProjectIds(modContext.versionId, {
        modContext,
        sync: false
      });
    }
  } else if (normalizedProjectType === 'shader' || normalizedProjectType === 'resourcepack') {
    installedProjectIds = getInstalledDownloadableModrinthProjectIds(normalizedProjectType, modContext);
  }
  const installedProjectIdSet = new Set(installedProjectIds);
  results = results.map((entry) => ({
    ...entry,
    installed: installedProjectIdSet.has(entry.projectId)
  }));

  const finalResult = {
    success: true,
    targetVersionId,
    minecraftVersion,
    projectType: normalizedProjectType,
    mode: normalizedQuery ? 'search' : 'top-downloads',
    offset: normalizedOffset,
    limit: normalizedLimit,
    totalHits,
    hasMore: totalHits > normalizedOffset + results.length,
    installedProjectIds,
    results
  };

  modrinthSearchCache.set(cacheKey, {
    createdAt: Date.now(),
    result: finalResult
  });
  persistModrinthCatalogResult(cacheKey, finalResult);
  if (modrinthSearchCache.size > MODRINTH_SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = modrinthSearchCache.keys().next().value;
    modrinthSearchCache.delete(oldestKey);
  }

  return finalResult;
}

function getModrinthVersionPriority(versionEntry) {
  const versionType = String(versionEntry?.version_type || '').trim().toLowerCase();
  if (versionType === 'release') {
    return 3;
  }
  if (versionType === 'beta') {
    return 2;
  }
  if (versionType === 'alpha') {
    return 1;
  }
  return 0;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textContainsExactMinecraftVersion(text, minecraftVersion) {
  const normalizedText = String(text || '');
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  if (!normalizedText || !normalizedMinecraftVersion) {
    return false;
  }

  const versionPattern = escapeRegExp(normalizedMinecraftVersion);
  return new RegExp(`(?:^|[^0-9A-Za-z])(?:mc)?${versionPattern}(?=$|[^0-9A-Za-z.]|\\.(?![0-9]))`, 'iu').test(normalizedText);
}

function getModrinthVersionSearchText(versionEntry, projectType = 'mod') {
  const primaryFile = getPrimaryProjectFile(versionEntry, projectType);
  const fileNames = Array.isArray(versionEntry?.files)
    ? versionEntry.files.map((file) => String(file?.filename || '').trim()).filter(Boolean)
    : [];

  return [
    versionEntry?.name,
    versionEntry?.version_number,
    primaryFile?.filename,
    ...fileNames
  ].join(' ');
}

function getModrinthVersionLoaders(versionEntry) {
  return Array.isArray(versionEntry?.loaders)
    ? versionEntry.loaders.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean)
    : [];
}

function getManagedVersionLoaders(versionEntry) {
  return Array.isArray(versionEntry?.loaders)
    ? versionEntry.loaders.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean)
    : [];
}

function textMentionsNonFabricLoader(text) {
  const normalizedText = String(text || '').toLowerCase();
  if (!normalizedText) {
    return false;
  }

  const mentionsFabric = /(?:^|[^a-z0-9])fabric(?:$|[^a-z0-9])/iu.test(normalizedText);
  if (mentionsFabric) {
    return false;
  }

  return /(?:^|[^a-z0-9])(?:neo[-_ ]?forge|neoforge|forge|quilt)(?:$|[^a-z0-9])/iu.test(normalizedText);
}

function isProjectFileAllowedForPreferredLoader(fileEntry, projectType = 'mod') {
  const preferredLoaders = getPreferredModrinthLoaders(projectType);
  if (!preferredLoaders.includes('fabric')) {
    return true;
  }

  return !textMentionsNonFabricLoader(fileEntry?.filename);
}

function isModrinthVersionAllowedForPreferredLoader(versionEntry, projectType = 'mod') {
  const preferredLoaders = getPreferredModrinthLoaders(projectType);
  if (!preferredLoaders.length) {
    return true;
  }

  const versionLoaders = getModrinthVersionLoaders(versionEntry);
  if (versionLoaders.length && !preferredLoaders.some((loader) => versionLoaders.includes(loader))) {
    return false;
  }

  if (preferredLoaders.includes('fabric') && textMentionsNonFabricLoader([
    versionEntry?.name,
    versionEntry?.version_number,
    getPrimaryProjectFile(versionEntry, projectType)?.filename
  ].join(' '))) {
    return false;
  }

  return true;
}

function isManagedVersionAllowedForPreferredLoader(versionEntry, projectType = 'mod') {
  const preferredLoaders = getPreferredModrinthLoaders(projectType);
  if (!preferredLoaders.length) {
    return true;
  }

  const versionLoaders = getManagedVersionLoaders(versionEntry);
  if (versionLoaders.length && !preferredLoaders.some((loader) => versionLoaders.includes(loader))) {
    return false;
  }

  if (preferredLoaders.includes('fabric') && textMentionsNonFabricLoader([
    versionEntry?.fileName,
    versionEntry?.versionName,
    versionEntry?.versionNumber
  ].join(' '))) {
    return false;
  }

  return true;
}

function getModrinthMinecraftVersionScore(versionEntry, minecraftVersion, projectType = 'mod') {
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  if (!normalizedMinecraftVersion) {
    return 0;
  }

  if (textContainsExactMinecraftVersion(getModrinthVersionSearchText(versionEntry, projectType), normalizedMinecraftVersion)) {
    return 5;
  }

  const gameVersions = Array.isArray(versionEntry?.game_versions)
    ? versionEntry.game_versions.map((version) => String(version || '').trim())
    : [];
  if (gameVersions.includes(normalizedMinecraftVersion)) {
    return 4;
  }

  return gameVersions.some((entry) => minecraftVersionSatisfiesRequirement(entry, normalizedMinecraftVersion)) ? 2 : 0;
}

function managedVersionLooksExactForMinecraft(versionEntry, minecraftVersion) {
  return textContainsExactMinecraftVersion([
    versionEntry?.fileName,
    versionEntry?.versionNumber,
    versionEntry?.versionName
  ].join(' '), minecraftVersion);
}

function getManagedVersionIntegrityIssue(versionEntry) {
  const libraryPath = String(versionEntry?.libraryPath || '').trim();
  const integrity = verifyFileIntegrity(libraryPath, {
    expectedSha1: String(versionEntry?.sha1 || '').trim(),
    expectedSha512: String(versionEntry?.sha512 || '').trim(),
    expectedSize: Number(versionEntry?.size || 0),
    requireZipEndRecord: shouldRequireZipIntegrity(libraryPath)
  });
  return integrity.ok ? '' : formatIntegrityIssues(integrity);
}

function shouldRefreshCachedManagedVersion(projectId, projectState, versionEntry, minecraftVersion, modContext = getActiveModContext()) {
  if (!versionEntry || !minecraftVersion) {
    return false;
  }

  if (!isManagedVersionAllowedForPreferredLoader(versionEntry, getModrinthProjectType(projectState))) {
    return true;
  }

  const libraryPath = String(versionEntry?.libraryPath || '').trim();
  if (libraryPath && fs.existsSync(libraryPath) && getManagedVersionIntegrityIssue(versionEntry)) {
    return true;
  }

  if (libraryPath && fs.existsSync(libraryPath) && !isManagedVersionJarCompatibleWithMinecraft(versionEntry, minecraftVersion)) {
    return true;
  }

  if (Array.isArray(versionEntry?.dependencies)
      && versionEntry.dependencies.length > 0
      && (!Array.isArray(versionEntry?.dependencyDetails) || versionEntry.dependencyDetails.length === 0)) {
    return true;
  }

  if (managedVersionLooksExactForMinecraft(versionEntry, minecraftVersion)) {
    return false;
  }

  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  const checkedMinecraftVersion = String(versionEntry?.checkedMinecraftVersion || '').trim();
  const matchScore = Number(versionEntry?.matchScore || 0);
  const versionType = String(versionEntry?.versionType || '').trim().toLowerCase();
  const syncedAt = getVersionTimestamp(versionEntry?.syncedAt);
  const weakEntryIsFresh = syncedAt > 0 && (Date.now() - syncedAt) < WEAK_MANAGED_VERSION_REFRESH_INTERVAL_MS;
  if (checkedMinecraftVersion === normalizedMinecraftVersion) {
    if (matchScore >= 5 && (versionType === 'release' || weakEntryIsFresh)) {
      return false;
    }

    if (matchScore >= 2 && weakEntryIsFresh) {
      return false;
    }
  }

  return true;
}

function getModrinthProjectType(projectReference) {
  if (!projectReference || typeof projectReference !== 'object') {
    return 'mod';
  }

  return normalizeModrinthProjectType(projectReference.projectType || projectReference.project_type);
}

function isSupportedModrinthDownloadFile(fileEntry, projectType = 'mod') {
  if (!fileEntry?.url) {
    return false;
  }

  const fileName = String(fileEntry.filename || '').toLowerCase();
  const normalizedProjectType = normalizeModrinthProjectType(projectType);
  if (normalizedProjectType === 'mod') {
    return fileName.endsWith('.jar');
  }
  if (normalizedProjectType === 'modpack') {
    return fileName.endsWith('.mrpack');
  }

  return fileName.endsWith('.zip');
}

function getPrimaryProjectFile(versionEntry, projectType = 'mod') {
  const files = Array.isArray(versionEntry?.files) ? versionEntry.files : [];
  return files.find((file) => file.primary && isSupportedModrinthDownloadFile(file, projectType) && isProjectFileAllowedForPreferredLoader(file, projectType))
    || files.find((file) => isSupportedModrinthDownloadFile(file, projectType) && isProjectFileAllowedForPreferredLoader(file, projectType))
    || null;
}

function getPreferredModrinthLoaders(projectType) {
  const normalizedProjectType = normalizeModrinthProjectType(projectType);
  if (normalizedProjectType === 'mod') {
    return ['fabric'];
  }
  if (normalizedProjectType === 'modpack') {
    return ['fabric'];
  }
  // Resource packs are deliberately loader- and version-independent because
  // Modrinth projects do not always use the same loader tag for pack files.
  if (normalizedProjectType === 'resourcepack') {
    return [];
  }
  return [];
}

function getInstalledFabricApiVersion(minecraftVersion) {
  if (isFabricApiHiddenForMinecraftVersion(minecraftVersion)) {
    return null;
  }

  const modContext = getActiveModContext();
  const state = readModsState(modContext);
  const fabricApiProject = state.projects[FABRIC_API_PROJECT_ID];
  if (!fabricApiProject) {
    return null;
  }
  const versionEntry = fabricApiProject.versions[minecraftVersion];
  return versionEntry ? versionEntry.versionNumber : null;
}

async function ensureFabricApiForMod(modContext, minecraftVersion, options = {}) {
  if (isFabricApiHiddenForMinecraftVersion(minecraftVersion)) {
    return {
      skipped: true,
      reason: `Fabric API wird für Minecraft ${minecraftVersion} nicht geladen.`
    };
  }

  const state = readModsState(modContext);
  const fabricApiProject = state.projects[FABRIC_API_PROJECT_ID];
  const forceRefresh = Boolean(options.forceRefresh);

  const existingFabricApiVersion = fabricApiProject?.versions?.[minecraftVersion];
  const existingFabricApiPath = String(existingFabricApiVersion?.libraryPath || '').trim();
  const hasBrokenExistingApi = !existingFabricApiPath
    || !fs.existsSync(existingFabricApiPath)
    || !isJarCompatibleWithMinecraft(existingFabricApiPath, minecraftVersion);

  const needsInstall = !fabricApiProject || !existingFabricApiVersion || hasBrokenExistingApi;
  if (!needsInstall && !forceRefresh) {
    return;
  }

  if (hasBrokenExistingApi && existingFabricApiPath && fs.existsSync(existingFabricApiPath) && isPathInsideDirectory(modContext.libraryDir, existingFabricApiPath)) {
    try {
      fs.unlinkSync(existingFabricApiPath);
    } catch (_error) {
      // ignore cleanup failures, reinstall will still attempt to restore the Fabric API
    }
  }

  if (hasBrokenExistingApi && existingFabricApiVersion && fabricApiProject?.versions) {
    delete fabricApiProject.versions[minecraftVersion];
    writeModsState(state, modContext);
  }

  try {
    await installManagedProjectVersion({ projectId: FABRIC_API_PROJECT_ID }, minecraftVersion, {
      forceRefresh: true,
      visitedProjects: new Set(),
      modContext
    });
    if (needsInstall) {
      console.log(`Fabric API wurde für Minecraft ${minecraftVersion} installiert`);
    } else {
      console.log(`Fabric API wurde für Minecraft ${minecraftVersion} aktualisiert`);
    }
    return {
      skipped: false
    };
  } catch (error) {
    console.warn(`Fabric API konnte nicht installiert oder aktualisiert werden: ${error.message}`);
    throw new Error(`Fabric API ist erforderlich für diese Mod, konnte aber nicht installiert oder aktualisiert werden: ${error.message}`);
  }
}

function filterModrinthVersionsByMinecraft(versions, minecraftVersion, projectType) {
  if (!Array.isArray(versions) || !minecraftVersion) {
    return versions || [];
  }

  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  return versions.filter((versionEntry) => {
    const gameVersions = Array.isArray(versionEntry?.game_versions)
      ? versionEntry.game_versions.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];

    if (isGameVersionListDeclaredForMinecraft(gameVersions, normalizedMinecraftVersion)) {
      return true;
    }

    if (textContainsExactMinecraftVersion(getModrinthVersionSearchText(versionEntry, projectType), normalizedMinecraftVersion)) {
      return true;
    }

    return false;
  });
}

function isModrinthVersionDeclaredForMinecraft(versionEntry, minecraftVersion, projectType = 'mod') {
  return filterModrinthVersionsByMinecraft([versionEntry], minecraftVersion, projectType).length > 0;
}

function filterModrinthVersionsByPreferredLoader(versions, projectType = 'mod') {
  if (!Array.isArray(versions)) {
    return [];
  }

  return versions.filter((versionEntry) => isModrinthVersionAllowedForPreferredLoader(versionEntry, projectType));
}

async function getModrinthMinecraftVersionSuggestionText(projectId, minecraftVersion, projectType = 'mod') {
  try {
    const normalizedProjectType = normalizeModrinthProjectType(projectType);
    const loaders = getPreferredModrinthLoaders(normalizedProjectType);
    const url = new URL(`${MODRINTH_API_BASE_URL}/project/${encodeURIComponent(projectId)}/version`);
    if (loaders.length) {
      url.searchParams.set('loaders', JSON.stringify(loaders));
    }
    const versions = await fetchJson(url.toString(), {
      headers: MODRINTH_API_HEADERS,
      allowedHosts: new Set(['api.modrinth.com'])
    });
    const suggestions = uniqueStrings((Array.isArray(versions) ? versions : [])
      .flatMap((versionEntry) => Array.isArray(versionEntry?.game_versions) ? versionEntry.game_versions : [])
      .map((entry) => String(entry || '').trim())
      .filter((entry) => entry && entry !== minecraftVersion)
      .filter((entry) => normalizedProjectType !== 'mod' || isSupportedMinecraftVersion(entry) || isProfileMinecraftVersion(entry)))
      .slice(0, 5);

    return suggestions.length
      ? ` Kompatible Minecraft-Versionen laut Modrinth: ${suggestions.join(', ')}.`
      : '';
  } catch (error) {
    logger.debug('Could not build Modrinth version suggestions', {
      projectId,
      minecraftVersion,
      projectType,
      error: serializeError(error)
    });
    return '';
  }
}

async function getCompatibleModrinthProjectVersions(projectId, minecraftVersion, options = {}) {
  const projectType = normalizeModrinthProjectType(options.projectType);
  const loaders = getPreferredModrinthLoaders(projectType);
  const strictMinecraftVersion = Boolean(options.strictMinecraftVersion);
  const forceRefresh = Boolean(options.forceRefresh);
  const selectedLoader = loaders.join(', ') || 'any';
  const url = `/project/${encodeURIComponent(projectId)}/version`;
  let versions = [];

  try {
    versions = await fetchModrinthJson(url, { forceRefresh });
  } catch (error) {
    logger.warn('Modrinth compatibility version list fetch failed', {
      projectId,
      minecraftVersion,
      selectedLoader,
      projectType,
      forceRefresh,
      error: serializeError(error)
    });
    return [];
  }

  logger.info('Modrinth compatibility check started', {
    projectId,
    minecraftVersion,
    selectedLoader,
    projectType,
    totalVersions: Array.isArray(versions) ? versions.length : 0,
    forceRefresh
  });

  const acceptedVersions = [];
  for (const versionEntry of Array.isArray(versions) ? versions : []) {
    const versionId = String(versionEntry?.id || '').trim();
    const versionNumber = String(versionEntry?.version_number || versionEntry?.name || '').trim();
    const versionLoaders = getModrinthVersionLoaders(versionEntry);
    const gameVersions = Array.isArray(versionEntry?.game_versions)
      ? versionEntry.game_versions.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    const primaryFile = getPrimaryProjectFile(versionEntry, projectType);
    const declaredForMinecraft = isModrinthVersionDeclaredForMinecraft(versionEntry, minecraftVersion, projectType);
    const loaderAllowed = isModrinthVersionAllowedForPreferredLoader(versionEntry, projectType);
    const hasFile = Boolean(primaryFile);
    const accepted = loaderAllowed && hasFile && (declaredForMinecraft || !strictMinecraftVersion);
    const rejectReasons = [];

    if (!loaderAllowed) {
      rejectReasons.push(`loader mismatch: selected ${selectedLoader}, version loaders ${versionLoaders.join(', ') || 'unknown'}`);
    }
    if (!hasFile) {
      rejectReasons.push('no supported downloadable file');
    }
    if (!declaredForMinecraft && strictMinecraftVersion) {
      rejectReasons.push(`Minecraft ${minecraftVersion} is not declared by Modrinth metadata`);
    }

    logger.info('Modrinth compatibility version checked', {
      projectId,
      minecraftVersion,
      selectedLoader,
      versionId,
      versionNumber,
      versionLoaders,
      gameVersions,
      fileName: primaryFile?.filename || '',
      accepted,
      reason: accepted ? 'accepted by metadata' : rejectReasons.join('; ')
    });

    if (accepted) {
      acceptedVersions.push(versionEntry);
    }
  }

  logger.info('Modrinth compatibility check completed', {
    projectId,
    minecraftVersion,
    selectedLoader,
    acceptedVersions: acceptedVersions.map((entry) => ({
      id: String(entry?.id || '').trim(),
      versionNumber: String(entry?.version_number || entry?.name || '').trim()
    }))
  });

  return acceptedVersions
    .sort((left, right) => {
      const exactDiff = getModrinthMinecraftVersionScore(right, minecraftVersion, projectType)
        - getModrinthMinecraftVersionScore(left, minecraftVersion, projectType);
      if (exactDiff !== 0) {
        return exactDiff;
      }

      const priorityDiff = getModrinthVersionPriority(right) - getModrinthVersionPriority(left);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const dateDiff = getVersionTimestamp(right.date_published) - getVersionTimestamp(left.date_published);
      if (dateDiff !== 0) {
        return dateDiff;
      }

      if (Boolean(right.featured) !== Boolean(left.featured)) {
        return right.featured ? 1 : -1;
      }

      return 0;
    });
}

async function getCompatibleModrinthProjectVersion(projectId, minecraftVersion, options = {}) {
  return (await getCompatibleModrinthProjectVersions(projectId, minecraftVersion, options))[0] || null;
}

async function getRequiredDependencies(versionEntry) {
  const dependencies = [];
  const seen = new Set();

  const pushDependency = (projectId, versionId = '', fileName = '', extra = {}) => {
    const normalizedDependency = normalizeManagedDependencyReference({
      ...extra,
      projectId,
      versionId,
      fileName
    });
    if (!normalizedDependency) {
      return;
    }

    const key = getManagedDependencySignature(normalizedDependency);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    dependencies.push(normalizedDependency);
  };

  for (const dependency of versionEntry?.dependencies || []) {
    if (dependency?.dependency_type !== 'required') {
      continue;
    }

    const directProjectId = String(dependency.project_id || '').trim();
    if (directProjectId) {
      pushDependency(directProjectId, dependency.version_id, dependency.file_name);
      continue;
    }

    const versionId = String(dependency.version_id || '').trim();
    if (!versionId) {
      continue;
    }

    try {
      const versionData = await fetchModrinthVersion(versionId);
      const projectId = String(versionData?.project_id || '').trim();
      if (projectId) {
        pushDependency(projectId, versionId, dependency.file_name);
      }
    } catch (_error) {
      // ignore dependency lookup failures here and surface them during install
    }
  }

  return dependencies;
}

async function getRequiredDependencyProjectIds(versionEntry) {
  return uniqueStrings((await getRequiredDependencies(versionEntry)).map((dependency) => dependency.projectId));
}

function normalizeManagedDependencyReference(dependency) {
  if (!dependency || typeof dependency !== 'object') {
    return null;
  }

  const projectId = String(dependency.projectId || dependency.project_id || '').trim();
  if (!projectId) {
    return null;
  }

  return {
    projectId,
    versionId: String(dependency.versionId || dependency.version_id || dependency.requiredVersionId || '').trim(),
    versionRequirement: dependency.versionRequirement || dependency.requiredVersionRequirement || '',
    blockedVersionRequirement: dependency.blockedVersionRequirement || '',
    fileName: String(dependency.fileName || dependency.file_name || '').trim(),
    source: String(dependency.source || '').trim()
  };
}

function getManagedDependencySignature(dependency) {
  const normalizedDependency = normalizeManagedDependencyReference(dependency);
  if (!normalizedDependency) {
    return '';
  }

  return [
    normalizedDependency.projectId,
    normalizedDependency.versionId,
    formatFabricDependencyRequirement(normalizedDependency.versionRequirement),
    formatFabricDependencyRequirement(normalizedDependency.blockedVersionRequirement),
    normalizedDependency.fileName,
    normalizedDependency.source
  ].join(':');
}

function uniqueManagedDependencyReferences(dependencies) {
  const result = [];
  const seen = new Set();

  for (const dependency of Array.isArray(dependencies) ? dependencies : []) {
    const normalizedDependency = normalizeManagedDependencyReference(dependency);
    if (!normalizedDependency) {
      continue;
    }

    const signature = getManagedDependencySignature(normalizedDependency);
    if (!signature || seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    result.push(normalizedDependency);
  }

  return result;
}

function getDependencyVersionCandidates(versionEntry) {
  const sourceText = [
    versionEntry?.versionNumber,
    versionEntry?.version_number,
    versionEntry?.versionName,
    versionEntry?.name,
    versionEntry?.fileName,
    getPrimaryProjectFile(versionEntry, 'mod')?.filename
  ].join(' ');

  const candidates = [];
  for (const match of sourceText.matchAll(/\d+(?:\.\d+){1,4}(?:[-+][A-Za-z0-9_.-]+)?/gu)) {
    candidates.push(match[0].replace(/\+.*$/u, '').replace(/-fabric$/iu, '').replace(/^mc(?=\d)/iu, ''));
  }
  return uniqueStrings(candidates);
}

function modrinthVersionSatisfiesDependencyRequirement(versionEntry, requirement) {
  const requirementText = formatFabricDependencyRequirement(requirement);
  if (!requirementText || requirementText === '*') {
    return true;
  }

  return getDependencyVersionCandidates(versionEntry)
    .some((candidate) => minecraftVersionSatisfiesRequirement(requirementText, candidate));
}

function modrinthVersionAvoidsBlockedRequirement(versionEntry, blockedRequirement) {
  const requirementText = formatFabricDependencyRequirement(blockedRequirement);
  if (!requirementText) {
    return true;
  }

  return !getDependencyVersionCandidates(versionEntry)
    .some((candidate) => minecraftVersionSatisfiesRequirement(requirementText, candidate));
}

function getKnownManagedDependencyConstraints(jarPath) {
  const manifestInfo = readFabricModManifest(jarPath);
  const manifest = manifestInfo?.manifest;
  if (!manifest || typeof manifest !== 'object') {
    return [];
  }

  const constraints = [];
  const addConstraints = (source, type) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return;
    }

    for (const [fabricModId, requirement] of Object.entries(source)) {
      const projectId = KNOWN_FABRIC_MOD_ID_PROJECT_IDS[String(fabricModId || '').trim().toLowerCase()];
      if (!projectId) {
        continue;
      }

      constraints.push({
        projectId,
        type,
        requirement
      });
    }
  };

  addConstraints(manifest.depends, 'depends');
  addConstraints(manifest.breaks, 'breaks');
  return constraints;
}

async function ensureModrinthProjectInfo(projectId, projectReference = null, modContext = getActiveModContext()) {
  const stateProject = readModsState(modContext).projects[projectId];
  const candidate = projectReference && typeof projectReference === 'object' ? projectReference : {};
  const localInfo = {
    id: projectId,
    slug: String(candidate.slug || stateProject?.slug || '').trim(),
    title: String(candidate.title || candidate.name || stateProject?.title || projectId).trim(),
    description: String(candidate.description || stateProject?.description || '').trim(),
    icon_url: String(candidate.iconUrl || candidate.icon_url || stateProject?.iconUrl || '').trim(),
    client_side: String(candidate.clientSide || candidate.client_side || stateProject?.clientSide || '').trim(),
    server_side: String(candidate.serverSide || candidate.server_side || stateProject?.serverSide || '').trim()
  };

  const shouldFetchRemote = !localInfo.slug
    || !localInfo.title
    || !localInfo.icon_url
    || !localInfo.client_side
    || !localInfo.server_side;
  if (!shouldFetchRemote) {
    return localInfo;
  }

  try {
    const remoteInfo = await fetchModrinthProject(projectId);
    return {
      id: projectId,
      slug: String(remoteInfo?.slug || localInfo.slug || '').trim(),
      title: String(remoteInfo?.title || remoteInfo?.name || localInfo.title || projectId).trim(),
      description: String(remoteInfo?.description || localInfo.description || '').trim(),
      icon_url: String(remoteInfo?.icon_url || remoteInfo?.iconUrl || localInfo.icon_url || '').trim(),
      client_side: String(remoteInfo?.client_side || remoteInfo?.clientSide || localInfo.client_side || '').trim(),
      server_side: String(remoteInfo?.server_side || remoteInfo?.serverSide || localInfo.server_side || '').trim()
    };
  } catch (_error) {
    return localInfo;
  }
}

async function enrichManagedProjectMetadata(projectId, modContext = getActiveModContext()) {
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedProjectId) {
    return null;
  }

  const state = readModsState(modContext);
  const currentProject = state.projects?.[normalizedProjectId];
  if (!currentProject) {
    return null;
  }

  const projectInfo = await ensureModrinthProjectInfo(normalizedProjectId, currentProject, modContext);
  const updatedProject = {
    ...currentProject,
    projectId: normalizedProjectId,
    slug: String(projectInfo.slug || currentProject.slug || '').trim(),
    title: String(projectInfo.title || currentProject.title || normalizedProjectId).trim(),
    description: String(projectInfo.description || currentProject.description || '').trim(),
    iconUrl: String(projectInfo.icon_url || projectInfo.iconUrl || currentProject.iconUrl || '').trim(),
    clientSide: String(projectInfo.client_side || projectInfo.clientSide || currentProject.clientSide || '').trim(),
    serverSide: String(projectInfo.server_side || projectInfo.serverSide || currentProject.serverSide || '').trim(),
    versions: currentProject.versions || {}
  };

  const hasChanged = updatedProject.slug !== (currentProject.slug || '')
    || updatedProject.title !== (currentProject.title || '')
    || updatedProject.description !== (currentProject.description || '')
    || updatedProject.iconUrl !== (currentProject.iconUrl || '')
    || updatedProject.clientSide !== (currentProject.clientSide || '')
    || updatedProject.serverSide !== (currentProject.serverSide || '');

  if (hasChanged) {
    state.projects[normalizedProjectId] = updatedProject;
    writeModsState(state, modContext);
  }

  return updatedProject;
}

async function addAutoDisabledManagedProject(projectReference, modContext = getActiveModContext()) {
  const projectId = getModrinthProjectId(projectReference);
  if (!projectId) {
    return null;
  }

  const projectInfo = await ensureModrinthProjectInfo(projectId, projectReference, modContext);
  const state = readModsState(modContext);
  const currentProject = state.projects[projectId] || {
    projectId,
    versions: {}
  };

  const project = {
    projectId,
    slug: String(projectInfo.slug || currentProject.slug || '').trim(),
    title: String(projectInfo.title || currentProject.title || getModrinthProjectTitle(projectReference) || projectId).trim(),
    description: String(projectInfo.description || currentProject.description || '').trim(),
    iconUrl: String(projectInfo.icon_url || projectInfo.iconUrl || currentProject.iconUrl || '').trim(),
    clientSide: String(projectInfo.client_side || projectInfo.clientSide || currentProject.clientSide || '').trim(),
    serverSide: String(projectInfo.server_side || projectInfo.serverSide || currentProject.serverSide || '').trim(),
    versions: currentProject.versions || {}
  };

  state.projects[projectId] = project;
  const disabledProjects = new Set(state.disabledProjects || []);
  const autoDisabledProjects = new Set(state.autoDisabledProjects || []);
  const wasAutoDisabled = markManagedProjectAutoDisabled(
    autoDisabledProjects,
    projectId,
    project,
    disabledProjects
  );
  if (wasAutoDisabled) {
    state.disabledProjectReasons = state.disabledProjectReasons || {};
    state.disabledProjectReasons[projectId] = createDisableReason({
      reason: `Keine kompatible Modrinth-Version für Minecraft ${modContext.minecraftVersion || 'die aktive Version'} gefunden.`,
      technicalEvidence: 'Installation wurde nur als deaktivierter State gespeichert, weil keine passende Version ermittelt werden konnte.',
      automated: true
    });
    recordModDisableEntry(modContext, {
      projectId,
      reason: `Keine kompatible Modrinth-Version für Minecraft ${modContext.minecraftVersion || 'die aktive Version'} gefunden.`,
      technicalEvidence: 'Installation wurde nur als deaktivierter State gespeichert, weil keine passende Version ermittelt werden konnte.'
    });
  }
  state.autoDisabledProjects = [...autoDisabledProjects].filter((entry) => !disabledProjects.has(entry));
  writeModsState(state, modContext);

  return {
    projectId,
    title: project.title || projectId,
    wasAutoDisabled
  };
}

function isMissingCompatibleModrinthVersionError(error) {
  const message = String(error?.message || error || '');
  return /Keine (?:exakt passende(?: Modrinth-Version)?|passende Modrinth-Version|kompatible|passende Fabric-Version|intern kompatible (?:Fabric-)?JAR(?:-Datei)?)/iu.test(message);
}

function sanitizeDownloadedFileName(fileName, fallbackExtension = '.zip') {
  const parsedPath = path.parse(path.basename(String(fileName || '').trim() || `download${fallbackExtension}`));
  const safeBaseName = parsedPath.name.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').trim() || 'download';
  const safeExtension = (parsedPath.ext || fallbackExtension || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '')
    .trim()
    || fallbackExtension;
  return `${safeBaseName}${safeExtension.startsWith('.') ? safeExtension : `.${safeExtension}`}`;
}

async function installManagedProjectVersion(projectReference, minecraftVersion, options = {}) {
  const projectId = getModrinthProjectId(projectReference);
  if (!projectId) {
    throw new Error('Modrinth-Projekt konnte nicht gelesen werden.');
  }

  if (isManagedProjectHiddenForMinecraftVersion(projectId, minecraftVersion)) {
    throw new Error(`Fabric API wird für Minecraft ${minecraftVersion} ausgeblendet.`);
  }

  const projectType = getModrinthProjectType(projectReference);
  const modContext = options.modContext || getActiveModContext();
  const forceRefresh = Boolean(options.forceRefresh);
  const requiredVersionId = String(options.requiredVersionId || projectReference?.versionId || projectReference?.version_id || '').trim();
  const requiredVersionRequirement = options.requiredVersionRequirement || projectReference?.versionRequirement || '';
  const blockedVersionRequirement = options.blockedVersionRequirement || projectReference?.blockedVersionRequirement || '';
  const skippedVersionIds = new Set(
    (Array.isArray(options.skipVersionIds) ? options.skipVersionIds : [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
  );
  const visitedProjects = options.visitedProjects instanceof Set ? options.visitedProjects : new Set();
  if (visitedProjects.has(projectId)) {
    return {
      projectId,
      title: getModrinthProjectTitle(projectReference) || projectId,
      warnings: []
    };
  }
  visitedProjects.add(projectId);

  const warnings = [];
  let state = readModsState(modContext);

  if (projectType === 'mod' && projectId !== FABRIC_API_PROJECT_ID && minecraftVersion) {
    try {
      const fabricApiResult = await ensureFabricApiForMod(modContext, minecraftVersion);
      if (fabricApiResult?.skipped && !isFabricApiHiddenForMinecraftVersion(minecraftVersion)) {
        warnings.push(fabricApiResult.reason);
      }
    } catch (error) {
      warnings.push(`Fabric API Installation/Update fehlgeschlagen: ${error.message}`);
    }
  }

  const existingProject = state.projects[projectId];
  const existingVersion = existingProject?.versions?.[minecraftVersion];
  const getExistingVersionUsability = () => {
    if (!existingVersion?.libraryPath || !fs.existsSync(existingVersion.libraryPath)) {
      return { usable: false, reason: 'no local library file' };
    }
    if (requiredVersionId && existingVersion.versionId !== requiredVersionId) {
      return { usable: false, reason: `required version ${requiredVersionId} does not match local ${existingVersion.versionId || 'unknown'}` };
    }
    if (requiredVersionRequirement && !modrinthVersionSatisfiesDependencyRequirement(existingVersion, requiredVersionRequirement)) {
      return { usable: false, reason: `local version does not satisfy dependency requirement ${formatFabricDependencyRequirement(requiredVersionRequirement)}` };
    }
    if (blockedVersionRequirement && !modrinthVersionAvoidsBlockedRequirement(existingVersion, blockedVersionRequirement)) {
      return { usable: false, reason: `local version is blocked by ${formatFabricDependencyRequirement(blockedVersionRequirement)}` };
    }
    if (!isManagedVersionAllowedForPreferredLoader(existingVersion, projectType)) {
      return { usable: false, reason: 'local version loader does not match selected loader' };
    }

    const compatibility = getManagedJarMinecraftCompatibility(existingVersion, minecraftVersion);
    if (compatibility.compatible === false) {
      return { usable: false, reason: `local JAR requires ${compatibility.requirement || 'another Minecraft version'}` };
    }
    return { usable: true, reason: 'local version is compatible' };
  };
  const returnExistingVersion = (reason) => {
    const dependencyDetails = uniqueManagedDependencyReferences(existingVersion?.dependencyDetails || []);
    const dependencyProjectIds = uniqueStrings([
      ...(Array.isArray(existingVersion?.dependencies) ? existingVersion.dependencies : []),
      ...dependencyDetails.map((dependency) => dependency.projectId)
    ]);
    logger.info('Managed mod compatibility selected installed local version', {
      projectId,
      title: existingProject?.title || getModrinthProjectTitle(projectReference) || projectId,
      minecraftVersion,
      selectedLoader: getPreferredModrinthLoaders(projectType).join(', ') || 'any',
      installedVersionId: existingVersion?.versionId || '',
      installedVersionNumber: existingVersion?.versionNumber || '',
      installedFileName: existingVersion?.fileName || '',
      reason
    });
    return {
      projectId,
      title: existingProject?.title || getModrinthProjectTitle(projectReference) || projectId,
      dependencyProjectIds,
      dependencyRequirements: dependencyDetails,
      warnings: []
    };
  };
  logger.info('Managed mod compatibility install check started', {
    projectId,
    title: existingProject?.title || getModrinthProjectTitle(projectReference) || projectId,
    minecraftVersion,
    selectedLoader: getPreferredModrinthLoaders(projectType).join(', ') || 'any',
    installedVersionId: existingVersion?.versionId || '',
    installedVersionNumber: existingVersion?.versionNumber || '',
    installedFileName: existingVersion?.fileName || '',
    forceRefresh
  });
  // Bei forceRefresh immer neu installieren, um sicherzustellen dass die beste Version verwendet wird
  if (forceRefresh) {
    const existingUsability = getExistingVersionUsability();
    logger.info('Managed mod force refresh will verify latest compatible Fabric version', {
      projectId,
      minecraftVersion,
      existingUsable: existingUsability.usable,
      reason: existingUsability.reason
    });
    // Überspringe Kompatibilitätsprüfung bei forceRefresh
  } else if (existingVersion?.libraryPath && fs.existsSync(existingVersion.libraryPath)) {
    if (requiredVersionId && existingVersion.versionId !== requiredVersionId) {
      warnings.push(`${existingProject?.title || projectId}: Abhängigkeit verlangt Modrinth-Version ${requiredVersionId}; gespeicherte Version ${existingVersion.versionId || 'unbekannt'} wird ersetzt.`);
    } else if (requiredVersionRequirement && !modrinthVersionSatisfiesDependencyRequirement(existingVersion, requiredVersionRequirement)) {
      warnings.push(`${existingProject?.title || projectId}: gespeicherte Version erfüllt die verlangte Mod-Abhängigkeit ${formatFabricDependencyRequirement(requiredVersionRequirement)} nicht und wird ersetzt.`);
    } else if (blockedVersionRequirement && !modrinthVersionAvoidsBlockedRequirement(existingVersion, blockedVersionRequirement)) {
      warnings.push(`${existingProject?.title || projectId}: gespeicherte Version fällt in einen inkompatiblen Bereich (${formatFabricDependencyRequirement(blockedVersionRequirement)}) und wird ersetzt.`);
    } else if (!isManagedVersionAllowedForPreferredLoader(existingVersion, projectType)) {
      warnings.push(`${existingProject?.title || projectId}: gespeicherte Version ist nicht für Fabric und wird ersetzt.`);
    } else {
      const existingCompatibility = getManagedJarMinecraftCompatibility(existingVersion, minecraftVersion);
      if (existingCompatibility.compatible !== false) {
        const hasKnownDependencies = (Array.isArray(existingVersion.dependencies) && existingVersion.dependencies.length > 0)
          || (Array.isArray(existingVersion.dependencyDetails) && existingVersion.dependencyDetails.length > 0);
        if (!hasKnownDependencies) {
          return returnExistingVersion('existing local version is compatible');
        }
        warnings.push(`${existingProject?.title || projectId}: vorhandene Version bleibt aktiv, Abhängigkeiten werden geprüft.`);
      } else {
        warnings.push(`${existingProject?.title || existingCompatibility.modName || projectId}: vorhandene JAR verlangt Minecraft ${existingCompatibility.requirement || 'eine andere Version'}.`);
      }
    }
  }

  const projectInfo = await ensureModrinthProjectInfo(projectId, projectReference, modContext);
  const requireDeclaredMinecraftVersion = projectType === 'mod';
  let compatibleVersions = [];
  if (requiredVersionId) {
    const requiredVersion = await fetchModrinthVersion(requiredVersionId, { forceRefresh });
    const requiredProjectId = String(requiredVersion?.project_id || '').trim();
    if (requiredProjectId && requiredProjectId !== projectId) {
      throw new Error(`Modrinth-Abhängigkeit ${requiredVersionId} gehört zu ${requiredProjectId}, erwartet wurde ${projectId}.`);
    }
    compatibleVersions = [requiredVersion];
  } else {
    compatibleVersions = await getCompatibleModrinthProjectVersions(projectId, minecraftVersion, {
      projectType,
      strictMinecraftVersion: requireDeclaredMinecraftVersion,
      forceRefresh
    });
  }
  if (requiredVersionRequirement) {
    const requirementText = formatFabricDependencyRequirement(requiredVersionRequirement);
    compatibleVersions = compatibleVersions.filter((entry) => modrinthVersionSatisfiesDependencyRequirement(entry, requiredVersionRequirement));
    if (!compatibleVersions.length) {
      const existingUsability = getExistingVersionUsability();
      if (existingUsability.usable) {
        return returnExistingVersion(`dependency requirement candidates exhausted: ${existingUsability.reason}`);
      }
      throw new Error(`${projectInfo.title || projectId}: Keine Modrinth-Version erfüllt die verlangte Mod-Abhängigkeit ${requirementText || String(requiredVersionRequirement)} für Minecraft ${minecraftVersion}.`);
    }
  }
  if (blockedVersionRequirement) {
    const blockedText = formatFabricDependencyRequirement(blockedVersionRequirement);
    compatibleVersions = compatibleVersions.filter((entry) => modrinthVersionAvoidsBlockedRequirement(entry, blockedVersionRequirement));
    if (!compatibleVersions.length) {
      const existingUsability = getExistingVersionUsability();
      if (existingUsability.usable) {
        return returnExistingVersion(`blocked dependency range exhausted remote candidates: ${existingUsability.reason}`);
      }
      throw new Error(`${projectInfo.title || projectId}: Alle passenden Modrinth-Versionen fallen in einen inkompatiblen Bereich (${blockedText || String(blockedVersionRequirement)}).`);
    }
  }
  compatibleVersions = compatibleVersions.filter((entry) => !skippedVersionIds.has(String(entry?.id || '').trim()));
  if (!compatibleVersions.length) {
    const existingUsability = getExistingVersionUsability();
    if (existingUsability.usable) {
      return returnExistingVersion(`all remote candidates exhausted: ${existingUsability.reason}`);
    }
    const suggestion = await getModrinthMinecraftVersionSuggestionText(projectId, minecraftVersion, projectType);
    throw new Error(`Keine exakt passende Modrinth-Version für Minecraft ${minecraftVersion} gefunden.${suggestion}`);
  }

  let compatibleVersion = null;
  let primaryFile = null;
  let libraryPath = '';
  let matchScore = 0;
  const candidateWarningStartIndex = warnings.length;

  for (const candidateVersion of compatibleVersions) {
    if (!isModrinthVersionAllowedForPreferredLoader(candidateVersion, projectType)) {
      warnings.push(`${projectInfo.title || projectId}: Modrinth-Version ${candidateVersion.version_number || candidateVersion.name || candidateVersion.id} ist nicht für Fabric und wurde übersprungen.`);
      continue;
    }

    const candidatePrimaryFile = getPrimaryProjectFile(candidateVersion, projectType);
    if (!candidatePrimaryFile) {
      continue;
    }

    const declaredForMinecraft = isModrinthVersionDeclaredForMinecraft(candidateVersion, minecraftVersion, projectType);
    if (requireDeclaredMinecraftVersion && !declaredForMinecraft) {
      warnings.push(`${projectInfo.title || projectId}: Modrinth-Version ${candidateVersion.version_number || candidateVersion.name || candidateVersion.id} nennt Minecraft ${minecraftVersion} nicht und wurde übersprungen.`);
      continue;
    }

    const candidateLibraryPath = getManagedLibraryPath(modContext, projectId, candidateVersion.id, candidatePrimaryFile.filename);
    await downloadFile(candidatePrimaryFile.url, candidateLibraryPath, {
      force: false,
      expectedSha1: String(candidatePrimaryFile.hashes?.sha1 || '').trim(),
      expectedSha512: String(candidatePrimaryFile.hashes?.sha512 || '').trim(),
      expectedSize: Number(candidatePrimaryFile.size || 0),
      allowedHosts: TRUSTED_MODRINTH_DOWNLOAD_HOSTS,
      backupExisting: false
    });
    const jarCompatibility = getJarMinecraftCompatibility(candidateLibraryPath, minecraftVersion);
    const canTrustModrinthGameVersions = jarCompatibility.compatible === false
      && jarCompatibility.reasonType === 'depends'
      && declaredForMinecraft;
    if (jarCompatibility.compatible === false && !canTrustModrinthGameVersions) {
      logger.info('Modrinth compatibility candidate rejected after JAR check', {
        projectId,
        minecraftVersion,
        selectedLoader: getPreferredModrinthLoaders(projectType).join(', ') || 'any',
        versionId: String(candidateVersion.id || '').trim(),
        versionNumber: String(candidateVersion.version_number || candidateVersion.name || '').trim(),
        fileName: candidatePrimaryFile.filename,
        reason: `JAR requires ${jarCompatibility.requirement || 'another Minecraft version'}`
      });
      warnings.push(`${jarCompatibility.modName || projectInfo.title || projectId}: Modrinth-Version ${candidateVersion.version_number || candidateVersion.name || candidateVersion.id} verlangt Minecraft ${jarCompatibility.requirement || 'eine andere Version'} und wurde übersprungen.`);
      try {
        if (fs.existsSync(candidateLibraryPath) && isPathInsideDirectory(modContext.libraryDir, candidateLibraryPath)) {
          fs.unlinkSync(candidateLibraryPath);
        }
      } catch (_error) {
        // stale incompatible cache files are ignored by the next sync
      }
      continue;
    }

    if (!declaredForMinecraft && !String(jarCompatibility.requirement || '').trim()) {
      logger.info('Modrinth compatibility candidate rejected after JAR check', {
        projectId,
        minecraftVersion,
        selectedLoader: getPreferredModrinthLoaders(projectType).join(', ') || 'any',
        versionId: String(candidateVersion.id || '').trim(),
        versionNumber: String(candidateVersion.version_number || candidateVersion.name || '').trim(),
        fileName: candidatePrimaryFile.filename,
        reason: `Minecraft ${minecraftVersion} was not declared and the JAR did not provide a usable requirement`
      });
      warnings.push(`${projectInfo.title || projectId}: Modrinth-Version ${candidateVersion.version_number || candidateVersion.name || candidateVersion.id} nennt Minecraft ${minecraftVersion} nicht und wurde übersprungen.`);
      try {
        if (fs.existsSync(candidateLibraryPath) && isPathInsideDirectory(modContext.libraryDir, candidateLibraryPath)) {
          fs.unlinkSync(candidateLibraryPath);
        }
      } catch (_error) {
        // stale uncertain cache files are ignored by the next sync
      }
      continue;
    }

    compatibleVersion = candidateVersion;
    primaryFile = candidatePrimaryFile;
    libraryPath = candidateLibraryPath;
    matchScore = getModrinthMinecraftVersionScore(compatibleVersion, minecraftVersion, projectType);
    logger.info('Modrinth compatibility candidate accepted after JAR check', {
      projectId,
      minecraftVersion,
      selectedLoader: getPreferredModrinthLoaders(projectType).join(', ') || 'any',
      versionId: String(candidateVersion.id || '').trim(),
      versionNumber: String(candidateVersion.version_number || candidateVersion.name || '').trim(),
      fileName: candidatePrimaryFile.filename,
      reason: canTrustModrinthGameVersions
        ? 'accepted because Modrinth game_versions match and local manifest only had a dependency range'
        : 'accepted by Modrinth metadata and local JAR compatibility'
    });
    warnings.splice(candidateWarningStartIndex);
    break;
  }

  if (!compatibleVersion || !primaryFile || !libraryPath) {
    const existingUsability = getExistingVersionUsability();
    if (existingUsability.usable) {
      return returnExistingVersion(`remote candidates rejected after JAR checks: ${existingUsability.reason}`);
    }
    const suggestion = await getModrinthMinecraftVersionSuggestionText(projectId, minecraftVersion, projectType);
    throw new Error(`Keine intern kompatible JAR-Datei für Minecraft ${minecraftVersion} gefunden.${suggestion}`);
  }

  const manifestManagedDependencyConstraints = getKnownManagedDependencyConstraints(libraryPath)
    .filter((constraint) => constraint.projectId && constraint.projectId !== projectId)
    .map((constraint) => normalizeManagedDependencyReference({
      projectId: constraint.projectId,
      versionRequirement: constraint.type === 'depends' ? constraint.requirement : '',
      blockedVersionRequirement: constraint.type === 'breaks' ? constraint.requirement : '',
      source: 'fabric.mod.json'
    }))
    .filter(Boolean);
  const manifestRequiredDependencies = manifestManagedDependencyConstraints
    .filter((dependency) => dependency.versionRequirement && !dependency.blockedVersionRequirement);
  const manifestConflictConstraints = manifestManagedDependencyConstraints
    .filter((dependency) => dependency.blockedVersionRequirement);
  const requiredDependencies = uniqueManagedDependencyReferences([
    ...(await getRequiredDependencies(compatibleVersion)),
    ...manifestRequiredDependencies
  ]);
  const dependencyDetails = uniqueManagedDependencyReferences([
    ...requiredDependencies,
    ...manifestConflictConstraints
  ]);
  const dependencyProjectIds = uniqueStrings(requiredDependencies.map((dependency) => dependency.projectId));

  // Stelle sicher, dass Fabric API installiert ist, wenn die Mod sie benötigt
  const needsFabricApi = dependencyProjectIds.includes(FABRIC_API_PROJECT_ID) ||
    (compatibleVersion.dependencies || []).some(dep => dep.project_id === FABRIC_API_PROJECT_ID);

  if (needsFabricApi) {
    try {
      const fabricApiResult = await ensureFabricApiForMod(modContext, minecraftVersion);
      if (fabricApiResult?.skipped && !isFabricApiHiddenForMinecraftVersion(minecraftVersion)) {
        warnings.push(fabricApiResult.reason);
      }
    } catch (error) {
      warnings.push(`Fabric API Installation fehlgeschlagen: ${error.message}`);
      // Fortfahren ohne Fabric API - die Mod könnte trotzdem funktionieren
    }
  }

  const installedDependencyProjectIds = [];
  const installedDependencyRequirements = [...dependencyDetails];
  for (const dependency of requiredDependencies) {
    const dependencyProjectId = dependency.projectId;
    if (dependencyProjectId === FABRIC_API_PROJECT_ID
        && (isDefaultManagedProjectIgnored(modContext, FABRIC_API_PROJECT_ID)
          || isFabricApiHiddenForMinecraftVersion(minecraftVersion))) {
      continue;
    }

    try {
      const dependencyResult = await installManagedProjectVersion({
        projectId: dependencyProjectId,
        versionId: dependency.versionId,
        versionRequirement: dependency.versionRequirement,
        blockedVersionRequirement: dependency.blockedVersionRequirement
      }, minecraftVersion, {
        forceRefresh,
        requiredVersionId: dependency.versionId,
        requiredVersionRequirement: dependency.versionRequirement,
        blockedVersionRequirement: dependency.blockedVersionRequirement,
        visitedProjects,
        modContext
      });
      installedDependencyProjectIds.push(dependencyProjectId, ...(dependencyResult.dependencyProjectIds || []));
      installedDependencyRequirements.push(...(dependencyResult.dependencyRequirements || []));
      warnings.push(...(dependencyResult.warnings || []));
    } catch (error) {
      const requirementText = formatFabricDependencyRequirement(dependency.versionRequirement);
      const blockedText = formatFabricDependencyRequirement(dependency.blockedVersionRequirement);
      const failedVersionId = String(compatibleVersion?.id || '').trim();
      const remainingVersions = compatibleVersions
        .map((entry) => String(entry?.id || '').trim())
        .filter((versionId) => versionId && versionId !== failedVersionId);
      if (failedVersionId && remainingVersions.length > 0) {
        logger.warn('Managed mod candidate skipped because a required dependency failed', {
          projectId,
          minecraftVersion,
          failedVersionId,
          dependencyProjectId,
          error: serializeError(error)
        });
        const retryVisitedProjects = new Set(visitedProjects);
        retryVisitedProjects.delete(projectId);
        return installManagedProjectVersion(projectReference, minecraftVersion, {
          ...options,
          forceRefresh: true,
          skipVersionIds: uniqueStrings([...skippedVersionIds, failedVersionId]),
          visitedProjects: retryVisitedProjects,
          modContext
        });
      }
      throw new Error(`Required dependency ${dependencyProjectId}${dependency.versionId ? ` (${dependency.versionId})` : ''}${requirementText ? ` (${requirementText})` : ''}${blockedText ? ` (not ${blockedText})` : ''}: ${error.message}`);
      warnings.push(`Abhängigkeit ${dependencyProjectId}${dependency.versionId ? ` (${dependency.versionId})` : ''}${requirementText ? ` (${requirementText})` : ''}${blockedText ? ` (nicht ${blockedText})` : ''}: ${error.message}`);
    }
  }

  state = readModsState(modContext);
  const currentProject = state.projects[projectId] || {
    projectId,
    versions: {}
  };
  if ((state.ignoredDefaultProjects || []).includes(projectId)) {
    state.ignoredDefaultProjects = (state.ignoredDefaultProjects || []).filter((entry) => entry !== projectId);
  }

  state.projects[projectId] = {
    projectId,
    slug: String(projectInfo.slug || currentProject.slug || '').trim(),
    title: String(projectInfo.title || currentProject.title || projectId).trim(),
    description: String(projectInfo.description || currentProject.description || '').trim(),
    iconUrl: String(projectInfo.icon_url || projectInfo.iconUrl || currentProject.iconUrl || '').trim(),
    clientSide: String(projectInfo.client_side || projectInfo.clientSide || currentProject.clientSide || '').trim(),
    serverSide: String(projectInfo.server_side || projectInfo.serverSide || currentProject.serverSide || '').trim(),
    versions: {
      ...(currentProject.versions || {}),
      [minecraftVersion]: {
        minecraftVersion,
        versionId: String(compatibleVersion.id || '').trim(),
        versionNumber: String(compatibleVersion.version_number || '').trim(),
        versionName: String(compatibleVersion.name || '').trim(),
        versionType: String(compatibleVersion.version_type || '').trim(),
        publishedAt: String(compatibleVersion.date_published || '').trim(),
        fileName: sanitizeJarFileName(primaryFile.filename),
        libraryPath,
        size: Number(primaryFile.size || 0),
        sha1: String(primaryFile.hashes?.sha1 || '').trim(),
        sha512: String(primaryFile.hashes?.sha512 || '').trim(),
        gameVersions: Array.isArray(compatibleVersion.game_versions)
          ? compatibleVersion.game_versions.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [],
        loaders: getModrinthVersionLoaders(compatibleVersion),
        matchScore,
        checkedMinecraftVersion: minecraftVersion,
        dependencies: dependencyProjectIds,
        dependencyDetails,
        syncedAt: new Date().toISOString()
      }
    }
  };

  writeModsState(state, modContext);
  logger.info('Managed mod compatibility final version selected', {
    projectId,
    title: state.projects[projectId].title || projectId,
    minecraftVersion,
    selectedLoader: getPreferredModrinthLoaders(projectType).join(', ') || 'any',
    installedVersionId: existingVersion?.versionId || '',
    selectedVersionId: String(compatibleVersion.id || '').trim(),
    selectedVersionNumber: String(compatibleVersion.version_number || '').trim(),
    selectedFileName: sanitizeJarFileName(primaryFile.filename)
  });
  if (existingVersion?.versionId !== String(compatibleVersion.id || '').trim()
      || existingVersion?.fileName !== sanitizeJarFileName(primaryFile.filename)) {
    logger.info('Managed mod version changed automatically', {
      projectId,
      title: state.projects[projectId].title || projectId,
      minecraftVersion,
      previousVersionId: existingVersion?.versionId || '',
      nextVersionId: String(compatibleVersion.id || '').trim(),
      previousFileName: existingVersion?.fileName || '',
      nextFileName: sanitizeJarFileName(primaryFile.filename),
      context: getDownloadableModrinthContextKey(modContext)
    });
  }

  return {
    projectId,
    title: state.projects[projectId].title || projectId,
    dependencyProjectIds: uniqueStrings(installedDependencyProjectIds),
    dependencyRequirements: uniqueManagedDependencyReferences(installedDependencyRequirements),
    warnings
  };
}

async function syncManagedModsForVersion(versionId = getEffectiveSelectedVersionId(), options = {}) {
  const modContext = options.modContext || getActiveModContext(versionId);
  const minecraftVersion = modContext.minecraftVersion;
  if (!minecraftVersion) {
    return {
      synced: 0,
      totalProjects: 0,
      warnings: []
    };
  }

  ensureDir(modContext.modsDir);
  ensureDir(modContext.resourcepacksDir || RESOURCEPACKS_DIR);
  ensureDir(modContext.shaderpacksDir || SHADERPACKS_DIR);
  cleanupProfileDuplicateFiles(modContext);
  cleanupUntrackedResourcePackFiles(modContext);
  ensureModsState(modContext);
  const declaredConflictWarnings = resolveFabricDeclaredDefaultConflicts(modContext, []);
  quarantineLegacyDisabledMods(modContext);
  const corruptedWarnings = quarantineCorruptedModFiles(modContext);
  const incompatibleXClientWarnings = disableIncompatibleXClientFiles(modContext, minecraftVersion);
  removeRemovedBundledModsFromContext(modContext);
  ensureDefaultManagedModsForContext(modContext, minecraftVersion);
  const bundledWarnings = ensureBundledRequiredModsForContext(modContext, minecraftVersion);
  const importedLocalWarnings = await importStandardLocalModrinthMods(modContext, minecraftVersion);
  const disabledUnmanagedWarnings = await disableUnmanagedStandardModFiles(modContext, []);

  let state = readModsState(modContext);
  if (restoreUnavailableAutoDisabledProjectsForRetry(state)) {
    writeModsState(state, modContext);
    state = readModsState(modContext);
  }
  const nextDisabledProjects = (state.disabledProjects || [])
    .filter((projectId) => !isManagedProjectDisableLocked(projectId, state.projects?.[projectId]));
  const nextAutoDisabledProjects = (state.autoDisabledProjects || [])
    .filter((projectId) => !isProtectedManagedProject(projectId, state.projects?.[projectId]));
  if (nextDisabledProjects.length !== (state.disabledProjects || []).length
      || nextAutoDisabledProjects.length !== (state.autoDisabledProjects || []).length) {
    state.disabledProjects = nextDisabledProjects;
    state.autoDisabledProjects = nextAutoDisabledProjects;
    writeModsState(state, modContext);
    state = readModsState(modContext);
  }

  const previousFiles = Array.isArray(state.activeSync?.files) ? state.activeSync.files : [];
  const previousFilesByProject = new Map();
  for (const entry of previousFiles) {
    if (!entry?.projectId) {
      continue;
    }

    const projectFiles = previousFilesByProject.get(entry.projectId) || [];
    projectFiles.push(entry);
    previousFilesByProject.set(entry.projectId, projectFiles);
  }
  const previousManagedNames = new Set(previousFiles.map((entry) => entry.fileName).filter(Boolean));
  const warnings = [
    ...declaredConflictWarnings,
    ...corruptedWarnings,
    ...incompatibleXClientWarnings,
    ...bundledWarnings,
    ...importedLocalWarnings,
    ...disabledUnmanagedWarnings
  ];
  const disabledProjects = new Set(state.disabledProjects || []);
  const autoDisabledProjects = new Set(state.autoDisabledProjects || []);
  const disabledProjectReasonUpdates = new Map();
  const disabledProjectReasonClears = new Set();
  const reservedNames = new Set(
    (fs.existsSync(modContext.modsDir) ? fs.readdirSync(modContext.modsDir) : [])
      .filter((fileName) => fileName.toLowerCase().endsWith('.jar'))
      .filter((fileName) => !previousManagedNames.has(fileName))
  );

  for (const fileName of fs.existsSync(modContext.modsDir) ? fs.readdirSync(modContext.modsDir) : []) {
    if (!fileName.toLowerCase().endsWith('.jar') || !isRequiredModFileName(fileName)) {
      continue;
    }

    const requiredModPath = path.join(modContext.modsDir, fileName);
    if (!isPathInsideDirectory(modContext.modsDir, requiredModPath)) {
      continue;
    }

    try {
      fs.unlinkSync(requiredModPath);
      reservedNames.delete(fileName);
    } catch (_error) {
      warnings.push(`${fileName}: Alte Pflichtmod-Datei konnte nicht ersetzt werden.`);
    }
  }

  const refreshProjects = options.refreshProjects instanceof Set ? options.refreshProjects : null;
  const forceRefreshAll = Boolean(options.refreshAll);
  const refreshDisabledProjects = Boolean(options.refreshDisabledProjects);
  const pendingProjectIds = Object.keys(state.projects || {}).sort((a, b) => {
    // Priorisiere Fabric API
    if (a === FABRIC_API_PROJECT_ID) return -1;
    if (b === FABRIC_API_PROJECT_ID) return 1;
    return 0;
  });
  const seenProjectIds = new Set();
  let activeFiles = [];
  const dependencyInstallConstraints = new Map();
  const mergeDependencyInstallConstraints = (dependencyRequirements = [], sourceTitle = '') => {
    for (const dependency of uniqueManagedDependencyReferences(dependencyRequirements)) {
      const dependencyProjectId = dependency.projectId;
      if (!dependencyProjectId || dependencyProjectId === FABRIC_API_PROJECT_ID && isFabricApiHiddenForMinecraftVersion(minecraftVersion)) {
        continue;
      }

      const currentConstraint = dependencyInstallConstraints.get(dependencyProjectId) || {};
      const nextConstraint = { ...currentConstraint };
      if (dependency.versionId) {
        if (currentConstraint.requiredVersionId && currentConstraint.requiredVersionId !== dependency.versionId) {
          warnings.push(`${sourceTitle || dependencyProjectId}: Widersprüchliche exakte Abhängigkeit für ${dependencyProjectId}: ${currentConstraint.requiredVersionId} und ${dependency.versionId}. Die zuletzt gefundene Vorgabe wird verwendet.`);
        }
        nextConstraint.requiredVersionId = dependency.versionId;
      }
      if (dependency.versionRequirement) {
        nextConstraint.requiredVersionRequirement = dependency.versionRequirement;
      }
      if (dependency.blockedVersionRequirement) {
        nextConstraint.blockedVersionRequirement = dependency.blockedVersionRequirement;
      }
      dependencyInstallConstraints.set(dependencyProjectId, nextConstraint);
    }
  };
  const getDependencyInstallOptions = (projectId) => {
    const constraint = dependencyInstallConstraints.get(projectId) || {};
    return {
      requiredVersionId: constraint.requiredVersionId || '',
      requiredVersionRequirement: constraint.requiredVersionRequirement || '',
      blockedVersionRequirement: constraint.blockedVersionRequirement || ''
    };
  };
  const shouldRefreshForDependencyConstraint = (projectId, versionEntry) => {
    if (!versionEntry) {
      return false;
    }

    const constraint = dependencyInstallConstraints.get(projectId);
    if (!constraint) {
      return false;
    }

    if (constraint.requiredVersionId && versionEntry.versionId !== constraint.requiredVersionId) {
      return true;
    }
    if (constraint.requiredVersionRequirement
        && !modrinthVersionSatisfiesDependencyRequirement(versionEntry, constraint.requiredVersionRequirement)) {
      return true;
    }
    if (constraint.blockedVersionRequirement
        && !modrinthVersionAvoidsBlockedRequirement(versionEntry, constraint.blockedVersionRequirement)) {
      return true;
    }
    return false;
  };
  for (const projectState of Object.values(state.projects || {})) {
    const projectId = String(projectState?.projectId || '').trim();
    if (!projectId || disabledProjects.has(projectId)) {
      continue;
    }

    const versionEntry = projectState?.versions?.[minecraftVersion];
    if (versionEntry?.dependencyDetails?.length) {
      mergeDependencyInstallConstraints(versionEntry.dependencyDetails, projectState.title || projectId);
    }
  }
  const requeueDependencyProjects = (dependencyProjectIds = []) => {
    for (const dependencyProjectId of uniqueStrings(dependencyProjectIds)) {
      if (!dependencyProjectId || dependencyProjectId === FABRIC_API_PROJECT_ID && isFabricApiHiddenForMinecraftVersion(minecraftVersion)) {
        continue;
      }

      const existingActiveIndexes = [];
      activeFiles.forEach((entry, index) => {
        if (entry.projectId === dependencyProjectId) {
          existingActiveIndexes.push(index);
          if (entry.fileName) {
            reservedNames.delete(entry.fileName);
          }
          if (entry.targetPath && isPathInsideDirectory(modContext.modsDir, entry.targetPath) && fs.existsSync(entry.targetPath)) {
            try {
              fs.unlinkSync(entry.targetPath);
            } catch (_error) {
              warnings.push(`${entry.fileName || path.basename(entry.targetPath)}: Alte abhängige Mod-Datei konnte nicht vor der Versionsanpassung entfernt werden.`);
            }
          }
        }
      });
      for (const index of existingActiveIndexes.reverse()) {
        activeFiles.splice(index, 1);
      }

      if (seenProjectIds.has(dependencyProjectId)) {
        seenProjectIds.delete(dependencyProjectId);
      }
      if (!pendingProjectIds.includes(dependencyProjectId)) {
        pendingProjectIds.unshift(dependencyProjectId);
      }
    }
  };

  while (pendingProjectIds.length > 0) {
    const projectId = pendingProjectIds.shift();
    if (!projectId || seenProjectIds.has(projectId)) {
      continue;
    }
    seenProjectIds.add(projectId);

    let projectState = readModsState(modContext).projects[projectId];
    state = readModsState(modContext);
    if ((state.keptLocalProjectIds || []).includes(projectId)) {
      if (removeManagedProjectFilesFromState(state, modContext, projectId)) {
        writeModsState(state, modContext);
      }
      continue;
    }
    if (isManagedProjectHiddenForMinecraftVersion(projectId, minecraftVersion)) {
      disabledProjects.delete(projectId);
      autoDisabledProjects.delete(projectId);
      continue;
    }

    if ((state.disabledProjects || []).includes(projectId)) {
      if (refreshDisabledProjects && projectState && !isBundledRequiredProject(projectId, projectState)) {
        const disabledVersionEntry = projectState?.versions?.[minecraftVersion];
        if (forceRefreshAll || !disabledVersionEntry?.libraryPath || !fs.existsSync(disabledVersionEntry.libraryPath)) {
          try {
            const installResult = await installManagedProjectVersion(projectState || { projectId }, minecraftVersion, {
              forceRefresh: forceRefreshAll,
              ...getDependencyInstallOptions(projectId),
              visitedProjects: new Set(),
              modContext
            });
            mergeDependencyInstallConstraints(installResult.dependencyRequirements || [], installResult.title || projectState?.title || projectId);
            warnings.push(...(installResult.warnings || []));
          } catch (error) {
            warnings.push(`${projectState?.title || projectId}: ${error.message}`);
          }
        }
      }
      continue;
    }
    const requiredBundledMod = getRequiredBundledMod(projectId, projectState);
    if (LEGACY_BUNDLED_PROJECT_IDS.has(String(projectId || '').trim())) {
      continue;
    }
    if (requiredBundledMod && !isRequiredBundledModCompatible(requiredBundledMod, minecraftVersion)) {
      warnings.push(`${projectState?.title || projectId}: Für ${minecraftVersion} ist keine kompatible gebündelte Version verfügbar.`);
      autoDisabledProjects.delete(projectId);
      continue;
    }

    let versionEntry = projectState?.versions?.[minecraftVersion];
    const isBundled = isBundledRequiredProject(projectId, projectState);
    const shouldRefreshProject = (forceRefreshAll
        || Boolean(refreshProjects?.has(projectId))
        || shouldRefreshCachedManagedVersion(projectId, projectState, versionEntry, minecraftVersion, modContext)
        || shouldRefreshForDependencyConstraint(projectId, versionEntry))
      && (!isBundled || forceRefreshAll);
    const shouldRefreshMetadata = Boolean(projectState)
      && (
        !String(projectState.iconUrl || '').trim()
        || !String(projectState.slug || '').trim()
        || !String(projectState.title || '').trim()
      );

    if (shouldRefreshMetadata) {
      try {
        await enrichManagedProjectMetadata(projectId, modContext);
      } catch (_error) {
        // keep sync stable even if metadata refresh fails
      }

      projectState = readModsState(modContext).projects[projectId];
      versionEntry = projectState?.versions?.[minecraftVersion];
    }

    const projectType = getModrinthProjectType(projectState);
    const unavailableCheckIsFresh = isUnavailableManagedProjectCheckFresh(state, projectId, minecraftVersion, projectType);
    if (!forceRefreshAll && unavailableCheckIsFresh && (!versionEntry?.libraryPath || !fs.existsSync(versionEntry.libraryPath))) {
      const unavailableEntry = getUnavailableManagedProjectCheck(state, projectId, minecraftVersion, projectType);
      autoDisabledProjects.add(projectId);
      disabledProjectReasonUpdates.set(projectId, createDisableReason({
        reason: `No compatible version for Minecraft ${minecraftVersion} was found.`,
        technicalEvidence: `Cached Modrinth result from ${unavailableEntry?.checkedAt || 'unknown'}: ${unavailableEntry?.reason || 'no compatible version'}.`,
        automated: true,
        source: 'managed-version-sync'
      }));
      warnings.push(`${projectState?.title || projectId}: Keine passende Version für ${minecraftVersion} gefunden (kürzlich bereits auf Modrinth geprüft).`);
      continue;
    }

    let missingExactVersion = false;
    let missingExactVersionReason = '';
    if (shouldRefreshProject || !versionEntry?.libraryPath || !fs.existsSync(versionEntry.libraryPath)) {
      try {
        const installResult = await installManagedProjectVersion(projectState || { projectId }, minecraftVersion, {
          forceRefresh: shouldRefreshProject,
          ...getDependencyInstallOptions(projectId),
          visitedProjects: new Set(),
          modContext
        });
        mergeDependencyInstallConstraints(installResult.dependencyRequirements || [], installResult.title || projectState?.title || projectId);
        requeueDependencyProjects(installResult.dependencyProjectIds || []);
        warnings.push(...(installResult.warnings || []));
        state = readModsState(modContext);
        clearUnavailableManagedProjectCheck(state, projectId, minecraftVersion, projectType);
        writeModsState(state, modContext);
      } catch (error) {
        missingExactVersion = isMissingCompatibleModrinthVersionError(error);
        if (missingExactVersion) {
          missingExactVersionReason = error.message;
        }
        if (missingExactVersion && !shouldRefreshProject) {
          try {
            const repairResult = await installManagedProjectVersion(projectState || { projectId }, minecraftVersion, {
              forceRefresh: true,
              ...getDependencyInstallOptions(projectId),
              visitedProjects: new Set(),
              modContext
            });
            missingExactVersion = false;
            mergeDependencyInstallConstraints(repairResult.dependencyRequirements || [], repairResult.title || projectState?.title || projectId);
            requeueDependencyProjects(repairResult.dependencyProjectIds || []);
            warnings.push(...(repairResult.warnings || []));
            state = readModsState(modContext);
            clearUnavailableManagedProjectCheck(state, projectId, minecraftVersion, projectType);
            writeModsState(state, modContext);
          } catch (repairError) {
            if (isMissingCompatibleModrinthVersionError(repairError)) {
              missingExactVersionReason = repairError.message;
            }
            warnings.push(`${projectState?.title || projectId}: Cache-Refresh konnte keine passende Fabric-Version finden (${repairError.message}).`);
          }
        }
        warnings.push(`${projectState?.title || projectId}: ${error.message}`);
      }

      projectState = readModsState(modContext).projects[projectId];
      versionEntry = projectState?.versions?.[minecraftVersion];
      if (missingExactVersion) {
        versionEntry = null;
      }
      for (const extraProjectId of Object.keys(readModsState(modContext).projects || {})) {
        if (!seenProjectIds.has(extraProjectId) && !pendingProjectIds.includes(extraProjectId)) {
          pendingProjectIds.push(extraProjectId);
        }
      }
    }

    const integrityIssue = versionEntry?.libraryPath && fs.existsSync(versionEntry.libraryPath)
      ? getManagedVersionIntegrityIssue(versionEntry)
      : '';
    if (integrityIssue) {
      warnings.push(`${projectState?.title || projectId}: Lokale Library-JAR ist beschädigt (${integrityIssue}) und wird neu geladen.`);
      try {
        const installResult = await installManagedProjectVersion(projectState || { projectId }, minecraftVersion, {
          forceRefresh: true,
          ...getDependencyInstallOptions(projectId),
          visitedProjects: new Set(),
          modContext
        });
        mergeDependencyInstallConstraints(installResult.dependencyRequirements || [], installResult.title || projectState?.title || projectId);
        requeueDependencyProjects(installResult.dependencyProjectIds || []);
        warnings.push(...(installResult.warnings || []));
      } catch (error) {
        warnings.push(`${projectState?.title || projectId}: Reparaturdownload fehlgeschlagen: ${error.message}`);
      }
      projectState = readModsState(modContext).projects[projectId];
      versionEntry = projectState?.versions?.[minecraftVersion];
      const repairedIntegrityIssue = versionEntry?.libraryPath && fs.existsSync(versionEntry.libraryPath)
        ? getManagedVersionIntegrityIssue(versionEntry)
        : 'Datei fehlt.';
      if (repairedIntegrityIssue) {
        warnings.push(`${projectState?.title || projectId}: Wird nicht geladen, weil die Library-JAR weiterhin ungültig ist (${repairedIntegrityIssue}).`);
        versionEntry = null;
      }
    }

    if (versionEntry?.libraryPath && fs.existsSync(versionEntry.libraryPath) && !isManagedVersionAllowedForPreferredLoader(versionEntry, getModrinthProjectType(projectState))) {
      warnings.push(`${projectState?.title || projectId}: Falscher Loader, wird neu installiert.`);
      try {
        const installResult = await installManagedProjectVersion(projectState || { projectId }, minecraftVersion, {
          forceRefresh: true,
          ...getDependencyInstallOptions(projectId),
          visitedProjects: new Set(),
          modContext
        });
        mergeDependencyInstallConstraints(installResult.dependencyRequirements || [], installResult.title || projectState?.title || projectId);
        requeueDependencyProjects(installResult.dependencyProjectIds || []);
        warnings.push(...(installResult.warnings || []));
      } catch (error) {
        warnings.push(`${projectState?.title || projectId}: Neuinstallation fehlgeschlagen: ${error.message}`);
      }
      projectState = readModsState(modContext).projects[projectId];
      versionEntry = projectState?.versions?.[minecraftVersion];
      if (versionEntry?.libraryPath && fs.existsSync(versionEntry.libraryPath) && !isManagedVersionAllowedForPreferredLoader(versionEntry, getModrinthProjectType(projectState))) {
        warnings.push(`${projectState?.title || projectId}: Keine passende Fabric-Version gefunden.`);
        versionEntry = null;
      }
    }

    if (versionEntry?.libraryPath && fs.existsSync(versionEntry.libraryPath) && !isManagedVersionJarCompatibleWithMinecraft(versionEntry, minecraftVersion)) {
      const jarCompatibility = getManagedJarMinecraftCompatibility(versionEntry, minecraftVersion);
      warnings.push(`${projectState?.title || jarCompatibility.modName || projectId}: Falsche Minecraft-Version, wird neu installiert.`);
      try {
        const installResult = await installManagedProjectVersion(projectState || { projectId }, minecraftVersion, {
          forceRefresh: true,
          ...getDependencyInstallOptions(projectId),
          visitedProjects: new Set(),
          modContext
        });
        mergeDependencyInstallConstraints(installResult.dependencyRequirements || [], installResult.title || projectState?.title || projectId);
        requeueDependencyProjects(installResult.dependencyProjectIds || []);
        warnings.push(...(installResult.warnings || []));
      } catch (error) {
        warnings.push(`${projectState?.title || projectId}: Neuinstallation fehlgeschlagen: ${error.message}`);
      }
      projectState = readModsState(modContext).projects[projectId];
      versionEntry = projectState?.versions?.[minecraftVersion];
      const repairedCompatibility = versionEntry?.libraryPath && fs.existsSync(versionEntry.libraryPath)
        ? getManagedJarMinecraftCompatibility(versionEntry, minecraftVersion)
        : { compatible: false };
      if (repairedCompatibility.compatible === false) {
        warnings.push(`${projectState?.title || repairedCompatibility.modName || projectId}: Keine passende Version für ${minecraftVersion} gefunden.`);
        versionEntry = null;
      }
    }

    if (!versionEntry?.libraryPath || !fs.existsSync(versionEntry.libraryPath)) {
      const retainedFile = (previousFilesByProject.get(projectId) || [])
        .find((entry) => entry?.targetPath
          && entry.minecraftVersion === minecraftVersion
          && isPathInsideDirectory(modContext.modsDir, entry.targetPath)
          && fs.existsSync(entry.targetPath)
          && isJarCompatibleWithMinecraft(entry.targetPath, minecraftVersion));
      if (retainedFile) {
        const retainedFileName = String(retainedFile.fileName || path.basename(retainedFile.targetPath) || '').trim();
        warnings.push(`${projectState?.title || projectId}: Keine kompatible Version für ${minecraftVersion} verfügbar. ${retainedFileName || 'Die vorhandene Datei'} bleibt aktiv.`);
        reservedNames.add(retainedFileName || path.basename(retainedFile.targetPath));
        activeFiles.push({
          ...retainedFile,
          fileName: retainedFileName || path.basename(retainedFile.targetPath),
          minecraftVersion: retainedFile.minecraftVersion || minecraftVersion
        });
        autoDisabledProjects.delete(projectId);
        disabledProjectReasonClears.add(projectId);
        continue;
      }

      autoDisabledProjects.add(projectId);
      state = readModsState(modContext);
      rememberUnavailableManagedProjectCheck(
        state,
        projectId,
        minecraftVersion,
        missingExactVersionReason || 'Automatic Modrinth compatibility sync could not find an installable version.',
        projectType
      );
      writeModsState(state, modContext);
      disabledProjectReasonUpdates.set(projectId, createDisableReason({
        reason: `No compatible version for Minecraft ${minecraftVersion} was found.`,
        technicalEvidence: 'Automatic Modrinth compatibility sync could not find an installable version.',
        automated: true,
        source: 'managed-version-sync'
      }));
      warnings.push(`${projectState?.title || projectId}: Keine passende Version für ${minecraftVersion} gefunden.`);
      continue;
    }

    autoDisabledProjects.delete(projectId);
    disabledProjectReasonClears.add(projectId);

    const activeFileName = getActiveManagedModFileName(versionEntry, projectId, minecraftVersion);
    const targetFileName = allocateManagedModFileName(activeFileName, projectId, reservedNames);
    const targetPath = path.join(modContext.modsDir, targetFileName);
    try {
      fs.copyFileSync(versionEntry.libraryPath, targetPath);
    } catch (error) {
      warnings.push(`${projectState?.title || projectId}: Konnte nicht in den Mods-Ordner kopiert werden (${error.message}).`);
      logger.warn('Managed mod copy failed during sync', {
        projectId,
        sourcePath: versionEntry.libraryPath,
        targetPath,
        error: serializeError(error)
      });
      continue;
    }
    reservedNames.add(targetFileName);
    activeFiles.push({
      projectId,
      fileName: targetFileName,
      targetPath,
      libraryPath: versionEntry.libraryPath,
      minecraftVersion
    });
  }

  state = readModsState(modContext);
  const duplicateModIdCleanup = removeDuplicateManagedFabricModIds(
    activeFiles,
    modContext,
    state,
    warnings,
    disabledProjectReasonUpdates
  );
  activeFiles = duplicateModIdCleanup.activeFiles;
  for (const removedProjectId of duplicateModIdCleanup.removedProjectIds) {
    autoDisabledProjects.add(removedProjectId);
  }

  state = readModsState(modContext);
  const activeManagedPaths = new Set(
    activeFiles
      .map((entry) => String(entry?.targetPath || '').trim())
      .filter(Boolean)
      .map((targetPath) => path.resolve(targetPath))
  );
  for (const entry of previousFiles) {
    if (!entry?.targetPath || !isPathInsideDirectory(modContext.modsDir, entry.targetPath)) {
      continue;
    }

    if (activeManagedPaths.has(path.resolve(entry.targetPath))) {
      continue;
    }

    if (fs.existsSync(entry.targetPath)) {
      try {
        fs.unlinkSync(entry.targetPath);
      } catch (_error) {
        // ignore single-file cleanup failures and continue with the new sync state
      }
    }
  }

  warnings.push(...detectKnownModConflictWarnings(modContext, state, activeFiles));

  state.activeSync = {
    minecraftVersion,
    files: activeFiles
  };
  state.autoDisabledProjects = [...autoDisabledProjects].filter((projectId) => !disabledProjects.has(projectId));
  state.disabledProjectReasons = {
    ...(state.disabledProjectReasons || {})
  };
  for (const projectId of disabledProjectReasonClears) {
    if (!autoDisabledProjects.has(projectId) && !disabledProjects.has(projectId)) {
      delete state.disabledProjectReasons[projectId];
    }
  }
  for (const [projectId, reasonEntry] of disabledProjectReasonUpdates.entries()) {
    state.disabledProjectReasons[projectId] = reasonEntry;
  }
  writeModsState(state, modContext);

  return {
    synced: activeFiles.length,
    totalProjects: Object.keys(readModsState(modContext).projects || {}).length,
    files: activeFiles,
    autoDisabledProjects: uniqueStrings([...autoDisabledProjects].filter((projectId) => !disabledProjects.has(projectId))),
    disabledProjects: uniqueStrings([...disabledProjects, ...autoDisabledProjects]),
    warnings: uniqueStrings(warnings)
  };
}

function formatManagedModsWarning(warnings) {
  const items = uniqueStrings(warnings);
  if (!items.length) {
    return '';
  }

  const preview = items[0];
  return items.length > 1
    ? `${preview} | +${items.length - 1} weitere`
    : preview;
}

function formatManagedModsLaunchMessage(syncResult) {
  const warningText = formatManagedModsWarning(syncResult?.warnings || []);
  return warningText ? ` Hinweis Mods: ${warningText}` : '';
}

function assertLaunchRequiredModsSynced(syncResult, minecraftVersion) {
  const autoDisabledProjects = uniqueStrings(syncResult?.autoDisabledProjects || []);
  if (autoDisabledProjects.length) {
    const warningText = formatManagedModsWarning(syncResult?.warnings || []);
    throw new Error(`Minecraft kann nicht gestartet werden, weil ${autoDisabledProjects.length} verwaltete Mod${autoDisabledProjects.length === 1 ? '' : 's'} nach der automatischen Reparatur keine kompatible Fabric-Version für ${minecraftVersion} hat.${warningText ? ` Details: ${warningText}` : ''}`);
  }

  if (isFabricApiHiddenForMinecraftVersion(minecraftVersion)) {
    return;
  }

  const activeFiles = Array.isArray(syncResult?.files) ? syncResult.files : [];
  const disabledProjects = new Set(syncResult?.disabledProjects || []);
  const hasFabricApi = activeFiles.some((entry) => entry.projectId === FABRIC_API_PROJECT_ID);

  if (!hasFabricApi && !disabledProjects.has(FABRIC_API_PROJECT_ID)) {
    throw new Error(`Minecraft kann nicht gestartet werden, weil Fabric API für ${minecraftVersion} nach der automatischen Reparatur nicht aktiv ist.`);
  }

  if (!hasFabricApi && !disabledProjects.has(FABRIC_API_PROJECT_ID)) {
    syncResult.warnings = uniqueStrings([
      ...(syncResult.warnings || []),
      `Fabric API wurde für ${minecraftVersion} nicht installiert; Start wird trotzdem versucht.`
    ]);
  }
}

function removeDuplicateManagedFabricModIds(activeFiles, modContext, state, warnings = [], disabledProjectReasonUpdates = new Map()) {
  const entriesByModId = new Map();
  const removedProjectIds = new Set();
  const keptFiles = [];

  for (const activeFile of activeFiles || []) {
    const targetPath = String(activeFile?.targetPath || '').trim();
    if (!targetPath || !fs.existsSync(targetPath) || !isPathInsideDirectory(modContext.modsDir, targetPath)) {
      keptFiles.push(activeFile);
      continue;
    }

    const manifestInfo = readFabricModManifest(targetPath);
    const modId = String(manifestInfo?.manifest?.id || '').trim().toLowerCase();
    if (!modId) {
      keptFiles.push(activeFile);
      continue;
    }

    const project = state.projects?.[activeFile.projectId];
    const candidate = {
      activeFile,
      modId,
      protected: isProtectedManagedProject(activeFile.projectId, project) || isRequiredModFileName(activeFile.fileName),
      title: project?.title || activeFile.fileName || activeFile.projectId
    };
    const existing = entriesByModId.get(modId);
    if (!existing) {
      entriesByModId.set(modId, candidate);
      keptFiles.push(activeFile);
      continue;
    }

    const keepCandidate = existing.protected && !candidate.protected ? existing : candidate;
    const removeCandidate = keepCandidate === existing ? candidate : existing;
    if (keepCandidate === candidate) {
      const existingIndex = keptFiles.findIndex((entry) => entry === existing.activeFile);
      if (existingIndex >= 0) {
        keptFiles.splice(existingIndex, 1, candidate.activeFile);
      } else {
        keptFiles.push(candidate.activeFile);
      }
      entriesByModId.set(modId, candidate);
    }

    if (removeCandidate.activeFile?.targetPath && fs.existsSync(removeCandidate.activeFile.targetPath)) {
      try {
        fs.unlinkSync(removeCandidate.activeFile.targetPath);
      } catch (_error) {
        warnings.push(`${removeCandidate.title}: Doppelte Mod-ID ${modId} erkannt, konnte aber nicht entfernt werden.`);
        continue;
      }
    }

    removedProjectIds.add(removeCandidate.activeFile.projectId);
    disabledProjectReasonUpdates.set(removeCandidate.activeFile.projectId, createDisableReason({
      reason: `Doppelte Fabric-Mod-ID ${modId}.`,
      technicalEvidence: `${removeCandidate.title} kollidiert mit ${keepCandidate.title}.`,
      automated: true
    }));
    warnings.push(`${removeCandidate.title}: Doppelte Mod-ID ${modId} erkannt und deaktiviert; ${keepCandidate.title} bleibt aktiv.`);
  }

  return {
    activeFiles: keptFiles.filter((entry) => !removedProjectIds.has(entry.projectId)),
    removedProjectIds
  };
}

function getDefaultDownloadableModrinthState() {
  return {
    downloads: {
      shader: {},
      resourcepack: {}
    }
  };
}

function normalizeDownloadableModrinthState(rawState) {
  const normalizedState = getDefaultDownloadableModrinthState();
  const rawDownloads = rawState?.downloads && typeof rawState.downloads === 'object'
    ? rawState.downloads
    : {};

  for (const projectType of ['shader', 'resourcepack']) {
    const rawBucket = rawDownloads[projectType] && typeof rawDownloads[projectType] === 'object'
      ? rawDownloads[projectType]
      : {};

    for (const [projectKey, rawEntry] of Object.entries(rawBucket)) {
      const rawProjectKey = String(projectKey || '').trim();
      const contextKey = String(rawEntry?.contextKey || '').trim()
        || (rawProjectKey.startsWith('pack:') ? rawProjectKey.split(':').slice(0, 2).join(':') : '')
        || (rawProjectKey.startsWith('global:') ? 'global' : '');
      const projectId = String(rawEntry?.projectId || (contextKey ? rawProjectKey.split(':').pop() : rawProjectKey) || '').trim();
      if (!projectId) {
        continue;
      }

      const stateKey = contextKey ? `${contextKey}:${projectId}` : projectId;
      normalizedState.downloads[projectType][stateKey] = {
        projectId,
        contextKey,
        projectType,
        slug: String(rawEntry?.slug || '').trim(),
        title: String(rawEntry?.title || '').trim(),
        description: String(rawEntry?.description || '').trim(),
        iconUrl: String(rawEntry?.iconUrl || '').trim(),
        minecraftVersion: String(rawEntry?.minecraftVersion || '').trim(),
        versionId: String(rawEntry?.versionId || '').trim(),
        versionNumber: String(rawEntry?.versionNumber || '').trim(),
        versionName: String(rawEntry?.versionName || '').trim(),
        fileName: String(rawEntry?.fileName || '').trim(),
        path: String(rawEntry?.path || '').trim(),
        sha1: String(rawEntry?.sha1 || '').trim().toLowerCase(),
        sha512: String(rawEntry?.sha512 || '').trim().toLowerCase(),
        size: Number(rawEntry?.size || 0),
        installedAt: String(rawEntry?.installedAt || '').trim()
      };
    }
  }

  return normalizedState;
}

function readDownloadableModrinthState() {
  ensureDir(CONFIG_DIR);
  if (!fs.existsSync(DOWNLOADABLE_MODRINTH_STATE_FILE)) {
    ROBUSTNESS.writeJsonFileAtomic(DOWNLOADABLE_MODRINTH_STATE_FILE, getDefaultDownloadableModrinthState(), {
      label: 'modrinth-downloads-state',
      backup: false,
      metadata: { createdDefault: true }
    });
  }

  return ROBUSTNESS.readJsonFile(DOWNLOADABLE_MODRINTH_STATE_FILE, getDefaultDownloadableModrinthState(), {
    label: 'modrinth-downloads-state',
    normalize: normalizeDownloadableModrinthState
  });
}

function writeDownloadableModrinthState(state) {
  ensureDir(CONFIG_DIR);
  ROBUSTNESS.writeJsonFileAtomic(DOWNLOADABLE_MODRINTH_STATE_FILE, normalizeDownloadableModrinthState(state), {
    label: 'modrinth-downloads-state',
    metadata: { operation: 'writeDownloadableModrinthState' }
  });
}

function getDownloadableModrinthBucket(state, projectType) {
  const normalizedProjectType = normalizeModrinthProjectType(projectType);
  if (normalizedProjectType !== 'shader' && normalizedProjectType !== 'resourcepack') {
    return null;
  }

  state.downloads = state.downloads && typeof state.downloads === 'object'
    ? state.downloads
    : {};
  state.downloads[normalizedProjectType] = state.downloads[normalizedProjectType] && typeof state.downloads[normalizedProjectType] === 'object'
    ? state.downloads[normalizedProjectType]
    : {};
  return state.downloads[normalizedProjectType];
}

function getDownloadableModrinthContextKey(modContext = getActiveModContext()) {
  return modContext?.type === 'pack' && modContext.packId
    ? `pack:${modContext.packId}`
    : 'global';
}

function createDownloadableModrinthStateKey(projectId, modContext = getActiveModContext()) {
  const normalizedProjectId = String(projectId || '').trim();
  return `${getDownloadableModrinthContextKey(modContext)}:${normalizedProjectId}`;
}

function getDownloadableModrinthEntryProjectId(stateKey, entry) {
  return String(entry?.projectId || '').trim() || String(stateKey || '').split(':').pop();
}

function downloadableModrinthEntryMatchesContext(stateKey, entry, modContext = getActiveModContext()) {
  const contextKey = getDownloadableModrinthContextKey(modContext);
  const entryContextKey = String(entry?.contextKey || '').trim();
  if (entryContextKey) {
    return entryContextKey === contextKey;
  }

  const normalizedStateKey = String(stateKey || '').trim();
  if (normalizedStateKey.startsWith('pack:') || normalizedStateKey.startsWith('global:')) {
    return normalizedStateKey.startsWith(`${contextKey}:`);
  }

  return contextKey === 'global';
}

function getInstalledDownloadableModrinthProjectIds(projectType = '', modContext = getActiveModContext()) {
  const state = readDownloadableModrinthState();
  const projectTypes = projectType
    ? [normalizeModrinthProjectType(projectType)]
    : ['shader', 'resourcepack'];
  const installedProjectIds = [];
  let changed = false;

  for (const currentProjectType of projectTypes) {
    const downloadTarget = getModrinthDownloadTarget(currentProjectType, modContext);
    const bucket = getDownloadableModrinthBucket(state, currentProjectType);
    if (!bucket) {
      continue;
    }

    for (const [projectId, entry] of Object.entries(bucket)) {
      if (!downloadableModrinthEntryMatchesContext(projectId, entry, modContext)) {
        continue;
      }

      const existingPath = getDownloadableModrinthEntryPath(entry, downloadTarget.directory);
      if (!existingPath) {
        delete bucket[projectId];
        changed = true;
        continue;
      }

      installedProjectIds.push(getDownloadableModrinthEntryProjectId(projectId, entry));
    }
  }

  if (changed) {
    writeDownloadableModrinthState(state);
  }

  return uniqueStrings(installedProjectIds);
}

async function enrichDownloadableModrinthEntryMetadata(state, projectType, projectId, entry) {
  if (entry?.iconUrl && entry?.title && entry?.description) {
    return entry;
  }

  const modrinthProjectId = getDownloadableModrinthEntryProjectId(projectId, entry);
  try {
    const projectInfo = await fetchModrinthProject(modrinthProjectId);
    const bucket = getDownloadableModrinthBucket(state, projectType);
    const currentEntry = bucket?.[projectId] || entry;
    const updatedEntry = {
      ...currentEntry,
      projectId: modrinthProjectId,
      slug: String(projectInfo?.slug || currentEntry.slug || '').trim(),
      title: String(projectInfo?.title || currentEntry.title || modrinthProjectId).trim(),
      description: String(projectInfo?.description || currentEntry.description || '').trim(),
      iconUrl: String(projectInfo?.icon_url || currentEntry.iconUrl || '').trim()
    };
    bucket[projectId] = updatedEntry;
    writeDownloadableModrinthState(state);
    return updatedEntry;
  } catch (_error) {
    return entry;
  }
}

function listDownloadablePackFilesRecursive(directory, visitedDirectories = new Set(), seenFiles = new Set()) {
  if (!directory || !fs.existsSync(directory)) {
    return [];
  }
  let canonicalDirectory = '';
  try {
    canonicalDirectory = getComparablePath(fs.realpathSync(directory));
  } catch (_error) {
    canonicalDirectory = getComparablePath(directory);
  }
  if (visitedDirectories.has(canonicalDirectory)) {
    return [];
  }
  visitedDirectories.add(canonicalDirectory);

  let directoryEntries = [];
  try {
    directoryEntries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    logger.warn('Could not read resource or shader pack directory', {
      directory,
      error: serializeError(error)
    });
    return [];
  }

  const files = [];
  for (const directoryEntry of directoryEntries) {
    const entryPath = path.join(directory, directoryEntry.name);
    let linkedStats = null;
    try {
      linkedStats = directoryEntry.isSymbolicLink() ? fs.statSync(entryPath) : null;
    } catch (error) {
      logger.warn('Ignored unreadable resource or shader pack path', {
        path: entryPath,
        error: serializeError(error)
      });
      continue;
    }

    if (directoryEntry.isDirectory() || linkedStats?.isDirectory()) {
      files.push(...listDownloadablePackFilesRecursive(entryPath, visitedDirectories, seenFiles));
      continue;
    }
    if ((!directoryEntry.isFile() && !linkedStats?.isFile()) || !directoryEntry.name.toLowerCase().endsWith('.zip')) {
      continue;
    }

    let canonicalFile = '';
    try {
      canonicalFile = getComparablePath(fs.realpathSync(entryPath));
    } catch (_error) {
      canonicalFile = getComparablePath(entryPath);
    }
    if (seenFiles.has(canonicalFile)) {
      logger.info('Ignored duplicate pack path (same file or symbolic link)', {
        path: entryPath,
        canonicalFile
      });
      continue;
    }
    seenFiles.add(canonicalFile);
    files.push(entryPath);
  }
  return files;
}

function getDownloadablePackIdentity(filePath) {
  const stem = path.basename(filePath, path.extname(filePath))
    .toLowerCase()
    .replace(/(?:^|[-_. ])v?\d+(?:[._-]\d+)+(?:[-_.][a-z]+\d*)*/giu, '-')
    .replace(/(?:^|[-_. ])(?:copy|final|new|old|updated?|\d+)(?=$|[-_. ])/gu, '-')
    .replace(/[-_. ]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return stem ? `name:${stem}` : `path:${getComparablePath(filePath)}`;
}

function getLocalPackIconDataUrl(filePath) {
  try {
    const archive = getZipCentralDirectoryEntries(filePath);
    const iconEntry = archive.entries.find((entry) => (
      String(entry?.name || '').replace(/^\.\//u, '').toLowerCase() === 'pack.png'
      && Number(entry.uncompressedSize || 0) <= 2 * 1024 * 1024
    ));
    if (!iconEntry) {
      return '';
    }
    const iconBuffer = readZipEntryBufferFromArchive(archive, iconEntry);
    if (!iconBuffer.length || iconBuffer.length > 2 * 1024 * 1024) {
      return '';
    }
    return `data:image/png;base64,${iconBuffer.toString('base64')}`;
  } catch (_error) {
    return '';
  }
}

function createLocalDownloadablePackEntry(projectType, filePath) {
  const stats = fs.statSync(filePath);
  const fileName = path.basename(filePath);
  return {
    id: `file:${filePath}`,
    projectId: '',
    slug: '',
    name: fileName.replace(/\.zip$/iu, ''),
    description: projectType === 'shader'
      ? 'Lokaler Shaderpack im shaderpacks-Ordner des aktiven Profils.'
      : 'Lokales Ressourcenpaket im resourcepacks-Ordner des aktiven Profils.',
    iconUrl: getLocalPackIconDataUrl(filePath),
    isProtected: false,
    canDisable: false,
    path: filePath,
    size: stats.size,
    enabled: true,
    autoDisabled: false,
    disabledReason: '',
    managed: false,
    source: 'manual',
    itemType: projectType,
    sourceLabel: projectType === 'shader' ? 'Shader' : 'Ressourcenpaket',
    fileName,
    minecraftVersion: '',
    versionName: '',
    versionNumber: '',
    lastUpdated: stats.mtime.toISOString()
  };
}

async function getInstalledDownloadableModrinthEntries(modContext = getActiveModContext()) {
  const state = readDownloadableModrinthState();
  const installedEntries = [];
  let changed = false;

  for (const projectType of ['shader', 'resourcepack']) {
    const downloadTarget = getModrinthDownloadTarget(projectType, modContext);
    const bucket = getDownloadableModrinthBucket(state, projectType);
    if (!bucket) {
      continue;
    }

    for (const [stateKey, rawEntry] of Object.entries(bucket)) {
      if (!downloadableModrinthEntryMatchesContext(stateKey, rawEntry, modContext)) {
        continue;
      }

      const projectId = getDownloadableModrinthEntryProjectId(stateKey, rawEntry);
      const entry = await enrichDownloadableModrinthEntryMetadata(state, projectType, stateKey, rawEntry);
      const existingPath = getDownloadableModrinthEntryPath(entry, downloadTarget.directory);
      if (!existingPath) {
        delete bucket[stateKey];
        changed = true;
        continue;
      }

      let stats = null;
      try {
        stats = fs.statSync(existingPath);
      } catch (_error) {
        delete bucket[stateKey];
        changed = true;
        continue;
      }

      installedEntries.push({
        id: `download:${projectType}:${projectId}`,
        projectId,
        slug: String(entry.slug || '').trim(),
        name: String(entry.title || entry.fileName || projectId).trim(),
        description: String(entry.description || '').trim() || (projectType === 'shader'
          ? 'Shaderpack im shaderpacks-Ordner des aktiven Profils.'
          : 'Ressourcenpaket im resourcepacks-Ordner des aktiven Profils.'),
        iconUrl: String(entry.iconUrl || '').trim(),
        isProtected: false,
        canDisable: false,
        path: existingPath,
        size: stats.size,
        enabled: true,
        autoDisabled: false,
        disabledReason: '',
        managed: true,
        source: 'modrinth',
        itemType: projectType,
        sourceLabel: projectType === 'shader' ? 'Shader' : 'Ressourcenpaket',
        contextKey: getDownloadableModrinthContextKey(modContext),
        fileName: path.basename(existingPath),
        minecraftVersion: String(entry.minecraftVersion || '').trim(),
        versionName: String(entry.versionName || '').trim(),
        versionNumber: String(entry.versionNumber || '').trim(),
        lastUpdated: stats.mtime.toISOString()
      });
    }
  }

  if (changed) {
    writeDownloadableModrinthState(state);
  }

  for (const projectType of ['shader', 'resourcepack']) {
    const downloadTarget = getModrinthDownloadTarget(projectType, modContext);
    const trackedPaths = new Set(
      installedEntries
        .filter((entry) => entry.itemType === projectType)
        .map((entry) => getComparablePath(entry.path))
    );
    for (const filePath of listDownloadablePackFilesRecursive(downloadTarget.directory)) {
      logger.info('Found resource or shader pack ZIP', { projectType, path: filePath });
      if (!trackedPaths.has(getComparablePath(filePath))) {
        installedEntries.push(createLocalDownloadablePackEntry(projectType, filePath));
      }
    }
  }

  const uniqueEntries = [];
  const entriesByIdentity = new Map();
  for (const entry of installedEntries) {
    const identity = `${entry.itemType}:${getDownloadablePackIdentity(entry.path)}`;
    const previous = entriesByIdentity.get(identity);
    if (!previous) {
      entriesByIdentity.set(identity, entry);
      uniqueEntries.push(entry);
      continue;
    }

    const previousMtime = Date.parse(previous.lastUpdated || '') || 0;
    const entryMtime = Date.parse(entry.lastUpdated || '') || 0;
    const preferred = previous.managed !== entry.managed
      ? (previous.managed ? previous : entry)
      : (entryMtime > previousMtime ? entry : previous);
    const duplicate = preferred === previous ? entry : previous;
    logger.info('Duplicate resource or shader pack detected', {
      projectType: entry.itemType,
      identity,
      kept: preferred.path,
      duplicate: duplicate.path
    });

    if (getComparablePath(duplicate.path) !== getComparablePath(preferred.path) && fs.existsSync(duplicate.path)) {
      try {
        fs.unlinkSync(duplicate.path);
      } catch (error) {
        logger.warn('Could not remove duplicate resource or shader pack', {
          path: duplicate.path,
          error: serializeError(error)
        });
      }
    }
    if (preferred !== previous) {
      const index = uniqueEntries.indexOf(previous);
      if (index !== -1) {
        uniqueEntries[index] = preferred;
      }
      entriesByIdentity.set(identity, preferred);
    }
  }

  logger.info('Completed resource and shader pack scan', {
    foundEntries: installedEntries.length,
    displayedEntries: uniqueEntries.length
  });
  return uniqueEntries;
}

async function cleanReinstallAllModrinthContent() {
  const modContext = getActiveModContext();
  const installedEntries = await getInstalledMods(modContext.versionId, { skipManagedSync: true });
  const reinstallProjects = new Map();
  const warnings = [];
  const removedNames = [];

  for (const entry of installedEntries) {
    if (entry.isProtected || entry.hiddenInModsTab) {
      logger.info('Keeping required content during clean reinstall', {
        name: entry.name,
        projectId: entry.projectId,
        path: entry.path
      });
      continue;
    }

    const itemType = String(entry.itemType || 'mod').trim();
    let projectId = String(entry.projectId || '').trim();
    if (entry.path && fs.existsSync(entry.path)) {
      try {
        const sha1 = getFileSha1(entry.path);
        const versionData = await fetchModrinthVersionByFileHash(sha1);
        const verifiedProjectId = String(versionData?.project_id || '').trim();
        if (verifiedProjectId) {
          projectId = verifiedProjectId;
        }
        logger.info('Identified local content on Modrinth for clean reinstall', {
          name: entry.name,
          itemType,
          projectId,
          sha1
        });
      } catch (error) {
        logger.info('Content hash was not identified on Modrinth during clean reinstall', {
          name: entry.name,
          itemType,
          path: entry.path,
          error: serializeError(error)
        });
        if (!projectId) {
          warnings.push(`${entry.name}: nicht auf Modrinth erkannt und entfernt.`);
        } else {
          warnings.push(`${entry.name}: Datei-Hash nicht erkannt; bekanntes Modrinth-Projekt wird trotzdem frisch installiert.`);
        }
      }
    }

    if (projectId) {
      reinstallProjects.set(`${itemType}:${projectId}`, {
        projectId,
        projectType: itemType,
        title: entry.name || projectId
      });
    }

    const removeResult = await removeInstalledMod(entry.id);
    if (removeResult?.success) {
      removedNames.push(entry.name || entry.fileName || projectId);
    } else {
      warnings.push(`${entry.name}: konnte nicht vollständig entfernt werden (${removeResult?.error || 'unbekannter Fehler'}).`);
    }
  }

  const installedProjects = [];
  const installTarget = {
    versionId: modContext.versionId,
    packId: modContext.packId || ''
  };
  for (const project of reinstallProjects.values()) {
    try {
      const result = await installModrinthMod(project, installTarget);
      if (result?.success) {
        installedProjects.push(project);
      } else {
        warnings.push(`${project.title}: Neuinstallation fehlgeschlagen (${result?.error || 'unbekannter Fehler'}).`);
      }
      if (result?.warning) {
        warnings.push(result.warning);
      }
    } catch (error) {
      warnings.push(`${project.title}: Neuinstallation fehlgeschlagen (${error.message}).`);
      logger.warn('Clean Modrinth reinstall failed', {
        project,
        error: serializeError(error)
      });
    }
  }

  const requiredResult = await MODS_ENGINE.syncManagedModsForVersion(modContext.versionId, {
    modContext,
    refreshAll: true,
    refreshDisabledProjects: true
  });
  warnings.push(...(requiredResult.warnings || []));
  const mods = await getInstalledMods(modContext.versionId);

  logger.info('Completed clean Modrinth content reinstall', {
    removed: removedNames.length,
    recognizedProjects: reinstallProjects.size,
    reinstalled: installedProjects.length,
    finalEntries: mods.length,
    warnings: uniqueStrings(warnings)
  });

  return {
    updated: installedProjects.length,
    total: reinstallProjects.size,
    removed: removedNames.length,
    warnings: uniqueStrings(warnings),
    message: `${removedNames.length} Einträge bereinigt, ${installedProjects.length}/${reinstallProjects.size} Modrinth-Projekte ohne Duplikate neu installiert.`,
    mods
  };
}

async function updateDownloadableModrinthProjects(projectTypes = ['resourcepack'], modContext = getActiveModContext()) {
  const state = readDownloadableModrinthState();
  const updated = [];
  const warnings = [];
  let total = 0;

  for (const projectType of projectTypes) {
    const normalizedProjectType = normalizeModrinthProjectType(projectType);
    // Resource packs are replaced only through an explicit user download.
    // Startup and bulk automatic updates must leave installed packs untouched.
    if (normalizedProjectType === 'resourcepack') {
      continue;
    }
    if (normalizedProjectType !== 'shader' && normalizedProjectType !== 'resourcepack') {
      continue;
    }

    const downloadTarget = getModrinthDownloadTarget(normalizedProjectType, modContext);
    const bucket = getDownloadableModrinthBucket(state, normalizedProjectType);
    const entries = Object.entries(bucket || {})
      .filter(([stateKey, entry]) => downloadableModrinthEntryMatchesContext(stateKey, entry, modContext));
    total += entries.length;

    for (const [stateKey, entry] of entries) {
      const projectId = getDownloadableModrinthEntryProjectId(stateKey, entry);
      const existingPath = getDownloadableModrinthEntryPath(entry, downloadTarget.directory);
      if (!existingPath) {
        delete bucket[stateKey];
        writeDownloadableModrinthState(state);
        warnings.push(`${entry?.title || projectId}: Datei wurde nicht mehr gefunden und aus der Liste entfernt.`);
        continue;
      }

      try {
        const result = await installDownloadableModrinthProject({
          projectId,
          slug: entry.slug,
          title: entry.title || projectId,
          projectType: normalizedProjectType
        }, normalizedProjectType, {
          versionId: modContext.versionId,
          packId: modContext.packId || ''
        });
        if (result?.success) {
          updated.push(projectId);
        } else if (result?.error) {
          warnings.push(`${entry?.title || projectId}: ${result.error}`);
        }
      } catch (error) {
        warnings.push(`${entry?.title || projectId}: ${error.message}`);
      }
    }
  }

  return {
    updated: uniqueStrings(updated).length,
    total,
    warnings: uniqueStrings(warnings)
  };
}

function getDownloadableModrinthEntryPath(entry, targetDirectory) {
  const entryPath = String(entry?.path || '').trim();
  if (entryPath && isPathInsideDirectory(targetDirectory, entryPath) && fs.existsSync(entryPath)) {
    return entryPath;
  }

  const fileName = String(entry?.fileName || '').trim();
  if (!fileName) {
    return '';
  }

  const candidatePath = path.join(targetDirectory, path.basename(fileName));
  return isPathInsideDirectory(targetDirectory, candidatePath) && fs.existsSync(candidatePath)
    ? candidatePath
    : '';
}

function getExistingDownloadableModrinthEntry(state, projectType, projectId, targetDirectory, modContext = getActiveModContext()) {
  const bucket = getDownloadableModrinthBucket(state, projectType);
  const stateKey = createDownloadableModrinthStateKey(projectId, modContext);
  const entry = bucket?.[stateKey] || (getDownloadableModrinthContextKey(modContext) === 'global' ? bucket?.[projectId] : null);
  if (!entry) {
    return null;
  }

  const existingPath = getDownloadableModrinthEntryPath(entry, targetDirectory);
  if (!existingPath) {
    delete bucket[stateKey];
    delete bucket[projectId];
    return null;
  }

  return {
    ...entry,
    stateKey,
    contextKey: getDownloadableModrinthContextKey(modContext),
    projectId,
    fileName: path.basename(existingPath),
    path: existingPath
  };
}

function removeTrackedDownloadableModrinthFiles(state, projectType, projectId, targetDirectory, keepPath = '', modContext = getActiveModContext()) {
  const bucket = getDownloadableModrinthBucket(state, projectType);
  const stateKey = createDownloadableModrinthStateKey(projectId, modContext);
  const legacyStateKey = getDownloadableModrinthContextKey(modContext) === 'global' ? projectId : '';
  const entry = bucket?.[stateKey] || (legacyStateKey ? bucket?.[legacyStateKey] : null);
  if (!entry) {
    return true;
  }

  const normalizedKeepPath = keepPath ? getComparablePath(keepPath) : '';
  const candidatePaths = uniqueStrings([
    String(entry.path || '').trim(),
    entry.fileName ? path.join(targetDirectory, path.basename(entry.fileName)) : ''
  ]);
  let cleanupSucceeded = true;

  for (const candidatePath of candidatePaths) {
    if (!candidatePath
        || !isPathInsideDirectory(targetDirectory, candidatePath)
        || (normalizedKeepPath && getComparablePath(candidatePath) === normalizedKeepPath)
        || !fs.existsSync(candidatePath)) {
      continue;
    }

    try {
      fs.unlinkSync(candidatePath);
    } catch (_error) {
      cleanupSucceeded = false;
    }
  }

  if (cleanupSucceeded) {
    delete bucket[stateKey];
    if (legacyStateKey) {
      delete bucket[legacyStateKey];
    }
  }

  return cleanupSucceeded;
}

async function removeDownloadableModrinthEntry(modId, modContext = getActiveModContext()) {
  const match = String(modId || '').trim().match(/^download:(shader|resourcepack):(.+)$/u);
  if (!match) {
    return { success: false, error: 'Unbekannter Download-Typ.' };
  }
  const projectType = match[1];
  const projectId = String(match[2] || '').trim();
  const downloadTarget = getModrinthDownloadTarget(projectType, modContext);
  const state = readDownloadableModrinthState();
  const bucket = getDownloadableModrinthBucket(state, projectType);
  const stateKey = createDownloadableModrinthStateKey(projectId, modContext);
  const entry = bucket?.[stateKey] || (getDownloadableModrinthContextKey(modContext) === 'global' ? bucket?.[projectId] : null);
  if (!entry) {
    return { success: false, error: 'Der Eintrag wurde nicht mehr gefunden.' };
  }
  if (!removeTrackedDownloadableModrinthFiles(state, projectType, projectId, downloadTarget.directory, '', modContext)) {
    return {
      success: false,
      error: `${entry.title || projectId} konnte nicht vollständig entfernt werden.`
    };
  }
  writeDownloadableModrinthState(state);
  return {
    success: true,
    message: `${entry.title || entry.fileName || projectId} wurde aus ${downloadTarget.folderLabel} entfernt.`
  };
}

function findDownloadableModrinthFileBySha1(targetDirectory, expectedSha1) {
  const normalizedExpectedSha1 = String(expectedSha1 || '').trim().toLowerCase();
  if (!normalizedExpectedSha1 || !fs.existsSync(targetDirectory)) {
    return '';
  }

  for (const fileName of fs.readdirSync(targetDirectory).filter((entry) => entry.toLowerCase().endsWith('.zip'))) {
    const candidatePath = path.join(targetDirectory, fileName);
    if (!isPathInsideDirectory(targetDirectory, candidatePath)) {
      continue;
    }

    try {
      if (fs.statSync(candidatePath).isFile() && getFileSha1(candidatePath).toLowerCase() === normalizedExpectedSha1) {
        return candidatePath;
      }
    } catch (_error) {
      // Ignore unreadable files and keep checking the rest of the folder.
    }
  }

  return '';
}

async function findDownloadableModrinthFileByProjectId(targetDirectory, projectId) {
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedProjectId || !fs.existsSync(targetDirectory)) {
    return null;
  }

  for (const fileName of fs.readdirSync(targetDirectory).filter((entry) => entry.toLowerCase().endsWith('.zip'))) {
    const candidatePath = path.join(targetDirectory, fileName);
    if (!isPathInsideDirectory(targetDirectory, candidatePath)) {
      continue;
    }

    let sha1 = '';
    try {
      if (!fs.statSync(candidatePath).isFile()) {
        continue;
      }
      sha1 = getFileSha1(candidatePath).toLowerCase();
    } catch (_error) {
      continue;
    }

    try {
      const versionData = await fetchModrinthVersionByFileHash(sha1);
      if (String(versionData?.project_id || '').trim() !== normalizedProjectId) {
        continue;
      }

      return {
        path: candidatePath,
        fileName,
        sha1,
        versionId: String(versionData?.id || '').trim(),
        versionNumber: String(versionData?.version_number || '').trim(),
        versionName: String(versionData?.name || '').trim()
      };
    } catch (_error) {
      // Non-Modrinth or offline-unresolvable ZIPs are ignored.
    }
  }

  return null;
}

function writeDownloadableModrinthEntry(state, projectType, projectId, entry, modContext = getActiveModContext()) {
  const bucket = getDownloadableModrinthBucket(state, projectType);
  if (!bucket) {
    return;
  }

  const contextKey = getDownloadableModrinthContextKey(modContext);
  const stateKey = createDownloadableModrinthStateKey(projectId, modContext);
  if (contextKey === 'global' && bucket[projectId]) {
    delete bucket[projectId];
  }

  bucket[stateKey] = {
    projectId,
    contextKey,
    projectType: normalizeModrinthProjectType(projectType),
    slug: String(entry.slug || '').trim(),
    title: String(entry.title || '').trim(),
    description: String(entry.description || '').trim(),
    iconUrl: String(entry.iconUrl || '').trim(),
    minecraftVersion: String(entry.minecraftVersion || '').trim(),
    versionId: String(entry.versionId || '').trim(),
    versionNumber: String(entry.versionNumber || '').trim(),
    versionName: String(entry.versionName || '').trim(),
    fileName: String(entry.fileName || '').trim(),
    path: String(entry.path || '').trim(),
    sha1: String(entry.sha1 || '').trim().toLowerCase(),
    sha512: String(entry.sha512 || '').trim().toLowerCase(),
    size: Number(entry.size || 0),
    installedAt: String(entry.installedAt || '').trim() || new Date().toISOString()
  };
}

function getModrinthDownloadTarget(projectType, modContext = getActiveModContext()) {
  const normalizedProjectType = normalizeModrinthProjectType(projectType);
  if (normalizedProjectType === 'shader') {
    return {
      typeLabel: 'Shader',
      folderLabel: 'shaderpacks',
      directory: modContext?.shaderpacksDir || SHADERPACKS_DIR,
      extension: '.zip'
    };
  }

  return {
    typeLabel: 'Ressourcenpaket',
    folderLabel: 'resourcepacks',
    directory: modContext?.resourcepacksDir || RESOURCEPACKS_DIR,
    extension: '.zip'
  };
}

async function installDownloadableModrinthProject(projectReference, projectType, installTarget = {}) {
  const normalizedProjectType = normalizeModrinthProjectType(projectType);
  const projectId = getModrinthProjectId(projectReference);
  if (!projectId) {
    return {
      success: false,
      error: 'Modrinth-Projekt konnte nicht gelesen werden.'
    };
  }

  let modContext;
  try {
    modContext = getModrinthInstallContext(installTarget);
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }

  const minecraftVersion = String(modContext.minecraftVersion || '').trim();
  if (!minecraftVersion) {
    return {
      success: false,
      error: 'Bitte wähle zuerst eine Fabric-Version aus.'
    };
  }

  const compatibleVersion = await getCompatibleModrinthProjectVersion(projectId, minecraftVersion, {
    projectType: normalizedProjectType,
    strictMinecraftVersion: normalizedProjectType !== 'resourcepack'
  });
  if (!compatibleVersion) {
    return {
      success: false,
      error: `Keine passende Version für Minecraft ${minecraftVersion} gefunden.`
    };
  }

  const primaryFile = getPrimaryProjectFile(compatibleVersion, normalizedProjectType);
  if (!primaryFile) {
    return {
      success: false,
      error: 'Keine herunterladbare Datei gefunden.'
    };
  }

  const downloadTarget = getModrinthDownloadTarget(normalizedProjectType, modContext);
  ensureDir(downloadTarget.directory);

  const fileName = sanitizeDownloadedFileName(primaryFile.filename, downloadTarget.extension);
  const destinationPath = path.join(downloadTarget.directory, fileName);
  const expectedSha1 = String(primaryFile.hashes?.sha1 || '').trim().toLowerCase();
  const expectedSha512 = String(primaryFile.hashes?.sha512 || '').trim().toLowerCase();
  const expectedSize = Number(primaryFile.size || 0);
  // Modrinth resource-pack metadata can lag behind the actual CDN file. The
  // transport is still restricted to trusted HTTPS hosts, checked against the
  // HTTP Content-Length and validated as a ZIP. Mods and shaders keep strict
  // metadata hash/size validation.
  const hasAdvisoryResourcePackMetadata = normalizedProjectType === 'resourcepack';
  const integrityExpectedSha1 = hasAdvisoryResourcePackMetadata ? '' : expectedSha1;
  const integrityExpectedSha512 = hasAdvisoryResourcePackMetadata ? '' : expectedSha512;
  const integrityExpectedSize = hasAdvisoryResourcePackMetadata ? 0 : expectedSize;
  const title = getModrinthProjectTitle(projectReference) || projectId;
  const warning = getModrinthTargetChangeWarning(installTarget, modContext);
  const state = readDownloadableModrinthState();
  const existingProjectEntry = getExistingDownloadableModrinthEntry(
    state,
    normalizedProjectType,
    projectId,
    downloadTarget.directory,
    modContext
  );
  let replacedExistingDownload = Boolean(existingProjectEntry);

  if (existingProjectEntry) {
    let existingFileMatches = false;
    try {
      existingFileMatches = verifyFileIntegrity(existingProjectEntry.path, {
        expectedSha1: integrityExpectedSha1,
        expectedSha512: integrityExpectedSha512,
        expectedSize: integrityExpectedSize,
        requireZipEndRecord: true
      }).ok;
    } catch (_error) {
      existingFileMatches = false;
    }

    if (existingFileMatches || existingProjectEntry.versionId === String(compatibleVersion.id || '').trim()) {
      writeDownloadableModrinthEntry(state, normalizedProjectType, projectId, {
        ...existingProjectEntry,
        slug: String(projectReference?.slug || existingProjectEntry.slug || '').trim(),
        title,
        description: String(projectReference?.description || existingProjectEntry.description || '').trim(),
        iconUrl: String(projectReference?.iconUrl || projectReference?.icon_url || existingProjectEntry.iconUrl || '').trim(),
        minecraftVersion,
        versionId: String(compatibleVersion.id || existingProjectEntry.versionId || '').trim(),
        versionNumber: String(compatibleVersion.version_number || existingProjectEntry.versionNumber || '').trim(),
        versionName: String(compatibleVersion.name || existingProjectEntry.versionName || '').trim(),
        sha1: expectedSha1 || existingProjectEntry.sha1,
        sha512: expectedSha512 || existingProjectEntry.sha512,
        size: expectedSize || existingProjectEntry.size,
        installedAt: existingProjectEntry.installedAt || new Date().toISOString()
      }, modContext);
      writeDownloadableModrinthState(state);
      return {
        success: true,
        warning,
        message: `${title} ist bereits in ${downloadTarget.folderLabel} installiert.`,
        path: existingProjectEntry.path
      };
    }
  }

  const existingHashPath = findDownloadableModrinthFileBySha1(downloadTarget.directory, expectedSha1);
  if (existingHashPath) {
    const cleanupSucceeded = removeTrackedDownloadableModrinthFiles(
      state,
      normalizedProjectType,
      projectId,
      downloadTarget.directory,
      existingHashPath,
      modContext
    );
    if (!cleanupSucceeded) {
      return {
        success: false,
        error: `${title} ist bereits vorhanden, aber eine alte Datei konnte nicht entfernt werden.`
      };
    }

    writeDownloadableModrinthEntry(state, normalizedProjectType, projectId, {
      slug: String(projectReference?.slug || '').trim(),
      title,
      description: String(projectReference?.description || '').trim(),
      iconUrl: String(projectReference?.iconUrl || projectReference?.icon_url || '').trim(),
      minecraftVersion,
      versionId: String(compatibleVersion.id || '').trim(),
      versionNumber: String(compatibleVersion.version_number || '').trim(),
      versionName: String(compatibleVersion.name || '').trim(),
      fileName: path.basename(existingHashPath),
      path: existingHashPath,
      sha1: expectedSha1,
      sha512: expectedSha512,
      size: expectedSize,
      installedAt: new Date().toISOString()
    }, modContext);
    writeDownloadableModrinthState(state);
    return {
      success: true,
      warning,
      message: `${title} ist bereits in ${downloadTarget.folderLabel} installiert.`,
      path: existingHashPath
    };
  }

  const existingProjectFile = await findDownloadableModrinthFileByProjectId(downloadTarget.directory, projectId);
  if (existingProjectFile) {
    const existingProjectFileMatches = existingProjectFile.versionId === String(compatibleVersion.id || '').trim()
      || (expectedSha1 && existingProjectFile.sha1 === expectedSha1);

    if (existingProjectFileMatches) {
      writeDownloadableModrinthEntry(state, normalizedProjectType, projectId, {
        slug: String(projectReference?.slug || '').trim(),
        title,
        description: String(projectReference?.description || '').trim(),
        iconUrl: String(projectReference?.iconUrl || projectReference?.icon_url || '').trim(),
        minecraftVersion,
        versionId: String(compatibleVersion.id || existingProjectFile.versionId || '').trim(),
        versionNumber: String(compatibleVersion.version_number || existingProjectFile.versionNumber || '').trim(),
        versionName: String(compatibleVersion.name || existingProjectFile.versionName || '').trim(),
        fileName: existingProjectFile.fileName,
        path: existingProjectFile.path,
        sha1: expectedSha1 || existingProjectFile.sha1,
        sha512: expectedSha512,
        size: expectedSize,
        installedAt: new Date().toISOString()
      }, modContext);
      writeDownloadableModrinthState(state);
      return {
        success: true,
        warning,
        message: `${title} ist bereits in ${downloadTarget.folderLabel} installiert.`,
        path: existingProjectFile.path
      };
    }

    if (isPathInsideDirectory(downloadTarget.directory, existingProjectFile.path) && fs.existsSync(existingProjectFile.path)) {
      try {
        fs.unlinkSync(existingProjectFile.path);
        replacedExistingDownload = true;
      } catch (_error) {
        return {
          success: false,
          error: `${path.basename(existingProjectFile.path)} konnte nicht ersetzt werden.`
        };
      }
    }
  }

  if (!removeTrackedDownloadableModrinthFiles(state, normalizedProjectType, projectId, downloadTarget.directory, '', modContext)) {
    return {
      success: false,
      error: `${title} konnte nicht aktualisiert werden, weil eine alte Datei nicht entfernt werden konnte.`
    };
  }

  await downloadFile(primaryFile.url, destinationPath, {
    expectedSha1: integrityExpectedSha1,
    expectedSha512: integrityExpectedSha512,
    expectedSize: integrityExpectedSize,
    allowedHosts: TRUSTED_MODRINTH_DOWNLOAD_HOSTS,
    backupExisting: false,
    requireZipEndRecord: true
  });
  writeDownloadableModrinthEntry(state, normalizedProjectType, projectId, {
    slug: String(projectReference?.slug || '').trim(),
    title,
    description: String(projectReference?.description || '').trim(),
    iconUrl: String(projectReference?.iconUrl || projectReference?.icon_url || '').trim(),
    minecraftVersion,
    versionId: String(compatibleVersion.id || '').trim(),
    versionNumber: String(compatibleVersion.version_number || '').trim(),
    versionName: String(compatibleVersion.name || '').trim(),
    fileName,
    path: destinationPath,
    sha1: expectedSha1,
    sha512: expectedSha512,
    size: expectedSize,
    installedAt: new Date().toISOString()
  }, modContext);
  writeDownloadableModrinthState(state);

  return {
    success: true,
    warning,
    message: replacedExistingDownload
      ? `${title} wurde in ${downloadTarget.folderLabel} aktualisiert.`
      : `${title} wurde in ${downloadTarget.folderLabel} gespeichert.`,
    path: destinationPath
  };
}

function getModpackFileHashes(fileEntry) {
  const rawHashes = fileEntry?.hashes && typeof fileEntry.hashes === 'object' ? fileEntry.hashes : {};
  return Object.fromEntries(
    Object.entries(rawHashes)
      .map(([algorithm, value]) => [
        String(algorithm || '').trim().toLowerCase(),
        String(value || '').trim().toLowerCase()
      ])
      .filter(([algorithm, value]) => algorithm && value)
  );
}

function getModpackDownloadUrl(fileEntry) {
  const downloads = Array.isArray(fileEntry?.downloads) ? fileEntry.downloads : [];
  for (const downloadUrl of downloads) {
    const normalizedUrl = String(downloadUrl || '').trim();
    if (!normalizedUrl) {
      continue;
    }

    assertTrustedHttpsUrl(normalizedUrl);
    return normalizedUrl;
  }

  return '';
}

function shouldInstallModpackFileForClient(fileEntry) {
  const clientEnv = String(fileEntry?.env?.client || 'required').trim().toLowerCase();
  return clientEnv !== 'unsupported' && clientEnv !== 'incompatible';
}

function parseModrinthPackIndex(mrpackPath) {
  const indexText = readZipTextEntry(mrpackPath, 'modrinth.index.json');
  if (!indexText) {
    throw new Error('Modpack-Manifest modrinth.index.json wurde nicht gefunden.');
  }

  let index;
  try {
    index = JSON.parse(indexText);
  } catch (error) {
    throw new Error(`Modpack-Manifest konnte nicht gelesen werden: ${error.message}`);
  }

  if (!index || typeof index !== 'object') {
    throw new Error('Modpack-Manifest ist ungültig.');
  }
  if (String(index.game || '').trim().toLowerCase() !== 'minecraft') {
    throw new Error('Nur Minecraft-Modpacks werden unterstützt.');
  }

  const dependencies = index.dependencies && typeof index.dependencies === 'object'
    ? index.dependencies
    : {};
  const minecraftVersion = String(dependencies.minecraft || '').trim();
  const fabricLoaderVersion = String(dependencies['fabric-loader'] || dependencies.fabricLoader || '').trim();
  if (!minecraftVersion) {
    throw new Error('Das Modpack nennt keine Minecraft-Version.');
  }
  if (!fabricLoaderVersion) {
    throw new Error('Nur Fabric-Modpacks können in diesem Launcher installiert werden.');
  }

  return {
    name: String(index.name || '').trim(),
    summary: String(index.summary || '').trim(),
    versionId: String(index.versionId || '').trim(),
    files: Array.isArray(index.files) ? index.files : [],
    dependencies,
    minecraftVersion,
    fabricLoaderVersion
  };
}

function createFabricVersionId(minecraftVersion, fabricLoaderVersion) {
  return `fabric-loader-${String(fabricLoaderVersion || '').trim()}-${String(minecraftVersion || '').trim()}`;
}

function createPackRecordWithoutDefaultInstall(name, versionId) {
  const normalizedName = normalizePackName(name);
  const normalizedVersionId = String(versionId || '').trim();
  const state = readPacksState();
  const packId = createPackId(normalizedName, state.packs.map((pack) => pack.id));
  const packDir = path.join(PACKS_DIR, sanitizePathSegment(packId));
  const modsDir = path.join(packDir, 'mods');
  const resourcepacksDir = path.join(packDir, 'resourcepacks');
  const shaderpacksDir = path.join(packDir, 'shaderpacks');
  const now = new Date().toISOString();

  ensureDir(packDir);
  ensureDir(modsDir);
  ensureDir(resourcepacksDir);
  ensureDir(shaderpacksDir);
  state.packs.push({
    id: packId,
    name: normalizedName,
    versionId: normalizedVersionId,
    createdAt: now,
    updatedAt: now,
    packDir,
    modsDir,
    resourcepacksDir,
    shaderpacksDir
  });
  state.activePackId = packId;
  writePacksState(state);
  syncOfficialLauncherProfiles();

  return readPacksState().packs.find((pack) => pack.id === packId);
}

function updateExistingPackForModpack(packId, versionId) {
  const normalizedPackId = String(packId || '').trim();
  const normalizedVersionId = String(versionId || '').trim();
  const targetMinecraftVersion = getMinecraftVersionName(normalizedVersionId);
  const state = readPacksState();
  const existingPack = state.packs.find((pack) => pack.id === normalizedPackId);
  if (!existingPack) {
    throw new Error('Das ausgewählte Profil wurde nicht gefunden.');
  }

  const existingMinecraftVersion = getMinecraftVersionName(existingPack.versionId);
  if (targetMinecraftVersion && existingMinecraftVersion !== targetMinecraftVersion) {
    throw new Error(`Das ausgewählte Profil nutzt Minecraft ${existingMinecraftVersion || 'eine andere Version'}, das Modpack ist für Minecraft ${targetMinecraftVersion}.`);
  }

  state.packs = state.packs.map((pack) => (
    pack.id === normalizedPackId
      ? {
          ...pack,
          updatedAt: new Date().toISOString()
        }
      : pack
  ));
  state.activePackId = normalizedPackId;
  writePacksState(state);

  return readPacksState().packs.find((pack) => pack.id === normalizedPackId);
}

function getModpackIgnoredDefaultProjects(importedProjectIds = new Set()) {
  return DEFAULT_PACK_PROJECTS
    .map((projectReference) => getModrinthProjectId(projectReference))
    .filter((projectId) => projectId && !isRequiredDefaultManagedProject(projectId) && !importedProjectIds.has(projectId));
}

function hashBuffer(buffer, algorithm = 'sha1') {
  return crypto.createHash(algorithm).update(buffer).digest('hex');
}

function writeBufferIfChanged(targetPath, data) {
  ensureDir(path.dirname(targetPath));
  if (fs.existsSync(targetPath)) {
    const existingHash = hashFile(targetPath, 'sha1');
    const nextHash = hashBuffer(data, 'sha1');
    if (existingHash === nextHash) {
      return false;
    }

  }

  fs.writeFileSync(targetPath, data);
  return true;
}

function addModpackManagedProjectToState(state, projectId, projectInfo, versionEntry, minecraftVersion) {
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedProjectId || !versionEntry?.libraryPath) {
    return;
  }

  const currentProject = state.projects[normalizedProjectId] || {};
  state.projects[normalizedProjectId] = {
    projectId: normalizedProjectId,
    slug: String(projectInfo?.slug || currentProject.slug || '').trim(),
    title: String(projectInfo?.title || currentProject.title || versionEntry.fileName || normalizedProjectId).trim(),
    description: String(projectInfo?.description || currentProject.description || '').trim(),
    iconUrl: String(projectInfo?.iconUrl || projectInfo?.icon_url || currentProject.iconUrl || '').trim(),
    clientSide: String(projectInfo?.clientSide || projectInfo?.client_side || currentProject.clientSide || 'required').trim(),
    serverSide: String(projectInfo?.serverSide || projectInfo?.server_side || currentProject.serverSide || 'optional').trim(),
    versions: {
      ...(currentProject.versions || {}),
      [minecraftVersion]: versionEntry
    }
  };
}

function archiveExistingProfileJarsBeforeModpackInstall(modContext) {
  const archiveRoot = path.join(modContext.libraryDir, '_before-modpack-install', String(Date.now()));
  const sourceDirs = [
    { dir: modContext.modsDir, label: 'mods' },
    { dir: getDisabledModsDir(modContext), label: 'disabled' }
  ];
  let archived = 0;

  for (const source of sourceDirs) {
    if (!fs.existsSync(source.dir)) {
      continue;
    }

    for (const fileName of fs.readdirSync(source.dir).filter((entry) => entry.toLowerCase().endsWith('.jar'))) {
      const sourcePath = path.join(source.dir, fileName);
      if (!isPathInsideDirectory(source.dir, sourcePath) || !fs.existsSync(sourcePath)) {
        continue;
      }

      const targetDir = path.join(archiveRoot, source.label);
      const targetPath = path.join(targetDir, sanitizeJarFileName(fileName));
      if (!isPathInsideDirectory(archiveRoot, targetPath)) {
        continue;
      }

      ensureDir(targetDir);
      try {
        fs.renameSync(sourcePath, targetPath);
        archived += 1;
      } catch (_error) {
        try {
          fs.copyFileSync(sourcePath, targetPath);
          fs.unlinkSync(sourcePath);
          archived += 1;
        } catch (copyError) {
          logger.warn('Could not archive existing profile jar before modpack install', {
            sourcePath,
            targetPath,
            error: serializeError(copyError)
          });
        }
      }
    }
  }

  return archived;
}

async function resolveModpackFileProjectInfo(fileEntry, fallbackFileName) {
  const hashes = getModpackFileHashes(fileEntry);
  const sha1 = hashes.sha1 || '';
  if (!sha1) {
    return {
      projectId: '',
      projectInfo: null,
      versionData: null,
      rejectedReason: `${fallbackFileName}: Keine Modrinth-Prüfsumme gefunden; nur Modrinth-Fabric-Mods werden installiert.`
    };
  }

  try {
    const versionData = await fetchModrinthVersionByFileHash(sha1);
    const projectId = String(versionData?.project_id || '').trim();
    if (!projectId) {
      return { projectId: '', projectInfo: null, versionData: null };
    }

    let projectInfo = null;
    let projectType = 'mod';
    try {
      const remoteProject = await fetchModrinthProject(projectId);
      projectType = normalizeModrinthProjectType(remoteProject?.project_type || 'mod');
      if (projectType === 'mod') {
        projectInfo = remoteProject;
      }
    } catch (_error) {
      projectInfo = null;
    }

    if (projectType !== 'mod') {
      return {
        projectId: '',
        projectInfo: null,
        versionData: null,
        rejectedReason: `${fallbackFileName}: Ist kein Modrinth-Mod und wurde übersprungen.`
      };
    }

    const loaders = getModrinthVersionLoaders(versionData);
    if (!loaders.includes('fabric')) {
      return {
        projectId: '',
        projectInfo: null,
        versionData: null,
        rejectedReason: `${fallbackFileName}: Ist keine Fabric-Mod und wurde übersprungen.`
      };
    }

    return {
      projectId,
      projectInfo: projectInfo || {
        title: String(versionData?.name || fallbackFileName || projectId).trim()
      },
      versionData,
      rejectedReason: ''
    };
  } catch (_error) {
    return {
      projectId: '',
      projectInfo: null,
      versionData: null,
      rejectedReason: `${fallbackFileName}: Konnte nicht als Modrinth-Fabric-Mod erkannt werden und wurde übersprungen.`
    };
  }
}

async function downloadModpackManagedFile(fileEntry, modContext, minecraftVersion, state) {
  const relativePath = normalizeZipRelativePath(fileEntry?.path || '');
  if (!relativePath || !relativePath.toLowerCase().startsWith('mods/')) {
    return { installed: false, warning: '' };
  }
  if (!relativePath.toLowerCase().endsWith('.jar')) {
    return {
      installed: false,
      warning: `${relativePath}: Nur JAR-Dateien im Modpack-Mods-Ordner werden installiert.`
    };
  }

  const downloadUrl = getModpackDownloadUrl(fileEntry);
  if (!downloadUrl) {
    return {
      installed: false,
      warning: `${relativePath}: Keine HTTPS-Download-URL im Modpack gefunden.`
    };
  }

  const hashes = getModpackFileHashes(fileEntry);
  const fallbackFileName = sanitizeJarFileName(path.basename(relativePath));
  const resolvedInfo = await resolveModpackFileProjectInfo(fileEntry, fallbackFileName);
  if (resolvedInfo.rejectedReason || !resolvedInfo.projectId || !resolvedInfo.versionData) {
    return {
      installed: false,
      warning: `${relativePath}: ${resolvedInfo.rejectedReason || 'Nur erkannte Modrinth-Fabric-Mods werden installiert.'}`
    };
  }

  const hashKey = hashes.sha1 || hashes.sha512 || hashBuffer(Buffer.from(relativePath), 'sha1');
  const projectId = resolvedInfo.projectId;
  const versionId = String(resolvedInfo.versionData.id || `mrpack-${hashKey.slice(0, 20)}`).trim();
  const libraryPath = getManagedLibraryPath(modContext, projectId, versionId, fallbackFileName);

  await downloadFile(downloadUrl, libraryPath, {
    expectedHashes: hashes,
    expectedSize: Number(fileEntry?.fileSize || fileEntry?.size || 0),
    backupExisting: false
  });

  if (!readFabricModManifest(libraryPath)?.manifest) {
    try {
      if (fs.existsSync(libraryPath) && isPathInsideDirectory(modContext.libraryDir, libraryPath)) {
        fs.unlinkSync(libraryPath);
      }
    } catch (_error) {
      // A later cache cleanup can remove it; the file is not added to state.
    }
    return {
      installed: false,
      warning: `${relativePath}: Datei hat kein Fabric-Mod-Manifest und wurde übersprungen.`
    };
  }

  const stats = fs.statSync(libraryPath);
  const versionData = resolvedInfo.versionData || {};
  const projectInfo = resolvedInfo.projectInfo || {
    title: fallbackFileName,
    description: 'Aus einem Modrinth-Modpack importierte Datei.',
    client_side: 'required',
    server_side: 'optional'
  };
  const versionEntry = {
    minecraftVersion,
    versionId,
    versionNumber: String(versionData.version_number || minecraftVersion).trim(),
    versionName: String(versionData.name || `${fallbackFileName} (${minecraftVersion})`).trim(),
    versionType: String(versionData.version_type || 'release').trim(),
    publishedAt: String(versionData.date_published || '').trim(),
    fileName: fallbackFileName,
    libraryPath,
    size: Number(fileEntry?.fileSize || fileEntry?.size || stats.size || 0),
    sha1: String(hashes.sha1 || getFileSha1(libraryPath)).trim().toLowerCase(),
    sha512: String(hashes.sha512 || '').trim().toLowerCase(),
    gameVersions: uniqueStrings([
      minecraftVersion,
      ...(Array.isArray(versionData.game_versions) ? versionData.game_versions : [])
    ]),
    loaders: uniqueStrings([
      'fabric',
      ...(Array.isArray(versionData.loaders) ? versionData.loaders : [])
    ]).map((entry) => entry.toLowerCase()),
    matchScore: 5,
    checkedMinecraftVersion: minecraftVersion,
    dependencies: [],
    dependencyDetails: [],
    syncedAt: new Date().toISOString()
  };

  addModpackManagedProjectToState(state, projectId, projectInfo, versionEntry, minecraftVersion);
  return {
    installed: true,
    projectId,
    warning: ''
  };
}

async function downloadModpackRootFile(fileEntry, minecraftVersion) {
  const relativePath = normalizeZipRelativePath(fileEntry?.path || '');
  if (!relativePath || relativePath.toLowerCase().startsWith('mods/')) {
    return { installed: false, warning: '' };
  }

  const downloadUrl = getModpackDownloadUrl(fileEntry);
  if (!downloadUrl) {
    return {
      installed: false,
      warning: `${relativePath}: Keine HTTPS-Download-URL im Modpack gefunden.`
    };
  }

  const destinationPath = path.join(DEFAULT_MINECRAFT_DIR, relativePath);
  if (!isPathInsideDirectory(DEFAULT_MINECRAFT_DIR, destinationPath)) {
    return {
      installed: false,
      warning: `${relativePath}: Unsicherer Modpack-Pfad wurde übersprungen.`
    };
  }

  await downloadFile(downloadUrl, destinationPath, {
    expectedHashes: getModpackFileHashes(fileEntry),
    expectedSize: Number(fileEntry?.fileSize || fileEntry?.size || 0),
    backupExisting: false
  });

  return {
    installed: true,
    warning: '',
    minecraftVersion
  };
}

function installModpackOverrideEntries(mrpackPath, modContext, minecraftVersion, state) {
  const archive = getZipCentralDirectoryEntries(mrpackPath);
  const prefixes = ['overrides/', 'client-overrides/'];
  const warnings = [];
  const importedProjectIds = [];
  let installedRootFiles = 0;
  let installedModFiles = 0;

  for (const entry of archive.entries) {
    const entryName = String(entry.name || '').replace(/\\/g, '/');
    const prefix = prefixes.find((candidate) => entryName.startsWith(candidate));
    if (!prefix || entryName.endsWith('/')) {
      continue;
    }

    const relativePath = normalizeZipRelativePath(entryName.slice(prefix.length));
    if (!relativePath) {
      warnings.push(`${entryName}: Unsicherer Override-Pfad wurde übersprungen.`);
      continue;
    }

    let entryBuffer;
    try {
      entryBuffer = readZipEntryBufferFromArchive(archive, entry);
    } catch (error) {
      warnings.push(`${relativePath}: Override konnte nicht gelesen werden (${error.message}).`);
      continue;
    }

    const isModsPath = relativePath.toLowerCase().startsWith('mods/');
    const isModJar = isModsPath && relativePath.toLowerCase().endsWith('.jar');
    if (isModJar) {
      if (!bufferHasFabricModManifest(entryBuffer)) {
        warnings.push(`${relativePath}: Override-JAR hat kein Fabric-Mod-Manifest und wurde übersprungen.`);
        continue;
      }

      const fileName = sanitizeJarFileName(path.basename(relativePath));
      const sha1 = hashBuffer(entryBuffer, 'sha1');
      const sha512 = hashBuffer(entryBuffer, 'sha512');
      const projectId = `mrpack-override-${sha1.slice(0, 18)}`;
      const versionId = `mrpack-override-${sha1.slice(0, 18)}`;
      const libraryPath = getManagedLibraryPath(modContext, projectId, versionId, fileName);
      writeBufferIfChanged(libraryPath, entryBuffer, {
        source: 'modpack-override',
        relativePath,
        minecraftVersion
      });
      addModpackManagedProjectToState(state, projectId, {
        title: fileName,
        description: 'Aus einem Modrinth-Modpack-Override importierte Datei.',
        client_side: 'required',
        server_side: 'optional'
      }, {
        minecraftVersion,
        versionId,
        versionNumber: minecraftVersion,
        versionName: `${fileName} (${minecraftVersion})`,
        versionType: 'release',
        publishedAt: '',
        fileName,
        libraryPath,
        size: entryBuffer.length,
        sha1,
        sha512,
        gameVersions: [minecraftVersion],
        loaders: ['fabric'],
        matchScore: 5,
        checkedMinecraftVersion: minecraftVersion,
        dependencies: [],
        dependencyDetails: [],
        syncedAt: new Date().toISOString()
      }, minecraftVersion);
      importedProjectIds.push(projectId);
      installedModFiles += 1;
      continue;
    }

    if (isModsPath) {
      warnings.push(`${relativePath}: Nur JAR-Overrides im Modpack-Mods-Ordner werden installiert.`);
      continue;
    }

    const destinationPath = path.join(DEFAULT_MINECRAFT_DIR, relativePath);
    if (!isPathInsideDirectory(DEFAULT_MINECRAFT_DIR, destinationPath)) {
      warnings.push(`${relativePath}: Unsicherer Override-Zielpfad wurde übersprungen.`);
      continue;
    }

    writeBufferIfChanged(destinationPath, entryBuffer, {
      source: 'modpack-override',
      relativePath,
      minecraftVersion
    });
    installedRootFiles += 1;
  }

  return {
    warnings,
    importedProjectIds,
    installedRootFiles,
    installedModFiles
  };
}

async function prepareModpackProfileTarget(target, defaultName, versionId) {
  const installMode = String(target?.installMode || target?.modpackInstallMode || '').trim();
  if (installMode === 'existing-profile') {
    const pack = updateExistingPackForModpack(target?.packId, versionId);
    ensureDir(pack.packDir);
    ensureDir(pack.modsDir);
    return getPackModContext(pack);
  }

  const normalizedName = normalizePackName(target?.packName || defaultName || 'Modpack');
  if (!normalizedName) {
    throw new Error('Bitte gib einen Profil-Namen ein.');
  }

  const pack = createPackRecordWithoutDefaultInstall(normalizedName, versionId);
  return getPackModContext(pack);
}

async function installModrinthModpack(projectReference, target = {}) {
  const projectId = getModrinthProjectId(projectReference);
  if (!projectId) {
    return {
      success: false,
      error: 'Modrinth-Modpack konnte nicht gelesen werden.'
    };
  }

  let projectInfo = projectReference;
  try {
    projectInfo = await fetchModrinthProject(projectId);
  } catch (_error) {
    projectInfo = projectReference;
  }

  if (normalizeModrinthProjectType(projectInfo?.project_type || projectInfo?.projectType || 'modpack') !== 'modpack') {
    return {
      success: false,
      error: 'Das ausgewählte Modrinth-Projekt ist kein Modpack.'
    };
  }

  const requestedVersionId = String(target?.versionId || projectReference?.targetVersionId || '').trim();
  const requestedMinecraftVersion = String(
    target?.minecraftVersion
    || projectReference?.targetMinecraftVersion
    || getMinecraftVersionName(requestedVersionId)
    || ''
  ).trim();
  const compatibleVersions = await getCompatibleModrinthProjectVersions(projectId, requestedMinecraftVersion, {
    projectType: 'modpack',
    strictMinecraftVersion: Boolean(requestedMinecraftVersion)
  });
  const compatibleVersion = requestedMinecraftVersion
    ? compatibleVersions[0]
    : (compatibleVersions.find((versionEntry) => (Array.isArray(versionEntry?.game_versions) ? versionEntry.game_versions : [])
        .some((versionName) => isProfileMinecraftVersion(versionName))) || compatibleVersions[0]);
  if (!compatibleVersion) {
    return {
      success: false,
      error: requestedMinecraftVersion
        ? `Keine Fabric-kompatible Modpack-Version für Minecraft ${requestedMinecraftVersion} gefunden.`
        : 'Keine Fabric-kompatible Modpack-Version gefunden.'
    };
  }

  const primaryFile = getPrimaryProjectFile(compatibleVersion, 'modpack');
  if (!primaryFile) {
    return {
      success: false,
      error: 'Keine .mrpack-Datei für dieses Modpack gefunden.'
    };
  }

  ensureDir(MODPACK_CACHE_DIR);
  const cacheDir = path.join(MODPACK_CACHE_DIR, sanitizePathSegment(projectId), sanitizePathSegment(compatibleVersion.id || 'latest'));
  const mrpackFileName = sanitizeDownloadedFileName(primaryFile.filename || `${projectId}.mrpack`, '.mrpack');
  const mrpackPath = path.join(cacheDir, mrpackFileName);
  await downloadFile(primaryFile.url, mrpackPath, {
    expectedSha1: String(primaryFile.hashes?.sha1 || '').trim(),
    expectedSha512: String(primaryFile.hashes?.sha512 || '').trim(),
    expectedSize: Number(primaryFile.size || 0),
    allowedHosts: TRUSTED_MODRINTH_DOWNLOAD_HOSTS,
    backupExisting: false
  });

  const packIndex = parseModrinthPackIndex(mrpackPath);
  const minecraftVersion = packIndex.minecraftVersion;
  if (requestedMinecraftVersion && minecraftVersion !== requestedMinecraftVersion) {
    return {
      success: false,
      error: `Das Modpack ist für Minecraft ${minecraftVersion}, gesucht wurde Minecraft ${requestedMinecraftVersion}.`
    };
  }

  const fabricVersionId = createFabricVersionId(minecraftVersion, packIndex.fabricLoaderVersion);
  if (!isProfileFabricVersionAllowed(fabricVersionId)) {
    return {
      success: false,
      error: getProfileMinecraftVersionsError()
    };
  }

  await resolveSelectedVersion(fabricVersionId, { allowProfileVersions: true });
  const title = getModrinthProjectTitle(projectInfo) || packIndex.name || projectId;
  const modContext = await prepareModpackProfileTarget(target, title, fabricVersionId);
  const installedVersionId = modContext.versionId || fabricVersionId;
  const archivedExistingJars = archiveExistingProfileJarsBeforeModpackInstall(modContext);
  const state = getDefaultModsState();
  const importedProjectIds = new Set();
  const warnings = [];
  let installedManagedFiles = 0;
  let installedRootFiles = 0;

  for (const fileEntry of packIndex.files) {
    if (!shouldInstallModpackFileForClient(fileEntry)) {
      continue;
    }

    const relativePath = normalizeZipRelativePath(fileEntry?.path || '');
    if (!relativePath) {
      warnings.push('Ein Modpack-Dateipfad war ungültig und wurde übersprungen.');
      continue;
    }

    try {
      if (relativePath.toLowerCase().startsWith('mods/')) {
        const result = await downloadModpackManagedFile(fileEntry, modContext, minecraftVersion, state);
        if (result.installed) {
          importedProjectIds.add(result.projectId);
          installedManagedFiles += 1;
        }
        if (result.warning) {
          warnings.push(result.warning);
        }
      } else {
        const result = await downloadModpackRootFile(fileEntry, minecraftVersion);
        if (result.installed) {
          installedRootFiles += 1;
        }
        if (result.warning) {
          warnings.push(result.warning);
        }
      }
    } catch (error) {
      warnings.push(`${relativePath}: Download fehlgeschlagen (${error.message}).`);
    }
  }

  const overrideResult = installModpackOverrideEntries(mrpackPath, modContext, minecraftVersion, state);
  overrideResult.importedProjectIds.forEach((entry) => importedProjectIds.add(entry));
  installedManagedFiles += overrideResult.installedModFiles;
  installedRootFiles += overrideResult.installedRootFiles;
  warnings.push(...overrideResult.warnings);
  state.ignoredDefaultProjects = getModpackIgnoredDefaultProjects(importedProjectIds);
  writeModsState(state, modContext);

  const syncResult = await syncManagedModsForVersion(installedVersionId, {
    modContext,
    refreshDisabledProjects: false
  });
  const warningText = formatManagedModsWarning([
    ...warnings,
    ...(syncResult.warnings || [])
  ]);

  return {
    success: true,
    activePackId: modContext.packId,
    selectedVersionId: installedVersionId,
    packs: getPacksConfig().packs,
    warning: warningText,
    message: `${title} wurde in Profil ${modContext.name} installiert (${installedManagedFiles} Mod-Dateien${installedRootFiles ? `, ${installedRootFiles} Zusatzdateien` : ''}${archivedExistingJars ? `, ${archivedExistingJars} alte JARs archiviert` : ''}).`,
    mods: await getInstalledMods(installedVersionId)
  };
}

async function installModrinthMod(projectReference, target = {}) {
  const projectType = getModrinthProjectType(projectReference);
  if (projectType === 'modpack') {
    return installModrinthModpack(projectReference, target);
  }

  if (projectType !== 'mod') {
    return installDownloadableModrinthProject(projectReference, projectType, target);
  }

  let modContext;
  try {
    modContext = getModrinthInstallContext(target);
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }

  const selectedVersionId = modContext.versionId;
  const minecraftVersion = modContext.minecraftVersion;
  if (!minecraftVersion) {
    return {
      success: false,
      error: 'Bitte wähle zuerst eine Fabric-Version aus.'
    };
  }

  let installResult;
  try {
    installResult = await installManagedProjectVersion(projectReference, minecraftVersion, {
      forceRefresh: true,
      visitedProjects: new Set(),
      modContext
    });
  } catch (error) {
    if (!isMissingCompatibleModrinthVersionError(error)) {
      throw error;
    }

    const syncResult = await syncManagedModsForVersion(selectedVersionId, { modContext });
    const title = getModrinthProjectTitle(projectReference) || 'Die Mod';
    return {
      success: false,
      warning: formatManagedModsWarning([
        getModrinthTargetChangeWarning(target, modContext),
        ...(syncResult.warnings || [])
      ]),
      error: `${title}: Keine passende Version für Minecraft ${minecraftVersion} gefunden.`,
      mods: await getInstalledMods(selectedVersionId)
    };
  }
  const syncResult = await syncManagedModsForVersion(selectedVersionId, { modContext });

  return {
    success: true,
    warning: formatManagedModsWarning([
      getModrinthTargetChangeWarning(target, modContext),
      ...(installResult.warnings || []),
      ...(syncResult.warnings || [])
    ]),
    message: modContext.type === 'pack'
      ? `${installResult.title} wurde in ${modContext.name} installiert.`
      : `${installResult.title} wurde für Fabric ${minecraftVersion} installiert.`,
    mods: await getInstalledMods(selectedVersionId)
  };
}

function normalizeDroppedModFilePaths(filePaths) {
  return uniqueStrings(Array.isArray(filePaths) ? filePaths : [filePaths])
    .map((filePath) => path.normalize(String(filePath || '').trim()))
    .filter((filePath) => filePath && path.isAbsolute(filePath));
}

async function recognizeDroppedModFile(filePath) {
  const fileName = path.basename(filePath);
  if (!fs.existsSync(filePath)) {
    return { recognized: false, filePath, fileName, error: `${fileName}: Datei wurde nicht gefunden.` };
  }

  const stats = fs.statSync(filePath);
  if (!stats.isFile() || !fileName.toLowerCase().endsWith('.jar')) {
    return { recognized: false, fileName, error: `${fileName}: Nur JAR-Dateien können als Mod hinzugefügt werden.` };
  }

  if (isJarFileCorrupted(filePath)) {
    return { recognized: false, fileName, error: `${fileName}: JAR ist beschädigt und wurde nicht übernommen.` };
  }

  const sha1 = getFileSha1(filePath);
  const manifestInfo = readFabricModManifest(filePath);
  let exactVersion = null;
  let remoteProject = null;

  try {
    exactVersion = await fetchModrinthVersionByFileHash(sha1);
    const exactProjectId = String(exactVersion?.project_id || '').trim();
    if (exactProjectId) {
      const project = await fetchModrinthProject(exactProjectId);
      if (normalizeModrinthProjectType(project?.project_type || 'mod') === 'mod') {
        remoteProject = project;
      }
    }
  } catch (_error) {
    exactVersion = null;
  }

  if (!remoteProject && manifestInfo?.manifest) {
    try {
      const found = await findModrinthProjectForLocalMod(
        manifestInfo.manifest,
        manifestInfo.manifestText,
        fileName
      );
      remoteProject = found.project || null;
    } catch (_error) {
      remoteProject = null;
    }
  }

  if (!remoteProject) {
    return {
      recognized: false,
      fileName,
      error: `${fileName}: Mod wurde nicht erkannt und deshalb nicht übernommen.`
    };
  }

  return {
    recognized: true,
    filePath,
    fileName,
    sha1,
    manifestInfo,
    exactVersion,
    project: remoteProject
  };
}

function droppedModExactVersionMatchesMinecraft(dropInfo, minecraftVersion) {
  const exactVersion = dropInfo?.exactVersion;
  if (!exactVersion) {
    return true;
  }

  const gameVersions = Array.isArray(exactVersion.game_versions)
    ? exactVersion.game_versions
    : [];
  if (!gameVersions.length) {
    return true;
  }

  return isGameVersionListDeclaredForMinecraft(gameVersions, minecraftVersion)
    || textContainsExactMinecraftVersion(getModrinthVersionSearchText(exactVersion, 'mod'), minecraftVersion)
    || textContainsExactMinecraftVersion(dropInfo.fileName, minecraftVersion);
}

function droppedModMatchesMinecraft(dropInfo, minecraftVersion) {
  const normalizedMinecraftVersion = String(minecraftVersion || '').trim();
  if (!normalizedMinecraftVersion) {
    return false;
  }

  if (!droppedModExactVersionMatchesMinecraft(dropInfo, normalizedMinecraftVersion)) {
    return false;
  }

  const compatibility = getJarMinecraftCompatibility(dropInfo.filePath, normalizedMinecraftVersion);
  if (compatibility.compatible !== false) {
    return true;
  }

  return compatibility.reasonType === 'depends'
    && droppedModExactVersionMatchesMinecraft(dropInfo, normalizedMinecraftVersion);
}

async function resolveDroppedModsTargetVersion(recognizedMods) {
  const currentVersionId = getEffectiveSelectedVersionId();
  const currentContext = getActiveModContext(currentVersionId);
  if (currentContext.versionId
      && currentContext.minecraftVersion
      && recognizedMods.every((dropInfo) => droppedModMatchesMinecraft(dropInfo, currentContext.minecraftVersion))) {
    return {
      versionId: currentContext.versionId,
      minecraftVersion: currentContext.minecraftVersion,
      changed: false
    };
  }

  const availableVersions = await getAvailableVersions();
  const candidates = (availableVersions.versions || [])
    .filter((version) => isFabricVersionId(version.id))
    .filter((version) => {
      const minecraftVersion = String(version.minecraftVersion || getMinecraftVersionName(version.id) || '').trim();
      return minecraftVersion
        && isSupportedMinecraftVersion(minecraftVersion)
        && recognizedMods.every((dropInfo) => droppedModMatchesMinecraft(dropInfo, minecraftVersion));
    });

  const selectedCandidate = candidates[0] || null;
  if (!selectedCandidate) {
    return {
      versionId: '',
      minecraftVersion: '',
      changed: false,
      error: 'Keine unterstützte Fabric-Version passt zu den gedroppten Mods.'
    };
  }

  return {
    versionId: selectedCandidate.id,
    minecraftVersion: String(selectedCandidate.minecraftVersion || getMinecraftVersionName(selectedCandidate.id) || '').trim(),
    changed: selectedCandidate.id !== currentVersionId
  };
}

async function copyDroppedManualModFiles(filePaths, modContext, options = {}) {
  const requireManualApproval = options.requireManualApproval !== false;
  ensureDir(modContext.modsDir);
  ensureDir(getDisabledModsDir(modContext));

  const imported = [];
  const failed = [];
  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    try {
      if (!fs.existsSync(filePath)) {
        failed.push(`${fileName}: Datei wurde nicht gefunden.`);
        continue;
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile() || !fileName.toLowerCase().endsWith('.jar')) {
        failed.push(`${fileName}: Nur JAR-Dateien können als Mod hinzugefügt werden.`);
        continue;
      }

      if (isJarFileCorrupted(filePath)) {
        failed.push(`${fileName}: JAR ist beschädigt und wurde nicht übernommen.`);
        continue;
      }

      const compatibility = options.checkMinecraftCompatibility
        ? getJarMinecraftCompatibility(filePath, modContext.minecraftVersion)
        : { compatible: true, requirement: '', modName: fileName };
      const shouldDisableForVersion = compatibility.compatible === false;
      const shouldDisable = shouldDisableForVersion || (!options.keepAsLocal && requireManualApproval);
      const targetDir = shouldDisable ? getDisabledModsDir(modContext) : modContext.modsDir;
      const targetPath = path.join(targetDir, fileName);
      if (!isPathInsideDirectory(targetDir, targetPath)) {
        failed.push(`${fileName}: Zielpfad ist nicht sicher.`);
        continue;
      }

      const copiedPath = copyFileWithUniqueName(filePath, targetPath);
      if (!copiedPath) {
        failed.push(`${fileName}: Datei konnte nicht kopiert werden.`);
        continue;
      }

      if (shouldDisableForVersion) {
        const requirement = compatibility.requirement || 'eine andere Minecraft-Version';
        rememberDisabledFileReason(modContext, path.basename(copiedPath), {
          reason: `Minecraft-Version nicht kompatibel: verlangt ${requirement}.`,
          technicalEvidence: `Aktives Profil nutzt Minecraft ${modContext.minecraftVersion || 'unbekannt'}.`,
          automated: true,
          source: 'drag-drop-version-check'
        });
      } else if (shouldDisable) {
        rememberDisabledFileReason(modContext, path.basename(copiedPath), {
          reason: 'Eigene Drag-and-drop-Mod wartet auf Freigabe.',
          technicalEvidence: 'Unbekannte lokale JAR wurde in den ausgeschalteten Mods abgelegt.',
          automated: false,
          source: 'drag-drop-approval'
        });
      }
      if (options.keepAsLocal) {
        await rememberKeptLocalModException(modContext, copiedPath, fileName);
      }

      imported.push({
        fileName: path.basename(copiedPath),
        enabled: !shouldDisable,
        disabledForVersion: shouldDisableForVersion,
        path: copiedPath,
        requirement: compatibility.requirement || ''
      });
    } catch (error) {
      failed.push(`${fileName}: ${error.message}`);
    }
  }

  return { imported, failed };
}

async function importDroppedMods(filePaths, options = {}) {
  const normalizedFilePaths = normalizeDroppedModFilePaths(filePaths);
  if (!normalizedFilePaths.length) {
    return {
      success: false,
      error: 'Keine gültige JAR-Datei erkannt.'
    };
  }

  if (options?.mode === 'keep') {
    const modContext = getActiveModContext();
    const manualResult = await copyDroppedManualModFiles(normalizedFilePaths, modContext, {
      requireManualApproval: options?.requireManualApproval,
      keepAsLocal: true,
      checkMinecraftCompatibility: true
    });
    if (!manualResult.imported.length) {
      return {
        success: false,
        error: manualResult.failed[0] || 'Keine gültige JAR-Datei erkannt.',
        rejected: manualResult.failed
      };
    }

    const activeCount = manualResult.imported.filter((entry) => entry.enabled !== false).length;
    const disabledForVersionCount = manualResult.imported.filter((entry) => entry.disabledForVersion).length;
    const messageParts = [];
    if (activeCount) {
      messageParts.push(`${activeCount} aktiviert`);
    }
    if (disabledForVersionCount) {
      messageParts.push(`${disabledForVersionCount} wegen falscher Minecraft-Version ausgeschaltet`);
    }
    return {
      success: true,
      selectedVersionId: modContext.versionId,
      minecraftVersion: modContext.minecraftVersion,
      installed: manualResult.imported.length,
      total: manualResult.imported.length,
      warning: formatManagedModsWarning(manualResult.failed),
      rejected: manualResult.failed,
      message: `${manualResult.imported.length} eigene Mod${manualResult.imported.length === 1 ? '' : 's'} behalten${messageParts.length ? `: ${messageParts.join(', ')}.` : '.'}`,
      mods: await getInstalledMods(modContext.versionId)
    };
  }

  const inspections = [];
  for (const filePath of normalizedFilePaths) {
    inspections.push(await recognizeDroppedModFile(filePath));
  }

  const recognizedMods = inspections.filter((entry) => entry.recognized);
  const recognizedFilePaths = new Set(recognizedMods.map((entry) => path.resolve(entry.filePath)));
  const manualFilePaths = normalizedFilePaths.filter((filePath) => !recognizedFilePaths.has(path.resolve(filePath)));
  const rejectedMessages = inspections
    .filter((entry) => !entry.recognized && entry.error)
    .map((entry) => entry.error);

  if (!recognizedMods.length) {
    const modContext = getActiveModContext();
    const manualResult = await copyDroppedManualModFiles(manualFilePaths, modContext, {
      requireManualApproval: options?.requireManualApproval
    });
    if (manualResult.imported.length) {
      const approvalText = options?.requireManualApproval !== false
        ? ' wartet in der Modliste auf Freigabe.'
        : ' wurde aktiviert.';
      return {
        success: true,
        selectedVersionId: modContext.versionId,
        minecraftVersion: modContext.minecraftVersion,
        installed: manualResult.imported.length,
        total: manualResult.imported.length,
        warning: formatManagedModsWarning(manualResult.failed),
        rejected: manualResult.failed,
        message: `${manualResult.imported.length} eigene Mod${manualResult.imported.length === 1 ? '' : 's'} hinzugefügt und${approvalText}`,
        mods: await getInstalledMods(modContext.versionId)
      };
    }

    return {
      success: false,
      error: manualResult.failed[0] || rejectedMessages[0] || 'Keine gedroppte JAR wurde als Modrinth-Fabric-Mod erkannt.',
      rejected: [...rejectedMessages, ...manualResult.failed]
    };
  }

  const targetVersion = await resolveDroppedModsTargetVersion(recognizedMods);
  if (!targetVersion.versionId || !targetVersion.minecraftVersion) {
    return {
      success: false,
      error: targetVersion.error || 'Keine passende Fabric-Version gefunden.',
      rejected: rejectedMessages
    };
  }

  const previousVersionId = getEffectiveSelectedVersionId();
  if (targetVersion.versionId !== previousVersionId) {
    persistEffectiveSelectedVersionId(targetVersion.versionId);
  }

  const modContext = getActiveModContext(targetVersion.versionId);
  ensureDir(modContext.modsDir);
  const manualResult = await copyDroppedManualModFiles(manualFilePaths, modContext, {
    requireManualApproval: options?.requireManualApproval
  });

  const projectsById = new Map();
  for (const dropInfo of recognizedMods) {
    const projectId = getModrinthProjectId(dropInfo.project);
    if (!projectId || projectsById.has(projectId)) {
      continue;
    }
    projectsById.set(projectId, dropInfo);
  }

  const installWarnings = [];
  const installedTitles = [];
  const failedMessages = [];
  for (const dropInfo of projectsById.values()) {
    try {
      const installResult = await installManagedProjectVersion(dropInfo.project, targetVersion.minecraftVersion, {
        forceRefresh: true,
        visitedProjects: new Set(),
        modContext
      });
      installedTitles.push(installResult.title || getModrinthProjectTitle(dropInfo.project) || dropInfo.fileName);
      installWarnings.push(...(installResult.warnings || []));
    } catch (error) {
      failedMessages.push(`${dropInfo.fileName}: ${error.message}`);
    }
  }

  if (!installedTitles.length && !manualResult.imported.length) {
    if (targetVersion.versionId !== previousVersionId) {
      persistEffectiveSelectedVersionId(previousVersionId);
    }
    return {
      success: false,
      error: failedMessages[0] || 'Keine erkannte Mod konnte installiert werden.',
      rejected: [...rejectedMessages, ...manualResult.failed, ...failedMessages]
    };
  }

  const syncResult = await syncManagedModsForVersion(targetVersion.versionId, { modContext });
  const warning = formatManagedModsWarning([
    ...rejectedMessages,
    ...manualResult.failed,
    ...failedMessages,
    ...installWarnings,
    ...(syncResult.warnings || [])
  ]);
  const versionText = `Fabric ${targetVersion.minecraftVersion}`;
  const versionChangeText = targetVersion.versionId !== previousVersionId
    ? ` Version wurde auf ${versionText} angepasst.`
    : '';
  const messageParts = [];
  if (installedTitles.length) {
    messageParts.push(`${installedTitles.length} Mod${installedTitles.length === 1 ? '' : 's'} installiert.`);
  }
  if (manualResult.imported.length) {
    messageParts.push(`${manualResult.imported.length} eigene Mod${manualResult.imported.length === 1 ? '' : 's'} hinzugefügt${options?.requireManualApproval !== false ? ' und wartet auf Freigabe' : ''}.`);
  }

  return {
    success: true,
    selectedVersionId: targetVersion.versionId,
    minecraftVersion: targetVersion.minecraftVersion,
    installed: installedTitles.length + manualResult.imported.length,
    total: recognizedMods.length + manualResult.imported.length,
    warning,
    rejected: [...rejectedMessages, ...manualResult.failed, ...failedMessages],
    message: `${messageParts.join(' ')}${versionChangeText}`,
    mods: await getInstalledMods(targetVersion.versionId)
  };
}

async function refreshInstalledMod(modId) {
  const normalizedModId = String(modId || '').trim();
  if (!normalizedModId) {
    return {
      success: false,
      error: 'Kein Mod angegeben.'
    };
  }

  if (!normalizedModId.startsWith('project:')) {
    return {
      success: false,
      error: 'Manuelle Mods können nicht automatisch aktualisiert werden.'
    };
  }

  const projectId = normalizedModId.slice('project:'.length).trim();
  const modContext = getActiveModContext();
  const state = readModsState(modContext);
  const project = state.projects[projectId];
  if (!project) {
    return {
      success: false,
      error: 'Der Mod wurde nicht mehr gefunden.'
    };
  }

  const syncResult = await syncManagedModsForVersion(modContext.versionId, {
    refreshProjects: new Set([projectId]),
    modContext
  });

  return {
    success: true,
    warning: formatManagedModsWarning(syncResult.warnings),
    message: `${project.title || projectId} wurde für ${getCurrentMinecraftVersion()} aktualisiert.`,
    mods: await getInstalledMods()
  };
}

async function updateAllManagedMods() {
  const modContext = getActiveModContext();
  const syncResult = await syncManagedModsForVersion(modContext.versionId, {
    refreshAll: true,
    refreshDisabledProjects: true,
    modContext
  });
  const downloadableUpdateResult = await updateDownloadableModrinthProjects(['resourcepack'], modContext);
  const state = readModsState(modContext);
  const visibleProjectIds = Object.keys(state.projects || {})
    .filter((projectId) => (
      !isManagedProjectHiddenForMinecraftVersion(projectId, modContext.minecraftVersion)
      && !isManagedProjectHiddenInModsTab(projectId, state.projects?.[projectId])
    ));
  const visibleProjectIdSet = new Set(visibleProjectIds);
  const checkedProjectIds = uniqueStrings([
    ...(syncResult.files || [])
      .map((entry) => String(entry?.projectId || '').trim())
      .filter((projectId) => visibleProjectIdSet.has(projectId)),
    ...(syncResult.disabledProjects || [])
      .map((projectId) => String(projectId || '').trim())
      .filter((projectId) => visibleProjectIdSet.has(projectId))
  ]);
  const totalProjects = visibleProjectIds.length + downloadableUpdateResult.total;
  if (totalProjects === 0) {
    return {
      updated: 0,
      total: 0,
      warnings: [],
      message: 'Noch keine Modrinth-Mods oder Ressourcenpakete im Launcher installiert.'
    };
  }

  const checkedTotal = (checkedProjectIds.length || syncResult.synced) + downloadableUpdateResult.updated;
  return {
    updated: checkedTotal,
    total: totalProjects,
    warnings: uniqueStrings([
      ...(syncResult.warnings || []),
      ...(downloadableUpdateResult.warnings || [])
    ]),
    message: modContext.type === 'pack'
      ? `Alle Mods in ${modContext.name} und Ressourcenpakete wurden geprüft und korrigiert.`
      : `Alle verwalteten Mods für Fabric ${getCurrentMinecraftVersion() || 'aktuell'} und Ressourcenpakete wurden geprüft und korrigiert.`
  };
}

function getDisabledModsDir(modContext = getActiveModContext()) {
  return modContext.disabledModsDir || path.join(CONFIG_DIR, DISABLED_MODS_DIR_NAME);
}

function recordModDisableEntry(modContext, details = {}) {
  const entry = {
    action: 'mod-disabled',
    contextType: String(modContext?.type || ''),
    versionId: String(modContext?.versionId || ''),
    minecraftVersion: String(modContext?.minecraftVersion || ''),
    modsDir: String(modContext?.modsDir || ''),
    projectId: String(details.projectId || ''),
    fileName: String(details.fileName || ''),
    filePath: String(details.filePath || ''),
    reason: String(details.reason || 'Nicht angegeben.'),
    technicalEvidence: String(details.technicalEvidence || '')
  };

  try {
    entry.auditPath = ROBUSTNESS.appendAudit(MOD_DISABLE_AUDIT_NAME, entry);
  } catch (error) {
    logger.warn('Could not write mod disable audit entry', {
      entry,
      error: serializeError(error)
    });
  }

  logger.warn('Mod disabled', entry);
  return entry;
}

function createDisableReason(details = {}) {
  return normalizeDisableReasonEntry({
    reason: details.reason || 'Technischer Grund nicht angegeben.',
    technicalEvidence: details.technicalEvidence || '',
    disabledAt: new Date().toISOString(),
    source: details.source || (details.automated ? 'auto-repair' : 'user')
  });
}

function getDisabledFileReasonKey(fileName) {
  return path.basename(String(fileName || '').trim()).toLowerCase();
}

function rememberDisabledFileReason(modContext, fileName, details = {}) {
  const key = getDisabledFileReasonKey(fileName);
  if (!key) {
    return;
  }

  try {
    const state = readModsState(modContext);
    state.disabledFileReasons = {
      ...(state.disabledFileReasons || {}),
      [key]: createDisableReason(details)
    };
    writeModsState(state, modContext);
  } catch (error) {
    logger.warn('Could not remember disabled file reason', {
      fileName,
      error: serializeError(error)
    });
  }
}

function clearDisabledFileReason(modContext, fileName) {
  const key = getDisabledFileReasonKey(fileName);
  if (!key) {
    return;
  }

  try {
    const state = readModsState(modContext);
    if (!state.disabledFileReasons?.[key]) {
      return;
    }
    delete state.disabledFileReasons[key];
    writeModsState(state, modContext);
  } catch (error) {
    logger.warn('Could not clear disabled file reason', {
      fileName,
      error: serializeError(error)
    });
  }
}

function formatStoredDisableReason(entry, fallback = '') {
  const reason = String(entry?.reason || '').trim();
  const evidence = String(entry?.technicalEvidence || '').trim();
  if (reason && evidence) {
    return `${reason} (${evidence})`;
  }
  return reason || evidence || fallback;
}

function stripDisabledModSuffix(filePath) {
  return String(filePath || '').toLowerCase().endsWith(DISABLED_MOD_SUFFIX)
    ? String(filePath || '').slice(0, -DISABLED_MOD_SUFFIX.length)
    : String(filePath || '');
}

function getDisabledModPath(filePath, modContext = getActiveModContext()) {
  const fileName = path.basename(stripDisabledModSuffix(filePath));
  return path.join(getDisabledModsDir(modContext), fileName);
}

function getEnabledModPath(filePath, modContext = getActiveModContext()) {
  const fileName = path.basename(stripDisabledModSuffix(filePath));
  return path.join(modContext.modsDir, fileName);
}

function isModStoragePath(modContext, filePath) {
  return isPathInsideDirectory(modContext.modsDir, filePath)
    || isPathInsideDirectory(getDisabledModsDir(modContext), filePath);
}

function getManagedProjectFileNames(state) {
  const names = new Set();
  for (const project of Object.values(state?.projects || {})) {
    for (const versionEntry of Object.values(project?.versions || {})) {
      const fileName = String(versionEntry?.fileName || '').trim().toLowerCase();
      if (fileName) {
        names.add(fileName);
      }
    }
  }
  for (const syncEntry of state?.activeSync?.files || []) {
    const fileName = String(syncEntry?.fileName || '').trim().toLowerCase();
    if (fileName) {
      names.add(fileName);
    }
  }
  return names;
}

function cleanupManagedDisabledModCopies(modContext = getActiveModContext(), state = readModsState(modContext)) {
  const disabledModsDir = getDisabledModsDir(modContext);
  if (!fs.existsSync(disabledModsDir)) {
    return;
  }

  const managedProjectFileNames = getManagedProjectFileNames(state);
  for (const fileName of fs.readdirSync(disabledModsDir)) {
    if (!managedProjectFileNames.has(fileName.toLowerCase())) {
      continue;
    }

    const filePath = path.join(disabledModsDir, fileName);
    if (isPathInsideDirectory(disabledModsDir, filePath) && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_error) {
        // keep sync resilient; this stale copy is not loaded from the mods folder
      }
    }
  }
}

function quarantineLegacyDisabledMods(modContext = getActiveModContext()) {
  if (!fs.existsSync(modContext.modsDir)) {
    return;
  }

  ensureDir(getDisabledModsDir(modContext));
  const state = readModsState(modContext);
  const managedProjectFileNames = getManagedProjectFileNames(state);

  for (const fileName of fs.readdirSync(modContext.modsDir)) {
    if (!fileName.toLowerCase().endsWith(`.jar${DISABLED_MOD_SUFFIX}`)) {
      continue;
    }

    const legacyPath = path.join(modContext.modsDir, fileName);
    const enabledFileName = path.basename(stripDisabledModSuffix(fileName)).toLowerCase();
    if (managedProjectFileNames.has(enabledFileName)) {
      try {
        fs.unlinkSync(legacyPath);
      } catch (_error) {
        // ignore cleanup failures; launch sync can continue safely
      }
      continue;
    }

    const disabledPath = getDisabledModPath(legacyPath, modContext);
    if (isPathInsideDirectory(modContext.modsDir, legacyPath) && isPathInsideDirectory(getDisabledModsDir(modContext), disabledPath)) {
      moveFileIfExists(legacyPath, disabledPath);
    }
  }

  cleanupManagedDisabledModCopies(modContext, state);
}

function moveFileIfExists(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  let finalTargetPath = targetPath;
  let counter = 0;
  if (fs.existsSync(finalTargetPath)) {
    const parsed = path.parse(targetPath);
    const timestamp = Date.now();
    do {
      counter += 1;
      finalTargetPath = path.join(parsed.dir, `${parsed.name}-${timestamp}-${counter}${parsed.ext}`);
    } while (fs.existsSync(finalTargetPath));
  }

  try {
    fs.renameSync(sourcePath, finalTargetPath);
  } catch (error) {
    if (error?.code !== 'EXDEV') {
      throw error;
    }

    fs.copyFileSync(sourcePath, finalTargetPath);
    fs.unlinkSync(sourcePath);
  }

  return finalTargetPath;
}

function copyFileWithUniqueName(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  let finalTargetPath = targetPath;
  let counter = 0;
  if (fs.existsSync(finalTargetPath)) {
    const parsed = path.parse(targetPath);
    const timestamp = Date.now();
    do {
      counter += 1;
      finalTargetPath = path.join(parsed.dir, `${parsed.name}-${timestamp}-${counter}${parsed.ext}`);
    } while (fs.existsSync(finalTargetPath));
  }

  fs.copyFileSync(sourcePath, finalTargetPath);
  return finalTargetPath;
}

function cleanupExactDuplicateFilesInDirectory(sourceDir, extensions = [], backupLabel = 'files') {
  if (!sourceDir || !fs.existsSync(sourceDir)) {
    return [];
  }

  const normalizedExtensions = new Set(
    extensions.map((extension) => String(extension || '').trim().toLowerCase()).filter(Boolean)
  );
  const filesByHash = new Map();
  const moved = [];

  for (const fileName of fs.readdirSync(sourceDir)) {
    const filePath = path.join(sourceDir, fileName);
    if (!isPathInsideDirectory(sourceDir, filePath)) {
      continue;
    }

    try {
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        continue;
      }

      const extension = path.extname(fileName).toLowerCase();
      if (normalizedExtensions.size && !normalizedExtensions.has(extension)) {
        continue;
      }

      const hashKey = `${stats.size}:${getFileSha1(filePath)}`;
      const existing = filesByHash.get(hashKey);
      if (!existing) {
        filesByHash.set(hashKey, {
          fileName,
          filePath,
          mtime: stats.mtimeMs
        });
        continue;
      }

      const keepEntry = existing.mtime >= stats.mtimeMs
        ? existing
        : { fileName, filePath, mtime: stats.mtimeMs };
      const duplicateEntry = existing.mtime >= stats.mtimeMs
        ? { fileName, filePath, mtime: stats.mtimeMs }
        : existing;
      filesByHash.set(hashKey, keepEntry);

      const backupDir = path.join(CONFIG_DIR, 'duplicate-backups', sanitizePathSegment(backupLabel));
      ensureDir(backupDir);
      const movedPath = moveFileIfExists(
        duplicateEntry.filePath,
        path.join(backupDir, duplicateEntry.fileName)
      );
      moved.push({
        fileName: duplicateEntry.fileName,
        keptFileName: keepEntry.fileName,
        backupPath: movedPath || ''
      });
    } catch (error) {
      logger.warn('Duplicate cleanup skipped file', {
        filePath,
        error: serializeError(error)
      });
    }
  }

  return moved;
}

function cleanupProfileDuplicateFiles(modContext = getActiveModContext()) {
  const contextLabel = modContext?.type === 'pack' && modContext.packId
    ? `pack-${modContext.packId}`
    : 'standard';
  return [
    ...cleanupExactDuplicateFilesInDirectory(modContext.modsDir, ['.jar'], `${contextLabel}-mods`),
    ...cleanupExactDuplicateFilesInDirectory(modContext.resourcepacksDir, ['.zip'], `${contextLabel}-resourcepacks`),
    ...cleanupExactDuplicateFilesInDirectory(modContext.shaderpacksDir, ['.zip'], `${contextLabel}-shaderpacks`)
  ];
}

function getTrackedDownloadableFileNamesForContext(projectType, modContext = getActiveModContext()) {
  const state = readDownloadableModrinthState();
  const bucket = getDownloadableModrinthBucket(state, projectType);
  const names = new Set();
  let changed = false;

  for (const [stateKey, entry] of Object.entries(bucket || {})) {
    if (!downloadableModrinthEntryMatchesContext(stateKey, entry, modContext)) {
      continue;
    }

    const target = getModrinthDownloadTarget(projectType, modContext);
    const existingPath = getDownloadableModrinthEntryPath(entry, target.directory);
    if (!existingPath) {
      delete bucket[stateKey];
      changed = true;
      continue;
    }

    names.add(path.basename(existingPath).toLowerCase());
    if (entry.fileName) {
      names.add(path.basename(entry.fileName).toLowerCase());
    }
  }

  if (changed) {
    writeDownloadableModrinthState(state);
  }

  return names;
}

function cleanupUntrackedResourcePackFiles(modContext = getActiveModContext()) {
  // Resource packs may be copied manually or appear before their Modrinth
  // state entry is written. They must never be removed by an automatic scan.
  return [];
}

function quarantineCorruptedModFiles(modContext = getActiveModContext()) {
  if (!fs.existsSync(modContext.modsDir)) {
    return [];
  }

  ensureDir(getDisabledModsDir(modContext));
  const warnings = [];
  const managedProjectFileNames = getManagedProjectFileNames(readModsState(modContext));

  for (const fileName of fs.readdirSync(modContext.modsDir)) {
    if (!fileName.toLowerCase().endsWith('.jar')) {
      continue;
    }

    const filePath = path.join(modContext.modsDir, fileName);
    if (!isPathInsideDirectory(modContext.modsDir, filePath)) {
      continue;
    }

    if (!isJarFileCorrupted(filePath)) {
      continue;
    }

    try {
      fs.unlinkSync(filePath);
      warnings.push(`${fileName}: Corrupted mod jar deleted automatically.`);
      logger.warn('Corrupted mod jar deleted automatically', {
        fileName,
        filePath,
        minecraftVersion: modContext.minecraftVersion
      });
    } catch (error) {
      warnings.push(`${fileName}: Corrupted mod jar detected but could not be deleted.`);
      logger.warn('Corrupted mod jar could not be deleted', {
        fileName,
        filePath,
        error: serializeError(error)
      });
    }
    continue;

    warnings.push(`${fileName}: Beschädigte MOD-Datei erkannt und deaktiviert (Korruptionsfehler).`);

    const disabledPath = path.join(getDisabledModsDir(modContext), fileName);
    recordModDisableEntry(modContext, {
      fileName,
      filePath,
      reason: 'Beschädigte JAR-Datei.',
      technicalEvidence: 'ZIP-Endverzeichnis konnte nicht gelesen werden oder Datei ist unvollständig.'
    });
    const movedPath = moveFileIfExists(filePath, disabledPath);
    rememberDisabledFileReason(modContext, path.basename(movedPath || disabledPath), {
      reason: 'Beschädigte JAR-Datei.',
      technicalEvidence: 'ZIP-Endverzeichnis konnte nicht gelesen werden oder Datei ist unvollständig.',
      automated: true
    });
  }

  return warnings;
}

function scanCorruptedModFiles(modContext = getActiveModContext()) {
  if (!fs.existsSync(modContext.modsDir)) {
    return [];
  }

  return fs.readdirSync(modContext.modsDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.jar'))
    .map((fileName) => {
      const filePath = path.join(modContext.modsDir, fileName);
      if (!isPathInsideDirectory(modContext.modsDir, filePath)) {
        return null;
      }
      return isJarFileCorrupted(filePath) ? { fileName, filePath } : null;
    })
    .filter(Boolean);
}

async function ensureLaunchModFolderHealthy(modContext, versionId) {
  const repairedWarnings = quarantineCorruptedModFiles(modContext);
  if (repairedWarnings.length) {
    logger.warn('Corrupted mods quarantined during launch preflight', {
      versionId,
      minecraftVersion: modContext.minecraftVersion,
      repairedWarnings
    });
    await syncManagedModsForVersion(versionId, {
      modContext,
      launchPreflight: true,
      refreshAll: false,
      refreshDisabledProjects: false
    });
  }

  const remainingCorruptedFiles = scanCorruptedModFiles(modContext);
  if (remainingCorruptedFiles.length) {
    throw new Error(`Beschädigte Mods blockieren den Start: ${remainingCorruptedFiles.map((entry) => entry.fileName).join(', ')}. Die Dateien konnten nicht automatisch repariert werden.`);
  }

  try {
    const siliconResult = await installManagedProjectVersion({
      projectId: SILICON_PROJECT_ID,
      slug: 'silicons',
      title: 'Silicon'
    }, modContext.minecraftVersion, {
      forceRefresh: false,
      visitedProjects: new Set(),
      modContext
    });
    if (siliconResult?.installed || siliconResult?.downloaded) {
      repairedWarnings.push('Pflichtmod Silicon automatisch installiert.');
    }
  } catch (error) {
    throw new Error(`Pflichtmod Silicon konnte nicht installiert werden: ${error.message}`);
  }

  const dependencyResult = await installMissingManifestDependencies(modContext);
  repairedWarnings.push(...dependencyResult.warnings);
  if (dependencyResult.installed.length) {
    repairedWarnings.push(`Fehlende Abhängigkeiten automatisch installiert: ${dependencyResult.installed.join(', ')}`);
  }

  return repairedWarnings;
}

async function installMissingManifestDependencies(modContext = getActiveModContext()) {
  const installed = [];
  const warnings = [];
  const ignoredIds = new Set(['minecraft', 'java', 'fabricloader']);
  const attemptedIds = new Set();

  for (let pass = 0; pass < 8; pass += 1) {
    const manifests = fs.existsSync(modContext.modsDir)
      ? fs.readdirSync(modContext.modsDir)
        .filter((fileName) => fileName.toLowerCase().endsWith('.jar'))
        .map((fileName) => readFabricModManifest(path.join(modContext.modsDir, fileName))?.manifest)
        .filter(Boolean)
      : [];
    const installedIds = new Set(manifests.map((manifest) => String(manifest.id || '').trim().toLowerCase()).filter(Boolean));
    let installedThisPass = false;

    for (const manifest of manifests) {
      const dependencies = manifest.depends && typeof manifest.depends === 'object' && !Array.isArray(manifest.depends)
        ? Object.entries(manifest.depends)
        : [];
      for (const [rawId, requirement] of dependencies) {
        const fabricId = String(rawId || '').trim().toLowerCase();
        if (!fabricId || ignoredIds.has(fabricId) || installedIds.has(fabricId) || attemptedIds.has(fabricId)) continue;
        attemptedIds.add(fabricId);
        const projectId = KNOWN_FABRIC_MOD_ID_PROJECT_IDS[fabricId] || fabricId;
        try {
          const result = await installManagedProjectVersion({
            projectId,
            slug: fabricId,
            title: fabricId,
            versionRequirement: requirement
          }, modContext.minecraftVersion, {
            forceRefresh: true,
            requiredVersionRequirement: requirement,
            visitedProjects: new Set(),
            modContext
          });
          installed.push(result.title || fabricId);
          installedThisPass = true;
        } catch (error) {
          warnings.push(`${manifest.name || manifest.id}: Abhängigkeit ${fabricId} konnte nicht automatisch installiert werden (${error.message}).`);
        }
      }
    }
    if (!installedThisPass) break;
  }

  return { installed: uniqueStrings(installed), warnings: uniqueStrings(warnings) };
}

async function setInstalledModEnabled(modId, enabled, options = {}) {
  const normalizedModId = String(modId || '').trim();
  const shouldEnable = Boolean(enabled);
  if (!normalizedModId) {
    return { success: false, error: 'Kein Mod angegeben.' };
  }

  const modContext = getActiveModContext();
  const state = readModsState(modContext);

  if (normalizedModId.startsWith('project:')) {
    const projectId = normalizedModId.slice('project:'.length).trim();
    const project = state.projects[projectId];
    if (!project) {
      return { success: false, error: 'Der verwaltete Mod wurde nicht gefunden.' };
    }
    if (!shouldEnable && isManagedProjectDisableLocked(projectId, project)) {
      return { success: false, error: 'Diese Pflichtmod ist erforderlich und kann nicht ausgeschaltet werden.' };
    }

    const disabledProjects = new Set(state.disabledProjects || []);
    const autoDisabledProjects = new Set(state.autoDisabledProjects || []);
    state.disabledProjectReasons = state.disabledProjectReasons || {};
    if (shouldEnable) {
      disabledProjects.delete(projectId);
      autoDisabledProjects.delete(projectId);
      delete state.disabledProjectReasons[projectId];
    } else {
      const disableReason = options.reason || 'Nutzer hat die verwaltete Mod manuell ausgeschaltet.';
      const technicalEvidence = options.technicalEvidence || 'Manuelle Aktion im Launcher.';
      recordModDisableEntry(modContext, {
        projectId,
        reason: disableReason,
        technicalEvidence
      });
      state.disabledProjectReasons[projectId] = createDisableReason({
        reason: disableReason,
        technicalEvidence,
        automated: Boolean(options.automated),
        source: options.source || (options.automated ? 'auto-repair' : 'user')
      });
      disabledProjects.add(projectId);
      autoDisabledProjects.delete(projectId);
      for (const entry of state.activeSync?.files || []) {
        if (entry.projectId === projectId && entry.targetPath && isPathInsideDirectory(modContext.modsDir, entry.targetPath) && fs.existsSync(entry.targetPath)) {
          fs.unlinkSync(entry.targetPath);
        }
      }
      const versionEntry = project?.versions?.[modContext.minecraftVersion] || {};
      const expectedFileName = String(versionEntry.fileName || '').trim();
      const expectedPath = expectedFileName ? path.join(modContext.modsDir, expectedFileName) : '';
      if (expectedPath && isPathInsideDirectory(modContext.modsDir, expectedPath) && fs.existsSync(expectedPath)) {
        fs.unlinkSync(expectedPath);
      }
      state.activeSync = {
        minecraftVersion: String(state.activeSync?.minecraftVersion || '').trim(),
        files: (state.activeSync?.files || []).filter((entry) => entry.projectId !== projectId)
      };
    }

    state.disabledProjects = [...disabledProjects];
    state.autoDisabledProjects = [...autoDisabledProjects];
    writeModsState(state, modContext);
    const syncResult = await syncManagedModsForVersion(modContext.versionId, { modContext });
    const autoDisabledAgain = shouldEnable
      && (syncResult.disabledProjects || []).includes(projectId)
      && readModsState(modContext).autoDisabledProjects.includes(projectId);
    return {
      success: true,
      warning: formatManagedModsWarning(syncResult.warnings),
      message: autoDisabledAgain
        ? `${project.title || projectId} konnte nicht eingeschaltet werden, weil keine passende Version gefunden wurde.`
        : `${project.title || projectId} wurde ${shouldEnable ? 'eingeschaltet' : 'ausgeschaltet'}.`,
      mods: await getInstalledMods()
    };
  }

  if (normalizedModId.startsWith('file:')) {
    const filePath = normalizedModId.slice('file:'.length).trim();
    const sourcePath = shouldEnable ? filePath : getEnabledModPath(filePath, modContext);
    const targetPath = shouldEnable ? getEnabledModPath(filePath, modContext) : getDisabledModPath(filePath, modContext);
    if (!sourcePath || !isModStoragePath(modContext, sourcePath) || !isModStoragePath(modContext, targetPath)) {
      return { success: false, error: 'Die Mod-Datei konnte nicht sicher geändert werden.' };
    }
    if (!shouldEnable && isRequiredModFileDisableLocked(path.basename(getEnabledModPath(filePath, modContext)))) {
      return { success: false, error: 'Diese Pflichtmod ist erforderlich und kann nicht ausgeschaltet werden.' };
    }

    ensureDir(path.dirname(targetPath));
    if (!shouldEnable) {
      const disableReason = options.reason || 'Nutzer hat die lokale Mod-Datei manuell ausgeschaltet.';
      const technicalEvidence = options.technicalEvidence || 'Manuelle Aktion im Launcher.';
      recordModDisableEntry(modContext, {
        fileName: path.basename(getEnabledModPath(filePath, modContext)),
        filePath: sourcePath,
        reason: disableReason,
        technicalEvidence
      });
    } else {
      clearDisabledFileReason(modContext, path.basename(sourcePath));
    }
    const movedPath = moveFileIfExists(sourcePath, targetPath);
    if (shouldEnable && isKeptLocalModFile(state, sourcePath, path.basename(sourcePath))) {
      await rememberKeptLocalModException(modContext, movedPath || targetPath, path.basename(sourcePath));
    }
    if (!shouldEnable) {
      rememberDisabledFileReason(modContext, path.basename(movedPath || targetPath), {
        reason: options.reason || 'Nutzer hat die lokale Mod-Datei manuell ausgeschaltet.',
        technicalEvidence: options.technicalEvidence || 'Manuelle Aktion im Launcher.',
        automated: Boolean(options.automated),
        source: options.source || (options.automated ? 'auto-repair' : 'user')
      });
    }
    return {
      success: true,
      message: `${path.basename(getEnabledModPath(filePath, modContext))} wurde ${shouldEnable ? 'eingeschaltet' : 'ausgeschaltet'}.`,
      mods: await getInstalledMods()
    };
  }

  return { success: false, error: 'Unbekannter Mod-Typ.' };
}

async function removeInstalledMod(modId) {
  const normalizedModId = String(modId || '').trim();
  if (!normalizedModId) {
    return {
      success: false,
      error: 'Kein Mod angegeben.'
    };
  }

  if (normalizedModId.startsWith('project:')) {
    const projectId = normalizeManagedProjectId(normalizedModId.slice('project:'.length).trim());
    const modContext = getActiveModContext();
    const state = readModsState(modContext);
    const project = state.projects[projectId];
    if (!project) {
      return {
        success: false,
        error: 'Der verwaltete Mod wurde nicht gefunden.'
      };
    }
    if (isManagedProjectRemoveLocked(projectId, project)) {
      return {
        success: false,
        error: 'Diese Pflichtmod ist erforderlich und kann nicht entfernt werden.'
      };
    }

    for (const entry of state.activeSync?.files || []) {
      if (entry.projectId !== projectId) {
        continue;
      }

      if (entry.targetPath && isPathInsideDirectory(modContext.modsDir, entry.targetPath) && fs.existsSync(entry.targetPath)) {
        try {
          fs.unlinkSync(entry.targetPath);
        } catch (_error) {
          // ignore single-file cleanup failures here
        }
      }
    }
    removeManagedProjectCopiesFromModStorage(modContext, projectId, project);

    delete state.projects[projectId];
    state.disabledProjects = (state.disabledProjects || []).filter((entry) => entry !== projectId);
    state.autoDisabledProjects = (state.autoDisabledProjects || []).filter((entry) => entry !== projectId);
    if (state.disabledProjectReasons) {
      delete state.disabledProjectReasons[projectId];
    }
    state.ignoredDefaultProjects = uniqueStrings([...(state.ignoredDefaultProjects || []), projectId]);
    state.activeSync = {
      minecraftVersion: String(state.activeSync?.minecraftVersion || '').trim(),
      files: (state.activeSync?.files || []).filter((entry) => entry.projectId !== projectId)
    };
    writeModsState(state, modContext);

    const projectLibraryDir = path.join(modContext.libraryDir, sanitizePathSegment(projectId));
    if (isPathInsideDirectory(modContext.libraryDir, projectLibraryDir) && fs.existsSync(projectLibraryDir)) {
      fs.rmSync(projectLibraryDir, { recursive: true, force: true });
    }

    const syncResult = await syncManagedModsForVersion(modContext.versionId, { modContext });
    return {
      success: true,
      warning: formatManagedModsWarning(syncResult.warnings),
      message: `${project.title || projectId} wurde entfernt.`,
      mods: await getInstalledMods()
    };
  }

  if (normalizedModId.startsWith('download:')) {
    const match = normalizedModId.match(/^download:(shader|resourcepack):(.+)$/u);
    if (!match) {
      return {
        success: false,
        error: 'Unbekannter Download-Typ.'
      };
    }

    const projectType = match[1];
    const projectId = String(match[2] || '').trim();
    const modContext = getActiveModContext();
    const downloadTarget = getModrinthDownloadTarget(projectType, modContext);
    const state = readDownloadableModrinthState();
    const bucket = getDownloadableModrinthBucket(state, projectType);
    const stateKey = createDownloadableModrinthStateKey(projectId, modContext);
    const entry = bucket?.[stateKey] || (getDownloadableModrinthContextKey(modContext) === 'global' ? bucket?.[projectId] : null);
    if (!entry) {
      return {
        success: false,
        error: 'Der Eintrag wurde nicht mehr gefunden.'
      };
    }

    if (!removeTrackedDownloadableModrinthFiles(state, projectType, projectId, downloadTarget.directory, '', modContext)) {
      return {
        success: false,
        error: `${entry.title || projectId} konnte nicht vollständig entfernt werden.`
      };
    }

    writeDownloadableModrinthState(state);
    return {
      success: true,
      message: `${entry.title || entry.fileName || projectId} wurde aus ${downloadTarget.folderLabel} entfernt.`,
      mods: await getInstalledMods(getEffectiveSelectedVersionId(), { skipManagedSync: true })
    };
  }

  if (normalizedModId.startsWith('file:')) {
    const filePath = normalizedModId.slice('file:'.length).trim();
    const modContext = getActiveModContext();
    if (!filePath || !isModStoragePath(modContext, filePath) || (!filePath.toLowerCase().endsWith('.jar') && !filePath.toLowerCase().endsWith(`.jar${DISABLED_MOD_SUFFIX}`))) {
      return {
        success: false,
        error: 'Die Mod-Datei konnte nicht sicher entfernt werden.'
      };
    }
    if (isRequiredModFileName(path.basename(getEnabledModPath(filePath, modContext)))) {
      return {
        success: false,
        error: 'Diese Pflichtmod ist erforderlich und kann nicht entfernt werden.'
      };
    }

    const enabledPath = getEnabledModPath(filePath, modContext);
    const disabledPath = getDisabledModPath(filePath, modContext);
    for (const candidatePath of uniqueStrings([filePath, enabledPath, disabledPath])) {
      if (candidatePath && isModStoragePath(modContext, candidatePath) && fs.existsSync(candidatePath)) {
        fs.unlinkSync(candidatePath);
      }
    }
    clearDisabledFileReason(modContext, path.basename(filePath));
    clearDisabledFileReason(modContext, path.basename(enabledPath));
    clearDisabledFileReason(modContext, path.basename(disabledPath));

    return {
      success: true,
      message: `${path.basename(filePath)} wurde entfernt.`,
      mods: await getInstalledMods()
    };
  }

  return {
    success: false,
    error: 'Unbekannter Mod-Typ.'
  };
}

async function getInstalledMods(versionId = getEffectiveSelectedVersionId(), options = {}) {
  const modContext = getActiveModContext(versionId);
  if (!options.skipManagedSync) {
    await syncManagedModsForVersion(versionId, { modContext });
  }
  quarantineLegacyDisabledMods(modContext);

  if (!fs.existsSync(modContext.modsDir)) {
    ensureDir(modContext.modsDir);
  }
  ensureDir(modContext.resourcepacksDir || RESOURCEPACKS_DIR);
  ensureDir(modContext.shaderpacksDir || SHADERPACKS_DIR);
  cleanupProfileDuplicateFiles(modContext);
  cleanupUntrackedResourcePackFiles(modContext);

  const minecraftVersion = getCurrentMinecraftVersion(versionId);
  const state = readModsState(modContext);
  const managedProjectFileNames = getManagedProjectFileNames(state);
  const managedFilesByPath = new Map(
    (state.activeSync?.files || []).map((entry) => [path.resolve(entry.targetPath), entry])
  );
  const mods = [];

  for (const file of fs.readdirSync(modContext.modsDir)
    .filter((entry) => entry.toLowerCase().endsWith('.jar'))) {
      const fullPath = path.join(modContext.modsDir, file);
      const stats = fs.statSync(fullPath);
      const managedEntry = managedFilesByPath.get(path.resolve(fullPath));
      const enabled = true;
      if (managedEntry) {
        const project = state.projects?.[managedEntry.projectId];
        const hiddenInModsTab = isManagedProjectHiddenInModsTab(managedEntry.projectId, project);

        const versionEntry = project?.versions?.[minecraftVersion];
        mods.push({
          id: `project:${managedEntry.projectId}`,
          projectId: managedEntry.projectId,
          slug: project?.slug || '',
          name: project?.title || file.replace(/\.jar$/i, ''),
          description: project?.description || '',
          iconUrl: project?.iconUrl || '',
          isProtected: isManagedProjectRemoveLocked(managedEntry.projectId, project) || isRequiredModFileName(file),
          canDisable: !isManagedProjectDisableLocked(managedEntry.projectId, project) && !isRequiredModFileDisableLocked(file),
          path: fullPath,
          size: stats.size,
          enabled,
          autoDisabled: false,
          disabledReason: '',
          managed: true,
          source: 'modrinth',
          sourceLabel: hiddenInModsTab ? 'Pflichtmod' : '',
          hiddenInModsTab,
          fileName: file,
          minecraftVersion,
          versionName: versionEntry?.versionName || '',
          versionNumber: versionEntry?.versionNumber || '',
          lastUpdated: stats.mtime.toISOString()
        });
        continue;
      }

      const hiddenInModsTab = isRequiredModFileHiddenInModsTab(file);

      mods.push({
        id: `file:${fullPath}`,
        projectId: '',
        slug: '',
        name: file.replace(/\.jar(?:\.disabled)?$/i, ''),
        description: '',
        iconUrl: '',
        isProtected: isRequiredModFileName(file.replace(new RegExp(`${DISABLED_MOD_SUFFIX}$`, 'i'), '')),
        canDisable: !isRequiredModFileDisableLocked(file.replace(new RegExp(`${DISABLED_MOD_SUFFIX}$`, 'i'), '')),
        path: fullPath,
        size: stats.size,
        enabled,
        autoDisabled: false,
        disabledReason: '',
        managed: false,
        source: 'manual',
        sourceLabel: hiddenInModsTab ? 'Pflichtmod' : '',
        hiddenInModsTab,
        fileName: file,
        minecraftVersion,
        versionName: '',
        versionNumber: '',
        lastUpdated: stats.mtime.toISOString()
      });
  }

  const disabledModsDir = getDisabledModsDir(modContext);
  for (const file of fs.existsSync(disabledModsDir) ? fs.readdirSync(disabledModsDir).filter((entry) => entry.toLowerCase().endsWith('.jar')) : []) {
    if (managedProjectFileNames.has(file.toLowerCase())) {
      continue;
    }
    const hiddenInModsTab = isRequiredModFileHiddenInModsTab(file);

    const fullPath = path.join(disabledModsDir, file);
    const stats = fs.statSync(fullPath);
    const disabledReason = formatStoredDisableReason(
      state.disabledFileReasons?.[getDisabledFileReasonKey(file)],
      'Ausgeschaltet.'
    );
    mods.push({
      id: `file:${fullPath}`,
      projectId: '',
      slug: '',
      name: file.replace(/\.jar$/i, ''),
      description: '',
      iconUrl: '',
      isProtected: isRequiredModFileName(file),
      canDisable: !isRequiredModFileDisableLocked(file),
      path: fullPath,
      size: stats.size,
      enabled: false,
      autoDisabled: false,
      disabledReason,
      managed: false,
      source: 'manual',
      sourceLabel: hiddenInModsTab ? 'Pflichtmod' : '',
      hiddenInModsTab,
      fileName: file,
      minecraftVersion,
      versionName: '',
      versionNumber: '',
      lastUpdated: stats.mtime.toISOString()
    });
  }

  const manuallyDisabledProjectIds = new Set(state.disabledProjects || []);
  const autoDisabledProjectIds = new Set(state.autoDisabledProjects || []);
  const disabledProjectIds = uniqueStrings([
    ...manuallyDisabledProjectIds,
    ...autoDisabledProjectIds
  ]).filter((projectId) => (
    !isManagedProjectHiddenForMinecraftVersion(projectId, minecraftVersion)
  ));

  for (const projectId of disabledProjectIds) {
    if (mods.some((entry) => entry.projectId === projectId)) {
      continue;
    }
    const project = state.projects?.[projectId];
    const versionEntry = project?.versions?.[minecraftVersion] || {};
    const libraryPath = String(versionEntry.libraryPath || '').trim();
    const stats = libraryPath && fs.existsSync(libraryPath) ? fs.statSync(libraryPath) : null;
    const autoDisabled = autoDisabledProjectIds.has(projectId) && !manuallyDisabledProjectIds.has(projectId);
    const storedDisabledReason = formatStoredDisableReason(state.disabledProjectReasons?.[projectId]);
    const hiddenInModsTab = isManagedProjectHiddenInModsTab(projectId, project);
    mods.push({
      id: `project:${projectId}`,
      projectId,
      slug: project?.slug || '',
      name: project?.title || projectId,
      description: project?.description || '',
      iconUrl: project?.iconUrl || '',
      isProtected: isManagedProjectRemoveLocked(projectId, project) || isRequiredModFileName(versionEntry.fileName),
      canDisable: !isManagedProjectDisableLocked(projectId, project) && !isRequiredModFileDisableLocked(versionEntry.fileName),
      path: path.join(modContext.modsDir, versionEntry.fileName || `${projectId}.jar`),
      size: stats?.size || 0,
      enabled: false,
      autoDisabled,
      disabledReason: storedDisabledReason || (autoDisabled
        ? `Keine passende Version für Minecraft ${minecraftVersion} gefunden.`
        : ''),
      managed: true,
      source: 'modrinth',
      sourceLabel: hiddenInModsTab ? 'Pflichtmod' : '',
      hiddenInModsTab,
      fileName: versionEntry.fileName || '',
      minecraftVersion,
      versionName: versionEntry.versionName || '',
      versionNumber: versionEntry.versionNumber || '',
      lastUpdated: (stats?.mtime || new Date()).toISOString()
    });
  }

  mods.push(...await getInstalledDownloadableModrinthEntries(modContext));

  return mods.sort((left, right) => {
    const typeOrder = { mod: 0, resourcepack: 1, shader: 2 };
    const leftType = left.itemType || 'mod';
    const rightType = right.itemType || 'mod';
    const typeDiff = (typeOrder[leftType] ?? 9) - (typeOrder[rightType] ?? 9);
    if (typeDiff !== 0) {
      return typeDiff;
    }
    if (left.enabled !== right.enabled) {
      return left.enabled ? -1 : 1;
    }
    if (left.managed !== right.managed) {
      return left.managed ? -1 : 1;
    }
    return left.name.localeCompare(right.name, 'de', { sensitivity: 'base' });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
