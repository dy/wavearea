import { state } from './wavearea.js';
import * as Comlink from 'comlink';


const worker = Comlink.wrap(new Worker(new URL('./worker.js', import.meta.url), {type: 'module'}));


const BAR_SIZE = 1024; // Number of samples per block for waveform calculation
let audioStore = []

const api ={
  async loadFile(file) {
    console.time('loadFile');
    console.log('Loading file stream via AudioDecoder...')
    await worker.decode(file, Comlink.proxy({
      onProgress: (audioChunk) => {
        audioStore.push(audioChunk);
        state.str += samplesToWaveform(audioChunk);
      },
      onError: (e) => console.error('AudioDecoder error:', e)
    }));
    console.timeEnd('loadFile');
  }
}


function samplesToWaveform(channelData, {blockSize=BAR_SIZE}={}) {
  const LEVELS = 128, AMP = 2

  let str = ''
  for (let i = 0, nextBlock = blockSize; i < channelData.length;) {
    let ssum = 0, sum = 0, x, avg, v, shift

    // avg amp method - waveform is too small
    // for (; i < nextBlock; i++) {
    //   x = i >= channelData.length ? 0 : channelData[i]
    //   sum += Math.abs(x)
    // }
    // avg = sum / blockSize
    // v = Math.ceil(avg * levels)
    // shift = 0

    // rms method
    // drawback: waveform is smaller than needed
    // for (; i < nextBlock; i++) {
    //   x = i >= channelData.length ? 0 : channelData[i]
    //   sum += x
    //   ssum += x ** 2
    // }
    // avg = sum / blockSize
    // const rms = Math.sqrt(ssum / blockSize)
    // v = Math.min(levels, Math.ceil(rms * levels * VISUAL_AMP / 2)) || 0
    // shift = Math.round(avg * levels / 2)

    // signal energy loudness
    // ref: https://github.com/MTG/essentia/blob/master/src/algorithms/temporal/loudness.cpp
    // same as RMS essentially, different power
    // const STEVENS_POW = 0.67
    // for (; i < nextBlock; i++) ssum += i >= channelData.length ? 0 : channelData[i] ** 2
    // const value = (ssum / blockSize) ** STEVENS_POW
    // v = Math.min(levels, Math.ceil(value * levels * VISUAL_AMP))
    // shift = 0

    // peak amplitude
    let max = -1, min = 1
    for (; i < nextBlock; i++) {
      x = i >= channelData.length ? 0 : channelData[i]
      sum += x
      max = Math.max(max, x)
      min = Math.min(min, x)
    }
    v = Math.min(LEVELS, Math.ceil(LEVELS * (max - min) / AMP)) || 0
    shift = Math.round(LEVELS * (max + min) / (2 * AMP))

    str += String.fromCharCode(0x0100 + v)
    str += (shift > 0 ? '\u0301' : '\u0300').repeat(Math.abs(shift))

    nextBlock += blockSize
  }
  return str
}

export default api;
