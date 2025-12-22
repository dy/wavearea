// UI part of wavearea
// handles user interactions and sends commands to worker
// all the data is stored and processed in worker
import sprae from 'sprae';
import { fileToArrayBuffer } from './audio-util.js';
import playClip from './play-loop.js';
import { measureLatency } from './measure-latency.js';
import { selection, cleanText } from './selection.js';

history.scrollRestoration = 'manual'


// refs
const wavearea = document.querySelector('#wavearea')
const editarea = wavearea.querySelector('#editarea')
const timecodes = wavearea.querySelector('#timecodes')
const playButton = wavearea.querySelector('#play')
const waveform = wavearea.querySelector('#waveform')
const caretLinePointer = wavearea.querySelector('#caret-line')
const audio = new Audio


// init backend - receives messages from worker with rendered audio & waveform
const worker = new Worker('./dist/worker.js', { type: "module" });
const audioCtx = new AudioContext()


// UI
let state = sprae(wavearea, {
  // state
  loading: false,
  recording: false,
  playing: false,
  selecting: false,
  isMouseDown: false,
  scrolling: false,

  // current playback start/end time
  clipStart: 0,
  loop: false,
  clipEnd: null,
  _startTime: 0,
  _startTimeOffset: 0,

  volume: 1,

  latency: 0, // time between playback and the first sample

  // waveform segments
  segments: [],
  total: 0, // # segments
  duration: 0, // duration (received from backend)

  caretOffscreen: 0, // +1 if caret is below, -1 above viewport
  caretOffset: 0, // current caret offset, characters
  caretY: waveform.getBoundingClientRect().top,
  caretX: 0, // caret row coordinate

  // chars per line (~5s with block==1024)
  cols: 216,

  // caret repositioned
  async handleCaret() {
    // we need to do that in order to capture only manual selection change, not as result of programmatic caret move
    let sel = selection.get()
    // skip unchanged
    if (!sel || (sel.start === state.caretOffset && sel.collapsed)) return
    state.caretOffset = sel.start;
    state.updateCaretLine(sel)

    state.clipStart = state.caretOffset;
    if (!state.playing) {
      state.clipEnd = !sel.collapsed ? sel.end : state.total;
      state.loop = audio.loop = !sel.collapsed;
    }
    else {
      // FIXME: latency compensation in Safari: not perfect, but better than nothing
      state._startTime = (performance.now() + state.latency) * 0.001
      state._startTimeOffset = state.caretOffset
    }

    // audio.currentTime converts to float32 which may cause artifacts with caret jitter
    audio.currentTime = state.duration * state.caretOffset / state.total;
  },

  // handle beforeinput event to process deletions & insertions
  async handleBeforeInput(e) {
    let handler = inputHandlers[e.inputType];
    if (!handler) {
      e.preventDefault();
      e.stopPropagation();
      // avoid double space insertion (osx)
      if (e.data === '. ') selection.set(state.caretOffset)
    } else {
      handler.call(this, e);
    }
  },

  // handle file drop
  async handleDrop(e) {
    let files = e.dataTransfer.files
    let file = files[0]
    if (!file.type.startsWith('audio')) return false;
    // FIXME: save file to storage under the name

    // recode into wav
    state.loading = true;
    state.segments = [];

    let arrayBuf = await fileToArrayBuffer(file);
    let audioBuf = await decodeAudio(arrayBuf);
    let wavBuffer = await encodeAudio(audioBuf);
    let blob = new Blob([wavBuffer], { type: 'audio/wav' });
    let url = URL.createObjectURL(blob);
    await applyOp(['src', url]);

    state.loading = false;

    return arrayBuf;
  },

  async handleFile(e) {
    // let url = URL.createObjectURL(e.target.files[0])
    // pushOp(['src', url])
    state.loading = 'Decoding'
    let file = e.target.files[0];
    let arrayBuf = await fileToArrayBuffer(file);
    let audioBuf = await audioCtx.decodeAudioData(arrayBuf);
    let channelData = Array.from({ length: audioBuf.numberOfChannels }, (i) => audioBuf.getChannelData(i))

    await pushOp(['file', {
      name: file.name,
      numberOfChannels: audioBuf.numberOfChannels,
      sampleRate: audioBuf.sampleRate,
      length: audioBuf.length,
      channelData
    }])
    state.loading = false
  },

  scrollIntoCaret() {
    if (state.caretOffscreen && !state.scrolling) {
      caretLinePointer.scrollIntoView({ behavior: 'smooth', block: 'center' })
      state.scrolling = true
      setTimeout(() => (state.scrolling = false), 108)
    }
  },

  // start playback
  play(e) {
    state.playing = true;
    state.scrolling = false;
    editarea.focus();
    console.log('play from', state.caretOffset);

    // from the end to the beginning
    if (state.caretOffset === state.total) selection.set(state.caretOffset = state.clipStart = 0)

    state.scrollIntoCaret();

    let { clipStart, clipEnd, loop } = state;

    const toggleStop = () => (playButton.click())

    // since audio.currentTime is inaccurate, esp. in Safari, we measure precise played time
    let animId
    state._startTime
    state._startTimeOffset = state.caretOffset
    const resetStartTime = async () => {
      await new Promise(ok => setTimeout(ok, state.latency)) // Safari needs visual/audio latency compensation
      state._startTime = performance.now() * 0.001;
      clearInterval(animId)
      animId = setInterval(syncCaret, 10.8)
    }

    // detect scrolling state, to prevent forcing scroll-into-caret
    let scrollY = editarea.getBoundingClientRect().top
    const checkScroll = () => {
      if (state.scrolling) return
      let curY = editarea.getBoundingClientRect().top
      if (curY !== scrollY) (state.scrolling = true, setTimeout(() => (state.scrolling = false, checkScroll()), 1080))
      else state.scrolling = false
      scrollY = curY
    }

    const syncCaret = () => {
      checkScroll()
      if (state.selecting) return

      let playedTime = (performance.now() * 0.001 - state._startTime);
      let currentBlock = Math.min(state._startTimeOffset + Math.round(state.total * playedTime / state.duration), state.total)
      if (loop) currentBlock = Math.min(currentBlock, clipEnd)

      let sel = selection.set(state.caretOffset = currentBlock)

      state.updateCaretLine(sel)
      state.scrollIntoCaret();
    }

    // audio takes time to init before play on mobile, so we hold on caret
    audio.addEventListener('play', resetStartTime, { once: true })

    // audio looped - reset caret
    if (state.loop) audio.addEventListener('seeked', resetStartTime)

    const stopAudio = playClip(audio, state.loop && {
      start: state.duration * state.clipStart / state.total,
      end: state.duration * state.clipEnd / state.total
    });
    // TODO: markLoopRange()

    audio.addEventListener('ended', toggleStop);

    return () => {
      audio.removeEventListener('seeked', resetStartTime)
      audio.removeEventListener('ended', toggleStop);

      clearInterval(animId)
      stopAudio();
      state.playing = false
      state.scrolling = false

      // return selection if there was any
      //TODO: unmarkLoopRange()
      if (state.loop) selection.set(clipStart, clipEnd)

      // adjust end caret position
      else if (audio.currentTime >= audio.duration) selection.set(state.total)

      editarea.focus()
    }
  },

  // navigate to history state
  async goto(params) {
    try {
      await renderAudio(params)
    }
    catch (e) {
      // failed to load audio means likely history is discontinuous:
      // try updating blob in history state by rebuilding audio
      await loadAudioFromURL()
    }
    selection.set(state.caretOffset)
  },

  // make sure play/caret line pointer matches audio
  updateCaretLine(sel) {
    // let caretLine = Math.floor(sel.end / state.cols);
    // // last of segment edge case
    // if (sel.startNode && !(state.caretOffset % state.cols) && sel.startNodeOffset === editarea.children[sel.startNode.dataset.id].textContent.length) caretLine--;

    // if (state.caretLine !== caretLine) state.caretLine = caretLine;

    // calculate caret x coordinate
    let rects = sel.range.getClientRects()
    let rect = rects[rects.length - 1]
    state.caretX = rect.right
    state.caretY = rect.top
  },

  // produce display time from frames
  timecode(block, ms = 0) {
    let time = ((block / state?.total)) * state?.duration || 0
    return `${Math.floor(time / 60).toFixed(0)}:${(Math.floor(time) % 60).toFixed(0).padStart(2, 0)}${ms ? `.${(time % 1).toFixed(ms).slice(2).padStart(ms)}` : ''}`
  }
});


