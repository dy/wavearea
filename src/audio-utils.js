// single audio buffer utils
import AudioBuffer from 'audio-buffer'
import decodeAudio from './decode.js'
import { BLOCK_SIZE, SAMPLE_RATE } from "./const.js";


// fetch audio source from URL
export async function fetchAudio(src) {
  console.time('fetch')
  let resp = await fetch(src);
  if (!resp.ok) throw new Error(`HTTP error: status=${resp.status}`);

  let arrayBuffer = await resp.arrayBuffer();
  console.timeEnd('fetch')

  return decodeAudio(arrayBuffer);
}

// convert audio buffers to wav array buffer
export async function encodeAudio (...audioBuffers) {
  console.time('wav encode')

  // extracted parts of node-wav for seamless integration with audio buffers float32
  let sampleRate = audioBuffers[0]?.sampleRate || SAMPLE_RATE;
  let bitDepth = 32
  let channels = audioBuffers[0]?.numberOfChannels || 1;
  let length = 0;
  for (let audioBuffer of audioBuffers) length += audioBuffer.length;
  let buffer = new ArrayBuffer(44 + length * channels * (bitDepth >> 3));
  let v = new DataView(buffer);
  let pos = 0;
  const u8 = (x) => v.setUint8(pos++, x);
  const u16 = (x) => (v.setUint16(pos, x, true), pos += 2)
  const u32 = (x) => (v.setUint32(pos, x, true), pos += 4)
  const string = (s) => { for (var i = 0; i < s.length; ++i) u8(s.charCodeAt(i));}
  string("RIFF");
  u32(buffer.byteLength - 8);
  string("WAVE");
  string("fmt ");
  u32(16);
  u16(3); // float
  u16(channels);
  u32(sampleRate);
  u32(sampleRate * channels * (bitDepth >> 3));
  u16(channels * (bitDepth >> 3));
  u16(bitDepth);
  string("data");
  u32(buffer.byteLength - 44);

  // FIXME: can just copy data for mono case (way faster)
  // FIXME: should we instead to just directly work with wav buffer instead of audio buffers?
  let output = new Float32Array(buffer, pos);
  for (let audioBuffer of audioBuffers) {
    let channels = audioBuffer.numberOfChannels,
        channelData = Array(channels),
        length = audioBuffer.length
    for (let ch = 0; ch < channels; ++ch) channelData[ch] = audioBuffer.getChannelData(ch)
    for (let i = 0; i < length; ++i)
      for (let ch = 0; ch < channels; ++ch) output[pos++] = channelData[ch][i];
  }

  console.timeEnd('wav encode')
  return buffer;
}

// convert audio buffer to waveform string
export function drawAudio (audioBuffer) {
  if (!audioBuffer) return '';

  // if waveform is rendered already - return cached
  if (audioBuffer._wf) return audioBuffer._wf;

  console.time('to waveform string')

  // map waveform to wavefont
  let channelData = audioBuffer.getChannelData(0), str = ''

  // TODO: weight waveform by audible spectrum

  // create wavefont string
  // amp coef brings up value a bit
  const VISUAL_AMP = 2

  for (let i = 0, nextBlock = BLOCK_SIZE; i < channelData.length;) {
    let ssum = 0, sum = 0

    // avg amp method - waveform is too small
    // for (; i < nextBlock; i++) sum += Math.abs(i >= channelData.length ? 0 : channelData[i])
    // const avg = sum / BLOCK_SIZE
    // str += String.fromCharCode(0x0100 + Math.ceil(avg * 100))

    // rms method
    // drawback: waveform is smaller than needed
    for (;i < nextBlock; i++) ssum += i >= channelData.length ? 0 : channelData[i] ** 2
    const rms = Math.sqrt(ssum / BLOCK_SIZE)
    let v =  Math.min(100, Math.ceil(rms * 100 * VISUAL_AMP))
    str += String.fromCharCode(0x0100 + v)

    // signal energy loudness
    // ref: https://github.com/MTG/essentia/blob/master/src/algorithms/temporal/loudness.cpp
    // same as RMS essentially, different power
    // const STEVENS_POW = 0.67
    // for (;i < nextBlock; i++) ssum += i >= channelData.length ? 0 : channelData[i] ** 2
    // const value = (ssum / BLOCK_SIZE) ** STEVENS_POW
    // let v =  Math.min(100, Math.ceil(value * 100 * VISUAL_AMP))
    // str += String.fromCharCode(0x0100 + v)

    nextBlock += BLOCK_SIZE
  }

  // cache waveform
  audioBuffer._wf = str

  console.timeEnd('to waveform string')
  return str
}

