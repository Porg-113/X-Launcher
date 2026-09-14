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

test('Weather and Time modules and their client-world overrides are absent', () => {
  assert.doesNotMatch(source, /new Module\("weather"/);
  assert.doesNotMatch(source, /new Module\("time"/);
  assert.doesNotMatch(source, /setWeatherMode\s*\(/);
  assert.doesNotMatch(source, /setTimeTicks\s*\(/);
  assert.doesNotMatch(source, /updateClientWorldOverrides\s*\(/);
});

test('fullbright maintains local invisible night vision', () => {
  assert.match(source, /forceOptionNumber\(client\.field_1690, FULLBRIGHT_GAMMA/);
  assert.match(source, /applyNightVisionEffect\(client\);/);
  assert.match(source, /createNightVisionInstance\(nightVision\)/);
  assert.match(source, /Boolean\.FALSE, Boolean\.FALSE, Boolean\.FALSE\);/);
  assert.match(source, /!effectBoolean\(current, "method_5592", "showIcon"\)/);
  assert.match(source, /current\.getAmplifier\(\) >= NIGHT_VISION_EFFECT_AMPLIFIER && !current\.showIcon\(\)/);
});

test('the UI editor moves the existing vanilla effect-icon element without a duplicate overlay', () => {
  assert.match(source, /replaceVanillaStatusEffects\(identifierClass, hudElementClass, registryClass\);/);
  assert.match(source, /new String\[\] \{ "MOB_EFFECTS", "STATUS_EFFECTS", "POTION_ICONS" \}/);
  assert.match(source, /renderVanillaEffectIcons\(oldElement, method, args\);/);
  assert.match(source, /invokeHudElement\(oldElement, callbackMethod, args\);/);
  assert.match(source, /OverlaySettings\.x\("effects"\)/);
  assert.match(source, /OverlaySettings\.y\("effects"\)/);
  assert.match(source, /if \("effects"\.equals\(id\)\) \{\s*return new int\[\] \{ x, y, 49, 24 \};/);
  assert.match(source, /drawEditorEffectIcon\(graphics, x, y, 0xFF58C86E\);/);
  assert.match(source, /drawEditorEffectIcon\(graphics, x \+ 25, y, 0xFF4A8DFF\);/);
  assert.doesNotMatch(source, /drawEffectStatus\s*\(/);
});