const inputHandlers = {
  // insertText(){},
  // insertReplacementText(){},
  // insertLineBreak(){},
  // insertParagraph(){},
  insertFromDrop(e) {
    console.log('insert from drop', e)
  },
  // insertFromPaste(){},
  // insertLink(){},
  // deleteWordBackward(){},
  // deleteWordForward(){},
  // deleteSoftLineBackward(){},
  // deleteSoftLineForward(){},
  // deleteEntireSoftLine(){},
  // deleteHardLineBackward(){},
  // deleteHardLineForward(){},
  // deleteByDrag(){},
  // deleteByCut(){},
  // deleteContent(){},
  async deleteContentBackward(e) {
    let range = e.getTargetRanges()[0]
    let fromNode = range.startContainer.parentNode.closest('.w-segment'),
      toNode = range.endContainer.parentNode.closest('.w-segment'),
      fromId = Number(fromNode.dataset.id), toId = Number(toNode.dataset.id)
    let from = range.startOffset + state.segments.slice(0, fromId).reduce((off, seg) => off + seg.length, 0),
      to = range.endOffset + state.segments.slice(0, toId).reduce((off, seg) => off + seg.length, 0)

    // debounce push op to collect multiple deletes
    if (this._deleteTimeout) {
      clearTimeout(this._deleteTimeout)
      this._deleteOp[1]--
    }
    else this._deleteOp = ['del', from, to]

    const pushDeleteOp = () => {
      pushOp(this._deleteOp)
      this._deleteOp = this._deleteTimeout = null
    }
    this._deleteTimeout = setTimeout(pushDeleteOp, 280)
  },
  // deleteContentForward(){},
  // historyUndo(){},
  // historyRedo(){},

}

