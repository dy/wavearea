// Playback engine — thin interface over 2 backends
// Primary: AudioBufferSourceNode (works everywhere incl iOS)
// Fallback: <audio> element (no AudioContext — encodes WAV blob)
// Future: AudioWorklet (Phase 3 — effects, crossfade, recording)

import { BLOCK_SIZE } from './constants.js'

// engine interface:
//   play(fromBlock, toBlock, loop) → void
//   pause() → void
//   seek(block) → void
//   setLoop(start, end) → void
//   setVolume(v) → void
//   setSpeed(r) → void
//   destroy() → void
//   state: 'stopped' | 'playing' | 'paused'
//   onstarted({block, time}) — emitted when playback starts
//   onlooped({block}) — emitted when loop restarts
//   onended() — emitted when playback reaches end

const engines = { buffer: bufferPlayer, audio: audioElPlayer, worklet: workletPlayer }

export default function createPlayer(getWindow, { sampleRate = 44100, channels = 1, engine, blockSize } = {}) {
  let gbs = blockSize ?? (() => BLOCK_SIZE)  // live accessor — zoom changes block size
  if (engine) return engines[engine](getWindow, sampleRate, channels, gbs)
  if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
    return bufferPlayer(getWindow, sampleRate, channels, gbs)
  }
  return audioElPlayer(getWindow, sampleRate, channels, gbs)
}

export { bufferPlayer, audioElPlayer, workletPlayer }


// Primary backend: AudioBufferSourceNode
const FADE_TIME = 0.015 // 15ms fade in/out to eliminate clicks
const MAX_BUFFER_SEC = 10 // cap AudioBuffer — Safari postMessage is slow for large transfers

