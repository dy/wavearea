// Virtual window over the waveform text — pure helpers.
// The DOM holds only visible lines ± buffer; the full string lives in state.
import { isBlock } from './selection.js'

/** Raw index into text of each visual line start (lineOffsets in blocks).
 *  Resumable for append-only growth: pass the same out/cursor to extend. */
export function buildRawLines(text, lineOffsets, out = [], cursor = { raw: 0, blocks: 0 }) {
  let i = cursor.raw, blocks = cursor.blocks, n = lineOffsets.length
  for (; i < text.length && out.length < n; i++) {
    if (isBlock(text[i])) {
      if (blocks === lineOffsets[out.length]) out.push(i)
      blocks++
    }
  }
  cursor.raw = i
  cursor.blocks = blocks
  return out
}

/** Visible line range [first, last) for the scroll position, with buffer. */
export function windowRange(scrollTop, docTop, lineH, viewH, lines, buf = 15) {
  if (!lineH || lines <= 0) return [0, Math.max(0, lines)]
  let first = Math.floor((scrollTop - docTop) / lineH) - buf
  let last = Math.ceil((scrollTop + viewH - docTop) / lineH) + buf
  return [
    Math.max(0, Math.min(first, lines)),
    Math.max(0, Math.min(last, lines)),
  ]
}
