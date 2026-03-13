import { test, expect } from '@playwright/test';
import path from 'path';

const FIXTURE = path.resolve('test/fixtures/sine-3s.mp3');

// helper: load a file into wavearea via file input
async function loadFile(page, filePath = FIXTURE) {
  // trigger file input directly (hidden input, label clicks it)
  const fileInput = page.locator('input#file');
  await fileInput.waitFor({ state: 'attached', timeout: 5000 });
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    fileInput.dispatchEvent('click')
  ]);
  await fileChooser.setFiles(filePath);
  // wait for waveform to render
  await page.waitForFunction(() => {
    let el = document.querySelector('#editarea');
    return el && el.textContent.length > 10;
  }, { timeout: 15000 });
}


test.describe('wavearea', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // wait for sprae to initialize
    await page.waitForFunction(() => document.querySelector('#wavearea main, #wavearea nav, #opener nav, input#file'), { timeout: 5000 });
  });

  test('renders empty state with file input', async ({ page }) => {
    // file input should exist (opener is rendered)
    await expect(page.locator('input#file')).toBeAttached();
    // waveform should not be visible
    let editarea = page.locator('#editarea');
    await expect(editarea).not.toBeVisible();
  });

  test('loads file and renders waveform', async ({ page }) => {
    await loadFile(page);
    let text = await page.locator('#editarea').textContent();
    expect(text.length).toBeGreaterThan(10);
    // play button should be visible
    await expect(page.locator('#play')).toBeVisible();
  });

  test('clicking waveform moves caret to clicked position', async ({ page }) => {
    await loadFile(page);

    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    let editarea = page.locator('#editarea');
    let box = await editarea.boundingBox();

    // click near start
    await page.mouse.click(box.x + 10, box.y + 15);
    await page.waitForTimeout(200);

    let startOffset = await page.evaluate(() => {
      let s = window.getSelection(), r = s.rangeCount ? s.getRangeAt(0) : null;
      return r?.startOffset ?? -1;
    });

    // click in the middle
    await page.mouse.click(box.x + box.width / 2, box.y + 15);
    await page.waitForTimeout(200);

    let midOffset = await page.evaluate(() => {
      let s = window.getSelection(), r = s.rangeCount ? s.getRangeAt(0) : null;
      return r?.startOffset ?? -1;
    });

    expect(errors).toEqual([]);
    expect(midOffset).toBeGreaterThan(startOffset);

    // verify selection is in text node inside editarea
    let inEditarea = await page.evaluate(() => {
      let s = window.getSelection();
      let ea = document.querySelector('#editarea');
      return s.rangeCount > 0 && ea.contains(s.anchorNode) && s.anchorNode.nodeType === 3;
    });
    expect(inEditarea).toBe(true);
  });

  test('clicking near start of waveform does not throw', async ({ page }) => {
    await loadFile(page);

    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    let editarea = page.locator('#editarea');
    await editarea.click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);

    expect(errors).toEqual([]);
  });

  test('space toggles playback on and off without errors', async ({ page }) => {
    await loadFile(page);

    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    // focus editarea
    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(100);

    // initially not playing
    await expect(page.locator('#editarea.playing')).toHaveCount(0);

    // press space to start playback
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    await expect(page.locator('#editarea.playing')).toHaveCount(1);
    expect(errors).toEqual([]);

    // press space again to stop playback
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    await expect(page.locator('#editarea.playing')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('play button starts and stops playback without errors', async ({ page }) => {
    await loadFile(page);

    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    let playBtn = page.locator('#play');

    // initially not playing
    await expect(page.locator('#editarea.playing')).toHaveCount(0);

    // click play button
    await playBtn.click();
    await page.waitForTimeout(300);

    await expect(page.locator('#editarea.playing')).toHaveCount(1);
    expect(errors).toEqual([]);

    // click again to pause
    await playBtn.click();
    await page.waitForTimeout(300);

    await expect(page.locator('#editarea.playing')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('play button follows caret line', async ({ page }) => {
    // narrow viewport to force waveform to wrap to multiple lines
    await page.setViewportSize({ width: 400, height: 720 });
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('input#file'), { timeout: 5000 });
    await loadFile(page);

    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    let editarea = page.locator('#editarea');
    let box = await editarea.boundingBox();
    let lineH = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#editarea')).lineHeight));

    // need multiple lines for this test
    if (box.height < lineH * 2) {
      test.skip();
      return;
    }

    // click on first line
    await page.mouse.click(box.x + 10, box.y + lineH * 0.5);
    await page.waitForTimeout(300);

    let playPos1 = await page.locator('#play').boundingBox();

    // click on second line
    await page.mouse.click(box.x + 10, box.y + lineH * 1.5);
    await page.waitForTimeout(300);

    let playPos2 = await page.locator('#play').boundingBox();

    expect(errors).toEqual([]);
    // play button should have moved down approximately one line height
    expect(playPos2.y).toBeGreaterThan(playPos1.y);
  });

  test('play button shows only play icon when stopped, only pause icon when playing', async ({ page }) => {
    await loadFile(page);

    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    // initially: play icon visible, pause icon not in DOM
    let playSvgs = await page.locator('#play svg').count();
    expect(playSvgs).toBe(1);
    let playPath = await page.locator('#play svg path:last-child').getAttribute('d');
    expect(playPath).toContain('5v14l11'); // play triangle

    // start playback
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // now: pause icon visible, play icon not in DOM
    playSvgs = await page.locator('#play svg').count();
    expect(playSvgs).toBe(1);
    let pausePath = await page.locator('#play svg path:last-child').getAttribute('d');
    expect(pausePath).toContain('6 19h4V5'); // pause bars

    // stop playback
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // back to play icon
    playSvgs = await page.locator('#play svg').count();
    expect(playSvgs).toBe(1);
    playPath = await page.locator('#play svg path:last-child').getAttribute('d');
    expect(playPath).toContain('5v14l11');

    expect(errors).toEqual([]);
  });

  test('playback overlay aligns with caret position', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 720 });
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('input#file'), { timeout: 5000 });
    await loadFile(page);

    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    let editarea = page.locator('#editarea');
    let box = await editarea.boundingBox();
    let lineH = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#editarea')).lineHeight));

    if (box.height < lineH * 2) {
      test.skip();
      return;
    }

    // click middle of second line
    await page.mouse.click(box.x + box.width / 2, box.y + lineH * 1.5);
    await page.waitForTimeout(300);

    // start playback
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // verify overlay CSS vars match caret position
    let overlay = await page.evaluate(() => {
      let ea = document.querySelector('#editarea');
      let container = document.querySelector('.container');
      let cs = getComputedStyle(container);
      let caretY = parseFloat(cs.getPropertyValue('--carety'));
      let caretX = parseFloat(cs.getPropertyValue('--caretx'));
      let eaRect = ea.getBoundingClientRect();
      return { caretY, caretX, eaHeight: eaRect.height, lineH: parseFloat(getComputedStyle(ea).lineHeight) };
    });

    // caretY should be approximately at second line (1 * lineH)
    expect(overlay.caretY).toBeGreaterThan(overlay.lineH * 0.5);
    expect(overlay.caretY).toBeLessThan(overlay.lineH * 2.5);

    // caretX should be within editarea width (not offset by unrelated margin)
    expect(overlay.caretX).toBeGreaterThan(0);

    // stop playback
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    expect(errors).toEqual([]);
  });

  test('timecodes render after loading', async ({ page }) => {
    await loadFile(page);

    let timecodes = page.locator('#timecodes a');
    let count = await timecodes.count();
    expect(count).toBeGreaterThan(0);

    // first timecode should be 0:00
    let first = await timecodes.first().textContent();
    expect(first).toBe('0:00');
  });

});