function bufferPlayer(getWindow, sr, ch, gbs = () => BLOCK_SIZE) {
  let ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive', ...(sr ? { sampleRate: sr } : {}) })
  // warm up AudioContext + audio pipeline (Safari has cold-start latency)
  if (ctx.state === 'suspended') ctx.resume()
  // play silent buffer to prime the audio output path
  let warmup = ctx.createBufferSource()
  warmup.buffer = ctx.createBuffer(1, 1, sr)
  warmup.connect(ctx.destination)
  warmup.start(0)
  let gain = ctx.createGain()
  gain.connect(ctx.destination)
  let vol = 1

  let fadeTo = (v) => {
    gain.gain.cancelScheduledValues(ctx.currentTime)
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(v, ctx.currentTime + FADE_TIME)
  }

  let source = null
  let nextSrc = null   // prefetched continuation window, start()-scheduled at the seam
  let chainGen = 0     // invalidates in-flight prefetches
  let speed = 1
  let loopStartBlock = 0, loopEndBlock = 0, isLooping = false
  let playAbort = false // flag to cancel pending async play

  // fetch a window into a ready-to-start source node (capped at MAX_BUFFER_SEC,
  // block-aligned so consecutive windows are sample-contiguous at the seam)
  async function makeSource(fromBlock, toBlock, loop) {
    let fromSample = fromBlock * gbs()
    let toSample = toBlock != null ? toBlock * gbs() : undefined
    let maxSamples = loop ? undefined : Math.floor(MAX_BUFFER_SEC * sr / gbs()) * gbs()
    if (maxSamples && toSample != null && toSample - fromSample > maxSamples) toSample = fromSample + maxSamples
    else if (maxSamples && toSample == null) toSample = fromSample + maxSamples

    let pcm = getWindow(fromSample, toSample)
    if (pcm?.then) pcm = await pcm
    if (!pcm || !pcm[0]?.length) return null

    let frames = pcm[0].length
    let buf = ctx.createBuffer(ch, frames, sr)
    for (let i = 0; i < ch; i++) buf.copyToChannel(pcm[i] || pcm[0], i)

    let s = ctx.createBufferSource()
    s.buffer = buf
    s.playbackRate.value = speed
    s.loop = loop
    if (loop) { s.loopStart = 0; s.loopEnd = frames / sr }
    s.connect(gain)
    s._fromBlock = fromBlock
    s._endBlock = toSample != null ? Math.ceil(toSample / gbs()) : toBlock
    s._frames = frames
    return s
  }

  let killSrc = s => { if (!s) return; s.onended = null; try { s.stop() } catch {}; try { s.disconnect() } catch {} }

  // prefetch the next contiguous window and start() it at the exact seam —
  // gapless steady state; a mid-window speed change drops the schedule and
  // that one seam falls back to fetch-on-end
  function scheduleNext(cur) {
    let gen = ++chainGen
    makeSource(cur._endBlock, loopEndBlock, false).then(s => {
      if (!s) return
      if (gen !== chainGen || playAbort || source !== cur || player.state !== 'playing') return killSrc(s)
      let endAt = cur._startAt + cur._frames / sr / speed
      s._startAt = Math.max(endAt, ctx.currentTime)
      s._scheduled = true
      s.onended = () => onWindowEnd(s)
      s.start(s._startAt)
      nextSrc = s
    }).catch(() => {})
  }

  function dropScheduled() {
    chainGen++
    killSrc(nextSrc)
    nextSrc = null
  }

  function onWindowEnd(s) {
    if (player.state !== 'playing' || s !== source) return
    // seam: the scheduled next window is already sounding — promote it
    if (nextSrc?._scheduled) {
      source = nextSrc
      nextSrc = null
      player.onstarted?.({ block: source._fromBlock, time: source._startAt })
      if (source._endBlock != null && loopEndBlock != null && source._endBlock < loopEndBlock) scheduleNext(source)
      return
    }
    // no schedule (dropped by a speed change) — refetch, small one-time gap
    if (s._endBlock != null && loopEndBlock != null && s._endBlock < loopEndBlock) {
      player.play(s._endBlock, loopEndBlock, false)
      return
    }
    player.state = 'stopped'
    source = null
    player.onended?.()
  }

  let player = {
    state: 'stopped',
    onstarted: null,
    onlooped: null,
    onended: null,

    async play(fromBlock = 0, toBlock, loop = false) {
      playAbort = false
      console.time('[bufferPlayer.play]')
      if (ctx.state === 'suspended') await ctx.resume()
      if (playAbort) return

      // fade out + stop previous without triggering onended
      dropScheduled()
      if (source) {
        fadeTo(0)
        source.onended = null
        source.stop(ctx.currentTime + FADE_TIME)
      }

      loopStartBlock = fromBlock
      loopEndBlock = toBlock
      isLooping = loop

      let s = await makeSource(fromBlock, toBlock, loop)
      if (playAbort) return killSrc(s)
      if (!s) return

      source = s
      s._startAt = ctx.currentTime
      s.onended = () => onWindowEnd(s)

      // fade in from silence
      gain.gain.setValueAtTime(0, ctx.currentTime)
      fadeTo(vol)
      s.start(s._startAt)
      console.timeEnd('[bufferPlayer.play]')
      player.state = 'playing'
      player.onstarted?.({ block: fromBlock, time: s._startAt })
      if (!loop && s._endBlock != null && toBlock != null && s._endBlock < toBlock) scheduleNext(s)
    },

    pause() {
      playAbort = true
      dropScheduled()
      if (source && player.state === 'playing') {
        // fade out then disconnect (click-free stop)
        fadeTo(0)
        source.onended = null
        let s = source
        source = null
        // disconnect after fade completes
        setTimeout(() => { try { s.stop(); s.disconnect() } catch {} }, FADE_TIME * 1000 + 5)
      }
      player.state = 'paused'
    },

    seek(block) {
      let wasPlaying = player.state === 'playing'
      dropScheduled()
      if (source) { try { source.stop() } catch {} }
      source = null
      if (wasPlaying) player.play(block)
    },

    setLoop(start, end) {
      loopStartBlock = start
      loopEndBlock = end
    },

    setVolume(v) {
      vol = v
      fadeTo(v)
    },

    setSpeed(r) {
      speed = r
      if (source) source.playbackRate.value = r
      // projected seam moved — drop the schedule, that boundary refetches
      dropScheduled()
    },

    destroy() {
      dropScheduled()
      if (source) { source.onended = null; try { source.stop() } catch {} }
      source = null
      ctx.close()
      player.state = 'stopped'
    },

    get currentTime() { return ctx.currentTime },
    get sampleRate() { return sr },
    get loopStart() { return loopStartBlock },
    get loopEnd() { return loopEndBlock },
    get loop() { return isLooping }
  }

  return player
}


