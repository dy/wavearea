// API layer connecting UI, engine worker and storage.
// The whole audio engine (decode, PCM pages, stats, edits) lives in the worker;
// main thread receives only stat deltas (waveform strings) and playback windows.

import audioWorker from 'audio/worker'
import { createStore } from './store/index.js'
import { statsToWavefont } from './waveform.js'
import { BLOCK_SIZE } from './constants.js'

export default function createApi({ store } = {}) {
  if (!store) store = createStore()

  let a = null, worker = null

  // re-render full waveform + meta from engine state (edits applied)
  async function refresh() {
    let total = Math.ceil(a.length / BLOCK_SIZE)
    if (!total) return { waveform: '', total: 0, duration: 0 }
    let [mins, maxs] = await a.stat(['min', 'max'], { bins: total, channel: 0 })
    return { waveform: statsToWavefont(mins, maxs), total, duration: a.duration }
  }

  return {
    async loadFile(file, onWaveform) {
      // string source: remote URL goes straight to the engine (fetched in worker),
      // anything else is a store id
      if (typeof file === 'string' && !/^(https?|data|blob):/.test(file)) {
        file = await store.getFile(file)
      }

      // fresh engine per file — frees all decoded PCM of the previous one
      a?.dispose()
      worker?.terminate()
      worker = new Worker(new URL('./engine-worker.js', import.meta.url), { type: 'module' })
      // f stays bound to this load — a concurrent loadFile reassigns `a`
      let f = a = audioWorker(file, { worker })

      // progressive render from stat deltas; emit strictly in block order —
      // if the 'data' subscription lands after decode started (FIFO race),
      // the missed prefix is healed by the full stat query below
      let next = 0, pending = new Map()
      f.on('data', ({ delta }) => {
        pending.set(delta.fromBlock, delta)
        while (pending.has(next)) {
          let d = pending.get(next)
          pending.delete(next)
          onWaveform(statsToWavefont(d.min[0], d.max[0]))
          next += d.max[0].length
        }
      })

      await f.ready

      let total = Math.ceil(f.length / BLOCK_SIZE)
      if (next < total) {
        let [mins, maxs] = await f.stat(['min', 'max'], { bins: total, channel: 0 })
        onWaveform(statsToWavefont(mins.subarray(next), maxs.subarray(next)))
      }

      return { duration: f.duration, channels: f.channels, sampleRate: f.sampleRate }
    },

    // playback window — PCM transferred from the engine, never retained here
    getWindow(fromSample, toSample) {
      if (!a) return null
      let sr = a.sampleRate
      return a.read({ at: fromSample / sr, duration: toSample != null ? (toSample - fromSample) / sr : undefined })
    },

    // edit ops — offsets in blocks, engine takes samples;
    // op history/redo lives in UI state (URL ops), engine just executes
    async removeRange(fromBlock, toBlock, { replace } = {}) {
      if (replace) await a.undo()
      await a.run(['remove', { offset: fromBlock * BLOCK_SIZE, length: (toBlock - fromBlock) * BLOCK_SIZE }])
      return refresh()
    },

    // apply a batch (URL reconstruction) — sequential ops, single re-render
    async removeRanges(ranges) {
      for (let [from, to] of ranges)
        await a.run(['remove', { offset: from * BLOCK_SIZE, length: (to - from) * BLOCK_SIZE }])
      return refresh()
    },

    async undoEdit() {
      let edit = await a.undo()
      return edit ? refresh() : null
    },

    async saveFile(file, meta) {
      return store.addFile(file, meta);
    },

    async getFiles(options) {
      return store.getFiles(options);
    }
  }
}
