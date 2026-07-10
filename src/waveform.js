// Wavefont string encoding — one char per block from min/max block stats.
// Char U+0100–U+017F encodes peak-to-peak amplitude (128 levels); combining marks
// shift the bar to the block midpoint (center-aligned font, YELA 0): U+0302/U+030C
// = ±10 steps, U+0301/U+0300 = ±1, 10-step marks first — the canonical order the
// font's GPOS rules recognize (see .work/wavefont-quirks.md).
const LEVELS = 128, RANGE = 2

export function statsToWavefont(mins, maxs) {
  let str = ''
  for (let i = 0; i < maxs.length; i++) {
    let min = mins[i], max = maxs[i]
    let v = Math.min(LEVELS - 1, Math.max(0, Math.ceil(LEVELS * (max - min) / RANGE))) || 0
    let shift = Math.round(LEVELS * (max + min) / (2 * RANGE))
    let n = Math.abs(shift)
    str += String.fromCharCode(0x0100 + v)
    if (n) str += (shift > 0 ? '\u0302' : '\u030C').repeat(n / 10 | 0) + (shift > 0 ? '\u0301' : '\u0300').repeat(n % 10)
  }
  return str
}
