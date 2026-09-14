const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
function readSplitSource(relativePath) {
  const entryPath = path.join(projectRoot, relativePath);
  const entry = fs.readFileSync(entryPath, 'utf8');
  const names = JSON.parse(entry.match(/const sourceParts = (\[[^;]+\])/s)?.[1] || entry.match(/const parts = (\[[^;]+\])/s)?.[1] || '[]');
  const relativeDirectory = entry.match(/path\.join\(__dirname, '([^']+)'/)?.[1]
    || entry.match(/new URL\('([^']+\/)', document\.currentScript\.src\)/)?.[1];
  if (!names.length || !relativeDirectory) return entry;
  return names.map((name) => fs.readFileSync(path.join(path.dirname(entryPath), relativeDirectory, name), 'utf8')).join('');
}
const rendererSource = readSplitSource('app.js');
const mainSource = readSplitSource(path.join('src', 'main.js'));
const stylesSource = fs.readFileSync(path.join(projectRoot, 'styles.css'), 'utf8');
const modBuilderSource = readSplitSource(path.join('scripts', 'build-x-launcher-menu-mod.js'));

test('bundled X Client version matches the version deployed by the launcher', () => {
  const builderVersion = modBuilderSource.match(/const MOD_VERSION = '([^']+)'/)?.[1];
  const launcherVersion = mainSource.match(/const X_CLIENT_MOD_VERSION = '([^']+)'/)?.[1];
  assert.ok(builderVersion, 'builder MOD_VERSION is missing');
  assert.ok(launcherVersion, 'launcher X_CLIENT_MOD_VERSION is missing');
  assert.equal(launcherVersion, builderVersion);
});

test('startup keeps secondary sections lazy', () => {
  assert.match(rendererSource, /this\.loadedSections = new Set\(\['dashboard', 'packs', 'servers'\]\)/);
  assert.match(rendererSource, /ensureSectionDataLoaded\(sectionId\)/);
  assert.doesNotMatch(rendererSource, /await this\.preloadStartupContentIcons\(\)/);
});

