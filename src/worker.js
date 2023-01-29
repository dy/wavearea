// main audio processing API / backend
import { BLOCK_SIZE, SAMPLE_RATE } from "./const.js";
import { fetchAudio, cloneAudio, drawAudio, encodeAudio } from "./audio-utils.js";
import AudioBuffer from "audio-buffer";

// sequence of applied ops with revert actions
const ops = []

// ops worker - schedules message processing with debounced update
let id = 0, queue = []
self.onmessage = async e => {
  queue.push(e.data)
  if (queue.length === 1) handleStack()
};
const handleStack = async () => {
  let op = queue[0]

  // apply op
  console.log('Apply op', op)
  let [name, ...args] = op
  let undo = await Ops[name]?.(...args);
  ops.push(undo)

  // skip render, if there's messages in queue
  queue.shift()
  if (queue.length) return handleStack()

  // render waveform & audio
  let segments = buffers.map(buffer => drawAudio(buffer).replaceAll('\u0100', ' '))
  let duration = buffers.reduce((total, {duration}) => total + duration, 0)
  let wavBuffer = await encodeAudio(...buffers);
  let blob = new Blob([wavBuffer], {type:'audio/wav'});
  let url = URL.createObjectURL( blob );

  id++
  self.postMessage({id, url, segments, duration});
}


// audio data corresponding to segments
let buffers = []

// dict of transforms to audio buffers list, return revert operation
const Ops = {
  // load file from url
  async src (...urls) {
    buffers = await Promise.all(urls.map(fetchAudio))
    return () => buffers = []
  },

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

  del(offset, count) {
    offset = Number(offset), count = Number(count)
    if (!count) return buffers

    let start = bufferIndex(offset)
    let end = bufferIndex(offset+ count)

    // correct tail: pointing to head of the next buffer unnecessarily joins buffers in result
    // but we may want to preserve segmentation
    if (!end[1] && end[0]) end[0] -= 1, end[1] = buffers[end[0]].length

    let startBuffer = buffers[start[0]]
    let endBuffer = buffers[end[0]]

    let outBuffer = new AudioBuffer({
      length: start[1] + (endBuffer.length - end[1]),
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

    let deleted = buffers.splice(start[0], end[0]-start[0]+1, outBuffer)

    return () => {
      // TODO: reinsert deleted buffers
    }
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

  },

  undo() {

  }
}


// return [bufIdx, bufOffset] from absolute offset
const bufferIndex = (blockOffset) => {
  let frameOffset = blockOffset * BLOCK_SIZE
  if (frameOffset === 0) return [ 0, 0 ]
  var start = 0, end
  for (let i = 0; i < buffers.length; i++) {
    end = start + buffers[i].length
    if (frameOffset < end) return [ i, frameOffset - start ]
    start = end
  }

  // that's special case of last buffer: we return index pointing at non-existing item
  // but that's useful for obtaining end of the range
  // eg. getSelection() API also returns offset index _after_ last item.
  return [buffers.length - 1, buffers[buffers.length - 1].length]
}


