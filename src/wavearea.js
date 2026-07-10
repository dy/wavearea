// wavearea(el, config?) → state
// Audio waveform editor component

import sprae from 'sprae';
import template from './wavearea.html';
import { createSelection, cleanText, cleanToRaw, isBlock } from './selection.js';
import createApi from './api.js';
import { buildRawLines, windowRange } from './virtual.js';
import createPlayer from './player.js';
import { BLOCK_SIZE } from './constants.js';
import _smoothCaret from './layers/smooth-caret.js';
import _loopHighlight from './layers/loop-highlight.js';

// minimal mono 16-bit WAV — silence for blank docs, samples for recordings
function wavFile(samples, sr = 44100, name = 'audio.wav') {
  let n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf)
  let w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, 'data'); v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7FFF, true)
  return new File([buf], name, { type: 'audio/wav' })
}
const silentFile = (sec = 3, sr = 44100) => wavFile(new Float32Array(sec * sr), sr, 'silence.wav')

// URL query keys owned by the op chain
const OP_PARAMS = ['del', 'sil', 'clip', 'cp', 'ins', 'norm', 'gain', 'shrink', 'fadein', 'fadeout', 'br', 'm']

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
  let selection = createSelection(() => el.querySelector('#editarea'), () => state.winBase)
  let ensurePlayer = () => player ??= createPlayer(
    (from, to) => api.getWindow(from, to),
    { sampleRate: state.sampleRate, channels: state.channels, engine: _engine, blockSize: () => state.blockSize }
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
    filename: '',
    // display block size (samples per char) — zoom level; all block coords use it
    blockSize: BLOCK_SIZE,
    volume: Math.max(0, Math.min(1, +(localStorage.getItem('wavearea:volume') ?? initVolume) || 1)),
    speed: +(localStorage.getItem('wavearea:speed') ?? initSpeed) || 1,
    muted: false,

    // op defaults — resolved into each created op and serialized with it (no hidden state);
    // thr: silence threshold dB for shrink (null = engine auto), gainDb: last used gain
    settings: (() => {
      const DEFAULTS = { gap: 0.3, curve: 'linear', norm: 'peak', theme: 'auto', gainDb: 3, thr: null }
      try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('wavearea:settings') || '{}') } }
      catch { return { ...DEFAULTS } }
    })(),
    showSettings: false,

    // absolute sample peak of the timeline — >1 clips on export
    peak: 0,
    // export progress 0..1, null when not encoding
    progress: null,

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

    // segment breaks \u2014 block offsets in current timeline, rendered as '\n'
    _brs: [],
    // starting block of each visual line (wraps + segment breaks)
    lineOffsets: [],

    // virtualized rendering — full text lives here, DOM holds a line window
    _text: '',
    _rawLines: [],                       // raw index of each line start in _text
    _rawCursor: { raw: 0, blocks: 0 },   // resumable scan for append-only growth
    winStart: 0,                         // first rendered line
    winEnd: 0,                           // end rendered line (exclusive)
    winBase: 0,                          // block offset of the window start
    winLines: [],                        // rendered line indexes (timecodes)

    computeRawLines() {
      this._rawCursor = { raw: 0, blocks: 0 }
      this._rawLines = []
      buildRawLines(this._text, this.lineOffsets, this._rawLines, this._rawCursor)
    },

    extendRawLines() {
      buildRawLines(this._text, this.lineOffsets, this._rawLines, this._rawCursor)
    },

    // slice the visible window (± buffer) into the single text node;
    // spacers are padding on #editarea so the node structure never changes
    renderWindow(force) {
      let ea = this.refs.editarea
      if (!ea || this.isMouseDown) return  // don't swap text mid-drag
      let lineH = this._lineH || 70
      let lines = this.lines || 1
      // padding keeps the box top at the virtual line-0 origin
      let top = ea.getBoundingClientRect().top + scrollY
      let [first, last] = windowRange(scrollY, top, lineH, innerHeight, lines)
      let sameRange = first === this.winStart && last === this.winEnd
      if (!force && sameRange) return
      let rawS = this._rawLines[first] ?? this._text.length
      let rawE = last < this._rawLines.length ? this._rawLines[last] : this._text.length
      let slice = this._text.slice(rawS, rawE)
      let node = ea.firstChild
      let textChanged = node?.nodeType !== 3 || node.data !== slice
      if (node?.nodeType === 3) { if (textChanged) node.data = slice }
      else ea.textContent = slice
      ea.style.paddingTop = first * lineH + 'px'
      ea.style.paddingBottom = Math.max(0, lines - last) * lineH + 'px'
      this.winStart = first
      this.winEnd = last
      this.winBase = this.lineOffsets[first] ?? 0
      if (!sameRange || textChanged) this.winLines = Array.from({ length: last - first }, (_, i) => first + i)
      // a text swap drops the DOM selection — restore only then, so idle
      // re-renders (resize ticks) never clobber a live selection
      if (textChanged && !this.playing) {
        if (this.loop && this.clipEnd != null) this.selection.set(this.clipStart, this.clipEnd)
        else this.selection.set(this.caretOffset)
      }
    },

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
            if (isBlock(text[rawEnd])) clean++
            rawEnd++
            while (rawEnd < text.length && !isBlock(text[rawEnd])) rawEnd++
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
      this.computeLines(ea)
    },

    // visual lines = wrapped rows per segment
    computeLines(ea) {
      if (!this.total) {
        this.lineOffsets = [0]
        this.lines = ea ? this.countLines(ea) : 0
        return
      }
      let cols = this.cols || 1, offs = [], prev = 0
      for (let b of [...this._brs, this.total]) {
        for (let o = prev; o < b; o += cols) offs.push(o)
        prev = b
      }
      if (!offs.length) offs.push(0)
      this.lineOffsets = offs
      this.lines = offs.length
    },

    lineFromBlock(b) {
      let offs = this.lineOffsets
      if (!offs?.length) return Math.floor(b / (this.cols || 1))
      let i = offs.length - 1
      while (i > 0 && offs[i] > b) i--
      return i
    },

    // blank silence document — type (space), paste or drop into it
    openSilence(sec = 3) {
      return this.loadAudio(silentFile(sec), { save: true })
    },

    // bundled demo sample (forest sounds)
    openSample() {
      return this.loadAudio(new URL('birds-forest.mp3', location.href).href)
    },

    async loadAudio(file, { save, ops, brs, marks, markL, bs, session } = {}) {
      console.time('[loadAudio] loadAudio')
      this.loading = save ? 'Decoding' : 'Loading'
      this.error = null
      this.waveform = ''
      this.total = 0
      this.peak = 0
      this._ops = []
      this._redoOps = []
      this._brs = []
      this.marks = []
      this.markL = {}
      this._clip = null
      this._session = session ?? null
      this._text = ''
      this._rawLines = []
      this._rawCursor = { raw: 0, blocks: 0 }
      this.winStart = this.winEnd = this.winBase = 0
      this.winLines = []
      this.blockSize = bs || BLOCK_SIZE
      api.setBlockSize(this.blockSize)
      // store ids are `${timestamp}-${name}`, URLs keep their last path segment
      this.filename = file?.name ?? (typeof file === 'string' ? file.split('/').pop().replace(/^\d+-/, '') : 'audio')
      // clear stale edit chain from URL — unless we're about to reconstruct it
      if (!ops?.length && !brs?.length) this._syncURL()
      // create player eagerly DURING user gesture (Safari requires this for AudioContext)
      ensurePlayer()

      console.time('[render] decode + render')
      try {
        // accumulate into the state text, window-render per frame
        let pending = '', pendingClean = 0, flushId = null
        let flushPending = () => {
          flushId = null
          if (!pending) return
          this._text += pending
          this.total += pendingClean
          this.duration = this.total * BLOCK_SIZE / this.sampleRate
          pending = ''; pendingClean = 0
          if (!this.refs.editarea) { flushId = setTimeout(flushPending, 16); return }
          this.computeLines(this.refs.editarea)
          this.extendRawLines()
          this.renderWindow(true)
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
        this.peak = meta.peak ?? 0
        // wait for font + layout, retry until char width is measurable
        await document.fonts.ready
        for (let i = 0; i < 10 && !this._charW; i++) {
          await new Promise(r => requestAnimationFrame(r))
          this.measureWaveform()
        }
        // font metrics settled — re-window with the final line layout
        this.measureWaveform()
        this.computeRawLines()
        this.renderWindow(true)
        // reconstruct edit chain from URL ops
        if (ops?.length) {
          this._ops = ops
          this._applyEdit(await api.applyOps(ops), 0)
        } else if (this.blockSize !== BLOCK_SIZE) {
          // progressive render ran at engine granularity — re-render at zoom level
          this._applyEdit(await api.rerender(), 0)
        }
        // restore segment breaks (current-timeline coords, applied after ops)
        if (brs?.length) {
          this._brs = [...new Set(brs)].filter(b => b > 0 && b < this.total).sort((a, b) => a - b)
          if (this._brs.length) this._rerenderBreaks(0)
        }
        if (marks?.length) {
          this.marks = [...new Set(marks)].filter(b => b >= 0 && b < this.total).sort((a, b) => a - b)
          if (markL) this.markL = Object.fromEntries(this.marks.filter(b => markL[b] != null).map(b => [b, markL[b]]))
        }
        this.loading = false
        this._refreshMinimap()
        onload?.({ duration: meta.duration, sampleRate: meta.sampleRate, channels: meta.channels })
        // reopened stored file / remote URL — reflect source in URL
        if (typeof file === 'string') this._syncURL(file)
        // save in background — don't block UI
        if (save) api.saveFile(file, { name: file.name, duration: meta.duration })
          .then(id => this._syncURL(id))
          .catch(e => console.warn('[store] save failed:', e.message))
      } catch (err) {
        console.error('Failed to load file:', err)
        this.error = err.message || 'Failed to load file'
        this.total = 0
        this._text = ''
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
      player.setVolume(this.muted ? 0 : this.volume)
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

      return () => this.stop()
    },

    // playback speed cycles through fixed steps; live on the running source
    cycleSpeed() {
      const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
      this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length]
      localStorage.setItem('wavearea:speed', this.speed)
      if (player && this.playing) {
        // rebase interpolation — elapsed×speed assumes a constant rate
        this._playStartBlock = this.caretOffset
        this._playStartTime = player.currentTime
        player.setSpeed(this.speed)
      }
    },

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, +v || 0))
      if (this.volume > 0) this.muted = false
      localStorage.setItem('wavearea:volume', this.volume)
      player?.setVolume(this.muted ? 0 : this.volume)
    },

    toggleMute() {
      this.muted = !this.muted
      player?.setVolume(this.muted ? 0 : this.volume)
    },

    setSetting(k, v) {
      this.settings = { ...this.settings, [k]: v }
      localStorage.setItem('wavearea:settings', JSON.stringify(this.settings))
      if (k === 'theme') this._applyTheme()
    },

    _applyTheme() {
      let t = this.settings.theme
      if (t === 'auto') delete document.documentElement.dataset.theme
      else document.documentElement.dataset.theme = t
    },

    stop() {
      if (!player || !this.playing) return
      console.time('[stop]')
      player.pause()
      this.playing = false
      this._stopCaretAnimation()
      this.clipStart = this.caretOffset
      this.clipEnd = this.total
      this.loop = false
      this.selection.set(this.caretOffset)
      console.timeEnd('[stop]')
    },

    // minimap viewport tracking (scroll/resize update these signals)
    scrollFrac: 0,
    viewFrac: 1,

    _trackScroll() {
      let doc = document.documentElement
      let max = Math.max(1, doc.scrollHeight)
      this.scrollFrac = scrollY / max
      this.viewFrac = Math.min(1, innerHeight / max)
    },

    // redraw the whole-file minimap canvas from coarse stats
    async _refreshMinimap() {
      let cv = this.refs.minimap
      if (!cv || !this.total) return
      let w = cv.clientWidth || 300, h = cv.clientHeight || 24
      let dpr = devicePixelRatio || 1
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      let data = await api.overview(Math.max(32, Math.min(Math.round(w / 2), 800)))
      if (!data) return
      let { mins, maxs } = data
      let ctx = cv.getContext('2d')
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = getComputedStyle(cv).color
      let n = maxs.length, bw = Math.max(1, w / n - 0.5)
      for (let i = 0; i < n; i++) {
        let y0 = (1 - Math.min(1, Math.max(-1, maxs[i]))) / 2 * h
        let y1 = (1 - Math.min(1, Math.max(-1, mins[i]))) / 2 * h
        ctx.fillRect(i / n * w, y0, bw, Math.max(1, y1 - y0))
      }
      this._trackScroll()
    },

    // click/drag the minimap to scroll the document
    minimapSeek(e) {
      let el = this.refs.minimapBox
      let scroll = ev => {
        let r = el.getBoundingClientRect()
        let f = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width))
        scrollTo({ top: f * document.documentElement.scrollHeight - innerHeight / 2 })
      }
      scroll(e)
      let up = () => { removeEventListener('pointermove', scroll); removeEventListener('pointerup', up) }
      addEventListener('pointermove', scroll)
      addEventListener('pointerup', up)
    },

    // keyboard caret: arrows by block/line, Home/End, Ctrl+Left/Right by line start,
    // Shift extends from a sticky anchor
    _anchor: null,
    _head: null,
    caretKey(e) {
      if (!this.total) return
      let k = e.key
      // Ctrl/Cmd+Up/Down = marker navigation (separate handlers)
      if ((e.ctrlKey || e.metaKey) && (k === 'ArrowUp' || k === 'ArrowDown')) return
      e.preventDefault()
      let cols = this.cols || 1
      // live selection is the truth (clicks and programmatic moves don't sync state);
      // the sticky head survives only while it still matches an end of the selection
      let sel = this.selection.get()
      let head = sel
        ? (sel.collapsed ? sel.start
          : (this._head === sel.start || this._head === sel.end ? this._head : sel.end))
        : this.caretOffset
      if (sel?.collapsed || !sel) this._anchor = e.shiftKey ? (this._anchor ?? head) : null
      let li = this.lineFromBlock(head)
      let lineStart = this.lineOffsets[li] ?? 0
      let lineEnd = this.lineOffsets[li + 1] ?? this.total
      let next = head
      if (k === 'ArrowLeft') next = e.ctrlKey || e.metaKey ? (head > lineStart ? lineStart : (this.lineOffsets[li - 1] ?? 0)) : head - 1
      else if (k === 'ArrowRight') next = e.ctrlKey || e.metaKey ? lineEnd : head + 1
      else if (k === 'ArrowUp') next = li > 0 ? Math.min((this.lineOffsets[li - 1] ?? 0) + (head - lineStart), lineStart - 1) : 0
      else if (k === 'ArrowDown') next = li + 1 < this.lineOffsets.length ? Math.min((this.lineOffsets[li + 1] ?? 0) + (head - lineStart), (this.lineOffsets[li + 2] ?? this.total) - 1) : this.total
      else if (k === 'Home') next = e.ctrlKey || e.metaKey ? 0 : lineStart
      else if (k === 'End') next = e.ctrlKey || e.metaKey ? this.total : lineEnd
      else return
      next = Math.max(0, Math.min(next, this.total))
      if (e.shiftKey) {
        this._anchor ??= head
        this._head = next
        this._setSelRange(this._anchor, next)
      } else {
        this._anchor = null
        this._head = next
        this._setCaret(next)
      }
    },

    _setSelRange(anchor, head) {
      let [s, e] = anchor <= head ? [anchor, head] : [head, anchor]
      let line = this.lineFromBlock(head)
      if (line < this.winStart || line >= this.winEnd) this._scrollToLine(line)
      let sel = this.selection.set(s, e)
      this.caretOffset = head
      this.caretLine = line
      this.clipStart = s
      this.clipEnd = e
      this.loop = true
      let rects = sel?.range?.getClientRects()
      let rect = rects?.length ? rects[head >= anchor ? rects.length - 1 : 0] : null
      if (rect) { this.caretX = head >= anchor ? rect.right : rect.left; this.caretY = rect.top }
    },

    _scrollToLine(line) {
      let ea = this.refs.editarea
      if (!ea) return
      let top = ea.getBoundingClientRect().top + scrollY
      scrollTo({ top: Math.max(0, top + line * (this._lineH || 0) - innerHeight / 3) })
      this.renderWindow()
    },

    // true unless the event targets a text field — global single-key shortcuts guard
    _key(e) {
      return !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)
    },

    // markers — block offsets, shifted with edits like breaks; URL m=a..b
    // labels keyed by offset (m=120-intro..300), exported as WAV cue labl text
    marks: [],
    markL: {},

    // toggle marker at caret (m key)
    mark() {
      if (!this.total) return
      let sel = this.selection.get()
      let at = sel ? sel.start : this.caretOffset
      if (at < 0 || at >= this.total) return
      if (this.marks.includes(at)) {
        this.marks = this.marks.filter(x => x !== at)
        if (this.markL[at] != null) { let { [at]: _, ...rest } = this.markL; this.markL = rest }
      } else this.marks = [...this.marks, at].sort((a, b) => a - b)
      this._syncURL()
    },

    // dblclick a marker: edit its label in a floating input
    markEdit: null,
    markEditStart(b) {
      let inp = this.refs.markLabel
      if (!inp) return
      this.markEdit = b
      let p = this.markPos(b)
      inp.style.left = p.left
      inp.style.top = p.top
      inp.value = this.markL[b] ?? ''
      inp.hidden = false
      inp.focus()
    },

    setMarkLabel(b, label) {
      this.markEdit = null
      if (b == null || !this.marks.includes(b)) return
      label = String(label).trim()
      let L = { ...this.markL }
      if (label) L[b] = label
      else delete L[b]
      this.markL = L
      this._syncURL()
    },

    // jump to prev/next marker (Ctrl+Up/Down)
    markJump(dir) {
      if (!this.marks.length) return
      let sel = this.selection.get()
      let at = sel ? sel.start : this.caretOffset
      let next = dir > 0
        ? this.marks.find(x => x > at) ?? this.marks[0]
        : [...this.marks].reverse().find(x => x < at) ?? this.marks[this.marks.length - 1]
      this.jumpTo(next)
    },

    // move caret to block and scroll it into view
    jumpTo(block) {
      if (!this.total) return
      block = Math.max(0, Math.min(Math.round(block), this.total))
      this._setCaret(block)
      let sel = this.selection.set(block)
      let rect = sel?.range?.getClientRects()?.[0]
      if (rect && (rect.top < 0 || rect.bottom > innerHeight))
        scrollTo({ top: scrollY + rect.top - innerHeight / 3, behavior: 'smooth' })
      if (this.playing) this.seekTo(block)
    },

    // 'g': jump to typed time (h:mm:ss, m:ss or seconds)
    jumpToTime(str) {
      let m = String(str).trim().match(/^(?:(\d+):)?(?:(\d+):)?(\d+(?:\.\d+)?)$/)
      if (!m) return
      let [, a, b, c] = m
      let t = b != null ? (+a) * 3600 + (+b) * 60 + +c : (+(a || 0)) * 60 + +c
      this.jumpTo(t * this.sampleRate / this.blockSize)
    },

    // marker screen position (reads cols/lineOffsets signals for reactivity)
    markPos(b) {
      let line = this.lineFromBlock(b)
      let x = (b - (this.lineOffsets[line] ?? 0)) * (this._charW || 0)
      return { left: x + 'px', top: line * (this._lineH || 0) + 'px' }
    },

    // edits run through a queue — hold-repeat keys must see each other's result
    _editQ: null,
    _edit(fn) {
      if (this.loading) return
      return this._editQ = (this._editQ || Promise.resolve()).then(fn).catch(e => {
        console.error(e)
        this.error = e.message || 'Edit failed'
      })
    },

    // applied ops (URL-serialized state) + redo history — raw, not reactive.
    // op shapes: ['del', from, to] | ['sil', at, n] | ['cp', from, to, v, at]
    // cp references the timeline after its first v ops; op.clip holds the live snapshot
    _ops: [],
    _redoOps: [],
    _clip: null, // { from, to, v, clip } — invalidated when undo breaks the v prefix

    // finalize an op: snapshot & shift segment breaks + markers, push op, render, sync URL.
    // merged ops keep their original pre-burst snapshot and re-shift from it.
    _commit(op, r, caretAt, merge = false) {
      if (!merge) { op.brs = [...this._brs]; op.marks = [...this.marks]; op.marksL = { ...this.markL }; this._ops.push(op) }
      this._brs = this._shiftBrs(op, op.brs, r.total)
      ;[this.marks, this.markL] = this._shiftMarks(op, op.marks ?? this.marks, op.marksL ?? this.markL, r.total)
      this._redoOps.length = 0
      this._applyEdit(r, caretAt)
      this._syncURL()
    },

    // remap one block offset through an op; null = position removed by the op
    _shiftPos(op, x) {
      let [t, a, b] = op
      if (t === 'del') return x <= a ? x : x >= b ? x - (b - a) : null
      if (t === 'clip') return x > a && x < b ? x - a : null
      if (t === 'sil') return x > a ? x + b : x
      if (t === 'cp') return x > op[4] ? x + (op[2] - op[1]) : x
      if (t === 'ins') return x > a ? x + (op.len || 0) : x
      return x
    },

    // remap break offsets through an op; drops collapsed/out-of-range breaks
    _shiftBrs(op, brs, newTotal) {
      let out = op[0] === 'br'
        ? (op[2] > 0 ? [...brs, op[1]] : brs.filter(x => x !== op[1]))
        : brs.map(x => this._shiftPos(op, x)).filter(x => x != null)
      return [...new Set(out)].filter(x => x > 0 && x < newTotal).sort((p, q) => p - q)
    },

    // markers shift like breaks (offset 0 allowed); labels follow their mark
    _shiftMarks(op, marks, labels, newTotal) {
      let out = [], outL = {}
      for (let m of marks) {
        let x = op[0] === 'br' ? m : this._shiftPos(op, m)
        if (x == null || x < 0 || x >= newTotal || out.includes(x)) continue
        out.push(x)
        if (labels[m] != null) outL[x] = labels[m]
      }
      return [out.sort((p, q) => p - q), outL]
    },

    // dir: -1 = backspace (before caret), +1 = delete (after caret)
    // repeat: key held (KeyboardEvent.repeat) — merge the burst into one undo step
    del(dir, repeat) {
      if (!this.total) return
      return this._edit(async () => {
        let sel = this.selection.get()
        let from, to, merge = false
        let last = this._ops[this._ops.length - 1]
        if (sel && !sel.collapsed) [from, to] = [sel.start, sel.end]
        else {
          let at = sel ? sel.start : this.caretOffset
          // backspace at segment start joins segments instead of deleting audio
          if (dir < 0 && this._brs.includes(at)) return this._break(at, -1)
          if (dir < 0) { if (at <= 0) return; from = at - 1; to = at }
          else { if (at >= this.total) return; from = at; to = at + 1 }
          // merge a held-key burst into the last op — one undo step
          if (last?.[0] === 'del' && repeat) {
            if (dir < 0 && to === last[1]) { merge = true; last[1] = from }
            else if (dir > 0 && from === last[1]) { merge = true; last[2] += to - from }
          }
        }
        this.stop()
        if (!merge) last = ['del', from, to]
        this._commit(last, await api.removeRange(last[1], last[2], { replace: merge }), from, merge)
      })
    },

    // insert one block of silence at caret (typing into the document); repeat merges
    sil(repeat) {
      if (!this.total) return
      return this._edit(async () => {
        let sel = this.selection.get()
        let at = sel ? sel.start : this.caretOffset
        let last = this._ops[this._ops.length - 1]
        let merge = last?.[0] === 'sil' && repeat && at === last[1] + last[2]
        this.stop()
        if (merge) last[2]++
        else last = ['sil', at, 1]
        this._commit(last, await api.insertSilence(last[1], last[2], { replace: merge }), at + 1, merge)
      })
    },

    // Enter: split segment at caret; Backspace at segment start joins (see del)
    br() {
      if (!this.total) return
      return this._edit(async () => {
        let sel = this.selection.get()
        let at = sel ? sel.start : this.caretOffset
        if (at <= 0 || at >= this.total || this._brs.includes(at)) return
        this._break(at, 1)
      })
    },

    // visual-only break op: no engine edit, local re-render
    _break(at, dir) {
      this.stop()
      let op = ['br', at, dir]
      op.brs = [...this._brs]
      op.marks = [...this.marks]
      this._ops.push(op)
      this._brs = this._shiftBrs(op, op.brs, this.total)
      this._redoOps.length = 0
      this._rerenderBreaks(at)
      this._syncURL()
    },

    copy() {
      let sel = this.selection.get()
      if (!sel || sel.collapsed) return
      let { start: from, end: to } = sel
      return this._edit(async () => {
        this._clip = { from, to, v: this._ops.length, clip: await api.copyRange(from, to) }
      })
    },

    cut() {
      let sel = this.selection.get()
      if (!sel || sel.collapsed) return
      this.copy()
      return this.del(-1)
    },

    paste() {
      if (!this._clip || !this.total) return
      return this._edit(async () => {
        let { from, to, v, clip } = this._clip
        let sel = this.selection.get()
        let at = sel ? sel.start : this.caretOffset
        let op = ['cp', from, to, v, at]
        op.clip = clip
        this.stop()
        this._commit(op, await api.pasteClip(clip, at), at + (to - from))
      })
    },

    // insert a dropped audio file at the drop point (fallback: caret)
    drop(e) {
      let file = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('audio'))
      if (!file || !this.total) return
      let at = this.caretOffset
      // WebKit/Blink ship caretRangeFromPoint, Firefox the standard caretPositionFromPoint
      let node, off
      if (document.caretRangeFromPoint) {
        let r = document.caretRangeFromPoint(e.clientX, e.clientY)
        if (r) { node = r.startContainer; off = r.startOffset }
      } else if (document.caretPositionFromPoint) {
        let p = document.caretPositionFromPoint(e.clientX, e.clientY)
        if (p) { node = p.offsetNode; off = p.offset }
      }
      let ea = this.refs.editarea
      if (node?.nodeType === 3 && ea?.contains(node))
        at = this.winBase + cleanText(node.textContent.slice(0, off)).length
      return this._insertFile(at, file)
    },

    // save a file to the store and insert it at block position (drop, recording)
    _insertFile(at, file) {
      return this._edit(async () => {
        this.stop()
        let prev = this.total
        let id = await api.saveFile(file, { name: file.name })
        let r = await api.insertFile(at, id)
        let op = ['ins', at, id]
        op.src = r.src
        op.len = r.total - prev
        this._commit(op, r, at + op.len)
      })
    },

    // mic recording — toggles; stop inserts at caret, or opens as a new doc
    _recStop: null,
    async record() {
      if (this._recStop) return this._recStop()
      if (this.loading) return
      try {
        let stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        let ctx = new AudioContext()
        await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([`
          class R extends AudioWorkletProcessor {
            process(inputs) { if (inputs[0]?.[0]) this.port.postMessage(inputs[0][0].slice()); return true }
          }
          registerProcessor('rec', R)
        `], { type: 'application/javascript' })))
        let src = ctx.createMediaStreamSource(stream)
        let node = new AudioWorkletNode(ctx, 'rec', { numberOfOutputs: 0 })
        src.connect(node)
        let chunks = [], len = 0
        node.port.onmessage = e => { chunks.push(e.data); len += e.data.length }
        this.recording = '0:00'
        let timer = setInterval(() => {
          let sec = len / ctx.sampleRate
          this.recording = `${Math.floor(sec / 60)}:${String(Math.floor(sec) % 60).padStart(2, '0')}`
        }, 250)
        this._recStop = async () => {
          this._recStop = null
          clearInterval(timer)
          node.disconnect(); src.disconnect()
          stream.getTracks().forEach(t => t.stop())
          await ctx.close()
          this.recording = false
          if (!len) return
          let samples = new Float32Array(len), off = 0
          for (let c of chunks) { samples.set(c, off); off += c.length }
          let file = wavFile(samples, ctx.sampleRate, 'recording.wav')
          if (!this.total) return this.loadAudio(file, { save: true })
          let sel = this.selection.get()
          return this._insertFile(sel ? sel.start : this.caretOffset, file)
        }
      } catch (e) {
        console.error(e)
        this.recording = false
        this.error = e.message || 'Microphone unavailable'
      }
    },

    // trim to selection — keep only the selected range
    trim() {
      let range = this._selRange()
      if (!range) return
      return this._edit(async () => {
        this.stop()
        this._commit(['clip', range[0], range[1]], await api.cropRange(range[0], range[1]), 0)
      })
    },

    // compress silent pauses (truncate silence) — selection or whole file;
    // gap + silence threshold defaults from settings, serialized with the op
    // (op shape: [gap] | [f, t, gap], trailing negative element = threshold dB)
    shrink() {
      if (!this.total) return
      let range = this._selRange()
      let gapMs = Math.round((+this.settings.gap || 0.3) * 1000)
      let thr = this.settings.thr == null || this.settings.thr === '' ? null : Math.min(0, +this.settings.thr) || null
      return this._edit(async () => {
        this.stop()
        let op = range ? ['shrink', range[0], range[1], gapMs] : ['shrink', gapMs]
        if (thr != null) op.push(thr)
        this._commit(op, await api.shrink(range?.[0], range?.[1], gapMs / 1000, thr), range ? range[0] : 0)
      })
    },

    // decode a shrink op into api.shrink(from, to, gap, thr) args
    _shrinkArgs(op) {
      let nums = op.slice(1)
      let thr = nums[nums.length - 1] < 0 ? nums.pop() : null
      return nums.length > 1
        ? [nums[0], nums[1], (nums[2] ?? 300) / 1000, thr]
        : [null, null, (nums[0] ?? 300) / 1000, thr]
    },

    // amplify selection by dB (negative attenuates); value persists as the default
    gain(db) {
      let range = this._selRange()
      db = Math.round(+db * 10) / 10
      if (!range || !Number.isFinite(db) || !db) return
      db = Math.max(-24, Math.min(24, db))
      this.setSetting('gainDb', db)
      return this._edit(async () => {
        this.stop()
        this._commit(['gain', range[0], range[1], db], await api.gain(range[0], range[1], db), range[0])
      })
    },

    // normalize the whole file — target from settings (peak dB or LUFS preset)
    normalize() {
      if (!this.total) return
      let t = this.settings.norm
      return this._edit(async () => {
        this.stop()
        let op = !t || t === 'peak' ? ['norm'] : ['norm', t]
        this._commit(op, await api.normalize(op[1]), this.caretOffset)
      })
    },

    // fade the selection — dir: 1 = in, -1 = out; curve from settings
    fade(dir) {
      let range = this._selRange()
      if (!range) return
      let curve = this.settings.curve
      return this._edit(async () => {
        this.stop()
        let [from, to] = range
        let op = [dir > 0 ? 'fadein' : 'fadeout', from, to]
        if (curve && curve !== 'linear') op.push(curve)
        this._commit(op, await api.fadeRange(from, to, dir, op[3]), from)
      })
    },

    // current non-collapsed selection as [from, to] blocks, or null
    _selRange() {
      let sel = this.selection.get()
      if (sel && !sel.collapsed) return [sel.start, sel.end]
      if (this.loop && this.clipEnd != null && this.clipEnd > this.clipStart) return [this.clipStart, this.clipEnd]
      return null
    },

    // export as WAV/MP3/FLAC — selection if active, else whole timeline;
    // markers + segment breaks become cue points with labels (whole-file export only)
    async download(fmt = 'wav') {
      if (!this.total || this.loading) return
      this.loading = 'Encoding'
      this.progress = 0
      try {
        let sr = this.sampleRate, opts = {}
        let range = this._selRange()
        if (range) {
          opts.at = range[0] * this.blockSize / sr
          opts.duration = (range[1] - range[0]) * this.blockSize / sr
        } else if (this._brs.length || this.marks.length) {
          opts.markers = [
            ...this.marks.map((b, i) => ({ time: b * this.blockSize / sr, label: this.markL[b] ?? String(i + 1) })),
            ...this._brs.map(b => ({ time: b * this.blockSize / sr, label: '¶' })),
          ].sort((a, b) => a.time - b.time)
        }
        let bytes = await api.encode(fmt, opts, p => this.progress = p.total ? Math.min(1, p.offset / p.total) : null)
        const MIME = { wav: 'audio/wav', mp3: 'audio/mpeg', flac: 'audio/flac' }
        let blob = new Blob([bytes], { type: MIME[fmt] || 'application/octet-stream' })
        let link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${(this.filename || 'audio').replace(/\.[^.]+$/, '')}-edited.${fmt}`
        link.click()
        URL.revokeObjectURL(link.href)
      } catch (e) {
        console.error(e)
        this.error = e.message || 'Export failed'
      }
      this.progress = null
      this.loading = false
    },

    // zoom: change display block size (samples per char); coords rescale.
    // levels start at engine stats granularity (1024) — finer needs raw PCM stats
    zoom(dir) {
      if (!this.total || this.loading) return
      const LEVELS = [1024, 2048, 4096, 8192]
      let i = LEVELS.indexOf(this.blockSize)
      let ni = Math.max(0, Math.min(LEVELS.length - 1, i - dir))
      if (ni === i || i < 0) return
      return this._edit(async () => {
        this.stop()
        let ratio = this.blockSize / LEVELS[ni]
        this.blockSize = LEVELS[ni]
        api.setBlockSize(this.blockSize)
        let scale = x => Math.round(x * ratio)
        for (let op of [...this._ops, ...this._redoOps]) this._scaleOp(op, scale)
        this._brs = [...new Set(this._brs.map(scale))].filter(x => x > 0).sort((a, b) => a - b)
        let L = {}
        for (let m of this.marks) if (this.markL[m] != null) L[scale(m)] ??= this.markL[m]
        this.marks = [...new Set(this.marks.map(scale))].sort((a, b) => a - b)
        this.markL = L
        if (this._clip) this._clip = { ...this._clip, from: scale(this._clip.from), to: scale(this._clip.to) }
        this._applyEdit(await api.rerender(), scale(this.caretOffset))
        this._syncURL()
      })
    },

    // rescale an op's block coords in place (cp keeps its chain index v, br its
    // direction, shrink its gap/threshold, fades their curve, gain its dB)
    _scaleOp(op, s) {
      if (op[0] === 'cp') { op[1] = s(op[1]); op[2] = s(op[2]); op[4] = s(op[4]) }
      else if (op[0] === 'ins') { op[1] = s(op[1]); if (op.len) op.len = s(op.len) }
      else if (op[0] === 'shrink') { if (op.length - (op[op.length - 1] < 0 ? 1 : 0) > 2) { op[1] = s(op[1]); op[2] = s(op[2]) } }
      else if (op[0] === 'norm') {}
      else if (typeof op[1] === 'number') { op[1] = s(op[1]); if (typeof op[2] === 'number' && op[0] !== 'br') op[2] = s(op[2]) }
      if (op.brs) op.brs = op.brs.map(s)
      if (op.marks) {
        if (op.marksL) op.marksL = Object.fromEntries(Object.entries(op.marksL).map(([k, v]) => [s(+k), v]))
        op.marks = op.marks.map(s)
      }
    },

    undo() {
      return this._edit(async () => {
        let last = this._ops[this._ops.length - 1]
        if (!last) return
        if (last[0] === 'br') {
          this._redoOps.push(this._ops.pop())
          this._brs = last.brs
          this.stop()
          this._rerenderBreaks(last[1])
          this._syncURL()
          return
        }
        let r = await api.undoEdit()
        if (!r) return
        this._redoOps.push(this._ops.pop())
        this._brs = last.brs ?? this._brs
        this.marks = last.marks ?? this.marks
        this.markL = last.marksL ?? this.markL
        // clipboard referenced a chain state that no longer exists
        if (this._clip && this._ops.length < this._clip.v) this._clip = null
        this.stop()
        this._applyEdit(r, this.caretOffset)
        this._syncURL()
      })
    },

    redo() {
      return this._edit(async () => {
        let op = this._redoOps.pop()
        if (!op) return
        if (op[0] === 'br') {
          op.brs = [...this._brs]
          this._ops.push(op)
          this._brs = this._shiftBrs(op, op.brs, this.total)
          this.stop()
          this._rerenderBreaks(op[1])
          this._syncURL()
          return
        }
        this.stop()
        let r = op[0] === 'del' ? await api.removeRange(op[1], op[2])
          : op[0] === 'sil' ? await api.insertSilence(op[1], op[2])
          : op[0] === 'clip' ? await api.cropRange(op[1], op[2])
          : op[0] === 'ins' ? await api.pasteClip(op.src, op[1])
          : op[0] === 'norm' ? await api.normalize(op[1])
          : op[0] === 'gain' ? await api.gain(op[1], op[2], op[3])
          : op[0] === 'shrink' ? await api.shrink(...this._shrinkArgs(op))
          : op[0] === 'fadein' ? await api.fadeRange(op[1], op[2], 1, op[3])
          : op[0] === 'fadeout' ? await api.fadeRange(op[1], op[2], -1, op[3])
          : await api.pasteClip(op.clip, op[4])
        this._ops.push(op)
        this._brs = this._shiftBrs(op, op.brs ?? this._brs, r.total)
        ;[this.marks, this.markL] = this._shiftMarks(op, op.marks ?? this.marks, op.marksL ?? this.markL, r.total)
        this._applyEdit(r, op[0] === 'del' ? op[1] : op[0] === 'sil' ? op[1] + op[2] : op[0] === 'clip' ? 0 : op[0] === 'cp' ? op[4] : op[1] ?? this.caretOffset)
        this._syncURL()
      })
    },

    // URL is the state: ?src=<store id | remote url>&del=f-t&sil=at-n&cp=f-t-v-at&br=a..b
    // repeated op params, document order = application order; br is a separate
    // visual-only list in current-timeline coords; shrink threshold rides as _dB
    // magnitude, marker labels as -label suffixes (URL-encoded, dots %2E-escaped
    // to survive the .. separator) — all separators stay literal in the query
    _syncURL(src) {
      let url = new URL(location.href)
      if (src != null) url.searchParams.set('src', src)
      if (this.blockSize !== BLOCK_SIZE) url.searchParams.set('bs', this.blockSize)
      else url.searchParams.delete('bs')
      for (let k of [...OP_PARAMS, 'session']) url.searchParams.delete(k)
      for (let op of this._ops) if (op[0] !== 'br') {
        let parts = op.slice(1)
        let thr = op[0] === 'shrink' && parts[parts.length - 1] < 0 ? -parts.pop() : null
        url.searchParams.append(op[0], parts.join('-') + (thr ? '_' + thr : ''))
      }
      if (this._brs.length) url.searchParams.set('br', this._brs.join('..'))
      if (this.marks.length) url.searchParams.set('m', this.marks.map(b =>
        this.markL[b] != null ? b + '-' + encodeURIComponent(this.markL[b]).replace(/\./g, '%2E') : b).join('..'))
      // long chains: park the ops in a stored session, keep the URL short
      if (this._ops.length > 50 || url.search.length > 1500) {
        for (let k of OP_PARAMS) url.searchParams.delete(k)
        this._session ??= Date.now().toString(36)
        localStorage.setItem('wavearea:session:' + this._session, JSON.stringify({
          ops: this._ops.filter(o => o[0] !== 'br').map(o => [...o]),
          brs: [...this._brs], marks: [...this.marks], markL: { ...this.markL },
        }))
        url.searchParams.set('session', this._session)
      } else if (this._session) {
        localStorage.removeItem('wavearea:session:' + this._session)
        this._session = null
      }
      history.replaceState(null, '', url)
    },

    // splice '\n' at break offsets into a break-less wavefont string
    _withBreaks(str) {
      if (!this._brs.length) return str
      let out = '', prevRaw = 0
      for (let b of this._brs) {
        let raw = cleanToRaw(str, b)
        out += str.slice(prevRaw, raw) + '\n'
        prevRaw = raw
      }
      return out + str.slice(prevRaw)
    },

    // re-render current waveform text with updated breaks (no engine round-trip)
    _rerenderBreaks(at) {
      this._text = this._withBreaks(this._text.replace(/\n/g, ''))
      this.measureWaveform()
      this.computeRawLines()
      this.renderWindow(true)
      this._setCaret(at)
    },

    _applyEdit({ waveform, total, duration, peak }, at) {
      this.total = total
      this.duration = duration
      if (peak != null) this.peak = peak
      this._text = this._withBreaks(waveform)
      this.measureWaveform()
      this.computeRawLines()
      this.renderWindow(true)
      this._setCaret(at)
      this._refreshMinimap()
    },

    _setCaret(at) {
      let caret = Math.max(0, Math.min(at, this.total))
      this.caretOffset = caret
      this.caretLine = this.lineFromBlock(caret)
      // bring the caret's line into the rendered window
      if (this.caretLine < this.winStart || this.caretLine >= this.winEnd) this._scrollToLine(this.caretLine)
      this.clipStart = caret
      this.clipEnd = this.total
      this.loop = false
      let sel = this.selection.set(caret)
      let rect = sel?.range?.getClientRects()
      rect = rect?.[rect.length - 1]
      if (rect) { this.caretX = rect.right; this.caretY = rect.top }
    },

    _userScrolled: false,

    _startCaretAnimation() {
      this._userScrolled = false
      let mouseWait = 0
      let animate = () => {
        if (!this.playing || !player) return

        // pause caret while mouse is down + 2 frames after release
        // (lets throttled click handler read selection before animation overwrites it)
        if (this.isMouseDown) { mouseWait = 2; this._rafId = requestAnimationFrame(animate); return }
        if (mouseWait > 0) { mouseWait--; this._rafId = requestAnimationFrame(animate); return }

        let elapsed = player.currentTime - this._playStartTime
        let blocksMoved = Math.floor(elapsed * this.sampleRate / this.blockSize * this.speed)
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
              this.caretLine = this.lineFromBlock(block)
              // auto-scroll: follow the playing caret unless the user scrolled
              // away; resume once the caret is back in view. (WebKit returns no
              // rects for some collapsed ranges — no rect, no scroll decision.)
              let vis = rect.top >= 0 && rect.bottom <= innerHeight - 40
              if (vis) this._userScrolled = false
              else if (!this._userScrolled) this._scrollToLine(this.lineFromBlock(block))
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
      let time = block * this.blockSize / this.sampleRate || 0
      let hr = Math.floor(time / 3600), min = Math.floor(time / 60) % 60, sec = Math.floor(time) % 60
      let head = hr ? `${hr}:${String(min).padStart(2, '0')}` : `${min}`
      return `${head}:${String(sec).padStart(2, '0')}${ms ? `.${(time % 1).toFixed(ms).slice(2)}` : ''}`
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
        while (pos < str.length && !isBlock(str[pos])) pos++
        range.setStart(textNode, 0), range.setEnd(textNode, pos)
        let rects = range.getClientRects()
        if (rects[rects.length - 1].y > y) right = mid - 1; else left = mid;
      }

      let count = 0
      for (let i = 0; i < left; i++) if (isBlock(str[i])) count++
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

  state._applyTheme()

  // auto-load src from option or URL; op params reconstruct the edit chain
  let params = new URLSearchParams(location.search)
  src ??= params.get('src')
  if (src) {
    const ARITY = { del: 2, sil: 2, clip: 2, cp: 4 }
    const CURVES = ['linear', 'exp', 'log', 'cos']
    let ops = []
    for (let [k, v] of params) {
      if (k === 'norm') { ops.push(v ? ['norm', v] : ['norm']); continue }
      if (k === 'gain') {
        // f-t-db, db signed/fractional
        let m = v.match(/^(\d+)-(\d+)-(-?\d+(?:\.\d+)?)$/)
        if (m && +m[1] <= +m[2] && Math.abs(+m[3]) <= 24) ops.push(['gain', +m[1], +m[2], +m[3]])
        continue
      }
      if (k === 'shrink') {
        // shrink=[gapMs] | f-t[-gapMs], optional _thr silence threshold (dB below 0)
        let [body, thrS] = v.split('_')
        let nums = body === '' ? [] : body.split('-').map(Number)
        if (!nums.every(n => Number.isInteger(n) && n >= 0)) continue
        let op
        if (nums.length <= 1) op = ['shrink', nums[0] ?? 300]
        else if (nums.length <= 3) op = ['shrink', nums[0], nums[1], nums[2] ?? 300]
        else continue
        if (thrS && +thrS > 0 && +thrS <= 120) op.push(-+thrS)
        ops.push(op)
        continue
      }
      if (k === 'fadein' || k === 'fadeout') {
        // f-t[-curve]
        let parts = v.split('-')
        let f = Number(parts[0]), t = Number(parts[1])
        if (!Number.isInteger(f) || !Number.isInteger(t) || f < 0 || t < f) continue
        let op = [k, f, t]
        if (parts[2] && CURVES.includes(parts[2])) op.push(parts[2])
        ops.push(op)
        continue
      }
      if (k === 'ins') {
        // ins=<at>-<store id> — the id itself may contain dashes
        let i = v.indexOf('-')
        let at = Number(v.slice(0, i))
        let id = v.slice(i + 1)
        if (Number.isInteger(at) && at >= 0 && id) ops.push(['ins', at, id])
        continue
      }
      if (!ARITY[k]) continue
      let nums = v.split('-').map(Number)
      if (nums.length === ARITY[k] && nums.every(n => Number.isInteger(n) && n >= 0)) ops.push([k, ...nums])
    }
    let brs = (params.get('br') || '').split('..').map(Number).filter(n => Number.isInteger(n) && n > 0)
    // m=120..300-label — optional -label per mark (URL-encoded, dots as %2E)
    let marks = [], markL = {}
    for (let part of (params.get('m') || '').split('..')) {
      let pm = part.match(/^(\d+)(?:-(.*))?$/)
      if (!pm) continue
      let b = +pm[1]
      marks.push(b)
      if (pm[2] != null) { try { markL[b] = decodeURIComponent(pm[2]) } catch {} }
    }
    // parked session takes over the op chain
    let session = params.get('session')
    if (session) {
      try {
        let st = JSON.parse(localStorage.getItem('wavearea:session:' + session) || 'null')
        if (!st) session = null
        else { ops = st.ops; brs = st.brs || []; marks = st.marks || []; markL = st.markL || {} }
      } catch {}
    }
    // a cp op may only reference the chain prefix before its own position
    ops = ops.filter((op, i) => op[0] !== 'cp' || op[3] <= i)
    let bs = [1024, 2048, 4096, 8192].includes(+params.get('bs')) ? +params.get('bs') : undefined
    state.loadAudio(src, { ops, brs, marks, markL, bs, session })
  }

  return state
}
