// API layer connecting UI, engine worker and storage.
// The whole audio engine (decode, PCM pages, stats, edits) lives in the worker;
// main thread receives only stat deltas (waveform strings) and playback windows.

import audioWorker from 'audio/worker'
import { createStore } from './store/index.js'
import { statsToWavefont } from './waveform.js'
import { BLOCK_SIZE } from './constants.js'

export default function createApi({ store } = {}) {
  if (!store) store = createStore()

  let a = null, worker = null, redoStack = []

  // re-render full waveform + meta from engine state (edits applied)
  async function refresh() {
    let total = Math.ceil(a.length / BLOCK_SIZE)
    if (!total) return { waveform: '', total: 0, duration: 0 }
    let [mins, maxs] = await a.stat(['min', 'max'], { bins: total, channel: 0 })
    return { waveform: statsToWavefont(mins, maxs), total, duration: a.duration }
  }

  return {
    async loadFile(file, onWaveform) {
      if (typeof file === 'string') {
        file = await store.getFile(file)
      }

      // fresh engine per file — frees all decoded PCM of the previous one
      a?.dispose()
      worker?.terminate()
      redoStack = []
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

    // edit ops — offsets in blocks, engine takes samples; new edit clears redo
    async removeRange(fromBlock, toBlock) {
      await a.run(['remove', { offset: fromBlock * BLOCK_SIZE, length: (toBlock - fromBlock) * BLOCK_SIZE }])
      redoStack = []
      return refresh()
    },

    async undo() {
      let edit = await a.undo()
      if (!edit) return null
      redoStack.push(edit)
      return refresh()
    },

    async redo() {
      let edit = redoStack.pop()
      if (!edit) return null
      await a.run(edit)
      return refresh()
    },

    async saveFile(file, meta) {
      await store.addFile(file, meta);
    },

    async getFiles(options) {
      return store.getFiles(options);
    }
  }
}