export function sliceAudio (buffer, start=0, end=buffer.length) {
  let newBuffer = new AudioBuffer({
    length: end - start,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate
  });

  for (var c = 0; c < newBuffer.numberOfChannels; c++) {
    newBuffer.copyToChannel(
      buffer.getChannelData(c).subarray(start, end),
      c, 0
    )
  }

  return newBuffer
}

export function joinAudio(a, b) {
  let newBuffer = new AudioBuffer({
    length: a.length + b.length,
    numberOfChannels: Math.max(a.numberOfChannels, b.numberOfChannels),
    sampleRate: a.sampleRate
  })

  for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
    newBuffer.copyToChannel(
      a.getChannelData(ch),
      ch, 0
    )
    newBuffer.copyToChannel(
      b.getChannelData(ch),
      ch, a.length
    )
  }

  return newBuffer
}

export function deleteAudio(buffer, start=0, end=buffer.length) {
  let newBuffer = new AudioBuffer({
    length: buffer.length - Math.abs(end - start),
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate
  });

  for (var c = 0; c < buffer.numberOfChannels; c++) {
    var channelData = buffer.getChannelData(c)
    var newChannelData = newBuffer.getChannelData(c)
    newChannelData.set(channelData.subarray(0, start), 0);
    newChannelData.set(channelData.subarray(end), start);
  }

  return newBuffer
}

export function insertAudio (a, offset, b) {
  if (offset >= a.length) return joinAudio(a, b)
  if (!offset) return joinAudio(b, a)

  let buffer = new AudioBuffer({
    length: a.length + b.length,
    numberOfChannels: Math.max(a.numberOfChannels, b.numberOfChannels),
    sampleRate: a.sampleRate
  })

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    buffer.copyToChannel(
      a.getChannelData(ch).subarray(0, offset),
      ch, 0
    )
    buffer.copyToChannel(
      b.getChannelData(ch),
      ch, offset
    )
    buffer.copyToChannel(
      a.getChannelData(ch).subarray(offset),
      ch, offset + b.length
    )
  }
  return buffer
}

export function cloneAudio (a) {
  let b = new AudioBuffer({sampleRate: a.sampleRate, numberOfChannels: a.numberOfChannels, length: a.length})
  for (let ch = 0; ch < a.numberOfChannels; ch++) b.getChannelData(ch).set(a.getChannelData(ch))
  return b
}

// load saved audio from store (blob)
export async function loadAudio (key=DB_KEY) {
  let blob = await storage.get(key)
  if (!blob) return
  let arrayBuf = await fileToArrayBuffer(blob)
  return arrayBuf
}
const DB_KEY = 'waveplae-audio'
export const fileToArrayBuffer = (file) => {
  return new Promise((y,n) => {
    const reader = new FileReader();
    reader.addEventListener('loadend', (event) => {
      y(event.target.result);
    });
    reader.addEventListener('error', n)
    reader.readAsArrayBuffer(file);
  })
}


export async function saveAudio (blob, key=DB_KEY) {
  // convert audioBuffer into blob
  // FIXME: we can cache blobs by audio buffers
  // FIXME: we can try to save arraybuffer also
  if (blob instanceof AudioBuffer) blob = new Blob([await encodeAudio(blob)])
  return storage.set(DB_KEY, blob)
}