// measure safari latency
const whatsLatency = async () => {
  wavearea.removeEventListener('touchstart', whatsLatency)
  wavearea.removeEventListener('mousedown', whatsLatency)
  wavearea.removeEventListener('keydown', whatsLatency)
  state.latency = await measureLatency()
}
wavearea.addEventListener('touchstart', whatsLatency)
wavearea.addEventListener('mousedown', whatsLatency)
wavearea.addEventListener('keydown', whatsLatency)


// create play button position observer
const caretObserver = new IntersectionObserver(([item]) => {
  state.caretOffscreen = item.isIntersecting ? 0 :
    (item.intersectionRect.top <= item.rootBounds.top ? 1 :
      item.intersectionRect.bottom >= item.rootBounds.bottom ? -1 :
        0);
}, {
  // root: document,
  threshold: 0.999,
  rootMargin: '0px'
});
caretObserver.observe(caretLinePointer);


// create line width observer
const resizeObserver = new ResizeObserver((entries) => {
  // let width = entries[0].contentRect.width
  state.cols = measureLines()
})
resizeObserver.observe(editarea);

// inspired by https://www.bennadel.com/blog/4310-detecting-rendered-line-breaks-in-a-text-node-in-javascript.htm
// measure number of characters per line
function measureLines() {
  let range = new Range();
  let textNode = editarea.firstChild.firstChild
  if (!textNode?.textContent) return
  let str = textNode.textContent

  range.setStart(textNode, 0), range.setEnd(textNode, 1)
  let y = range.getClientRects()[0].y
  for (var i = 0, offset = 0; i < str.length; offset++) {
    let skip = 1; while (str[i + skip] >= '\u0300') skip++;
    range.setStart(textNode, 0), range.setEnd(textNode, i = i + skip);
    // 2nd line means we counted chars per line
    let rects = range.getClientRects()
    if (rects[rects.length - 1].y > y) return offset
  }

  return str.length
}

