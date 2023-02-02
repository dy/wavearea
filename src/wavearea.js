// UI part of wavearea
// handles user interactions and sends commands to worker
// all the data is stored and processed in worker
import sprae from 'sprae';


// wait this interval before triggering update
export const KEY_DEBOUNCE = 1080;

// refs
const wavearea = document.querySelector('.wavearea')
const editarea = wavearea.querySelector('.w-editable')
const audio = wavearea.querySelector('.w-playback')
const playButton = wavearea.querySelector('.w-play')


// init backend - receives messages from worker with rendered audio & waveform
const worker = new Worker('./dist/worker.js', { type: "module" });
let lastId = 0
worker.addEventListener('message', (e) => {
  let {id, url, segments, duration} = e.data
  if (id < lastId) return // skip older responses
  lastId = id
  audio.src = url
  // assert waveform same as current content (must be!)
  state.loading = false
  if (!state.total) state.segments = segments
  else console.assert(segments.join('') === editarea.textContent, 'Rendered waveform is different from UI')
  state.total = segments.reduce((total, seg) => total += seg.length, 0);
  state.duration = duration
})


// load operations
const url = new URL(location);

// if URL has no operations - put random sample
if (url.search.length < 2) {
  const sampleSources = [
    // 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Vivaldi_-_Magnificat_01_Magnificat.oga',
    'https://upload.wikimedia.org/wikipedia/commons/c/cf/Caja_de_m%C3%BAsica_%28PianoConcerto5_Beethoven%29.ogg',
    // 'https://upload.wikimedia.org/wikipedia/commons/9/96/Carcassi_Op_60_No_1.ogg',
  ]
  let src = sampleSources[Math.floor(Math.random() * sampleSources.length)];
  pushOp(['src', src])
}
// apply operations from URL, like src=path/to/file&clip=from:to&br=a,b,c
else {
  for (const [op, arg] of url.searchParams) arg.split('..').map(arg =>
    worker.postMessage([op, ...(arg.includes(':') ? [arg] : arg.split('-'))])
  )
}

// update history, post operation & schedule update
// NOTE: we imply that ops are applied once and not multiple times
// so that ops can be combined as del=0:10,20:30 instead of del=0:10&del=20:30
function pushOp (...ops) {
  for (let op of ops) {
    let [name, ...args] = op
    if (url.searchParams.has(name)) url.searchParams.set(name, `${url.searchParams.get(name)}..${args.join('-')}` )
    else url.searchParams.append(name, args.join('-'))
    worker.postMessage(op)
  }
  history.pushState(null, '', decodeURI(url)); // decodeURI needed to avoid escaping `:`
}


// UI state
let state = sprae(wavearea, {
  // params
  loading: true,
  recording: false,
  playing: false,
  selecting: false,

  // current playback start/end time
  playbackStart: 0,
  loop: false,
  playbackEnd: null,

  volume: 1,

  // waveform segments
  segments: [],
  total: 0, // # segments
  duration: 0, // duration (received from backend)

  // current caret offset
  caretOffset: 0,

  // chars per line (~5s with block==1024)
  // FIXME: make responsive
  lineWidth: 216,

  // current mouse state
  isMouseDown: false,

  // caret repositioned my mouse
  handleCaret(e) {
    // we need to do that in order to capture only manual selection change, not as result of programmatic caret move
    let selection = sel()
    if (!selection) return
    state.caretOffset = selection.start;
    state.playbackStart = selection.start;
    state.loop = !selection.collapsed;
    state.playbackEnd = state.loop ? selection.end : null;
    // audio.currentTime converts to float32 which may cause artifacts with caret jitter
    audio.currentTime = state.duration * state.playbackStart / state.total;
  },

  // update offsets/timecodes visually - the hard job of updating segments is done by other listeners
  updateTimecodes() {
    let offset = 0, i = 0
    for (let el of editarea.children) {
      let content = el.textContent.trim()
      let lines = Math.ceil(content.length / state.lineWidth)
      el.dataset.id = i++
      el.dataset.offset = offset
      el.setAttribute('timecodes', Array.from(
        {length: lines},
        (_,i) => timecode(i*state.lineWidth + offset)).join('\n')
      )
      offset += content.length
    }
  },

  async handleBeforeInput(e) {
    let handler = inputHandlers[e.inputType]
    if (!handler) e.preventDefault(); else handler.call(this, e)
  },

  async handleDrop(e) {
    let files = e.dataTransfer.files
    let file = files[0]
    if (!file.type.startsWith('audio')) return false;
    // FIXME: save file to storage under the name

    // recode into wav
    state.loading = true
    state.segments = []

    let arrayBuf = await fileToArrayBuffer(file)
    let audioBuf = await decodeAudio(arrayBuf)
    let wavBuffer = await encodeAudio(audioBuf);
    let blob = new Blob([wavBuffer], {type:'audio/wav'});
    let url = URL.createObjectURL( blob );
    await applyOp(['src', url])

    state.loading = false

    return arrayBuf
  },

  // audio time changes
  timeChange(e) {
    // ignore if event comes from editarea
    if (document.activeElement === editarea) return
    sel(state.playbackStart = Math.floor(state.total * audio.currentTime / state.duration))
    editarea.focus()
  },

  play (e) {
    state.playing = true;
    let selection = sel();
    if (!selection) selection = sel(0);

    let playbackStart = state.caretOffset;
    let playbackEnd = !selection.collapsed ? selection.end : state.total;

    let animId;

    const syncCaret = () => {
      const blocksPlayed = Math.max(Math.ceil(state.total * audio.currentTime / state.duration) - state.playbackStart, 0)
      const playbackCurrent = state.playbackStart + blocksPlayed;
      // Prevent updating during the click
      sel(state.caretOffset = playbackCurrent)
      if (playbackEnd && playbackCurrent >= playbackEnd) playButton.click();
      else animId = requestAnimationFrame(syncCaret)
    }
    syncCaret();

    editarea.focus();

    audio.play();

    // onstop
    return () => {
      audio.pause();
      state.playing = false
      cancelAnimationFrame(animId), animId = null

      // return selection if there was any
      if (selection.start !== selection.end) {
        sel(playbackStart, playbackEnd)
      }

      // adjust end caret position
      if (audio.currentTime >= state.duration) {
        sel(state.total)
      }

      editarea.focus()
    }
  }
});

