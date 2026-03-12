// UI part of wavearea
// handles user interactions and sends commands to worker
// all the data is stored and processed in worker
import sprae from 'sprae';
import { selection, cleanText } from './selection.js';
import api from './api.js';

history.scrollRestoration = 'manual'


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

  // audio
  duration: 0, // duration (received from backend)
  volume: 1,

  // total characters in waveform (excluding combining marks)
  total: 0,

  // selection start/end time
  clipStart: 0,
  loop: false,
  clipEnd: null,

  // caret position
  caretOffscreen: 0, // +1 if caret is below, -1 above viewport
  caretOffset: 0, // current caret offset, characters
  caretLine: 0, // caret line number
  caretY: 0,
  caretX: 0, // caret row coordinate

  // start playback — stub, replaced in Phase 1 with playback engine
  // returns stop function (sprae sequence pattern: start..stop)
  play() {
    this.playing = true;
    // TODO: Phase 1 — wire playback engine
    return () => {
      this.playing = false;
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