// encode PCM to WAV blob
function encodeWAV(pcm, sr, ch) {
  let frames = pcm[0].length
  let bytesPerSample = 2
  let dataLen = frames * ch * bytesPerSample
  let buf = new ArrayBuffer(44 + dataLen)
  let view = new DataView(buf)

  // RIFF header
  let writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)) }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataLen, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // subchunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, ch, true)
  view.setUint32(24, sr, true)
  view.setUint32(28, sr * ch * bytesPerSample, true)
  view.setUint16(32, ch * bytesPerSample, true)
  view.setUint16(34, bytesPerSample * 8, true)
  writeStr(36, 'data')
  view.setUint32(40, dataLen, true)

  // interleave channels and convert f32 → i16
  let off = 44
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      let s = Math.max(-1, Math.min(1, pcm[c]?.[i] || 0))
      view.setInt16(off, s * 0x7FFF, true)
      off += 2
    }
  }

  return new Blob([buf], { type: 'audio/wav' })
}


// Fallback backend: <audio> element with WAV blob
function audioElPlayer(getWindow, sr, ch, gbs = () => BLOCK_SIZE) {
  let el = document.createElement('audio')
  let blobUrl = null
  let speed = 1
  let startBlock = 0, isLooping = false

  let player = {
    state: 'stopped',
    onstarted: null,
    onlooped: null,
    onended: null,

    async play(fromBlock = 0, toBlock, loop = false) {
      if (blobUrl) URL.revokeObjectURL(blobUrl)

      startBlock = fromBlock
      isLooping = loop

      let fromSample = fromBlock * gbs()
      let toSample = toBlock != null ? toBlock * gbs() : undefined

      let pcm = await getWindow(fromSample, toSample)
      if (!pcm || !pcm[0]?.length) return

      let blob = encodeWAV(pcm, sr, ch)
      blobUrl = URL.createObjectURL(blob)
      el.src = blobUrl
      el.loop = loop
      el.playbackRate = speed
      await el.play()

      player.state = 'playing'
      player.onstarted?.({ block: fromBlock, time: performance.now() / 1000 })
    },

    pause() {
      el.pause()
      player.state = 'paused'
    },

    seek(block) {
      let wasPlaying = player.state === 'playing'
      el.pause()
      if (wasPlaying) player.play(block)
    },

    setLoop(start, end) { startBlock = start; el.loop = true },
    setVolume(v) { el.volume = v },
    setSpeed(r) {
      speed = r
      el.playbackRate = r
    },
    destroy() {
      el.pause()
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      el.src = ''
      player.state = 'stopped'
    },

    get currentTime() { return (performance.now() / 1000) },
    get sampleRate() { return sr },
    get loopStart() { return startBlock },
    get loopEnd() { return 0 },
    get loop() { return isLooping }
  }

  el.onended = () => {
    player.state = 'stopped'
    player.onended?.()
  }

  // loop event — <audio> fires 'seeked' when looping back
  el.onseeked = () => {
    if (el.loop && player.state === 'playing') {
      player.onlooped?.({ block: startBlock })
    }
  }

  return player
}


