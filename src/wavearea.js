// wavearea(el, config?) → state
// Audio waveform editor component

import sprae from 'sprae';
import template from './wavearea.html';
import { createSelection, cleanText, cleanToRaw, isBlock } from './selection.js';
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

    // segment breaks \u2014 block offsets in current timeline, rendered as '\n'
    _brs: [],
    // starting block of each visual line (wraps + segment breaks)
    lineOffsets: [],

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

    async loadAudio(file, { save, ops, brs } = {}) {
      console.time('[loadAudio] loadAudio')
      this.loading = save ? 'Decoding' : 'Loading'
      this.error = null
      this.waveform = ''
      this.total = 0
      this._ops = []
      this._redoOps = []
      this._brs = []
      this._clip = null
      // clear stale edit chain from URL — unless we're about to reconstruct it
      if (!ops?.length && !brs?.length) this._syncURL()
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
        // reconstruct edit chain from URL ops
        if (ops?.length) {
          this._ops = ops
          this._applyEdit(await api.applyOps(ops), 0)
        }
        // restore segment breaks (current-timeline coords, applied after ops)
        if (brs?.length) {
          this._brs = [...new Set(brs)].filter(b => b > 0 && b < this.total).sort((a, b) => a - b)
          if (this._brs.length) this._rerenderBreaks(0)
        }
        this.loading = false
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

      return () => this.stop()
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

    // finalize an op: snapshot & shift segment breaks, push op, render, sync URL.
    // merged ops keep their original pre-burst snapshot and re-shift from it.
    _commit(op, r, caretAt, merge = false) {
      if (!merge) { op.brs = [...this._brs]; this._ops.push(op) }
      this._brs = this._shiftBrs(op, op.brs, r.total)
      this._redoOps.length = 0
      this._applyEdit(r, caretAt)
      this._syncURL()
    },

    // remap break offsets through an op; drops collapsed/out-of-range breaks
    _shiftBrs(op, brs, newTotal) {
      let [t, a, b] = op, out
      if (t === 'del') out = brs.filter(x => x <= a || x >= b).map(x => x >= b ? x - (b - a) : x)
      else if (t === 'clip') out = brs.filter(x => x > a && x < b).map(x => x - a)
      else if (t === 'sil') out = brs.map(x => x > a ? x + b : x)
      else if (t === 'cp') out = brs.map(x => x > op[4] ? x + (op[2] - op[1]) : x)
      else if (t === 'ins') out = brs.map(x => x > a ? x + (op.len || 0) : x)
      else if (t === 'br') out = op[2] > 0 ? [...brs, a] : brs.filter(x => x !== a)
      else out = brs
      return [...new Set(out)].filter(x => x > 0 && x < newTotal).sort((p, q) => p - q)
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
      let range = document.caretRangeFromPoint?.(e.clientX, e.clientY)
      let ea = this.refs.editarea
      if (range && ea?.contains(range.startContainer) && range.startContainer.nodeType === 3)
        at = cleanText(range.startContainer.textContent.slice(0, range.startOffset)).length
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

    // trim to selection — keep only the selected range
    trim() {
      let sel = this.selection.get()
      let from, to
      if (sel && !sel.collapsed) ({ start: from, end: to } = sel)
      else if (this.loop && this.clipEnd != null && this.clipEnd > this.clipStart) [from, to] = [this.clipStart, this.clipEnd]
      else return
      return this._edit(async () => {
        this.stop()
        this._commit(['clip', from, to], await api.cropRange(from, to), 0)
      })
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
          : await api.pasteClip(op.clip, op[4])
        this._ops.push(op)
        this._brs = this._shiftBrs(op, op.brs ?? this._brs, r.total)
        this._applyEdit(r, op[0] === 'del' ? op[1] : op[0] === 'sil' ? op[1] + op[2] : op[0] === 'clip' ? 0 : op[0] === 'ins' ? op[1] : op[4])
        this._syncURL()
      })
    },

    // URL is the state: ?src=<store id | remote url>&del=f-t&sil=at-n&cp=f-t-v-at&br=a..b
    // repeated op params, document order = application order; br is a separate
    // visual-only list in current-timeline coords
    _syncURL(src) {
      let url = new URL(location.href)
      if (src != null) url.searchParams.set('src', src)
      for (let k of ['del', 'sil', 'clip', 'cp', 'ins', 'br']) url.searchParams.delete(k)
      for (let op of this._ops) if (op[0] !== 'br') url.searchParams.append(op[0], op.slice(1).join('-'))
      if (this._brs.length) url.searchParams.set('br', this._brs.join('..'))
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
      let ea = this.refs.editarea
      if (ea?.firstChild) ea.firstChild.data = this._withBreaks(ea.firstChild.data.replace(/\n/g, ''))
      this.measureWaveform()
      this._setCaret(at)
    },

    _applyEdit({ waveform, total, duration }, at) {
      this.total = total
      this.duration = duration
      let ea = this.refs.editarea
      if (ea) {
        let str = this._withBreaks(waveform)
        if (ea.firstChild?.nodeType === 3) ea.firstChild.data = str
        else ea.textContent = str
      }
      this.measureWaveform()
      this._setCaret(at)
    },

    _setCaret(at) {
      let caret = Math.max(0, Math.min(at, this.total))
      this.caretOffset = caret
      this.caretLine = this.lineFromBlock(caret)
      this.clipStart = caret
      this.clipEnd = this.total
      this.loop = false
      let sel = this.selection.set(caret)
      let rect = sel?.range?.getClientRects()
      rect = rect?.[rect.length - 1]
      if (rect) { this.caretX = rect.right; this.caretY = rect.top }
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
              this.caretLine = this.lineFromBlock(block)
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

  // auto-load src from option or URL; op params reconstruct the edit chain
  let params = new URLSearchParams(location.search)
  src ??= params.get('src')
  if (src) {
    const ARITY = { del: 2, sil: 2, clip: 2, cp: 4 }
    let ops = []
    for (let [k, v] of params) {
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
    // a cp op may only reference the chain prefix before its own position
    ops = ops.filter((op, i) => op[0] !== 'cp' || op[3] <= i)
    let brs = (params.get('br') || '').split('..').map(Number).filter(n => Number.isInteger(n) && n > 0)
    state.loadAudio(src, { ops, brs })
  }

  return state
}
