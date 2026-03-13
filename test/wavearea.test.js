import { test, expect } from '@playwright/test';
import path from 'path';

const FIXTURE = path.resolve('test/fixtures/sine-3s.mp3');
const BAD_FIXTURE = path.resolve('test/fixtures/bad.mp3');
const EMPTY_FIXTURE = path.resolve('test/fixtures/empty.mp3');

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

  test('drag to select text creates non-collapsed selection', async ({ page }) => {
    // widen chars via letter-spacing so Playwright can drag-select
    await page.evaluate(() => {
      document.querySelector('#wavearea').style.setProperty('--wavefont-spacing', '4px');
    });
    await loadFile(page);

    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    let editarea = page.locator('#editarea');
    let box = await editarea.boundingBox();

    // drag from ~20% to ~60% of the first line
    let y = box.y + 15;
    let startX = box.x + box.width * 0.2;
    let endX = box.x + box.width * 0.6;

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    let sel = await page.evaluate(() => {
      let s = window.getSelection();
      return {
        collapsed: s.isCollapsed,
        text: s.toString().length,
        inEditarea: s.rangeCount > 0 && document.querySelector('#editarea').contains(s.anchorNode)
      };
    });

    expect(errors).toEqual([]);
    expect(sel.collapsed).toBe(false);
    expect(sel.text).toBeGreaterThan(0);
    expect(sel.inEditarea).toBe(true);
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

  test('invalid file shows error in UI', async ({ page }) => {
    const fileInput = page.locator('input#file');
    await fileInput.waitFor({ state: 'attached', timeout: 5000 });
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      fileInput.dispatchEvent('click')
    ]);
    await fileChooser.setFiles(BAD_FIXTURE);

    // error should appear
    let error = page.locator('#error');
    await expect(error).toBeVisible({ timeout: 15000 });
    let text = await error.textContent();
    expect(text.length).toBeGreaterThan(0);

    // waveform should not be visible
    await expect(page.locator('#editarea')).not.toBeVisible();
  });

  test('empty file shows error in UI', async ({ page }) => {
    const fileInput = page.locator('input#file');
    await fileInput.waitFor({ state: 'attached', timeout: 5000 });
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      fileInput.dispatchEvent('click')
    ]);
    await fileChooser.setFiles(EMPTY_FIXTURE);

    // error should appear
    let error = page.locator('#error');
    await expect(error).toBeVisible({ timeout: 15000 });
  });

  test('error clears on successful load', async ({ page }) => {
    // first load bad file
    let fileInput = page.locator('input#file');
    await fileInput.waitFor({ state: 'attached', timeout: 5000 });
    let [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      fileInput.dispatchEvent('click')
    ]);
    await fileChooser.setFiles(BAD_FIXTURE);
    await expect(page.locator('#error')).toBeVisible({ timeout: 15000 });

    // now load valid file
    [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      fileInput.dispatchEvent('click')
    ]);
    await fileChooser.setFiles(FIXTURE);
    await page.waitForFunction(() => {
      let el = document.querySelector('#editarea');
      return el && el.textContent.length > 10;
    }, { timeout: 15000 });

    // error should be gone, waveform visible
    await expect(page.locator('#error')).not.toBeVisible();
    await expect(page.locator('#editarea')).toBeVisible();
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


// Web Audio spy — inject before page load to capture all AudioContext calls
const WEB_AUDIO_SPY = () => {
  window.__audioSpy = { calls: [], nodes: [], ctx: null };

  const OrigAudioContext = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = function(...args) {
    let ctx = new OrigAudioContext(...args);
    window.__audioSpy.ctx = ctx;
    window.__audioSpy.calls.push({ method: 'new AudioContext', args: args[0] || {} });

    // spy on createBufferSource
    let origCreateBufferSource = ctx.createBufferSource.bind(ctx);
    ctx.createBufferSource = function() {
      let source = origCreateBufferSource();
      let node = { type: 'BufferSource', started: false, stopped: false, loop: false, playbackRate: 1, buffer: null };
      window.__audioSpy.nodes.push(node);

      let origStart = source.start.bind(source);
      source.start = function(...a) {
        node.started = true;
        node.startArgs = a;
        window.__audioSpy.calls.push({ method: 'source.start', args: a });
        return origStart(...a);
      };

      let origStop = source.stop.bind(source);
      source.stop = function(...a) {
        node.stopped = true;
        window.__audioSpy.calls.push({ method: 'source.stop', args: a });
        return origStop(...a);
      };

      // track property changes
      let origBuffer = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(source), 'buffer');
      Object.defineProperty(source, 'buffer', {
        get() { return origBuffer.get.call(this); },
        set(v) {
          node.buffer = { channels: v?.numberOfChannels, length: v?.length, sampleRate: v?.sampleRate };
          window.__audioSpy.calls.push({ method: 'source.buffer=', buffer: node.buffer });
          origBuffer.set.call(this, v);
        }
      });

      let origLoop = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(source), 'loop');
      Object.defineProperty(source, 'loop', {
        get() { return origLoop.get.call(this); },
        set(v) {
          node.loop = v;
          window.__audioSpy.calls.push({ method: 'source.loop=', value: v });
          origLoop.set.call(this, v);
        }
      });

      return source;
    };

    // spy on createGain
    let origCreateGain = ctx.createGain.bind(ctx);
    ctx.createGain = function() {
      let gain = origCreateGain();
      window.__audioSpy.calls.push({ method: 'createGain' });
      return gain;
    };

    // spy on createBuffer
    let origCreateBuffer = ctx.createBuffer.bind(ctx);
    ctx.createBuffer = function(...a) {
      window.__audioSpy.calls.push({ method: 'createBuffer', args: a });
      return origCreateBuffer(...a);
    };

    return ctx;
  };
  if (window.webkitAudioContext) window.webkitAudioContext = window.AudioContext;
};


