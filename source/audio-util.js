// various audio / single buffer utils

import wavEncode from './lib/wav-encode';
import storage from 'kv-storage-polyfill';


// NOTE: oggmented doesn't support other sample rate
export const SAMPLE_RATE = 44100;

// approx. block size - close to chars length. Must be in sync with wavefont.
export const BLOCK_SIZE = 1024;

// conversion helpers time <-> offset <-> block
export const t2o = t =>  Math.floor(t * SAMPLE_RATE / BLOCK_SIZE)
export const o2t = frame => frame * BLOCK_SIZE / SAMPLE_RATE
export const t2b = t => Math.ceil(frame(t) / BLOCK_SIZE)


// get ogg decoder
// FIXME: direct decoder would be better
const audioCtx = await (async () => {
  let audio = new Audio, Context = OfflineAudioContext;
  if (!audio.canPlayType('audio/ogg')) {
    let mod = await import('oggmented');
    Context = mod.default.OggmentedAudioContext;
  }
  return new Context({ sampleRate: SAMPLE_RATE, length: 60*60*44100 });
})()


// load saved audio from store (blob)
export async function loadAudio (key=DB_KEY) {
  let blob = await storage.get(key)
  if (!blob) return
  let arrayBuf = await blobToAB(blob)
  return arrayBuf
}
const DB_KEY = 'waveplay-audio'
const blobToAB = (file) => {
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

// fetch audio source from URL
export async function fetchAudio(src) {
  console.time('fetch')
  let resp = await fetch(src);
  if (!resp.ok) throw new Error(`HTTP error: status=${resp.status}`);

  let arrayBuffer = await resp.arrayBuffer();
  console.timeEnd('fetch')

  return arrayBuffer
}

// decode array buffer to audio buffer
// FIXME: we can cache blob maybe?
export async function decodeAudio (arrayBuffer, ctx) {
  console.time('decode')
  let audioBuffer
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.log(e)
  }
  console.timeEnd('decode')
  return audioBuffer
}

// convert audio to wav array buffer
export async function encodeAudio (...audioBuffers) {
  // FIXME: it can be really done fast by pre-selecting encoding type
  // and just copying audio buffers Float32Arrays straight to wav buffer
  console.time('wav encode')
  let audioBuffer = audioBuffers[0]
  let channelData = audioBuffer.getChannelData(0)
  let res = wavEncode([channelData], { sampleRate: audioBuffer.sampleRate, float: true, bitDepth: 32 })
  console.timeEnd('wav encode')
  return res
}

// convert audio buffer to waveform string
export function drawAudio (audioBuffer) {
  if (!audioBuffer) return '';
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
    // for (; i < nextBlock; i++) sum += Math.abs(i > channelData.length ? 0 : channelData[i])
    // const avg = sum / BLOCK_SIZE
    // str += String.fromCharCode(0x0100 + Math.ceil(avg * 100))

    // rms method:
    // drawback: waveform is smaller than needed
    for (;i < nextBlock; i++) ssum += i > channelData.length ? 0 : channelData[i] ** 2
    const rms = Math.sqrt(ssum / BLOCK_SIZE)
    // replace 0 with space
    let v =  Math.min(100, Math.ceil(rms * 100 * VISUAL_AMP))
    str += String.fromCharCode(0x0100 + v)

    nextBlock += BLOCK_SIZE
  }

  console.timeEnd('to waveform string')
  return str
}
