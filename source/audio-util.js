import wav from 'node-wav';
import storage from 'kv-storage-polyfill';

const SAMPLE_RATE = 48000;
// approx. block size - close to chars length. Must be in sync with wavefont.
const BLOCK_SIZE = 1024;
// 1h-length audio ctx (hope more is not needed)
const audioCtx = new OfflineAudioContext(2, SAMPLE_RATE * 60 * 60, SAMPLE_RATE);


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
  let audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
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
  let max = 0
  for (let i = 0; i < channelData.length; i++) max = Math.max(Math.abs(channelData[i]), max)
  let amp = Math.max(1 / max, 1)
  for (let i = 0; i < channelData.length; i++) channelData[i] = Math.max(Math.min(amp * channelData[i], 1),-1);

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
    str += String.fromCharCode(0x0100 + Math.min(100, Math.ceil(rms * 100 * VISUAL_AMP)))

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
  end = end == null ? buffer.length : end;

  var data = [], arr;
  for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
    data.push(arr = new Float32Array(start + buffer.length - end))
    var channelData = buffer.getChannelData(channel)
    arr.set(channelData.subarray(0, start), 0);
    arr.set(channelData.subarray(end), start);
  }

  return create(buffer.sampleRate, data)
}

export function create (sampleRate, data) {
  let newBuffer = new AudioBuffer({
    length: data[0].length,
    numberOfChannels: data.length,
    sampleRate
  });

  for (var channel = 0; channel < newBuffer.numberOfChannels; channel++) {
    newBuffer.copyToChannel(data[channel], channel, 0)
  }

  return newBuffer
}


export {
  loadAudio as load,
  saveAudio as save,
  fetchAudio as fetch,
  encodeAudio as encode,
  decodeAudio as decode,
  drawAudio as draw
}