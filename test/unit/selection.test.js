// Unit tests for selection utilities — runs in Node.js
import test, { is } from 'tst'
import { cleanText, cleanToRaw } from '../../src/selection.js'

test('cleanText removes combining marks', () => {
  is(cleanText('abc'), 'abc')
  is(cleanText('a\u0300b\u0301c'), 'abc')
  is(cleanText('\u0100\u0300\u0101\u0301'), '\u0100\u0101')
  is(cleanText(''), '')
})

test('cleanToRaw converts clean offset to raw', () => {
  // no combining marks
  is(cleanToRaw('abcdef', 3), 3)

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

test('cleanToRaw handles edge cases', () => {
  is(cleanToRaw('', 0), 0)
  is(cleanToRaw('', 5), 0) // past end
  is(cleanToRaw('abc', 10), 3) // past end
})
