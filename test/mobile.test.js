// iOS-Safari-shaped smoke (webkit + iPhone viewport + touch) — layout fit,
// touch caret, transport, playback. Physical-device quirks still need a real pass.
import { test, expect } from '@playwright/test';

let errors;

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.wa, { timeout: 5000 });
  // silence doc avoids fixture upload + fake-mic (unavailable on webkit)
  await page.evaluate(() => wa.openSilence(3));
  await page.waitForFunction(() => wa.total > 100 && !document.querySelector('#status'), { timeout: 20000 });
});

test('fits the viewport: no horizontal overflow, chrome bars visible', async ({ page }) => {
  let { scrollW, innerW } = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
  }));
  expect(scrollW).toBeLessThanOrEqual(innerW + 1);

  // top toolbar and bottom transport bar are on screen
  let toolbar = await page.locator('#toolbar').boundingBox();
  let minimap = await page.locator('#minimap').boundingBox();
  let vp = page.viewportSize();
  expect(toolbar).not.toBeNull();
  expect(toolbar.x).toBeGreaterThanOrEqual(0);
  expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(vp.width + 1);
  expect(minimap.y + minimap.height).toBeLessThanOrEqual(vp.height + 1);

  // content starts below the toolbar band — buttons don't swallow line-1 taps
  let wave = await page.locator('#editarea').boundingBox();
  expect(wave.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height - 1);
  expect(errors).toEqual([]);
});

test('tap moves the caret; tapped timecode jumps', async ({ page }) => {
  let box = await page.locator('#editarea').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + 10);
  await page.waitForTimeout(300);
  let caret = await page.evaluate(() => wa.caretOffset);
  expect(caret).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('tap play toggles playback; transport shows time', async ({ page }) => {
  await page.locator('#play').dispatchEvent('click');
  await page.waitForFunction(() => wa.playing === true, { timeout: 5000 });
  await expect(page.locator('#editarea.playing')).toHaveCount(1);
  expect(await page.locator('#time').textContent()).toMatch(/^\d+:\d\d \/ \d+:\d\d$/);
  await page.locator('#play').dispatchEvent('click');
  await page.waitForFunction(() => wa.playing === false, { timeout: 5000 });
  expect(errors).toEqual([]);
});
