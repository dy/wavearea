// wavearea(el, config?) → state
// Audio waveform editor component

import sprae from 'sprae';
import template from './wavearea.html';
import { createSelection, cleanText } from './selection.js';
import createApi from './api.js';
import createPlayer from './player.js';
import { BLOCK_SIZE } from './constants.js';
import _smoothCaret from './layers/smooth-caret.js';
import _loopHighlight from './layers/loop-highlight.js';

export default function wavearea(el, {
  src,
  readonly = true,
  caret = 'smooth',       // 'smooth' | 'native' | false
  loopHighlight = true,    // true | false | { color, name }
  engine = 'auto',         // 'auto' | 'buffer' | 'audio' | 'worklet'
  volume: initVolume = 1,
  speed: initSpeed = 1,
  store = 'auto',          // 'auto' | 'opfs' | 'idb' | 'memory' | adapter
  onload,
  onerror,
} = {}) {
  el.innerHTML = template

  let api = createApi({ store: typeof store === 'string' ? (store === 'auto' ? undefined : store) : store })
  let player = null
  let _engine = engine === 'auto' ? undefined : engine
  let selection = createSelection(() => el.querySelector('#editarea'))
  let ensurePlayer = () => player ??= createPlayer(
    (from, to) => api.getWindow(from, to),
    { sampleRate: state.sampleRate, channels: state.channels, engine: _engine }
  )

  let state = sprae(el, {
    // deps
    selection,
    cleanText,
    api,

    // refs
    refs: {},

    // layout
    waveform: '',
    lines: 0,
    cols: null,

    // mode
    loading: false,
    recording: false,
    playing: false,
    selecting: false,
    scrolling: false,
    error: null,

    isMouseDown: false,

    // audio
    duration: 0,
    sampleRate: 44100,
    channels: 1,
    volume: initVolume,
    speed: initSpeed,

    // total waveform characters (excluding combining marks)
    total: 0,

    // selection
    clipStart: 0,
    loop: false,
    clipEnd: null,

    // playback interpolation
    _playStartBlock: 0,
    _playStartTime: 0,
    _rafId: null,

    // caret
    caretOffscreen: 0,
    caretOffset: 0,
    caretLine: 0,
    caretY: 0,
    caretX: 0,

    // cached char metrics for timecode computation and cols/lines calculation
    _charW: 0,
    _lineH: 0,

    // measure editarea dimensions: char width, line height, cols per line, total lines
    measureWaveform() {
      let ea = this.refs.editarea
      if (!ea) return
      this._lineH = parseFloat(getComputedStyle(ea).lineHeight) || 20
      // measure char width: width of first N clean chars / N
      if (ea.firstChild) {
        let text = ea.firstChild.textContent
        let n = Math.min(10, cleanText(text).length)
        if (n > 0) {
          let rawEnd = 0, clean = 0
          while (clean < n && rawEnd < text.length) {
            if (text[rawEnd] < '\u0300') clean++
            rawEnd++
            while (rawEnd < text.length && text[rawEnd] >= '\u0300') rawEnd++
          }
          let r = new Range()
          r.setStart(ea.firstChild, 0)
          r.setEnd(ea.firstChild, rawEnd)
          let rect = r.getClientRects()[0]
          if (rect && n) this._charW = rect.width / n
        }
      }
      // cache editarea rect for animation
      this._eaRect = ea.getBoundingClientRect()
      // compute cols from char width (reliable even during loading)
      this.cols = this._charW ? Math.floor(this._eaRect.width / this._charW) || 1 : this.countCols(ea)
      this.lines = this.total ? Math.ceil(this.total / this.cols) : this.countLines(ea)
    },

    async loadAudio(file, { save } = {}) {
      console.time('[loadAudio] loadAudio')
      this.loading = save ? 'Decoding' : 'Loading'
      this.error = null
      this.waveform = ''
      this.total = 0
      // create player eagerly DURING user gesture (Safari requires this for AudioContext)
      ensurePlayer()

      console.time('[render] decode + render')
      try {
        // append to single text node, throttled adaptively
        let pending = '', pendingClean = 0, flushId = null
        let flushPending = () => {
          flushId = null
          if (!pending) return
          let ea = this.refs.editarea
          if (!ea) {
            this.total += pendingClean; pendingClean = 0
            this.duration = this.total * BLOCK_SIZE / this.sampleRate
            flushId = setTimeout(flushPending, 16)
            return
          }
          let node = ea.firstChild
          if (node && node.nodeType === 3) node.appendData(pending)
          else ea.textContent = pending
          this.total += pendingClean
          this.duration = this.total * BLOCK_SIZE / this.sampleRate
          pending = ''; pendingClean = 0
        }
        let meta = await api.loadFile(file, (str) => {
          pending += str
          pendingClean += cleanText(str).length
          if (!flushId) flushId = requestAnimationFrame(flushPending)
        })
        if (flushId) { cancelAnimationFrame(flushId); flushId = null }
        flushPending()
        console.timeEnd('[render] decode + render')
        this.duration = meta.duration
        this.sampleRate = meta.sampleRate
        this.channels = meta.channels
        // wait for font + layout, retry until char width is measurable
        await document.fonts.ready
        for (let i = 0; i < 10 && !this._charW; i++) {
          await new Promise(r => requestAnimationFrame(r))
          this.measureWaveform()
        }
        this.loading = false
        onload?.({ duration: meta.duration, sampleRate: meta.sampleRate, channels: meta.channels })
        // save in background — don't block UI
        if (save) api.saveFile(file, { name: file.name, duration: meta.duration }).catch(e => console.warn('[store] save failed:', e.message))
      } catch (err) {
        console.error('Failed to load file:', err)
        this.error = err.message || 'Failed to load file'
        this.total = 0
        let ea = this.refs.editarea
        if (ea) ea.textContent = ''
        this.loading = false
        onerror?.(err)
      }
      console.timeEnd('[loadAudio] loadAudio')
    },

    // caret moved
    seekTo(block, toBlock, looping) {
      if (!player || !this.playing) return
      this._stopCaretAnimation()
      if (toBlock == null) toBlock = this.total
      if (looping == null) looping = false
      player.onstarted = ({ block: b, time }) => {
        this._playStartBlock = b
        this._playStartTime = time
        this._startCaretAnimation()
      }
      player.onended = () => {
        this.playing = false
        this._stopCaretAnimation()
      }
      player.play(block, toBlock, looping)
    },

    play() {
      console.time('[play]')
      ensurePlayer()

      let fromBlock = this.loop ? this.clipStart : this.caretOffset
      let toBlock = this.clipEnd != null ? this.clipEnd : this.total
      let looping = this.loop

      this.selection.set(fromBlock)
      player.setVolume(this.volume)
      player.setSpeed(this.speed)

      player.onstarted = ({ block, time }) => {
        this._playStartBlock = block
        this._playStartTime = time
        this._startCaretAnimation()
        console.timeEnd('[play]')
      }
      player.onended = () => {
        this.playing = false
        this._stopCaretAnimation()
      }

      player.play(fromBlock, toBlock, looping)
      this.playing = true

      return () => {
        console.time('[stop]')
        player.pause()
        this.playing = false
        this._stopCaretAnimation()
        this.clipStart = this.caretOffset
        this.clipEnd = this.total
        this.loop = false
        this.selection.set(this.caretOffset)
        console.timeEnd('[stop]')
      }
    },

    _startCaretAnimation() {
      let mouseWait = 0
      let animate = () => {
        if (!this.playing || !player) return

        // pause caret while mouse is down + 2 frames after release
        // (lets throttled click handler read selection before animation overwrites it)
        if (this.isMouseDown) { mouseWait = 2; this._rafId = requestAnimationFrame(animate); return }
        if (mouseWait > 0) { mouseWait--; this._rafId = requestAnimationFrame(animate); return }

        let elapsed = player.currentTime - this._playStartTime
        let blocksMoved = Math.floor(elapsed * this.sampleRate / BLOCK_SIZE * this.speed)
        let block = this._playStartBlock + blocksMoved

        if (player.loop && player.loopEnd) {
          let loopLen = player.loopEnd - player.loopStart
          if (loopLen > 0 && block >= player.loopEnd) {
            block = player.loopStart + ((block - player.loopStart) % loopLen)
            this._playStartBlock = player.loopStart
            this._playStartTime = player.currentTime
          }
        }

        if (block !== this.caretOffset && block >= 0 && block < this.total) {
          this.caretOffset = block
          // use getClientRects for accurate position (safe: contenteditable off during playback)
          let sel = this.selection.set(block)
          if (sel?.range) {
            let rects = sel.range.getClientRects()
            let rect = rects[rects.length - 1]
            if (rect) {
              this.caretX = rect.right
              this.caretY = rect.top
              this.caretLine = Math.floor(block / (this.cols || 1))
            }
          }
        }
        this._rafId = requestAnimationFrame(animate)
      }
      this._rafId = requestAnimationFrame(animate)
    },

    _stopCaretAnimation() {
      if (this._rafId) {
        cancelAnimationFrame(this._rafId)
        this._rafId = null
      }
    },

    timecode(block, ms = 0) {
      let time = block * BLOCK_SIZE / this.sampleRate || 0
      let min = Math.floor(time / 60), sec = Math.floor(time) % 60
      return `${min}:${String(sec).padStart(2, '0')}${ms ? `.${(time % 1).toFixed(ms).slice(2)}` : ''}`
    },

    countLines(el) {
      let range = new Range
      range.selectNodeContents(el)
      let h = range.getBoundingClientRect().height
      let rects = range.getClientRects()
      return h && Math.round(h / rects[rects.length - 1].height)
    },

    countCols(el) {
      let range = new Range();
      let textNode = el.firstChild
      if (!textNode?.textContent) return
      let str = textNode.textContent

      range.setStart(textNode, 0), range.setEnd(textNode, 1)
      let y = range.getClientRects()[0].y

      let left = 0, right = str.length
      while (left < right) {
        let mid = Math.floor((left + right + 1) / 2)
        let pos = mid
        while (pos < str.length && str[pos] >= '\u0300') pos++
        range.setStart(textNode, 0), range.setEnd(textNode, pos)
        let rects = range.getClientRects()
        if (rects[rects.length - 1].y > y) right = mid - 1; else left = mid;
      }

      let count = 0
      for (let i = 0; i < left; i++) if (str[i] < '\u0300') count++
      return count
    }
  })

  // initialize visual layers
  let cleanups = []
  let layers = [
    caret === 'smooth' && _smoothCaret(typeof caret === 'object' ? caret : {}),
    loopHighlight && _loopHighlight(typeof loopHighlight === 'object' ? loopHighlight : {}),
  ].filter(Boolean)
  for (let layer of layers) {
    let cleanup = layer(state, el)
    if (cleanup) cleanups.push(cleanup)
  }

  state[Symbol.dispose] = () => cleanups.forEach(fn => fn())

  // auto-load src if provided
  if (src) state.loadAudio(src)

  return state
}
