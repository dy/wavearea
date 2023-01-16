// import '@github/file-attachment-element';
import sprae from 'sprae';
import { BLOCK_SIZE, SAMPLE_RATE, t2o, o2t, t2b, drawAudio, encodeAudio } from './source/audio-util.js';
import * as Ops from './source/audio-ops.js'


// refs
const waveplay = document.querySelector('.waveplay')
const wavearea = waveplay.querySelector('.w-wavearea')
const audio = waveplay.querySelector('.w-playback')

// audio buffers & applied operations
let buffers = []
const url = new URL(location);
const ops = []


// init UI state
let state = sprae(waveplay, {
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
  lineWidth: 215,

  // current mouse state
  isMouseDown: false,

  // caret repositioned my mouse
  handleCaret(e) {
    state.startFrame = t2o(audio.currentTime = o2t(sel().start));
    // state.endFrame = sel().collapsed ? t2b(audio.duration) : sel().end;
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
    await applyOp(['br', selection.start])

    // TODO: account for existing selection that was removed (replace fragment with break)

    sel(selection.start, selection.start, 1)

    return
  },

  async handleDelete(e) {
    let selection = sel()
    let segmentId = selection.startNode.dataset.id
    if (!segmentId) throw Error('Segment id is not found, strange')
    let count = selection.end - selection.start
    let offset = selection.start - (e.key === 'Delete' ? 0 : 1)
    if (offset < 0 && !count) return // head condition
    // beginning of a segment must delete segment break, not insert delete op
    if (!selection.startNodeOffset && selection.isCollapsed) {
      // we don't want to introduce join in URL
      await applyOp(['join', selection.start])
      sel(selection.start)
    }

    else {
      //FIXME: must be done after we serialize ops in URL
      // since it modifiers set of applied ops
      let op = count ? ['del', selection.start, count] :
        ['del', offset, 1]
      ops.push(op)
      await applyOp(op)

      // recover selection
      sel(offset)
    }

  },

  async handleSpace(e) {
    console.log('space')
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
      const framesPlayed = t2o(audio.currentTime) - state.startFrame
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
  },

  // produce display time from frames
  timecode(frame) {
    let time = o2t(frame)
    return `${Math.floor(time/60).toFixed(0)}:${(time%60).toFixed(0).padStart(2,0)}`
  }
});


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

    await applyOp(...ops);
  }
  catch (e) {
    console.error(e)
    state.error = e.message
  }

  state.loading = false
}

// apply operations to buffers
async function applyOp (...ops) {
  console.log('Apply ops', ops)
  for (let [op, ...args] of ops) {
    if (!Ops[op]) throw Error('Unknown operation `' + op + '`')

    buffers = await Ops[op]?.(buffers, ...args)
  }

  // FIXME: these can be parallelized
  renderWaveform(buffers);
  renderAudio(buffers);
}


// render waveform
// FIXME: can rerender only diffing part
// FIXME: we may not need rerendering waveform here, hoping changes to initial file are enough
// FIXME: move to worker to check if waveform is different
const renderWaveform = (buffers) => {
  let segments = [];

  for (let buffer of buffers) {
    let waveform = drawAudio(buffer)
    waveform = waveform.replaceAll('\u0100', ' ');
    segments.push(waveform)
  }

  state.segments = segments
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
