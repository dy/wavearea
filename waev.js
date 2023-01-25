// import '@github/file-attachment-element';
import sprae from 'sprae';
import { BLOCK_SIZE, SAMPLE_RATE, t2o, o2t, t2b, drawAudio, encodeAudio, fileToArrayBuffer, decodeAudio } from './source/audio-util.js';
import applyOp from './source/audio-ops.js'


// refs
const waev = document.querySelector('.waev')
const wavearea = waev.querySelector('.w-wavearea')
const audio = waev.querySelector('.w-playback')

// audio buffers & applied operations
let buffers = []
const url = new URL(location);

// current set of applied ops
const ops = []

// init UI state
let state = sprae(waev, {
  // params
  loading: false,
  recording: false,
  playing: false,
  selecting: false,

  // current playback start/end time
  startFrame: 0,

  volume: 1,

  // TODO: display error and state in audio element
  error: null,

  // waveform segments
  segments: [],

  // chars per line (~5s with block==1024)
  // FIXME: make responsive
  lineWidth: 216,

  // current mouse state
  isMouseDown: false,

  // caret repositioned my mouse
  handleCaret(e) {
    // audio.currentTime converts to float32 which may cause artifacts with caret jitter
    audio.currentTime = o2t(state.startFrame = sel().start);
    // state.endFrame = sel().collapsed ? t2b(audio.duration) : sel().end;
  },

  // update offsets/timecodes visually - the hard job of updating segments is done by other listeners
  updateTimecodes() {
    let offset = 0, i = 0
    for (let el of wavearea.children) {
      let content = el.textContent.trim()
      let lines = Math.ceil(content.length / state.lineWidth)
      el.dataset.id = i++
      el.dataset.offset = offset
      el.setAttribute('timecodes', Array.from({length: lines}, (_,i) => timecode(i*state.lineWidth + offset)).join('\n'))
      offset += content.length
    }
  },
  // cleanup() {
  //   // remove empty breaks (result of multiple enter keys)
  //   // FIXME: move to beforeinput event
  //   for (let el of wavearea.children) if (!el.textContent.trim()) el.remove()
  // },

  async handleBeforeInput(e) {
    let handler = inputHandlers[e.inputType]
    if (!handler) e.preventDefault(); else handler(e)
  },

  async handleEnter(e) {
    let selection = sel()
    let segmentId = selection.startNode.dataset.id
    if (!segmentId) throw Error('Segment id is not found, strange')
    // push break operation
    // FIXME: save to history
    // FIXME: this logic (multiple same-ops) can be done in push-history function to any ops
    let brOp = ops.at(-1)[0] === 'br' ? ops.pop() : ['br']
    brOp.push(selection.start)
    await applyOp(buffers, ['br', selection.start])
    // TODO: account for existing selection that was removed (replace fragment with break)
    sel(selection.start, selection.start, 1)

    return
  },
  async handleBackspace(e) {
    console.log(123)
    let selection = sel()
    let segment = state.segments[selection.startNode.dataset.id]
    let offset = selection.start
    let count = wavearea.textContent.length - state.segments.reduce((sum, seg) => sum += seg.length, 0)
    console.log(count)

    if (offset < 0 && !count) return // head condition


  },
  async handleDelete(e) {
    // // beginning of a segment must delete segment break, not insert delete op
    // if (!selection.startNodeOffset && selection.collapsed) {
    //   // we don't want to introduce join in URL
    //   await applyOp(['join', selection.start])
    //   sel(selection.start)
    // }

    // else {
    //   //FIXME: must be done after we serialize ops in URL
    //   // since it modifiers set of applied ops
    //   let op = count ? ['del', selection.start, count] :
    //     ['del', offset, 1]
    //   ops.push(op)
    //   await applyOp(op)

    //   // recover selection
    //   sel(offset)
    // }
  },

  async handleSpace(e) {
    let selection = sel()
    let segment = state.segments[selection.startNode.dataset.id]
    let count = selection.startNode.textContent.length - segment.length
    let offset = selection.start - count

    // save op to the list
    let op = ops.at(-1)[0] === 'mute' ? ops.pop() : ['mute']
    op.push([offset, count])
    await applyOp(['mute', [offset, count]])

    // TODO: account for existing selection that was removed (replace fragment with break)
    sel(selection.start)
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
    // ignore if event comes from wavearea
    if (document.activeElement === wavearea) return
    sel(state.startFrame = t2o(audio.currentTime))
    wavearea.focus()
  },

  play (e) {
    state.playing = true;
    let selection = sel();
    if (!selection) selection = sel(0);

    let startFrame = selection.start;
    let endFrame = !selection.collapsed ? selection.end : t2o(audio.duration);

    let animId;

    const syncCaret = () => {
      const framesPlayed = Math.max(t2o(audio.currentTime) - state.startFrame, 0)
      const currentFrame = state.startFrame + framesPlayed;
      // Prevent updating during the click
      if (!state.isMouseDown) sel(currentFrame)
      if (endFrame && currentFrame >= endFrame) audio.pause();
      else animId = requestAnimationFrame(syncCaret)
    }
    syncCaret();

    wavearea.focus();

    // onstop
    return () => {
      state.playing = false
      cancelAnimationFrame(animId), animId = null

      // return selection if there was any
      if (selection.start !== selection.end) {
        sel(startFrame, endFrame)
      }

      // adjust end caret position
      if (audio.currentTime >= audio.duration) {
        sel(t2b(audio.duration).length)
      }

      wavearea.focus()
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

    let lastOp = ops.at(-1)
    if (lastOp[0] === 'del') lastOp[2]++; else ops.push(lastOp = ['del', from, count]);
    buffers = await applyOp(buffers, ['del',from, count])

    // FIXME: these can be parallelized
    renderWaveform(buffers);
    renderAudio(buffers);
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
    startNode = wavearea.firstChild
    while ((startNodeOffset+lineOffset) > startNode.firstChild.data.length)
    startNodeOffset -= startNode.firstChild.data.length, startNode = startNode.nextSibling
    range.setStart(startNode.firstChild, startNodeOffset)

    let endNodeOffset = end
    endNode = wavearea.firstChild
    while ((endNodeOffset+lineOffset) > endNode.firstChild.data.length) endNodeOffset -= endNode.firstChild.data.length, endNode = endNode.nextSibling
    range.setEnd(endNode.firstChild, endNodeOffset)

    s.addRange(range)

    return {
      start, startNode, end, endNode,
      startNodeOffset, endNodeOffset,
      collapsed: s.isCollapsed
    }
  }

  if (!s.anchorNode || s.anchorNode.parentNode.parentNode !== wavearea) return

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
const timecode = (frame) => {
  let time = o2t(frame)
  return `${Math.floor(time/60).toFixed(0)}:${(Math.floor(time)%60).toFixed(0).padStart(2,0)}`
}


// ----------- init app
const sampleSources = [
  // './asset/Krsna book 33_ rasa dance description (enhanced).wav'
  // './2022.12.13 - Законы счастливой общины-6Dn9qvAfBH0.mp4'
  // './2019.02.12 - SB 1.6.21 - Conversation between Narada and Vyasadeva (Adilabad)-EKGiwd8Y2gI.m4a'
  // 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Vivaldi_-_Magnificat_01_Magnificat.oga',
  'https://upload.wikimedia.org/wikipedia/commons/c/cf/Caja_de_m%C3%BAsica_%28PianoConcerto5_Beethoven%29.ogg',
  // 'https://upload.wikimedia.org/wikipedia/commons/9/96/Carcassi_Op_60_No_1.ogg',
]

async function init() {
  state.loading = true

  try {
    // collect operation from URL, like src=path/to/file&sub=from:to&br=a,b,c
    for (const [op, value] of url.searchParams) {
      console.log(op, value);
    }

    // if URL has no operations - put random sample
    if (!ops.length) {
      let src = sampleSources[Math.floor(Math.random() * sampleSources.length)];
      // TODO: make a history entry
      // url.searchParams.set('src', src);
      // history.pushState(null, '', url);
      ops.push(['src', src], ['norm'])
    }

    buffers = await applyOp(buffers, ...ops);
    renderWaveform(buffers);
    renderAudio(buffers);
  }
  catch (e) {
    console.error(e)
    state.error = e.message
  }

  state.loading = false
}

// render waveform
// FIXME: can rerender only diffing part
// FIXME: we may not need rerendering waveform here, hoping changes to initial file are enough
// FIXME: move to worker to check if waveform is different
const renderWaveform = (buffers) => {
  let segments = [];

  let selection = sel()

  for (let buffer of buffers) {
    let waveform = drawAudio(buffer)
    waveform = waveform.replaceAll('\u0100', ' ');
    segments.push(waveform)
  }
  state.segments = segments

  if (selection) sel(selection.start)
}

// update audio URL based on current audio buffer
const renderAudio = async (buffers) => {
  // encode into wav-able blob
  // NOTE: can't do directly source since it can be unsupported
  // console.trace('render', buffer.duration)
  URL.revokeObjectURL(audio.src);
  let wavBuffer = await encodeAudio(...buffers);
  let blob = new Blob([wavBuffer], {type:'audio/wav'});
  let time = audio.currentTime
  let url = audio.src = URL.createObjectURL( blob );
  audio.currentTime = time

  return
}

init();
