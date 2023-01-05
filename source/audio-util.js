import wav from './lib/node-wav';
import storage from 'kv-storage-polyfill';


// NOTE: oggmented doesn't support other sample rate
export const SAMPLE_RATE = 44100;

// approx. block size - close to chars length. Must be in sync with wavefont.
export const BLOCK_SIZE = 1024;

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

// conversion helpers
export const frame = t =>  Math.floor(t * SAMPLE_RATE / BLOCK_SIZE)
export const time = frame => frame * BLOCK_SIZE / SAMPLE_RATE


// load saved audio from store (blob)
async function loadAudio (key=DB_KEY) {
  let blob = await storage.get(key)
  if (!blob) return
  let arrayBuf = await blobToAB(blob)
  return arrayBuf
}
const DB_KEY = 'wavearea-audio'
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


async function saveAudio (blob, key=DB_KEY) {
  // convert audioBuffer into blob
  // FIXME: we can cache blobs by audio buffers
  // FIXME: we can try to save arraybuffer also
  if (blob instanceof AudioBuffer) blob = new Blob([await encodeAudio(blob)])
  return storage.set(DB_KEY, blob)
}

// fetch audio source from URL
async function fetchAudio(src) {
  console.time('fetch')
  let resp = await fetch(src);
  if (!resp.ok) throw new Error(`HTTP error: status=${resp.status}`);

  let arrayBuffer = await resp.arrayBuffer();
  console.timeEnd('fetch')

  return arrayBuffer
}

// decode array buffer to audio buffer
// FIXME: we can cache blob maybe?
async function decodeAudio (arrayBuffer, ctx) {
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
async function encodeAudio (audioBuffer) {
  console.time('wav encode')
  let channelData = audioBuffer.getChannelData(0)
  let res = wav.encode([channelData], { sampleRate: audioBuffer.sampleRate, float: false, bitDepth: 16 })
  console.timeEnd('wav encode')
  return res
}

// convert audio buffer to waveform string
async function drawAudio (audioBuffer) {
  if (!audioBuffer) return '';
  console.time('to waveform string')

  // map waveform to wavefont
  let channelData = audioBuffer.getChannelData(0), str = ''

  // normalize waveform before rendering
  // for every channel bring it to max-min amplitude range
  // NOTE: normalization updates scale on rerender, we don't need that
  // let max = 0
  // for (let i = 0; i < channelData.length; i++) max = Math.max(Math.abs(channelData[i]), max)
  // let amp = Math.max(1 / max, 1)
  // for (let i = 0; i < channelData.length; i++) channelData[i] = Math.max(Math.min(amp * channelData[i], 1),-1);

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


// audio buffer utils
export function slice (buffer, start, end) {
  start = start == null ? 0 : start;
  end = end == null ? buffer.length : end;

  var data = [];
  for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
    data.push(buffer.getChannelData(channel).subarray(start, end));
  }

  return create(buffer.sampleRate, data)
}

export function remove (buffer, start, end) {
  start = start == null ? 0 : start;
  end = Math.min(end == null ? buffer.length : end, buffer.length);

  var data = [], arr;
  for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
    data.push(arr = new Float32Array(buffer.length - Math.abs(end-start)))
    var channelData = buffer.getChannelData(channel)
    arr.set(channelData.subarray(0, start), 0);
    arr.set(channelData.subarray(end), start);
  }

  return create(data)
}

export function silence (len, channels=2) {
  let data = Array.from({length:channels}, ()=>new Float32Array(len))
  return create(data)
}

export function create (data) {
  let newBuffer = new AudioBuffer({
    length: data[0].length,
    numberOfChannels: data.length,
    sampleRate: SAMPLE_RATE
  });

  for (var channel = 0; channel < newBuffer.numberOfChannels; channel++) {
    newBuffer.copyToChannel(data[channel], channel, 0)
  }

  return newBuffer
}

export function insert (buffer, start, newBuffer) {

  var data = [], arr;
  for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
    data.push(arr = new Float32Array(buffer.length + newBuffer.length))
    var channelData = buffer.getChannelData(channel)
    console.log('start', start);
    arr.set(channelData.subarray(0, start), 0);
    arr.set(newBuffer.getChannelData(channel), start)
    arr.set(channelData.subarray(start), start + newBuffer.length);
  }

  return create(data)
}


export {
  loadAudio as load,
  saveAudio as save,
  fetchAudio as fetch,
  encodeAudio as encode,
  decodeAudio as decode,
  drawAudio as draw
}