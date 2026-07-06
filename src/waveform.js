// Wavefont string encoding — one char per block from min/max block stats.
// Char U+0100–U+0180 encodes amplitude (max-min, 128 levels), combining marks
// U+0301/U+0300 encode vertical shift up/down (see .work/wavefont-quirks.md).
const LEVELS = 128, RANGE = 2

export function statsToWavefont(mins, maxs) {
  let str = ''
  for (let i = 0; i < maxs.length; i++) {
    let min = mins[i], max = maxs[i]
    let v = Math.min(LEVELS, Math.ceil(LEVELS * (max - min) / RANGE)) || 0
    let shift = Math.round(LEVELS * (max + min) / (2 * RANGE))
    str += String.fromCharCode(0x0100 + v)
    str += (shift > 0 ? '\u0301' : '\u0300').repeat(Math.abs(shift))
  }
  return str
}
