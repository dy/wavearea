// Unit tests for wavefont encoding — runs in Node.js
import test, { is } from 'tst'
import { statsToWavefont } from '../../src/waveform.js'

const UP10 = '\u0302', UP = '\u0301', DOWN10 = '\u030C', DOWN = '\u0300'

test('amplitude maps to U+0100..U+017F', () => {
  is(statsToWavefont([0], [0]), 'Ā') // silence
  is(statsToWavefont([-1], [1]), 'ſ') // full scale clamps to 127, not blank U+0180
  is(statsToWavefont([-2], [2]), 'ſ') // decoder overshoot clamps too
  is(statsToWavefont([0.05], [-0.05]), 'Ā') // garbage min>max clamps to 0
  is(statsToWavefont([], []), '')
})

test('symmetric blocks carry no marks', () => {
  is(statsToWavefont([-0.5], [0.5]), 'ŀ')
  is(statsToWavefont([-0.05, -1], [0.05, 1]), 'ćſ')
})

test('shift marks are canonical: 10-step first, then 1-step', () => {
  // min=-0.1 max=0.9 → v=64, shift=+26 → 2×up10 + 6×up
  is(statsToWavefont([-0.1], [0.9]), 'ŀ' + UP10.repeat(2) + UP.repeat(6))
  // mirrored down
  is(statsToWavefont([-0.9], [0.1]), 'ŀ' + DOWN10.repeat(2) + DOWN.repeat(6))
  // max shift: min=max=1 → v=0, shift=+64 → 6×up10 + 4×up (15 marks max per char)
  is(statsToWavefont([1], [1]), 'Ā' + UP10.repeat(6) + UP.repeat(4))
})
