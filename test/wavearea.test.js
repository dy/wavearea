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

    // no timecode should contain Infinity or NaN
    let allText = await timecodes.allTextContents();
    for (let t of allText) {
      expect(t).not.toContain('Infinity');
      expect(t).not.toContain('NaN');
    }
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

  test('play → stop → play resumes from caret, not from original position', async ({ page }) => {
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    // click near start
    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(100);

    let startOffset = await page.evaluate(() => {
      let s = window.getSelection();
      return s.rangeCount ? s.getRangeAt(0).startOffset : 0;
    });

    // play for 1.5s to advance caret
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);

    // stop
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    let stoppedOffset = await page.evaluate(() => {
      let s = window.getSelection();
      return s.rangeCount ? s.getRangeAt(0).startOffset : 0;
    });
    expect(stoppedOffset).toBeGreaterThan(startOffset);

    // play again — should start from stopped position, not from original
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    let resumedOffset = await page.evaluate(() => {
      let s = window.getSelection();
      return s.rangeCount ? s.getRangeAt(0).startOffset : 0;
    });

    expect(errors).toEqual([]);
    // caret should be past the stopped position, not back at startOffset
    expect(resumedOffset).toBeGreaterThanOrEqual(stoppedOffset);

    await page.keyboard.press('Space');
  });

  test('slow click during playback seeks to clicked position', async ({ page }) => {
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    // play from start
    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await expect(page.locator('#editarea.playing')).toHaveCount(1);

    // slow click (200ms hold) far ahead during playback
    let box = await page.locator('#editarea').boundingBox();
    let targetX = box.x + box.width * 0.8, targetY = box.y + 15;
    await page.mouse.move(targetX, targetY);
    await page.mouse.down();
    await page.waitForTimeout(200); // hold for 200ms — animation runs during this
    await page.mouse.up();
    await page.waitForTimeout(200);

    // should still be playing
    await expect(page.locator('#editarea.playing')).toHaveCount(1);

    // caret should be near the click target (80%), not dragged back by animation
    let pos = await page.evaluate(() => {
      let s = window.getSelection();
      return s.rangeCount ? s.getRangeAt(0).startOffset : 0;
    });
    let textLen = await page.evaluate(() => document.querySelector('#editarea').textContent.length);
    expect(pos).toBeGreaterThan(textLen * 0.5);

    expect(errors).toEqual([]);
    await page.keyboard.press('Space');
  });

  test('drag-selecting during playback loops the selection', async ({ page }) => {
    // widen chars for reliable drag selection
    await page.evaluate(() => {
      document.querySelector('#wavearea').style.setProperty('--wavefont-spacing', '4px');
    });

    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    // play from start
    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await expect(page.locator('#editarea.playing')).toHaveCount(1);

    // drag-select a range in the middle during playback
    let box = await page.locator('#editarea').boundingBox();
    let y = box.y + 15;
    await page.mouse.move(box.x + box.width * 0.3, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // should still be playing
    await expect(page.locator('#editarea.playing')).toHaveCount(1);

    let total = await page.evaluate(() =>
      document.querySelector('#editarea').textContent.replace(/[\u0300\u0301]/g, '').length
    );
    let getCleanPos = () => page.evaluate(() => {
      let s = window.getSelection(), r = s.rangeCount ? s.getRangeAt(0) : null;
      if (!r) return 0;
      return r.startContainer.textContent.slice(0, r.startOffset).replace(/[\u0300\u0301]/g, '').length;
    });

    // sample 3 times over 2s — all should stay within selection range
    // (if looping, caret wraps around and stays in range)
    let positions = [];
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(600);
      positions.push(await getCleanPos());
    }

    // all samples should stay within the loop range, not reach the end of the file
    // the drag was ~30-70% so caret should never be in the last 10%
    for (let pos of positions) {
      expect(pos).toBeLessThan(total - 2); // not at the very end (total-1 or total)
      expect(pos).toBeGreaterThanOrEqual(total * 0.2); // not at the very start
    }

    expect(errors).toEqual([]);
    await page.keyboard.press('Space');
  });

  test('clicking during playback seeks to clicked position', async ({ page }) => {
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    // click near start, play for 300ms (caret advances a few blocks)
    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await expect(page.locator('#editarea.playing')).toHaveCount(1);

    // click far ahead (near end of waveform) during playback
    let box = await page.locator('#editarea').boundingBox();
    await page.mouse.click(box.x + box.width * 0.8, box.y + 15);

    // immediately sample caret over a few frames — it should NOT jump back
    // to the old play position; it should stay near the click target
    await page.waitForTimeout(100);
    let pos1 = await page.evaluate(() => {
      let s = window.getSelection();
      return s.rangeCount ? s.getRangeAt(0).startOffset : 0;
    });

    await page.waitForTimeout(200);
    let pos2 = await page.evaluate(() => {
      let s = window.getSelection();
      return s.rangeCount ? s.getRangeAt(0).startOffset : 0;
    });

    // should still be playing
    await expect(page.locator('#editarea.playing')).toHaveCount(1);

    // both positions should be in the latter part of the waveform (near 80%),
    // NOT near the beginning where playback originally started
    let textLen = await page.evaluate(() => document.querySelector('#editarea').textContent.length);
    let threshold = textLen * 0.5; // at least past halfway
    expect(pos1).toBeGreaterThan(threshold);
    expect(pos2).toBeGreaterThanOrEqual(pos1);

    expect(errors).toEqual([]);
    await page.keyboard.press('Space');
  });

  test('quick double-space does not select or loop', async ({ page }) => {
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(100);

    // rapid space: play then stop within 100ms
    await page.keyboard.down('Space');
    await page.waitForTimeout(50);
    await page.keyboard.up('Space');
    await page.waitForTimeout(50);
    await page.keyboard.down('Space');
    await page.waitForTimeout(50);
    await page.keyboard.up('Space');
    await page.waitForTimeout(300);

    // should not be playing (stopped by second space)
    await expect(page.locator('#editarea.playing')).toHaveCount(0);

    // selection should be collapsed (no character selected)
    let sel = await page.evaluate(() => {
      let s = window.getSelection();
      return { collapsed: s.isCollapsed, text: s.toString().length };
    });
    expect(sel.collapsed).toBe(true);
    expect(sel.text).toBe(0);

    // internal loop state should be false
    let loopState = await page.evaluate(() => {
      // access sprae state through the element
      let el = document.querySelector('#wavearea');
      return { loop: el._s?.loop ?? null, clipEnd: el._s?.clipEnd ?? null };
    });

    // play again — should play normally from near start, not loop a fragment
    await page.keyboard.press('Space');
    await page.waitForTimeout(800);

    // verify caret is advancing (not stuck looping a single char)
    let offset1 = await page.evaluate(() => {
      let s = window.getSelection();
      return s.rangeCount ? s.getRangeAt(0).startOffset : 0;
    });
    await page.waitForTimeout(500);
    let offset2 = await page.evaluate(() => {
      let s = window.getSelection();
      return s.rangeCount ? s.getRangeAt(0).startOffset : 0;
    });

    expect(errors).toEqual([]);
    expect(offset2).toBeGreaterThan(offset1);

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


test.describe('saved file', () => {
  test('opens saved file from OPFS and plays without errors', async ({ page }) => {
    // addInitScript persists across reloads
    await page.addInitScript(WEB_AUDIO_SPY);
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('input#file'), { timeout: 5000 });

    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    // 1. Load file via input — this saves to OPFS
    await loadFile(page);
    expect((await page.locator('#editarea').textContent()).length).toBeGreaterThan(10);

    // 2. Reload page — opener should show with saved file
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#opener'), { timeout: 5000 });

    // wait for files list to populate
    let fileBtn = page.locator('#files .file-button').first();
    await fileBtn.waitFor({ state: 'visible', timeout: 10000 });

    // 3. Click saved file — should decode and render waveform
    await fileBtn.click();
    await page.waitForFunction(() => {
      let el = document.querySelector('#editarea');
      return el && el.textContent.length > 10;
    }, { timeout: 15000 });

    expect((await page.locator('#editarea').textContent()).length).toBeGreaterThan(10);

    // 4. Timecodes must be valid (not Infinity:NaN)
    let timecodes = page.locator('#timecodes a');
    let tcCount = await timecodes.count();
    expect(tcCount).toBeGreaterThan(0);
    let allTc = await timecodes.allTextContents();
    expect(allTc[0]).toBe('0:00');
    for (let t of allTc) {
      expect(t).not.toContain('Infinity');
      expect(t).not.toContain('NaN');
    }

    // 5. Play — sampleRate must be valid, no errors
    await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    await expect(page.locator('#editarea.playing')).toHaveCount(1);

    let spy = await page.evaluate(() => window.__audioSpy);
    expect(spy.calls.some(c => c.method === 'source.start')).toBe(true);
    let bufferCall = spy.calls.find(c => c.method === 'source.buffer=');
    expect(bufferCall).toBeTruthy();
    expect(bufferCall.buffer.length).toBeGreaterThan(0);
    expect(bufferCall.buffer.sampleRate).toBeGreaterThanOrEqual(3000);

    // stop playback
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    await expect(page.locator('#editarea.playing')).toHaveCount(0);

    expect(errors).toEqual([]);
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


// --- Playback engine contract: both backends must satisfy the same interface ---

function playbackContractTests(backendName, initScript) {
  test.describe(`${backendName} — engine contract`, () => {
    test.beforeEach(async ({ page }) => {
      if (initScript) await page.addInitScript(initScript);
      await page.goto('/');
      await page.waitForFunction(() => document.querySelector('input#file'), { timeout: 5000 });
      await loadFile(page);
    });

    test('play → playing state → pause → not playing', async ({ page }) => {
      let errors = [];
      page.on('pageerror', e => errors.push(e.message));

      await expect(page.locator('#editarea.playing')).toHaveCount(0);

      await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
      await page.keyboard.press('Space');
      await page.waitForTimeout(500);
      await expect(page.locator('#editarea.playing')).toHaveCount(1);

      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
      await expect(page.locator('#editarea.playing')).toHaveCount(0);

      expect(errors).toEqual([]);
    });

    test('play → stop → play resumes from stopped position', async ({ page }) => {
      let errors = [];
      page.on('pageerror', e => errors.push(e.message));

      await page.locator('#editarea').click({ position: { x: 5, y: 5 } });
      await page.waitForTimeout(100);

      await page.keyboard.press('Space');
      await page.waitForTimeout(1000);

      await page.keyboard.press('Space');
      await page.waitForTimeout(200);

      let stoppedOffset = await page.evaluate(() => {
        let s = window.getSelection();
        return s.rangeCount ? s.getRangeAt(0).startOffset : 0;
      });

      await page.keyboard.press('Space');
      await page.waitForTimeout(500);

      let resumedOffset = await page.evaluate(() => {
        let s = window.getSelection();
        return s.rangeCount ? s.getRangeAt(0).startOffset : 0;
      });

      expect(errors).toEqual([]);
      expect(resumedOffset).toBeGreaterThanOrEqual(stoppedOffset);

      await page.keyboard.press('Space');
    });

    test('play button works same as space', async ({ page }) => {
      let errors = [];
      page.on('pageerror', e => errors.push(e.message));

      await page.locator('#play').click();
      await page.waitForTimeout(500);
      await expect(page.locator('#editarea.playing')).toHaveCount(1);

      await page.locator('#play').click();
      await page.waitForTimeout(300);
      await expect(page.locator('#editarea.playing')).toHaveCount(0);

      expect(errors).toEqual([]);
    });
  });
}

// Force worklet backend via engine config
const FORCE_WORKLET = () => {
  window.__playerEngine = 'worklet';
};

playbackContractTests('bufferPlayer', WEB_AUDIO_SPY);
playbackContractTests('audioElPlayer', FORCE_AUDIO_EL);
playbackContractTests('workletPlayer', FORCE_WORKLET);


// --- Decode layer: format detection and OPFS ---

test.describe('decode layer', () => {
  test('decodes MP3 from file input (MIME type path)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('input#file'), { timeout: 5000 });

    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await loadFile(page);
    expect((await page.locator('#editarea').textContent()).length).toBeGreaterThan(10);
    expect(errors).toEqual([]);
  });

  test('decodes saved file from OPFS (header detection, no MIME)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('input#file'), { timeout: 5000 });

    let errors = [];
    page.on('pageerror', e => errors.push(e.message));

    // save file to OPFS first
    await loadFile(page);
    let originalLen = (await page.locator('#editarea').textContent()).length;

    // wait for save to complete
    await page.waitForFunction(() => !document.querySelector('#status'), { timeout: 10000 });
    await page.waitForTimeout(300);

    // reload — OPFS file has empty MIME type, uses header detection
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#opener'), { timeout: 5000 });

    let fileBtn = page.locator('#files .file-button').first();
    await fileBtn.waitFor({ state: 'visible', timeout: 10000 });
    await fileBtn.click();

    await page.waitForFunction(() => {
      let el = document.querySelector('#editarea');
      return el && el.textContent.length > 10;
    }, { timeout: 15000 });

    // should decode to same length as original
    let opfsLen = (await page.locator('#editarea').textContent()).length;
    expect(opfsLen).toBe(originalLen);
    expect(errors).toEqual([]);
  });

  test('rejects invalid file with error', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('input#file'), { timeout: 5000 });

    const fileInput = page.locator('input#file');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      fileInput.dispatchEvent('click')
    ]);
    await fileChooser.setFiles(BAD_FIXTURE);

    await expect(page.locator('#error')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#editarea')).not.toBeVisible();
  });
});