// update history, post operation & schedule update
// NOTE: we imply that ops are applied once and not multiple times
// so that ops can be combined as del=0-10..20-30 instead of del=0-10&del=20-30
async function pushOp(...ops) {
  let url = new URL(location)

  for (let op of ops) {
    let [name, ...args] = op
    if (args[0].name) url.searchParams.set(name, args[0].name)
    else if (url.searchParams.has(name)) url.searchParams.set(name, `${url.searchParams.get(name)}..${args.join('-')}`)
    else url.searchParams.append(name, args.join('-'))
  }
  state.loading = 'Processing'
  let params = await runOp(...ops)
  history.pushState(params, '', decodeURI(url)); // decodeURI needed to avoid escaping `:`
  state.loading = false

  if (editarea.textContent) console.assert(params.segments.join('') === editarea.textContent, 'Rendered waveform is different from UI')

  return renderAudio(params)
}

// post op message and wait for update response
function runOp(...ops) {
  return new Promise(resolve => {
    // worker manages history, so id indicates which point in history we commit changes to
    console.log('Post message', ops)
    worker.postMessage({ id: history.state?.id || 0, ops })
    worker.addEventListener('message', e => {
      resolve(e.data)
    }, { once: true })
  })
}

// update audio url & assert waveform
function renderAudio({ url, segments, duration, offsets }) {
  // assert waveform same as current content (must be!)
  state.total = segments.reduce((total, seg) => total += cleanText(seg).length, 0);
  state.duration = duration
  state.segments = segments
  if (!state.cols) state.cols = measureLines()
  // URL.revokeObjectURL(audio.src) // can be persisted from history, so we keep it
  audio.src = url
  audio.preload = "metadata" // preload avoids redundant fetch requests and needed by Safari
  return new Promise((ok, nok) => {
    audio.addEventListener('error', nok)
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = duration * state.caretOffset / state.total || 0
    }, { once: true });
  })
}

// reconstruct audio from url
async function loadAudioFromURL(url = new URL(location)) {
  state.loading = ' '

  let ops = []
  for (const [op, arg] of url.searchParams) ops.push(...arg.split('..').map(arg => {
    // skip https:// as single argument
    return [op, ...(op === 'src' || op === 'file' ? [arg] : arg.split('-'))]
  }))

  // shortcut for src op
  if (ops[0][0] === 'src') {
    let [, src] = ops.shift()
    let resp = await fetch(src, { cache: 'force-cache' });
    let arrayBuf = await resp.arrayBuffer();
    state.loading = 'Decoding'
    let audioBuf = await audioCtx.decodeAudioData(arrayBuf);
    let channelData = Array.from({ length: audioBuf.numberOfChannels }, (i) => audioBuf.getChannelData(i))
    ops.push(['file', {
      name: src,
      numberOfChannels: audioBuf.numberOfChannels,
      sampleRate: audioBuf.sampleRate,
      length: audioBuf.length,
      channelData
    }])
  }

  let params = await runOp(...ops)
  history.replaceState(params, '', decodeURI(url))
  renderAudio(params)
  state.loading = false
}


// if URL has no operations - put random sample
// if (location.search.length < 2) {
//   const sampleSources = [
//     // 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Vivaldi_-_Magnificat_01_Magnificat.oga',
//     'https://upload.wikimedia.org/wikipedia/commons/c/cf/Caja_de_m%C3%BAsica_%28PianoConcerto5_Beethoven%29.ogg',
//     // 'https://upload.wikimedia.org/wikipedia/commons/9/96/Carcassi_Op_60_No_1.ogg',
//   ]
//   let src = sampleSources[Math.floor(Math.random() * sampleSources.length)];
//   location.search = `?src=${src}`
// }
// history.replaceState({segments:[]}, '', '/')

// apply operations from URL, like src=path/to/file&clip=from-to&br=a..b..c
if (location.search.length) {
  loadAudioFromURL()
}
