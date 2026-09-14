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

test('weather and time are local visual overrides with a full-day time slider', () => {
  assert.match(source, /static final int MIN_TIME_TICKS = 0;/);
  assert.match(source, /static final int MAX_TIME_TICKS = 23999;/);
  assert.match(source, /static void setTimeTicks\(int value\)[\s\S]*?timeTicks = clampTimeTicks\(value\);/);
  assert.match(source, /double ratio = Math\.max\(0\.0D, Math\.min\(1\.0D, \(mouseX - trackX\) \/ \(double\) trackW\)\);/);
  assert.match(source, /MenuModules\.setTimeTicks\(MenuModules\.MIN_TIME_TICKS \+ \(int\) Math\.round\(ratio \* range\)\);/);
  assert.match(source, /invokeWorldNumber\(level, Long\.valueOf\(MenuModules\.timeTicks\(\)\), "setTimeFromServer"/);
  assert.match(source, /invokeWorldNumber\(level, Float\.valueOf\(rain\), "setRainLevel"/);
  assert.match(source, /invokeWorldNumber\(level, Float\.valueOf\(thunder\), "setThunderLevel"/);
  assert.match(source, /drawButton\(graphics, font, startX, y \+ 22, buttonW, 16, "Clear"/);
  assert.match(source, /"Rain", selected == 1/);
  assert.match(source, /"Thunder", selected == 2/);
});

test('fullbright maintains local invisible night vision', () => {
  assert.match(source, /forceOptionNumber\(client\.field_1690, FULLBRIGHT_GAMMA/);
  assert.match(source, /applyNightVisionEffect\(client\);/);
  assert.match(source, /createNightVisionInstance\(nightVision\)/);
  assert.match(source, /Boolean\.FALSE, Boolean\.FALSE, Boolean\.FALSE\);/);
  assert.match(source, /!effectBoolean\(current, "method_5592", "showIcon"\)/);
});

test('the UI editor moves the existing vanilla effect-icon element without a duplicate overlay', () => {
  assert.match(source, /replaceVanillaStatusEffects\(identifierClass, hudElementClass, registryClass\);/);
  assert.match(source, /renderVanillaEffectIcons\(oldElement, method, args\);/);
  assert.match(source, /invokeHudElement\(oldElement, callbackMethod, args\);/);
  assert.match(source, /OverlaySettings\.x\("effects"\)/);
  assert.match(source, /OverlaySettings\.y\("effects"\)/);
  assert.match(source, /if \("effects"\.equals\(id\)\) \{\s*return new int\[\] \{ x, y, 49, 24 \};/);
  assert.doesNotMatch(source, /drawEffectStatus\s*\(/);
});
