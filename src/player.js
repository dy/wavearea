// Playback engine — thin interface over 2 backends
// Primary: AudioBufferSourceNode (works everywhere incl iOS)
// Fallback: <audio> element (no AudioContext — encodes WAV blob)
// Future: AudioWorklet (Phase 3 — effects, crossfade, recording)

const BLOCK_SIZE = 1024

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

export default function createPlayer(getWindow, { sampleRate = 44100, channels = 1 } = {}) {
  if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
    return bufferPlayer(getWindow, sampleRate, channels)
  }
  return audioElPlayer(getWindow, sampleRate, channels)
}

// force a specific backend (for testing)
export { bufferPlayer, audioElPlayer }


// Primary backend: AudioBufferSourceNode
function bufferPlayer(getWindow, sr, ch) {
  let ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: sr })
  let gain = ctx.createGain()
  gain.connect(ctx.destination)

  let source = null
  let speed = 1
  let loopStartBlock = 0, loopEndBlock = 0, isLooping = false
  let player = {
    state: 'stopped',
    onstarted: null,
    onlooped: null,
    onended: null,

    async play(fromBlock = 0, toBlock, loop = false) {
      if (ctx.state === 'suspended') await ctx.resume()

      // stop previous
      if (source) { try { source.stop() } catch {} }

      loopStartBlock = fromBlock
      loopEndBlock = toBlock
      isLooping = loop

      let fromSample = fromBlock * BLOCK_SIZE
      let toSample = toBlock != null ? toBlock * BLOCK_SIZE : undefined

      let pcm = await getWindow(fromSample, toSample)
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

      source.onended = () => {
        if (player.state === 'playing' && !loop) {
          player.state = 'stopped'
          source = null
          player.onended?.()
        }
      }

      source.start(0)
      player.state = 'playing'
      player.onstarted?.({ block: fromBlock, time: ctx.currentTime })
    },

    pause() {
      if (source && player.state === 'playing') {
        source.stop()
        source = null
        player.state = 'paused'
      }
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
      gain.gain.value = v
    },

    setSpeed(r) {
      speed = r
      if (source) source.playbackRate.value = r
    },

    destroy() {
      if (source) { try { source.stop() } catch {} }
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
  let loopStartBlock = 0, loopEndBlock = 0, isLooping = false
  let startBlock = 0

  let player = {
    state: 'stopped',
    onstarted: null,
    onlooped: null,
    onended: null,

    async play(fromBlock = 0, toBlock, loop = false) {
      // revoke previous blob
      if (blobUrl) URL.revokeObjectURL(blobUrl)

      startBlock = fromBlock
      loopStartBlock = fromBlock
      loopEndBlock = toBlock
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

    setLoop(s, e) {
      loopStartBlock = s
      loopEndBlock = e
      el.loop = true
    },
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
    get loopStart() { return loopStartBlock },
    get loopEnd() { return loopEndBlock },
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