// --- Storage layer: OPFS adapter roundtrip ---

test.describe('storage layer', () => {
  test('save → list → open roundtrip preserves file', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('input#file'), { timeout: 5000 });

    await loadFile(page);

    // wait for save to complete (loading becomes false after saveFile)
    await page.waitForFunction(() => {
      let el = document.querySelector('#wavearea');
      return el && !el.querySelector('#status');
    }, { timeout: 10000 });
    await page.waitForTimeout(500);

    await page.reload();
    await page.waitForFunction(() => document.querySelector('#opener'), { timeout: 5000 });

    let fileBtn = page.locator('#files .file-button').first();
    await fileBtn.waitFor({ state: 'visible', timeout: 10000 });

    // verify metadata
    let fileName = await fileBtn.locator('.file-name').textContent();
    expect(fileName).toContain('sine-3s');

    // open saved file
    await fileBtn.click();
    await page.waitForFunction(() => {
      let el = document.querySelector('#editarea');
      return el && el.textContent.length > 10;
    }, { timeout: 15000 });

    expect((await page.locator('#editarea').textContent()).length).toBeGreaterThan(10);
  });
});


// --- Storage adapter contract: all adapters must satisfy the same interface ---
// Uses native ES module imports from servedir (esbuild serves raw src/ files)

