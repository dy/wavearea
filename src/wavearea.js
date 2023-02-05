// UI part of wavearea
// handles user interactions and sends commands to worker
// all the data is stored and processed in worker
import sprae from 'sprae';


// refs
const wavearea = document.querySelector('.wavearea')
const editarea = wavearea.querySelector('.w-editable')
const playButton = wavearea.querySelector('.w-play')
const caretLineRef = wavearea.querySelector('.w-caret-line')
const audio = new Audio, loopAudio = new Audio;
loopAudio.loop = true


// init backend - receives messages from worker with rendered audio & waveform
const worker = new Worker('./dist/worker.js', { type: "module" });


// UI state
let state = sprae(wavearea, {
  // interaction state
  isMouseDown: false,
  isKeyDown: false,

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

  caretOffscreen: 0, // +1 if caret is below, -1 above viewport
  caretOffset: 0, // current caret offset
  caretLine: 0,

  // chars per line (~5s with block==1024)
  // FIXME: make responsive
  lineWidth: 216,

  // caret repositioned my mouse
  async handleCaret(e) {
    // we need to do that in order to capture only manual selection change, not as result of programmatic caret move
    let selection = sel()
    if (!selection) return
    state.caretOffset = selection.start;
    state.caretLine = Math.floor(state.caretOffset / state.lineWidth);
    if (!state.playing) {
      state.playbackStart = selection.start;
      state.playbackEnd = !selection.collapsed ? selection.end : state.total;
      state.loop = !selection.collapsed;
      // create loopable audio fragment
      if (state.loop) inputHandlers.createLoop()
    }

    // audio.currentTime converts to float32 which may cause artifacts with caret jitter
    if (state.loop) loopAudio.currentTime = !state.playing ? 0 : loopAudio.duration *
      (Math.max(state.playbackStart, Math.min(selection.start, state.playbackEnd)) - state.playbackStart) /
      (state.playbackEnd - state.playbackStart);
    else audio.currentTime = audio.duration * selection.start / state.total;
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
    let handler = inputHandlers[e.inputType];
    if (!handler) e.preventDefault(); else {
      handler.call(this, e);
    }
  },

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
    let blob = new Blob([wavBuffer], {type:'audio/wav'});
    let url = URL.createObjectURL( blob );
    await applyOp(['src', url]);

    state.loading = false;

    return arrayBuf;
  },

  // audio time changes
  timeChange(e) {
    // ignore if event comes from editarea
    if (document.activeElement === editarea) return
    sel(state.playbackStart = Math.floor(state.total * audio.currentTime / state.duration))
    editarea.focus()
  },

  scrollIntoCaret() {
    if (state.caretOffscreen) caretLineRef.scrollIntoView({ behavior: 'smooth', block: 'center'});
  },

  // start playback
  play (e) {
    state.playing = true;

    state.scrollIntoCaret();

    let playbackStart = state.playbackStart;
    let playbackEnd = state.playbackEnd;

    let animId;

    const syncCaret = () => {
      const playbackCurrent = state.loop ?
        state.playbackStart + Math.ceil((state.playbackEnd - state.playbackStart) * loopAudio.currentTime / loopAudio.duration) :
        Math.max(Math.ceil(state.total * audio.currentTime / audio.duration), 0)

      sel(state.caretOffset = playbackCurrent)

      let caretLine = Math.floor(state.caretOffset / state.lineWidth);
      if (caretLine !== state.caretLine) state.caretLine = caretLine, state.scrollIntoCaret();

      // stop if end reached
      if (!state.loop && playbackEnd && playbackCurrent >= playbackEnd) playButton.click();
      else animId = requestAnimationFrame(syncCaret)
    }
    syncCaret();

    editarea.focus();

    (state.loop ? loopAudio : audio).play();
    // TODO: markLoopRange()

    // onstop
    return () => {
      (state.loop ? loopAudio : audio).pause();
      state.playing = false
      cancelAnimationFrame(animId), animId = null

      // return selection if there was any
      //TODO: unmarkLoopRange()
      if (state.loop) sel(playbackStart, playbackEnd)

      // adjust end caret position
      else if (audio.currentTime >= state.duration) sel(state.total)

      editarea.focus()
    }
  },

  // navigate to history state
  goto (params) {
    renderAudio(params)
    sel(state.caretOffset)
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
    let from = range.startOffset + Number(range.startContainer.parentNode.closest('.w-segment').dataset.offset),
        to = range.endOffset + Number(range.endContainer.parentNode.closest('.w-segment').dataset.offset)

    // debounce push op to collect multiple deletes
    if (this._deleteTimeout) {
      clearTimeout(this._deleteTimeout)
      this._deleteOp[1]--
    }
    else this._deleteOp = ['del', from, to]

    const pushDeleteOp = () => {
      // postpone updating delete until key is up
      if (state.isKeyDown) return this._deleteTimeout = setTimeout(pushDeleteOp, 50)
      pushOp(this._deleteOp)
      this._deleteOp = this._deleteTimeout = null
    }
    this._deleteTimeout = setTimeout(pushDeleteOp, 280)
  },
  // deleteContentForward(){},
  // historyUndo(){},
  // historyRedo(){},

  // non-input handler for loop (need to debounce)
  createLoop(e) {
    if (this._loopTimeout) clearTimeout(this._loopTimeout)

    const pushLoopOp = async () => {
      if (state.isMouseDown || state.isKeyDown) return this._loopTimeout = setTimeout(pushLoopOp, 50)
      this._loopTimeout = null
      let { url } = await runOp(['loop', state.playbackStart, state.playbackEnd]);
      if (loopAudio.src) URL.revokeObjectURL(loopAudio.src)
      loopAudio.src = url
    }

    this._loopTimeout = setTimeout(pushLoopOp, 280)
  }
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

  if (!s.anchorNode || !editarea.contains(s.anchorNode)) return

  // collect start/end offsets
  start = s.anchorOffset, end = s.focusOffset
  let prevNode = s.anchorNode.parentNode.closest('.w-segment')
  while (prevNode = prevNode.previousSibling) start += prevNode.firstChild.data.length
  prevNode = s.focusNode.parentNode.closest('.w-segment')
  while (prevNode = prevNode.previousSibling) end += prevNode.firstChild.data.length

  // swap selection direction
  let startNode = s.anchorNode.parentNode.closest('.w-segment'), startNodeOffset = s.anchorOffset,
      endNode = s.focusNode.parentNode.closest('.w-segment'), endNodeOffset = s.focusOffset;
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

// create play button observer
const caretObserver = new IntersectionObserver(([item]) => {
  state.caretOffscreen = item.isIntersecting ? 0 :
  (item.intersectionRect.top <= item.rootBounds.top ? 1 :
    item.intersectionRect.bottom >= item.rootBounds.bottom ? -1 :
    0);
  }, {
    root: document,
    threshold: 1,
    rootMargin: '0px'
  });
caretObserver.observe(caretLineRef);




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
// apply operations from URL, like src=path/to/file&clip=from-to&br=a..b..c
else {
  let ops = []
  for (const [op, arg] of url.searchParams) ops.push(...arg.split('..').map(arg =>
    // skip https:// as single argument
    [op, ...(arg.includes(':') ? [arg] : arg.split('-'))]
  ))
  let params = await runOp(...ops)
  history.replaceState(params, '', decodeURI(url))
  renderAudio(params)
}

// update history, post operation & schedule update
// NOTE: we imply that ops are applied once and not multiple times
// so that ops can be combined as del=0-10..20-30 instead of del=0-10&del=20-30
async function pushOp (...ops) {
  for (let op of ops) {
    let [name, ...args] = op
    if (url.searchParams.has(name)) url.searchParams.set(name, `${url.searchParams.get(name)}..${args.join('-')}` )
    else url.searchParams.append(name, args.join('-'))
  }
  let params = await runOp(...ops)
  history.pushState(params, '', decodeURI(url)); // decodeURI needed to avoid escaping `:`

  console.assert(params.segments.join('') === editarea.textContent, 'Rendered waveform is different from UI')

  return renderAudio(params)
}

// post op message and wait for update response
function runOp (...ops) {
  return new Promise(resolve => {
    // worker manages history, so id indicates which point in history we commit changes to
    worker.postMessage({id: history.state?.id || 0, ops})
    worker.addEventListener('message', e => resolve(e.data), {once: true})
  })
}

// update audio url & assert waveform
function renderAudio ({url, segments, duration}) {
  // assert waveform same as current content (must be!)
  state.loading = false
  state.total = segments.reduce((total, seg) => total += seg.length, 0);
  state.duration = duration
  state.segments = segments

  let currentTime = audio.currentTime
  // URL.revokeObjectURL(audio.src) - can be persisted from history, so we keep it
  audio.src = url

  return new Promise(ok => {
    audio.addEventListener('canplay', e => ok(audio.currentTime = currentTime), {once: true});
  })
}
