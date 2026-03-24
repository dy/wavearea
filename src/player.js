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

export default function createPlayer(getWindow, { sampleRate = 44100, channels = 1, engine } = {}) {
  if (engine) return engines[engine](getWindow, sampleRate, channels)
  if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
    return bufferPlayer(getWindow, sampleRate, channels)
  }
  return audioElPlayer(getWindow, sampleRate, channels)
}

export { bufferPlayer, audioElPlayer, workletPlayer }


// Primary backend: AudioBufferSourceNode
const FADE_TIME = 0.015 // 15ms fade in/out to eliminate clicks
const MAX_BUFFER_SEC = 10 // cap AudioBuffer — Safari postMessage is slow for large transfers

function bufferPlayer(getWindow, sr, ch) {
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
  let speed = 1
  let loopStartBlock = 0, loopEndBlock = 0, isLooping = false
  let playAbort = false // flag to cancel pending async play
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
      if (source) {
        fadeTo(0)
        source.onended = null
        source.stop(ctx.currentTime + FADE_TIME)
      }

      loopStartBlock = fromBlock
      loopEndBlock = toBlock
      isLooping = loop

      let fromSample = fromBlock * BLOCK_SIZE
      let toSample = toBlock != null ? toBlock * BLOCK_SIZE : undefined

      // cap buffer size for responsiveness
      let maxSamples = loop ? undefined : MAX_BUFFER_SEC * sr
      if (maxSamples && toSample != null && toSample - fromSample > maxSamples) toSample = fromSample + maxSamples
      else if (maxSamples && toSample == null) toSample = fromSample + maxSamples

      let pcm = getWindow(fromSample, toSample)
      if (pcm?.then) pcm = await pcm
      if (playAbort) return
      if (!pcm || !pcm[0]?.length) return

      let frames = pcm[0].length
      let buf = ctx.createBuffer(ch, frames, sr)
      for (let i = 0; i < ch; i++) buf.copyToChannel(pcm[i] || pcm[0], i)

      source = ctx.createBufferSource()
      source.buffer = buf
      source.playbackRate.value = speed
      source.loop = loop
      if (loop) {
        source.loopStart = 0
        source.loopEnd = frames / sr
      }
      source.connect(gain)

      let cappedEnd = toSample != null ? Math.ceil(toSample / BLOCK_SIZE) : toBlock
      source.onended = () => {
        if (player.state === 'playing') {
          if (loop) return
          // if we capped the buffer, auto-continue from where we left off
          if (cappedEnd && loopEndBlock && cappedEnd < loopEndBlock) {
            player.play(cappedEnd, loopEndBlock, false)
            return
          }
          player.state = 'stopped'
          source = null
          player.onended?.()
        }
      }

      // fade in from silence
      gain.gain.setValueAtTime(0, ctx.currentTime)
      fadeTo(vol)
      source.start(0)
      console.timeEnd('[bufferPlayer.play]')
      player.state = 'playing'
      player.onstarted?.({ block: fromBlock, time: ctx.currentTime })
    },

    pause() {
      playAbort = true
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
    },

    destroy() {
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
function audioElPlayer(getWindow, sr, ch) {
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

      let fromSample = fromBlock * BLOCK_SIZE
      let toSample = toBlock != null ? toBlock * BLOCK_SIZE : undefined

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
function workletPlayer(getWindow, sr, ch) {
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

      let fromSample = fromBlock * BLOCK_SIZE
      let toSample = toBlock != null ? toBlock * BLOCK_SIZE : undefined

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
