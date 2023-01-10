// dict of operations on waveform/audio supported by waveplay
// acts on list of buffers

import { decodeAudio, fetchAudio } from './audio-util.js'

// load file from url
export const src =  async (buffers, url) => {
  // try loading persisted audio, if any
  let arrayBuffer = await fetchAudio(url);

  // decode data from src
  let buffer = await decodeAudio(arrayBuffer);

  return [buffer]
}

// normalize audio
export const norm = (buffers) => {
  // normalize waveform before rendering
  // for every channel bring it to max-min amplitude range
  let max = 0
  for (let buffer of buffers) {
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      let channelData = buffer.getChannelData(c);
      for (let i = 0; i < channelData.length; i++) max = Math.max(Math.abs(channelData[i]), max)
    }
  }
  let amp = Math.max(1 / max, 1)
  for (let buffer of buffers) {
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      let channelData = buffer.getChannelData(c);
      for (let i = 0; i < channelData.length; i++) channelData[i] = Math.max(Math.min(amp * channelData[i], 1),-1);
    }
  }
  return buffers
}

// either add external URL or silence (count)
export const add = (buffers, offset, src) => {

}

// copy offset/cout to another position (rewrites data underneath)
export const cp = (buffers, offset, count, to) => {

}

// insert breaks / split
export const br = (buffers, offset) => {

}

// clip to indicated fragment
export function clip (buffer, start, end) {
  start = start == null ? 0 : start;
  end = end == null ? buffer.length : end;

  var data = [];
  for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
    data.push(buffer.getChannelData(channel).subarray(start, end));
  }

  return create(buffer.sampleRate, data)
}

export function del (buffer, start, end) {
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

export function mute (len, channels=2) {
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
    arr.set(channelData.subarray(0, start), 0);
    arr.set(newBuffer.getChannelData(channel), start)
    arr.set(channelData.subarray(start), start + newBuffer.length);
  }

  return create(data)
}