// main thread UI-facing API layer connecting UI, worker, storage and playback worklet

import * as Comlink from 'comlink';
import store from './store/index.js';


// decoder worker
const worker = Comlink.wrap(new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }));


// playback worklet
const audioContext = new AudioContext()
await audioContext.audioWorklet.addModule(new URL('./audio-worklet.js', import.meta.url));
const playbackNode = new AudioWorkletNode(audioContext, 'playback');
playbackNode.connect(audioContext.destination);
const worklet = Comlink.wrap(playbackNode.port);


const api = {
  // load file provided by user
  async loadFile(file, onProgress) {
    // load from store if file is ID
    if (typeof file === 'string') {
      file = await store.getFile(file);
    }

    console.time('loadFile');
    console.log('Loading file stream via AudioDecoder...')
    const segments = []
    await worker.decode(file, Comlink.proxy({
      onProgress: (chunk) => {
        segments.push(chunk);
        onProgress?.(chunk);
      },
      onError: (e) => console.error('AudioDecoder error:', e)
    }));
    console.timeEnd('loadFile');

    const duration = segments.reduce((sum, chunk) => sum + chunk.length, 0) / 44100; // estimate duration

    return Object.assign(segments, {duration});
  },

  async saveFile(file, meta) {
    await store.addFile(file, meta);
  },

  async delete() {

  },

  async save() {

  },

  async insert() {

  },

  async getFiles(options) {
    return store.getFiles(options);
  },

  // normalize audio content to -1..1 range
  async normalize() {
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
  }
}


export default api;
