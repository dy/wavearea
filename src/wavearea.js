// UI part of wavearea
// handles user interactions and sends commands to worker
// all the data is stored and processed in worker
import sprae from 'sprae';
import { selection, cleanText } from './selection.js';
import api from './api.js';
import createPlayer from './player.js';

history.scrollRestoration = 'manual'

const BLOCK_SIZE = 1024

// player instance — created after first file load
let player = null


// UI
export let state = sprae(wavearea, {
  // deps
  selection,
  cleanText,
  api,

  // refs
  refs: {},

  // mode
  loading: false,
  recording: false,
  playing: false,
  selecting: false,
  scrolling: false,
  error: null,

  // audio
  duration: 0, // duration (received from backend)
  sampleRate: 44100,
  channels: 1,
  volume: 1,
  speed: 1,

  // total characters in waveform (excluding combining marks)
  total: 0,

  // selection start/end time
  clipStart: 0,
  loop: false,
  clipEnd: null,

  // playback interpolation
  _playStartBlock: 0,
  _playStartTime: 0,
  _rafId: null,

  // caret position
  caretOffscreen: 0, // +1 if caret is below, -1 above viewport
  caretOffset: 0, // current caret offset, characters
  caretLine: 0, // caret line number
  caretY: 0,
  caretX: 0, // caret row coordinate

  // start/stop playback — sprae sequence pattern: start..stop
  play() {
    if (!player) {
      player = createPlayer(
        (from, to) => api.getWindow(from, to),
        { sampleRate: this.sampleRate, channels: this.channels }
      )
    }

    let fromBlock = this.clipStart || this.caretOffset
    let toBlock = this.clipEnd != null ? this.clipEnd : this.total
    let looping = this.loop

    player.setVolume(this.volume)
    player.setSpeed(this.speed)

    player.onstarted = ({ block, time }) => {
      this._playStartBlock = block
      this._playStartTime = time
      this._startCaretAnimation()
    }
    player.onended = () => {
      this.playing = false
      this._stopCaretAnimation()
    }

    player.play(fromBlock, toBlock, looping)
    this.playing = true

    return () => {
      player.pause()
      this.playing = false
      this._stopCaretAnimation()
    }
  },

  _startCaretAnimation() {
    let animate = () => {
      if (!this.playing || !player) return
      let elapsed = player.currentTime - this._playStartTime
      let blocksMoved = Math.floor(elapsed * this.sampleRate / BLOCK_SIZE * this.speed)
      let block = this._playStartBlock + blocksMoved

      // wrap caret on loop
      if (player.loop && player.loopEnd) {
        let loopLen = player.loopEnd - player.loopStart
        if (loopLen > 0 && block >= player.loopEnd) {
          block = player.loopStart + ((block - player.loopStart) % loopLen)
          // reset interpolation base so elapsed stays correct
          this._playStartBlock = player.loopStart
          this._playStartTime = player.currentTime
        }
      }

      if (block !== this.caretOffset && block >= 0 && block < this.total) {
        this.caretOffset = block
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

  // produce display time from frames
  timecode(block, ms = 0) {
    let time = ((block / this?.total)) * this?.duration || 0
    return `${Math.floor(time / 60).toFixed(0)}:${(Math.floor(time) % 60).toFixed(0).padStart(2, 0)}${ms ? `.${(time % 1).toFixed(ms).slice(2).padStart(ms)}` : ''}`
  },

  // count number of lines in an element
  countLines(el) {
    let range = new Range
    range.selectNodeContents(el)
    let h = range.getBoundingClientRect().height
    let rects = range.getClientRects()
    return h && Math.round(h / rects[rects.length - 1].height)
  },

  // measure number of characters per line in an element using binary search
  // inspired by https://www.bennadel.com/blog/4310-detecting-rendered-line-breaks-in-a-text-node-in-javascript.htm
  countCols(el) {
    let range = new Range();
    let textNode = el.firstChild
    if (!textNode?.textContent) return
    let str = textNode.textContent

    range.setStart(textNode, 0), range.setEnd(textNode, 1)
    let y = range.getClientRects()[0].y

    // Binary search for the wrap point
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
});