function storageContractTests(adapterType) {
  test.describe(`${adapterType} adapter — storage contract`, () => {
    test('add → list → get → has → delete → clear', async ({ page }) => {
      await page.goto('/');

      let result = await page.evaluate(async (type) => {
        let { createStore } = await import('/src/store/index.js');
        let store = createStore(type);
        await store.init();
        await store.clearAll();

        let blob = new File([new Uint8Array(1024)], 'test.mp3', { type: 'audio/mpeg' });

        // add
        let fileId = await store.addFile(blob, { name: 'test.mp3' });

        // list
        let files = await store.getFiles();

        // get
        let retrieved = await store.getFile(fileId);

        // has
        let has = await store.hasFile(fileId);

        // delete
        await store.deleteFile(fileId);
        let afterDelete = await store.getFiles();
        let hasAfterDelete = await store.hasFile(fileId);

        // add again then clearAll
        await store.addFile(blob, { name: 'test2.mp3' });
        await store.clearAll();
        let afterClear = await store.getFiles();

        return {
          fileId: typeof fileId === 'string',
          listLen: files.length,
          name: files[0]?.name,
          size: retrieved.size,
          has,
          afterDeleteLen: afterDelete.length,
          hasAfterDelete,
          afterClearLen: afterClear.length
        };
      }, adapterType);

      expect(result.fileId).toBe(true);
      expect(result.listLen).toBe(1);
      expect(result.name).toBe('test.mp3');
      expect(result.size).toBe(1024);
      expect(result.has).toBe(true);
      expect(result.afterDeleteLen).toBe(0);
      expect(result.hasAfterDelete).toBe(false);
      expect(result.afterClearLen).toBe(0);
    });

    test('sorts files by name and date', async ({ page }) => {
      await page.goto('/');

      let result = await page.evaluate(async (type) => {
        let { createStore } = await import('/src/store/index.js');
        let store = createStore(type);
        await store.init();
        await store.clearAll();

        await store.addFile(new File([new Uint8Array(10)], 'b.mp3', { type: 'audio/mpeg' }), { name: 'b.mp3' });
        await new Promise(r => setTimeout(r, 10));
        await store.addFile(new File([new Uint8Array(20)], 'a.mp3', { type: 'audio/mpeg' }), { name: 'a.mp3' });

        let byDate = await store.getFiles({ sortBy: 'date', order: 'desc' });
        let byName = await store.getFiles({ sortBy: 'name', order: 'asc' });

        await store.clearAll();
        return {
          byDateFirst: byDate[0]?.name,
          byNameFirst: byName[0]?.name
        };
      }, adapterType);

      expect(result.byDateFirst).toBe('a.mp3');
      expect(result.byNameFirst).toBe('a.mp3');
    });
  });
}

storageContractTests('opfs');
storageContractTests('idb');
storageContractTests('memory');