// AudioWorklet backend: streams PCM via worklet processor
function workletPlayer(getWindow, sr, ch, gbs = () => BLOCK_SIZE) {
  let ctx = new (window.AudioContext || window.webkitAudioContext)(sr ? { sampleRate: sr } : undefined)
  let gain = ctx.createGain()
  gain.connect(ctx.destination)
  let vol = 1

  let node = null
  let speed = 1
  let loopStartBlock = 0, loopEndBlock = 0, isLooping = false

  let ready = ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([`
    class P extends AudioWorkletProcessor {
      constructor() {
        super()
        this.buf = null
        this.pos = 0
        this.on = false
        this.loop = false
        this.port.onmessage = e => {
          if (e.data.cmd === 'load') { this.buf = e.data.pcm; this.pos = 0; this.on = true; this.loop = e.data.loop }
          else if (e.data.cmd === 'stop') { this.on = false }
        }
      }
      process(_, outputs) {
        if (!this.on || !this.buf) return true
        let out = outputs[0], n = out[0].length, len = this.buf[0].length
        for (let c = 0; c < out.length; c++) {
          let src = this.buf[c] || this.buf[0]
          for (let i = 0; i < n; i++) {
            let idx = this.pos + i
            out[c][i] = idx < len ? src[idx] : this.loop ? src[idx % len] : 0
          }
        }
        this.pos += n
        if (this.pos >= len) {
          if (this.loop) { this.pos = 0; this.port.postMessage('looped') }
          else { this.on = false; this.port.postMessage('ended') }
        }
        return true
      }
    }
    registerProcessor('pcm-player', P)
  `], { type: 'application/javascript' })))

  let player = {
    state: 'stopped',
    onstarted: null,
    onlooped: null,
    onended: null,

    async play(fromBlock = 0, toBlock, loop = false) {
      await ready
      if (ctx.state === 'suspended') await ctx.resume()

      // fade out + stop previous
      if (node) {
        gain.gain.setTargetAtTime(0, ctx.currentTime, FADE_TIME / 3)
        node.port.postMessage({ cmd: 'stop' })
        setTimeout(() => { try { node?.disconnect() } catch {} }, FADE_TIME * 1000)
        node = null
      }

      loopStartBlock = fromBlock
      loopEndBlock = toBlock
      isLooping = loop

      let fromSample = fromBlock * gbs()
      let toSample = toBlock != null ? toBlock * gbs() : undefined

      let pcm = await getWindow(fromSample, toSample)
      if (!pcm || !pcm[0]?.length) return

      node = new AudioWorkletNode(ctx, 'pcm-player', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [ch]
      })
      node.connect(gain)
      gain.gain.setTargetAtTime(vol, ctx.currentTime, FADE_TIME / 3)
      node.port.onmessage = e => {
        if (e.data === 'ended') {
          player.state = 'stopped'
          node?.disconnect()
          node = null
          player.onended?.()
        } else if (e.data === 'looped') {
          player.onlooped?.({ block: fromBlock })
        }
      }

      // transfer PCM buffers to worklet (zero-copy)
      let arrays = Array.from(pcm)
      node.port.postMessage({ cmd: 'load', pcm: arrays, loop }, arrays.map(a => a.buffer))

      player.state = 'playing'
      player.onstarted?.({ block: fromBlock, time: ctx.currentTime })
    },

    pause() {
      if (node && player.state === 'playing') {
        gain.gain.setTargetAtTime(0, ctx.currentTime, FADE_TIME / 3)
        node.port.postMessage({ cmd: 'stop' })
        let n = node; setTimeout(() => { try { n.disconnect() } catch {} }, FADE_TIME * 1000)
        node = null
        player.state = 'paused'
      }
    },

    seek(block) {
      let wasPlaying = player.state === 'playing'
      if (node) { node.port.postMessage({ cmd: 'stop' }); node.disconnect(); node = null }
      if (wasPlaying) player.play(block)
    },

    setLoop(start, end) {
      loopStartBlock = start
      loopEndBlock = end
    },

    setVolume(v) { vol = v; gain.gain.setTargetAtTime(v, ctx.currentTime, FADE_TIME / 3) },

    setSpeed(r) { speed = r },

    destroy() {
      if (node) { node.port.postMessage({ cmd: 'stop' }); node.disconnect() }
      node = null
      ctx.close()
      player.state = 'stopped'
    },

    get currentTime() { return ctx.currentTime },
    get sampleRate() { return sr },
    get loopStart() { return loopStartBlock },
    get loopEnd() { return loopEndBlock },
    get loop() { return isLooping }
  }

  return player
}
