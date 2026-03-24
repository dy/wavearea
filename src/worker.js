import * as Comlink from 'comlink';
import { decodeStream } from 'audio-decode';

import { BLOCK_SIZE } from './constants.js';
import { extractWindow } from './pcm.js';
const CHUNK_SIZE = 184320;

// MIME → decoder format
const FORMATS = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/flac': 'flac',
  'audio/ogg': 'oga', 'audio/vorbis': 'oga', 'application/ogg': 'oga',
  'audio/opus': 'opus',
  'audio/wav': 'wav', 'audio/wave': 'wav', 'audio/x-wav': 'wav',
  'audio/aac': 'aac', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/webm': 'webm',
  'audio/amr': 'amr',
  'audio/aiff': 'aiff', 'audio/x-aiff': 'aiff',
};

// detect format from file header bytes
function detectFormat(h) {
  if (h.length < 4) return null
  if (h[0] === 0xFF && (h[1] & 0xE0) === 0xE0) return 'mp3'
  if (h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33) return 'mp3'
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46) return 'wav'
  if (h[0] === 0x66 && h[1] === 0x4C && h[2] === 0x61 && h[3] === 0x43) return 'flac'
  if (h[0] === 0x4F && h[1] === 0x67 && h[2] === 0x67 && h[3] === 0x53) return 'oga'
  if (h[0] === 0x71 && h[1] === 0x6F && h[2] === 0x61 && h[3] === 0x66) return 'qoa'
  if (h.length > 7 && h[4] === 0x66 && h[5] === 0x74 && h[6] === 0x79 && h[7] === 0x70) return 'm4a'
  return null
}

let chunks = [];
let sampleRate = 44100;
let channelCount = 1;
let totalSamples = 0;


function samplesToWaveform(samples, blockSize = BLOCK_SIZE) {
  const LEVELS = 128, RANGE = 2
  let str = ''
  for (let i = 0, nextBlock = blockSize; i < samples.length;) {
    let sum = 0, x, v, shift
    let max = -1, min = 1
    for (; i < nextBlock; i++) {
      x = i >= samples.length ? 0 : samples[i]
      sum += x
      max = Math.max(max, x)
      min = Math.min(min, x)
    }
    v = Math.min(LEVELS, Math.ceil(LEVELS * (max - min) / RANGE)) || 0
    shift = Math.round(LEVELS * (max + min) / (2 * RANGE))
    str += String.fromCharCode(0x0100 + v)
    str += (shift > 0 ? '\u0301' : '\u0300').repeat(Math.abs(shift))
    nextBlock += blockSize
  }
  return str
}


function createAccumulator(cb) {
  let count = 0
  let channelBufs = null

  function init(ch, sr) {
    channelCount = ch
    sampleRate = sr
    chunks = Array.from({ length: ch }, () => [])
    channelBufs = Array.from({ length: ch }, () => new Float32Array(CHUNK_SIZE))
  }

  function push(channelData, frames) {
    if (!channelBufs) init(channelData.length, sampleRate)
    let off = 0
    while (off < frames) {
      let n = Math.min(CHUNK_SIZE - count, frames - off)
      for (let ch = 0; ch < channelCount; ch++) {
        channelBufs[ch].set(channelData[ch].subarray(off, off + n), count)
      }
      count += n
      off += n
      if (count >= CHUNK_SIZE) flush()
    }
  }

  function flush() {
    if (count === 0) return
    let pcmChunk = []
    for (let ch = 0; ch < channelCount; ch++) {
      let data = count < CHUNK_SIZE ? channelBufs[ch].slice(0, count) : channelBufs[ch]
      chunks[ch].push(data)
      pcmChunk.push(data.slice()) // copy for transfer to main thread
    }
    totalSamples += count
    cb.onWaveform?.(samplesToWaveform(
      count < CHUNK_SIZE ? channelBufs[0].slice(0, count) : channelBufs[0]
    ))
    // send PCM chunk to main thread for local playback (avoids slow postMessage on getWindow)
    cb.onPCM?.(pcmChunk, count)
    count = 0
    channelBufs = Array.from({ length: channelCount }, () => new Float32Array(CHUNK_SIZE))
  }

  return { init, push, flush }
}


Comlink.expose({
  getWindow(fromSample = 0, toSample) {
    let result = extractWindow(chunks, totalSamples, channelCount, fromSample, toSample)
    if (!result) return null
    return Comlink.transfer(result, result.map(a => a.buffer))
  },

  async decode(file, cb) {
    chunks = []
    totalSamples = 0
    channelCount = 1
    sampleRate = 44100

    let fmt = FORMATS[file.type]
    if (!fmt) {
      let header = new Uint8Array(await file.slice(0, 16).arrayBuffer())
      fmt = detectFormat(header)
    }
    if (!fmt) { cb.onError?.(Error('Unsupported format: ' + file.type)); return }

    const acc = createAccumulator(cb)
    let inited = false
    let t0 = performance.now()

    let chunkCount = 0
    for await (let result of decodeStream(file.stream(), fmt)) {
      if (!inited) {
        acc.init(result.channelData.length, result.sampleRate)
        inited = true
        console.log(`[decode] first chunk: ${(performance.now() - t0).toFixed(1)}ms`)
      }
      acc.push(result.channelData, result.channelData[0].length)
      // yield every few chunks so main thread can paint
      if (++chunkCount % 4 === 0) await new Promise(r => setTimeout(r, 0))
    }

    acc.flush()
    if (!totalSamples) { cb.onError?.(Error('No audio data decoded')); return }
    let dt = performance.now() - t0
    let dur = totalSamples / sampleRate
    console.log(`[decode] done: ${dt.toFixed(0)}ms, ${dur.toFixed(1)}s audio, ${(dur / (dt / 1000)).toFixed(0)}x realtime`)
    return { duration: dur, channels: channelCount, sampleRate }
  }
});
