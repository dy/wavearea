// API layer connecting UI, worker and storage
// PCM stored on main thread to avoid slow Worker postMessage on playback

import * as Comlink from 'comlink';
import { createStore } from './store/index.js';

const worker = Comlink.wrap(new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }));

export default function createApi({ store } = {}) {
  if (!store) store = createStore()

  // main-thread PCM storage — chunks per channel
  let pcmChunks = [] // [ch][chunkIndex] = Float32Array
  let pcmTotal = 0
  let channelCount = 0

  return {
    async loadFile(file, onWaveform) {
      if (typeof file === 'string') {
        file = await store.getFile(file);
      }

      // reset PCM storage
      pcmChunks = []
      pcmTotal = 0
      channelCount = 0

      let decodeError = null;
      const result = await worker.decode(file, Comlink.proxy({
        onWaveform,
        onPCM: (chunkData, frames) => {
          if (!channelCount) {
            channelCount = chunkData.length
            pcmChunks = Array.from({ length: channelCount }, () => [])
          }
          for (let ch = 0; ch < channelCount; ch++) {
            pcmChunks[ch].push(chunkData[ch])
          }
          pcmTotal += frames
        },
        onError: (e) => { decodeError = e }
      }));
      if (decodeError) throw decodeError;
      return result;
    },

    // getWindow from main-thread PCM — instant, no Worker postMessage
    getWindow(fromSample, toSample) {
      if (!pcmChunks.length || !pcmChunks[0].length) return null
      if (toSample == null || toSample > pcmTotal) toSample = pcmTotal
      if (fromSample >= toSample) return null

      let len = toSample - fromSample
      let result = Array.from({ length: channelCount }, () => new Float32Array(len))

      for (let ch = 0; ch < channelCount; ch++) {
        let pos = 0
        for (let chunk of pcmChunks[ch]) {
          let chunkEnd = pos + chunk.length
          if (chunkEnd > fromSample && pos < toSample) {
            let srcStart = Math.max(0, fromSample - pos)
            let srcEnd = Math.min(chunk.length, toSample - pos)
            let dstStart = Math.max(0, pos + srcStart - fromSample)
            result[ch].set(chunk.subarray(srcStart, srcEnd), dstStart)
          }
          pos = chunkEnd
        }
      }

      return result
    },

    async saveFile(file, meta) {
      await store.addFile(file, meta);
    },

    async getFiles(options) {
      return store.getFiles(options);
    }
  }
}
