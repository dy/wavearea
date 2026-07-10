// Unit tests for selection utilities — runs in Node.js
import test, { is } from 'tst'
import { cleanText, cleanToRaw, isBlock } from '../../src/selection.js'

test('isBlock accepts wavefont glyphs only', () => {
  is(isBlock('\u0100'), true)
  is(isBlock('\u0180'), true)
  is(isBlock('\u0300'), false) // combining mark
  is(isBlock('\u0301'), false)
  is(isBlock('\n'), false)     // segment break
  is(isBlock('a'), false)
})

test('cleanText keeps block chars only (complements isBlock)', () => {
  is(cleanText('abc'), '') // non-block chars never count as blocks
  is(cleanText('\u0100\u0302\u0101\u030c'), '\u0100\u0101') // 10-step shift marks
  is(cleanText('\u0100\u0300\u0101\u0301'), '\u0100\u0101')
  is(cleanText('\u0100\n\u0101'), '\u0100\u0101')
  is(cleanText('\u0100\u0300\n\u0101\u0301\n'), '\u0100\u0101')
  is(cleanText(''), '')
})

test('cleanToRaw converts clean offset to raw', () => {
  // each char followed by one combining mark
  let s = '\u0100\u0300\u0101\u0301\u0102\u0300'
  is(cleanToRaw(s, 0), 0)
  is(cleanToRaw(s, 1), 2)
  is(cleanToRaw(s, 2), 4)
  is(cleanToRaw(s, 3), 6)

  // mixed: some chars have marks, some don't
  let m = '\u0100\u0300\u0300\u0101\u0102\u0301'
  is(cleanToRaw(m, 0), 0)
  is(cleanToRaw(m, 1), 3) // skip 2 combining marks
  is(cleanToRaw(m, 2), 4)
  is(cleanToRaw(m, 3), 6)
})

test('cleanToRaw skips segment breaks (caret lands after \\n)', () => {
  // break between blocks: block 1 maps past the newline — start of next segment
  let s = '\u0100\u0300\n\u0101\u0301'
  is(cleanToRaw(s, 0), 0)
  is(cleanToRaw(s, 1), 3) // after mark AND newline
  is(cleanToRaw(s, 2), 5)

  // consecutive marks + break
  let m = '\u0100\u0300\u0301\n\u0101\n\u0102'
  is(cleanToRaw(m, 1), 4)
  is(cleanToRaw(m, 2), 6)
  is(cleanToRaw(m, 3), 7)
})

test('cleanToRaw handles edge cases', () => {
  is(cleanToRaw('', 0), 0)
  is(cleanToRaw('', 5), 0) // past end
  is(cleanToRaw('\u0100\u0101\u0102', 10), 3) // past end
})