test.describe('bufferPlayer backend', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(WEB_AUDIO_SPY);
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('input#file'), { timeout: 5000 });
    await loadFile(page);
  });

  test('play creates AudioContext, GainNode, and starts source', async ({ page }) => {
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    let spy = await page.evaluate(() => window.__audioSpy);

    expect(errors).toEqual([]);
    expect(spy.calls.some(c => c.method === 'new AudioContext')).toBe(true);
    expect(spy.calls.some(c => c.method === 'createGain')).toBe(true);
    expect(spy.calls.some(c => c.method === 'source.start')).toBe(true);

    let bufferCall = spy.calls.find(c => c.method === 'source.buffer=');
    expect(bufferCall).toBeTruthy();
    expect(bufferCall.buffer.length).toBeGreaterThan(0);
    expect(bufferCall.buffer.sampleRate).toBeGreaterThan(0);
  });

  test('pause stops the source node', async ({ page }) => {
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    let spy = await page.evaluate(() => window.__audioSpy);

    expect(errors).toEqual([]);
    expect(spy.calls.some(c => c.method === 'source.stop')).toBe(true);
    expect(spy.nodes[0]?.started).toBe(true);
    expect(spy.nodes[0]?.stopped).toBe(true);
  });

  test('buffer duration matches fixture (~3s)', async ({ page }) => {
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    let spy = await page.evaluate(() => window.__audioSpy);
    let bufferCall = spy.calls.find(c => c.method === 'source.buffer=');

    expect(errors).toEqual([]);
    let durationSec = bufferCall.buffer.length / bufferCall.buffer.sampleRate;
    expect(durationSec).toBeGreaterThan(2);
    expect(durationSec).toBeLessThan(5);
  });

  test('caret advances during playback', async ({ page }) => {
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(100);

    let startOffset = await page.evaluate(() => {
      let s = window.getSelection();
      return s.rangeCount ? s.getRangeAt(0).startOffset : 0;
    });

    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);

    let endOffset = await page.evaluate(() => {
      let s = window.getSelection();
      return s.rangeCount ? s.getRangeAt(0).startOffset : 0;
    });

    expect(errors).toEqual([]);
    expect(endOffset).toBeGreaterThan(startOffset);

    await page.keyboard.press('Space');
  });

  test('play → pause → play creates new source nodes', async ({ page }) => {
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    let spy = await page.evaluate(() => window.__audioSpy);

    expect(errors).toEqual([]);
    let startCalls = spy.calls.filter(c => c.method === 'source.start');
    expect(startCalls.length).toBeGreaterThanOrEqual(2);

    await page.keyboard.press('Space');
  });

  test('play button triggers same engine', async ({ page }) => {
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.locator('#play').click();
    await page.waitForTimeout(500);

    let spy = await page.evaluate(() => window.__audioSpy);

    expect(errors).toEqual([]);
    expect(spy.calls.some(c => c.method === 'new AudioContext')).toBe(true);
    expect(spy.calls.some(c => c.method === 'source.start')).toBe(true);
    await expect(page.locator('#editarea.playing')).toHaveCount(1);

    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await expect(page.locator('#editarea.playing')).toHaveCount(0);
  });
});


// Force <audio> fallback by removing AudioContext before page load
const FORCE_AUDIO_EL = () => {
  delete window.AudioContext;
  delete window.webkitAudioContext;

  // spy on <audio> element
  window.__audioElSpy = { plays: 0, pauses: 0, src: null, loop: false, volume: 1 };
  let origPlay = HTMLAudioElement.prototype.play;
  HTMLAudioElement.prototype.play = function() {
    window.__audioElSpy.plays++;
    window.__audioElSpy.src = this.src;
    window.__audioElSpy.loop = this.loop;
    window.__audioElSpy.volume = this.volume;
    return origPlay.call(this);
  };
  let origPause = HTMLAudioElement.prototype.pause;
  HTMLAudioElement.prototype.pause = function() {
    window.__audioElSpy.pauses++;
    return origPause.call(this);
  };
};

test.describe('audioElPlayer backend', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FORCE_AUDIO_EL);
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('input#file'), { timeout: 5000 });
    await loadFile(page);
  });

  test('play creates WAV blob and calls audio.play()', async ({ page }) => {
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await page.waitForTimeout(800);

    let spy = await page.evaluate(() => window.__audioElSpy);

    expect(errors).toEqual([]);
    expect(spy.plays).toBeGreaterThanOrEqual(1);
    // src should be a blob URL
    expect(spy.src).toMatch(/^blob:/);
  });

  test('pause calls audio.pause()', async ({ page }) => {
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await page.waitForTimeout(800);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    let spy = await page.evaluate(() => window.__audioElSpy);

    expect(errors).toEqual([]);
    expect(spy.pauses).toBeGreaterThanOrEqual(1);
  });

  test('UI state toggles correctly', async ({ page }) => {
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await expect(page.locator('#editarea.playing')).toHaveCount(0);

    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await page.waitForTimeout(800);

    await expect(page.locator('#editarea.playing')).toHaveCount(1);

    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    await expect(page.locator('#editarea.playing')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
