'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const partsDir = path.join(__dirname, '..', 'scripts', 'build-x-launcher-menu-mod.parts');
const source = fs.readdirSync(partsDir)
  .filter((name) => name.endsWith('.jsfrag'))
  .sort()
  .map((name) => fs.readFileSync(path.join(partsDir, name), 'utf8'))
  .join('');

test('HUD and UI modules do not expose unnecessary keybinds', () => {
  const hudModules = [
    'sounddisplay', 'fps', 'fakefps', 'coords', 'nethercoords', 'keys',
    'cps', 'armor', 'crosshair', 'clock', 'uptimer', 'ui'
  ];

  for (const id of hudModules) {
    assert.match(source, new RegExp(`new Module\\("${id}",[\\s\\S]*?, (?:true|false), false\\)`));
  }
  assert.match(source, /new Module\("zoom",[\s\S]*?, true, true\)/);
  assert.match(source, /new Module\("freecam",[\s\S]*?, true, true\)/);
});

test('armor durability bars render below items with three static configurable colors', () => {
  assert.match(source, /drawArmorDurabilityBar\(graphics, slotX \+ 3, slotY \+ slot \+ 1, slot - 6, stack\)/);
  assert.match(source, /static int armorHealthyColor\(\)[\s\S]*?XClientColorModes\.staticColor\("overlay\.armor\.health\.healthy", 0x45D36B\)/);
  assert.match(source, /static int armorWarningColor\(\)[\s\S]*?XClientColorModes\.staticColor\("overlay\.armor\.health\.warning", 0xEAC54F\)/);
  assert.match(source, /static int armorCriticalColor\(\)[\s\S]*?XClientColorModes\.staticColor\("overlay\.armor\.health\.critical", 0xEA4F4F\)/);
  assert.match(source, /drawArmorEditor\(graphics, font, panelX, panelY, panelW\)/);
  assert.doesNotMatch(source, /ratio < 0\.0F \|\| ratio >= 0\.9999F/);
  assert.match(source, /ratio > 0\.20F \? OverlaySettings\.armorWarningColor\(\) : OverlaySettings\.armorCriticalColor\(\)/);
  assert.match(source, /LauncherTheme\.rawArgb\(90, color\)/);
});

test('UI editor uses the live HUD visuals and shows randomized diamond armor', () => {
  assert.match(source, /HudOverlay\.drawEditorPreview\(graphics, font, id, text, bounds\[0\], bounds\[1\]\)/);
  assert.match(source, /public static void drawEditorPreview\(Object graphics, Object font, String id, String sampleText, int x, int y\)/);
  assert.match(source, /"DIAMOND_HELMET", "DIAMOND_CHESTPLATE", "DIAMOND_LEGGINGS", "DIAMOND_BOOTS"/);
  assert.match(source, /EDITOR_ARMOR_PREVIEW_PERCENT/);
  assert.match(source, /drawItemStack\(graphics, armor\[index\], slotX \+ Math\.max\(1, \(slot - icon\) \/ 2\), slotY \+ 2, icon\)/);
  assert.match(source, /drawArmorDurabilityBar\(graphics, slotX \+ 3, slotY \+ slot \+ 1, slot - 6, armor\[index\]\)/);
});

test('a clicked UI editor overlay remains visibly selected until deselected', () => {
  assert.match(source, /selectedOverlay = hit;\s*draggingOverlay = hit;/);
  assert.match(source, /id\.equals\(selectedOverlay\) \|\| id\.equals\(draggingOverlay\)/);
  assert.match(source, /selectedOverlay = null;\s*resizingOverlay = false;/);
});

test('armor status color picker disables the rainbow control', () => {
  assert.match(source, /new XClientColorPickerScreen\(this, target, label, initialColor, false\)/);
  assert.match(source, /if\(allowRainbow\)\{int ry=/);
  assert.match(source, /if\(allowRainbow&&inside/);
  assert.match(source, /if\(!allowRainbow\)XClientColorModes\.setRainbow\(target,false\)/);
  assert.match(source, /super\(Component\.literal\(""\)\)/);
});
