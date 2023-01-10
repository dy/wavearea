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

// delete part of audio
export const del = (buffers, offset, count) => {

}

// either add external URL or silence (count)
export const add = (buffers, offset, src) => {

}

// make subset of audio
// FIXME: conflicts with subscribe
export const sub = (buffers, from, count) => {

}

// copy offset/cout to another position (rewrites data underneath)
export const cp = (buffers, offset, count, to) => {

}

// insert breaks / split
export const br = (buffers, offset) => {

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

export function mut (len, channels=2) {
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