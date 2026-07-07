// Unit tests for virtual window helpers — runs in Node.js
import test, { is } from 'tst'
import { buildRawLines, windowRange } from '../../src/virtual.js'

const B = '\u0100', M = '\u0300' // block char, combining mark

test('buildRawLines maps line starts to raw indexes', () => {
  // 6 blocks, one mark after 2nd and 4th, lines of 2 blocks
  let text = B + B + M + B + B + M + B + B
  is(buildRawLines(text, [0, 2, 4]), [0, 3, 6])
})

test('buildRawLines skips newlines (segment breaks)', () => {
  // 4 blocks with a break after 2nd: line starts at the block after '\n'
  let text = B + B + M + '\n' + B + B
  is(buildRawLines(text, [0, 2]), [0, 4])
})

test('buildRawLines is resumable for append-only growth', () => {
  let out = [], cursor = { raw: 0, blocks: 0 }
  let t1 = B + B + M
  buildRawLines(t1, [0, 2, 4], out, cursor)
  is(out, [0])
  let t2 = t1 + B + B + B + M
  buildRawLines(t2, [0, 2, 4], out, cursor)
  is(out, [0, 3, 5])
})

test('buildRawLines with pending line offset waits for content', () => {
  let out = [], cursor = { raw: 0, blocks: 0 }
  buildRawLines(B + B, [0, 2], out, cursor)
  is(out, [0]) // line 1 starts at block 2 — not decoded yet
  buildRawLines(B + B + B, [0, 2], out, cursor)
  is(out, [0, 2])
})

test('windowRange clamps and buffers', () => {
  // 100 lines of 10px, viewport 50px at top: [0, visible+buf]
  is(windowRange(0, 0, 10, 50, 100, 5), [0, 10])
  // mid-scroll
  is(windowRange(500, 0, 10, 50, 100, 5), [45, 60])
  // bottom clamp
  is(windowRange(2000, 0, 10, 50, 100, 5), [100, 100])
  // doc offset shifts the origin
  is(windowRange(100, 100, 10, 50, 100, 5), [0, 10])
  // degenerate
  is(windowRange(0, 0, 0, 50, 100, 5), [0, 100])
})
