// main thread API layer connecting UI, worker and storage

import * as Comlink from 'comlink';
import store from './store/index.js';


// decoder worker
const worker = Comlink.wrap(new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }));


const api = {
  // load and decode file, streaming waveform strings to callback
  // file: File object or OPFS file ID (string)
  // onWaveform(str) called per decoded chunk with waveform string
  // returns {duration, channels, sampleRate}
  async loadFile(file, onWaveform) {
    if (typeof file === 'string') {
      file = await store.getFile(file);
    }

    return worker.decode(file, Comlink.proxy({
      onWaveform,
      onError: (e) => console.error('Decode error:', e)
    }));
  },

  async saveFile(file, meta) {
    await store.addFile(file, meta);
  },

  async getFiles(options) {
    return store.getFiles(options);
  }
}


export default api;