test('Xray render path avoids per-frame world lookups and temporary boxes', () => {
  const pipeline = modBuilderSource.slice(
    modBuilderSource.indexOf("'dev/xlauncher/client/EspRenderPipeline26.java'"),
    modBuilderSource.indexOf('const fabricApiStub')
  );
  const draw = pipeline.slice(pipeline.indexOf('private static void draw('), pipeline.indexOf('private static void execute('));
  assert.doesNotMatch(draw, /getChunkSource\(\)|getBlockState\(|\.inflate\(/);
  assert.match(pipeline, /PLAYER_REFRESH_MS = 100L/);
  assert.doesNotMatch(pipeline, /RESCAN_DELAY_MS/);
  assert.doesNotMatch(pipeline, /now - scanCompletedAt >=/);
});

test('in-game menu reads a customizable dark glass palette without frame-rate I/O', () => {
  const theme = modBuilderSource.slice(
    modBuilderSource.indexOf("'dev/xlauncher/client/LauncherTheme.java'"),
    modBuilderSource.indexOf("'dev/xlauncher/client/MenuModules.java'")
  );
  assert.match(theme, /return accent/);
  assert.match(theme, /return panel/);
  assert.match(theme, /HIGHLIGHT_COLOR_PATTERN/);
  assert.match(theme, /PANEL_COLOR_PATTERN/);
  assert.match(theme, /BUTTON_COLOR_PATTERN/);
  assert.match(theme, /BORDER_COLOR_PATTERN/);
  assert.match(theme, /HOVER_COLOR_PATTERN/);
  assert.match(theme, /CHECK_INTERVAL_MS = 1000L/);
});

test('26.2 compatibility watcher never touches client state off-thread', () => {
  const watcher = modBuilderSource.slice(
    modBuilderSource.indexOf('private static void watchKeybind()'),
    modBuilderSource.indexOf('private static void toggleMenu(class_310 client)')
  );
  assert.match(watcher, /watcherTickQueued\.compareAndSet\(false, true\)/);
  assert.match(watcher, /execute\(\(\) -> runWatcherTick\(client\)\)/);
  assert.match(watcher, /finally \{\s*watcherTickQueued\.set\(false\)/);
  assert.doesNotMatch(watcher.slice(0, watcher.indexOf('private static void runWatcherTick')), /updateClicks\(client\)|updateZoom\(client\)|GameTimer\.tick\(client\)/);
});

test('render distance slider is capped at exactly 43 chunks', () => {
  assert.match(modBuilderSource, /class XLauncherRenderDistanceMixin/);
  assert.match(modBuilderSource, /stringValue=options\.renderDistance/);
  assert.match(modBuilderSource, /return 43;/);
});

test('client tick stages do not allocate callback lambdas every tick', () => {
  const officialStart = modBuilderSource.indexOf('const officialSources');
  const officialClient = modBuilderSource.slice(
    modBuilderSource.indexOf("'dev/xlauncher/client/XLauncherMenuClient.java'", officialStart),
    modBuilderSource.indexOf("'dev/xlauncher/client/XClientTutorialScreen.java'", officialStart)
  );
  const tick = officialClient.slice(officialClient.indexOf('public static void clientTick('), officialClient.indexOf('private static void updateMenuKey('));
  assert.doesNotMatch(tick, /runClientStage\([^\n]*->/);
  assert.match(officialClient, /switch \(operation\)/);
});

test('social presence avoids aggressive reflection polling', () => {
  assert.match(modBuilderSource, /scanOnlinePlayers\(\);[\s\S]{0,220}Thread\.sleep\(5000L\)/);
  assert.doesNotMatch(modBuilderSource, /scanOnlinePlayers\(\);\s*Thread\.sleep\(1500L\)/);
});

test('tick and render module checks use an allocation-free ID index', () => {
  const menuModules = modBuilderSource.slice(
    modBuilderSource.indexOf("'dev/xlauncher/client/MenuModules.java'"),
    modBuilderSource.indexOf("'dev/xlauncher/client/OwnerAccess.java'")
  );
  assert.match(menuModules, /MODULES_BY_ID = indexModules\(\)/);
  assert.match(menuModules, /static boolean enabled\(String id\)/);
  assert.match(menuModules, /return MODULES_BY_ID\.get\(id\)/);
  assert.doesNotMatch(modBuilderSource, /private static boolean enabled\(String id\) \{\s*for \(MenuModules\.Module module : MenuModules\.modules\(\)\)/);
});

test('world overlays register exactly one supported render phase', () => {
  assert.doesNotMatch(modBuilderSource, /modern \|= registerRenderEvent/);
  const singleRegistrationFallback = /boolean modern = registerRenderEvent\([^\n]+"COLLECT_SUBMITS"\);\s*if \(!modern\) modern = registerRenderEvent\([^\n]+"BEFORE_GIZMOS"\);\s*if \(!modern\) modern = registerRenderEvent\([^\n]+"AFTER_SOLID_FEATURES"\);/g;
  assert.equal([...modBuilderSource.matchAll(singleRegistrationFallback)].length, 3);
});

test('fixed menu theme does not poll files at frame rate', () => {
  assert.match(modBuilderSource, /CHECK_INTERVAL_MS = 1000L/);
  const accent = modBuilderSource.slice(modBuilderSource.indexOf('public static int accent()'), modBuilderSource.indexOf('static int secondColor()'));
  assert.doesNotMatch(accent, /refresh\(\)/);
});

test('visible module arrays are cached until permissions change', () => {
  assert.match(modBuilderSource, /cachedPermissionMask == permissionMask/);
  assert.doesNotMatch(modBuilderSource, /return java\.util\.Arrays\.stream\(MODULES\)/);
});

test('runtime localization processes changed subtrees instead of always scanning body', () => {
  assert.match(rendererSource, /mutation\.addedNodes\.forEach\(\(node\) => this\.scheduleRuntimeLocalization\(node\)\)/);
  assert.match(rendererSource, /applyRuntimeLocalization\(root = document\.body\)/);
});

test('live theme state never uses synchronous disk writes', () => {
  const liveThemeWriter = mainSource.slice(
    mainSource.indexOf('async function writeLiveThemeState'),
    mainSource.indexOf('async function setLiveThemeColor')
  );
  assert.match(liveThemeWriter, /fs\.promises\.writeFile/);
  assert.doesNotMatch(liveThemeWriter, /writeFileSync/);
});

test('Minecraft runtime polling is visibility-aware and low frequency', () => {
  assert.match(rendererSource, /if \(!document\.hidden\) \{\s*refreshRuntimeStatus\(\);\s*\}\s*\}, 10000\)/);
});

test('scroll motion is initialized and remains animated in static UI mode', () => {
  assert.match(rendererSource, /this\.setupNavigation\(\);\s*this\.setupScrollFade\(\);/);
  assert.match(
    stylesSource,
    /@media \(prefers-reduced-motion: no-preference\)[\s\S]*?html\.launcher-static-ui \.scroll-fade-item\s*\{[\s\S]*?transition:\s*transform 520ms var\(--motion-ease\) !important;/
  );
});
