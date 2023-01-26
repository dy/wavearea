// dict of operations on waveform/audio supported by waveplay
// acts on list of buffers

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


// import worker from './ops-worker.js';

// // listen for myWorker to transfer the buffer back to main
// worker.addEventListener("message", function handleMessageFromWorker(msg) {
//   console.log("message from worker received in main:", msg);

//   const bufTransferredBackFromWorker = msg.data;

//   console.log(
//     "buf.byteLength in main AFTER transfer back from worker:",
//     bufTransferredBackFromWorker.byteLength
//   );
// });


// apply operations to buffers immediately
export default async function applyOp (buffers, ...ops) {
  console.log('Apply ops', ops)
  // const sab = new SharedArrayBuffer(1024);
  // worker.postMessage(sab);

  for (let [op, ...args] of ops) {
    if (!Ops[op]) throw Error('Unknown operation `' + op + '`')
    buffers = await Ops[op]?.(buffers, ...args)
  }

  return buffers
}

const Ops = {}

// load file from url
Ops.src =  async (buffers, url) => {
  // try loading persisted audio, if any
  let arrayBuffer = await fetchAudio(url);

  // decode data from src
  let buffer = await decodeAudio(arrayBuffer);

  return [buffer]
}

// normalize audio
Ops.norm = (buffers) => {
  // remove static - calculate avg and subtract
  let sum = 0, total = 0
  for (let buffer of buffers) {
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      let channelData = buffer.getChannelData(c);
      total += channelData.length
      for (let i = 0; i < channelData.length; i++)
        sum += channelData[i]
    }
  }
  let avg = sum / total
  for (let buffer of buffers) {
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      let channelData = buffer.getChannelData(c);
      total += channelData.length
      for (let i = 0; i < channelData.length; i++)
        channelData[i] -= avg
    }
  }

  // amplify max to meet 1
  let max = 0
  for (let buffer of buffers) {
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      let channelData = buffer.getChannelData(c);
      for (let i = 0; i < channelData.length; i++)
        max = Math.max(Math.abs(channelData[i]), max)
    }
  }

  let amp = Math.max(1 / max, 1);

  for (let buffer of buffers) {
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      let channelData = buffer.getChannelData(c);
      for (let i = 0; i < channelData.length; i++)
        channelData[i] = Math.min(1, Math.max(-1, channelData[i] * amp));
    }
  }
  return buffers
}

// insert breaks / split
Ops.br = (buffers, ...offsets) => {
  for (let offset of offsets) {
    let [bufIdx, bufOffset] = bufferOffset(buffers, b2o(offset));
    let buf = buffers[bufIdx]

    if (bufOffset > 0 && bufOffset < buf.length) {
      let left = sliceAudio(buf, 0, bufOffset)
      let right = sliceAudio(buf, bufOffset)

      buffers.splice(bufIdx, 1,
        left, right
      )
    }
  }

  return buffers
}

Ops.join = (buffers, offset) => {
  let [bufIdx, bufOffset] = bufferOffset(buffers, b2o(offset))

  if (bufOffset) return console.warn('Wrong buffer offset', offset)

  let left = buffers[bufIdx-1], right = buffers[bufIdx]
  buffers.splice(bufIdx-1, 2,
    joinAudio(left, right)
  )

  return buffers
}

Ops.del = (buffers, offset, count) => {
  if (!count) return buffers

  let start = bufferOffset(buffers, b2o(offset))
  let end = bufferOffset(buffers, b2o(offset + count))

  // correct tail: pointing to head of the next buffer unnecessarily joins buffers in result
  // but we may want to preserve segmentation
  if (!end[1] && end[0]) end[0] -= 1, end[1] = buffers[end[0]].length

  let startBuffer = buffers[start[0]]
  let endBuffer = buffers[end[0]]

  let outBuffer = new AudioBuffer({
    length: start[1] + (endBuffer.length - end[1]),
    sampleRate: SAMPLE_RATE,
    numberOfChannels: startBuffer.numberOfChannels
  })

  for (let c = 0; c < startBuffer.numberOfChannels; c++) {
    let i = 0,
      outData = outBuffer.getChannelData(c),
      startData = startBuffer.getChannelData(c),
      endData = endBuffer.getChannelData(c)

    // transfer remaining head samples
    for (i = 0; i < start[1]; i++) outData[i] = startData[i]
    // transfer remaining tail samples
    for (let j = end[1]; j < endData.length; j++) outData[i] = endData[j], i++
  }

  buffers.splice(start[0], end[0]-start[0]+1, outBuffer)

  return buffers
}

Ops.mute = (buffers, ...parts) => {
  for (let part of parts) {
    let [offset, count] = part
    let [bufIdx, bufOffset] = bufferOffset(buffers, b2o(offset))

    // end of segment: insert to prev buffer - conventionally better have end space than have spaced beginning
    if (!bufOffset && bufIdx) bufIdx -= 1, bufOffset = buffers[bufIdx].length

    let silenceBuffer = new AudioBuffer({
      length: count * BLOCK_SIZE,
      numberOfChannels: buffers?.[0].numberOfChannels || 1,
      sampleRate: buffers?.[0].sampleRate || SAMPLE_RATE
    })
    buffers[bufIdx] = insertAudio(buffers[bufIdx], bufOffset, silenceBuffer)
  }
  return buffers
}

// clip to indicated fragment
Ops.clip = (buffers, from, to) => {

}


// either add external URL or silence (count)
Ops.add = (buffers, offset, src) => {

}

// copy offset/cout to another position (rewrites data underneath)
Ops.cp = (buffers, offset, count, to) => {

}

// return [bufIdx, bufOffset] from absolute offset
const bufferOffset = (buffers, offset) => {
  if (offset === 0) return [ 0, 0 ]
  var start = 0, end
  for (let i = 0; i < buffers.length; i++) {
    end = start + buffers[i].length
    if (offset < end) return [ i, offset - start ]
    start = end
  }

  // that's special case of last buffer: we return index pointing at non-existing item
  // but that's useful for obtaining end of the range
  // eg. getSelection() API also returns offset index _after_ last item.
  return [buffers.length - 1, buffers[buffers.length - 1].length]
}


// conversion helpers time <-> offset <-> block
export const t2o = t =>  Math.floor(t * SAMPLE_RATE / BLOCK_SIZE)
export const o2t = frame => frame * BLOCK_SIZE / SAMPLE_RATE
export const t2b = t => Math.ceil(t2o(t) / BLOCK_SIZE)
export const b2o = block => block * BLOCK_SIZE



// load saved audio from store (blob)
export async function loadAudio (key=DB_KEY) {
  let blob = await storage.get(key)
  if (!blob) return
  let arrayBuf = await fileToArrayBuffer(blob)
  return arrayBuf
}
const DB_KEY = 'waev-audio'
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

// convert audio buffers to wav array buffer
export async function encodeAudio (...audioBuffers) {
  console.time('wav encode')

  // extracted parts of node-wav for seamless integration with audio buffers float32
  let sampleRate = SAMPLE_RATE;
  let bitDepth = 32
  let channels = audioBuffers[0].numberOfChannels;
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
  if (
    audioBuffer._wf &&
    audioBuffer._wf_first === audioBuffer.getChannelData(0)[0]
    ) return audioBuffer._wf;

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
  audioBuffer._wf_first = audioBuffer.getChannelData(0)[0]

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
