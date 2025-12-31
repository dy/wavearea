// FIXME: remove
// main audio processing API / backend
import { BLOCK_SIZE, SAMPLE_RATE } from "./const.js";
import { fetchAudio, cloneAudio, drawAudio, encodeAudio, sliceAudio, fileToArrayBuffer } from "./audio-util.js";
import decodeAudio from 'audio-decode'
import AudioBuffer from "audio-buffer";
import storage from 'kv-storage-polyfill';

// shim worker for Safari
if (!globalThis.Worker) {
  let { default: Worker } = await import('pseudo-worker')
  globalThis.Worker = Worker
}

// ops worker - schedules message processing with debounced update
self.onmessage = async e => {
  console.log('Worker message', e)
  let { id, ops } = e.data, resultBuffers

  // revert history if needed
  while (id < history.length) history.pop()()

  // apply op
  for (let op of ops) {
    console.log('Apply op', op)
    let [name, ...args] = op
    resultBuffers = await Ops[name]?.(...args);
  }

  renderAudio(resultBuffers)
};

// render waveform & audio, post to client
const renderAudio = async (buffers) => {
  let segments = buffers.map(buffer => drawAudio(buffer))
  let duration = buffers.reduce((total, { duration }) => total + duration, 0)
  let wavBuffer = await encodeAudio(...buffers);
  let blob = new Blob([wavBuffer], { type: 'audio/wav' });
  let url = URL.createObjectURL(blob);
  self.postMessage({ id: history.length, url, segments, duration });
}


// sequence of buffers states
let history = []

// current audio data (which segments correspond to)
let buffers = []

// dict of operations - supposed to update history & current buffers
const Ops = {
  // load/decode file from url
  async src(...urls) {
    history.push(() => buffers = [])
    buffers = await Promise.all(urls.map(fetchAudio))
    return buffers
  },

  // accept decoded audio buffer
  async file(data) {
    // load file from storage, if exists
    if (typeof data === 'string') {
      let blob = await storage.get(DB_KEY + ':' + data)
      if (!blob) return buffers // TODO: throw error, reset history

      let arrayBuffer = await fileToArrayBuffer(blob)
      let audioBuffer = await decodeAudio(arrayBuffer)

      return buffers = [audioBuffer]
    }

    history.push(() => buffers.pop())

    // overcome alloc limit by creating multiple buffers
    let maxLength = 108 * SAMPLE_RATE // 108 sec
    for (let i = 0; i < data.length; i += maxLength) {
      let length = Math.min(maxLength, data.length - i)
      console.log(length);
      let audioBuffer = new AudioBuffer({
        numberOfChannels: data.numberOfChannels,
        length,
        sampleRate: data.sampleRate
      });
      data.channelData.forEach((data, channel) => audioBuffer.getChannelData(channel).set(data.subarray(i, i + length)))
      buffers.push(audioBuffer)
    }

    // save to storage
    let blob = new Blob([await encodeAudio(...buffers)])
    console.log('save', DB_KEY + ':' + data.name)
    storage.set(DB_KEY + ':' + data.name, blob)

    return buffers
  },

  del(from, to) {
    from = Number(from), to = Number(to)

    let origBuffers = [...buffers]
    history.push(() => {
      buffers = origBuffers
    })

    let start = bufferIndex(from)
    let end = bufferIndex(to)

    // correct tail: pointing to head of the next buffer unnecessarily joins buffers in result
    // but we may want to preserve segmentation
    if (!end[1] && end[0]) end[0] -= 1, end[1] = buffers[end[0]].length

    let startBuffer = buffers[start[0]]
    let endBuffer = buffers[end[0]]

    let length = start[1] + (endBuffer.length - end[1])
    if (!length) return buffers = []

    let outBuffer = new AudioBuffer({
      length,
      sampleRate: startBuffer.sampleRate,
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

    let deleted = buffers.splice(start[0], end[0] - start[0] + 1, outBuffer)

    return buffers
  },

  /*
  // normalize audio
  norm() {
    let origBuffers = buffers.map(buffer => cloneAudio(buffer))

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

    return () => origBuffers
  },

  // insert breaks / split
  br(buffers, ...offsets) {
    for (let offset of offsets) {
      let [bufIdx, bufOffset] = bufferIndex(offset);
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
  },

  join(offset) {
    let [bufIdx, bufOffset] = bufferIndex(offset)

    if (bufOffset) return console.warn('Wrong buffer offset', offset)

    let left = buffers[bufIdx-1], right = buffers[bufIdx]
    buffers.splice(bufIdx-1, 2,
      joinAudio(left, right)
    )

    return buffers
  },

  mute(...parts) {
    for (let part of parts) {
      let [offset, count] = part
      let [bufIdx, bufOffset] = bufferIndex(offset)

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
  },

  // clip to indicated fragment
  clip(from, to) {

  },

  // either add external URL or silence (count)
  add(offset, src) {

  },

  // copy offset/cout to another position (rewrites data underneath)
  cp(offset, count, to) {

  }
  */

  // apply ops to history
  goto(id) {

  }
}


// return [bufIdx, bufOffset] from absolute offset
const bufferIndex = (blockOffset) => {
  let frameOffset = blockOffset * BLOCK_SIZE
  if (frameOffset === 0) return [0, 0]
  var start = 0, end
  for (let i = 0; i < buffers.length; i++) {
    end = start + buffers[i].length
    if (frameOffset < end) return [i, frameOffset - start]
    start = end
  }

  // that's special case of last buffer: we return index pointing at non-existing item
  // but that's useful for obtaining end of the range
  // eg. getSelection() API also returns offset index _after_ last item.
  return [buffers.length - 1, buffers[buffers.length - 1].length]
}

const DB_KEY = 'wavearea-audio'
