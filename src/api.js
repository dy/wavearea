// API layer connecting UI, worker and storage

import * as Comlink from 'comlink';
import { createStore } from './store/index.js';

const worker = Comlink.wrap(new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }));

export default function createApi({ store } = {}) {
  if (!store) store = createStore()

  return {
    async loadFile(file, onWaveform) {
      if (typeof file === 'string') {
        file = await store.getFile(file);
      }

      let decodeError = null;
      const result = await worker.decode(file, Comlink.proxy({
        onWaveform,
        onError: (e) => { decodeError = e }
      }));
      if (decodeError) throw decodeError;
      return result;
    },

    getWindow(fromSample, toSample) {
      return worker.getWindow(fromSample, toSample)
    },

    async saveFile(file, meta) {
      await store.addFile(file, meta);
    },

    async getFiles(options) {
      return store.getFiles(options);
    }
  }
}