const inputHandlers = {
  // insertText(){},
  // insertReplacementText(){},
  // insertLineBreak(){},
  // insertParagraph(){},
  // insertFromDrop(){},
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
  async deleteContentBackward(e){
    let range = e.getTargetRanges()[0]
    let from = range.startOffset + Number(range.startContainer.parentNode.dataset.offset),
        to = range.endOffset + Number(range.endContainer.parentNode.dataset.offset),
        count = to - from

    // debounce push op to collect multiple deletes
    if (this._deleteTimeout) {
      clearTimeout(this._deleteTimeout)
      this._deleteOp[1]--
      this._deleteOp[2]++
    }
    else this._deleteOp = ['del', from, count]

    this._deleteTimeout = setTimeout(() => {
      pushOp(this._deleteOp)
      this._deleteOp = this._deleteTimeout = null
    }, KEY_DEBOUNCE)
  },
  // deleteContentForward(){},
  // historyUndo(){},
  // historyRedo(){},
}


// get/set selection with absolute (transparent) offsets
const sel = (start, end, lineOffset=0) => {
  let s = window.getSelection()

  // set selection, if passed
  if (start != null) {
    // start/end must be within limits
    start = Math.max(0, start)
    if (end == null) end = start

    let startNode, endNode
    s.removeAllRanges()
    let range = new Range()

    // find start/end nodes
    let startNodeOffset = start
    startNode = editarea.firstChild
    while ((startNodeOffset+lineOffset) > startNode.firstChild.data.length)
    startNodeOffset -= startNode.firstChild.data.length, startNode = startNode.nextSibling
    range.setStart(startNode.firstChild, startNodeOffset)

    let endNodeOffset = end
    endNode = editarea.firstChild
    while ((endNodeOffset+lineOffset) > endNode.firstChild.data.length) endNodeOffset -= endNode.firstChild.data.length, endNode = endNode.nextSibling
    range.setEnd(endNode.firstChild, endNodeOffset)

    s.addRange(range)

    return {
      start, startNode, end, endNode,
      startNodeOffset, endNodeOffset,
      collapsed: s.isCollapsed
    }
  }

  if (!s.anchorNode || s.anchorNode.parentNode.parentNode !== editarea) return

  // collect start/end offsets
  start = s.anchorOffset, end = s.focusOffset
  let prevNode = s.anchorNode.parentNode
  while (prevNode = prevNode.previousSibling) start += prevNode.firstChild.data.length
  prevNode = s.focusNode.parentNode
  while (prevNode = prevNode.previousSibling) end += prevNode.firstChild.data.length

  // swap selection direction
  let startNode = s.anchorNode.parentNode, startNodeOffset = s.anchorOffset,
      endNode = s.focusNode.parentNode, endNodeOffset = s.focusOffset;
  if (start > end) {
    [end, endNode, endNodeOffset, start, startNode, startNodeOffset] =
    [start, startNode, startNodeOffset, end, endNode, endNodeOffset]
  }

  return {
    start,
    startNode,
    startNodeOffset,
    end,
    endNode,
    endNodeOffset,
    collapsed: s.isCollapsed
  }
}

// produce display time from frames
const timecode = (block) => {
  let time = (block / state.total) * state.duration
  return `${Math.floor(time/60).toFixed(0)}:${(Math.floor(time)%60).toFixed(0).padStart(2,0)}`
}