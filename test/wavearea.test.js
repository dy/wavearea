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

  test('clicking waveform does not throw and positions caret', async ({ page }) => {
    await loadFile(page);

    // listen for errors
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    let editarea = page.locator('#editarea');
    let box = await editarea.boundingBox();

    // click in the middle of the waveform text (within first line height)
    await editarea.click({ position: { x: box.width / 2, y: Math.min(30, box.height / 2) } });
    await page.waitForTimeout(300);

    expect(errors).toEqual([]);

    // verify selection exists inside editarea
    let hasSelection = await page.evaluate(() => {
      let s = window.getSelection();
      let ea = document.querySelector('#editarea');
      return s.rangeCount > 0 && ea.contains(s.anchorNode);
    });
    expect(hasSelection).toBe(true);
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
