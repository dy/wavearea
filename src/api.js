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
  // display block size — zoom level; ops/caret/URL coords are in bs units
  let bs = BLOCK_SIZE

  // re-render full waveform + meta from engine state (edits applied)
  async function refresh() {
    let total = Math.ceil(a.length / bs)
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
    // op history/redo lives in UI state (URL ops), engine executes 1 edit per op
    async removeRange(fromBlock, toBlock, { replace } = {}) {
      if (replace) await a.undo()
      await a.run(['remove', { offset: fromBlock * bs, length: (toBlock - fromBlock) * bs }])
      return refresh()
    },

    async insertSilence(atBlock, nBlocks, { replace } = {}) {
      if (replace) await a.undo()
      await a.run(['insert', { source: nBlocks * bs / a.sampleRate, offset: atBlock * bs }])
      return refresh()
    },

    // trim to selection — keep only the range
    async cropRange(fromBlock, toBlock) {
      await a.run(['crop', { offset: fromBlock * bs, length: (toBlock - fromBlock) * bs }])
      return refresh()
    },

    // peak-normalize the whole file (target gain derives from full stats)
    async normalize() {
      await a.run(['normalize', {}])
      return refresh()
    },

    // fade over a range — dir: 1 = in, -1 = out
    async fadeRange(fromBlock, toBlock, dir) {
      await a.run(['fade', { in: dir * (toBlock - fromBlock) * bs / a.sampleRate, offset: fromBlock * bs }])
      return refresh()
    },

    // encode current timeline (edits applied); markers become WAV cue points
    encode(format, opts) {
      return a.encode(format, opts)
    },

    // clipboard — clone+crop snapshots the current timeline range, sample-precise
    // (clip() takes seconds and can drift ±1 sample → a stray partial block)
    async copyRange(fromBlock, toBlock) {
      let c = await a.clone()
      await c.run(['crop', { offset: fromBlock * bs, length: (toBlock - fromBlock) * bs }])
      return c
    },

    async pasteClip(clip, atBlock) {
      await a.run(['insert', { source: clip, offset: atBlock * bs }])
      return refresh()
    },

    // insert an external stored file at position — opens a second instance
    // on the same engine worker, inserted by ref
    async insertFile(atBlock, id) {
      let b = audioWorker(await store.getFile(id), { worker })
      await b.ready
      await a.run(['insert', { source: b, offset: atBlock * bs }])
      let r = await refresh()
      r.src = b
      return r
    },

    setBlockSize(v) { bs = v },

    // full re-render at the current block size (zoom change, post-load)
    rerender() { return refresh() },

    // coarse whole-file min/max for the minimap
    async overview(bins) {
      if (!a?.length) return null
      let [mins, maxs] = await a.stat(['min', 'max'], { bins, channel: 0 })
      return { mins, maxs }
    },

    async undoEdit() {
      let edit = await a.undo()
      return edit ? refresh() : null
    },

    // replay an op chain (URL reconstruction) — sequential, single re-render.
    // cp ops reference the timeline state after their first v ops: clips for
    // v === k are snapshotted right before op k applies.
    async applyOps(ops) {
      let sr = a.sampleRate
      let clipAt = new Map() // v → [cp ops]
      for (let op of ops) if (op[0] === 'cp') {
        if (!clipAt.has(op[3])) clipAt.set(op[3], [])
        clipAt.get(op[3]).push(op)
      }
      let clips = new Map() // cp op → clip facade
      for (let k = 0; k <= ops.length; k++) {
        for (let cp of clipAt.get(k) || []) {
          let c = await a.clone()
          await c.run(['crop', { offset: cp[1] * bs, length: (cp[2] - cp[1]) * bs }])
          clips.set(cp, c)
        }
        if (k === ops.length) break
        let [type, ...args] = ops[k]
        if (type === 'del') await a.run(['remove', { offset: args[0] * bs, length: (args[1] - args[0]) * bs }])
        else if (type === 'sil') await a.run(['insert', { source: args[1] * bs / sr, offset: args[0] * bs }])
        else if (type === 'clip') await a.run(['crop', { offset: args[0] * bs, length: (args[1] - args[0]) * bs }])
        else if (type === 'cp') await a.run(['insert', { source: clips.get(ops[k]), offset: args[3] * bs }])
        else if (type === 'ins') {
          let b = audioWorker(await store.getFile(args[1]), { worker })
          await b.ready
          await a.run(['insert', { source: b, offset: args[0] * bs }])
        }
        else if (type === 'norm') await a.run(['normalize', {}])
        else if (type === 'fadein' || type === 'fadeout') {
          let d = (type === 'fadein' ? 1 : -1) * (args[1] - args[0]) * bs / sr
          await a.run(['fade', { in: d, offset: args[0] * bs }])
        }
      }
      return refresh()
    },

    async saveFile(file, meta) {
      return store.addFile(file, meta);
    },

    async getFiles(options) {
      return store.getFiles(options);
    }
  }
}
