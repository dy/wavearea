import { useEffect, useRef } from 'preact/hooks'
import Loader from './loader'
import { signal, useComputed, useSignal } from '@preact/signals'

import { drawAudio, fileToArrayBuffer, fetchAudio, encodeAudio } from '../audio-utils';
import playClip from '../play-loop';
import measureLatency from '../measure-latency';

history.scrollRestoration = 'manual'

const audio = new Audio

// init backend - receives messages from worker with rendered audio & waveform
const worker = new Worker('./dist/worker.js', { type: "module" });



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
  latency.value = await measureLatency()
  console.log('measured latency', latency.value)
}
wavearea.addEventListener('touchstart', whatsLatency)
wavearea.addEventListener('mousedown', whatsLatency)
wavearea.addEventListener('keydown', whatsLatency)

// get/set normalized selection
/**
 *
 * @param {number | Array} start – absolute offset (excluding modifier chars) or relative offset [node, offset]
 * @param {number | Array} end – absolute offset (excluding modifier chars) or relative offset [node, offset]
 * @returns {start, startNode, startNodeOffset, end, endNode, endNodeOffset, collapsed, range}
 */
const selection = (start, end) => {
  let s = window.getSelection()

  // set selection, if passed
  if (start != null) {
    if (Array.isArray(start)) start = absOffset(...start)
    if (Array.isArray(end)) end = absOffset(...end)

    // start/end must be within limits
    start = Math.max(0, start)
    if (end == null) end = start

    // find start/end nodes
    let [startNode, startNodeOffset] = relOffset(start)
    let [endNode, endNodeOffset] = relOffset(end)

    let currentRange = s.getRangeAt(0)
    if (
      !(currentRange.startContainer === startNode.firstChild && currentRange.startOffset === startNodeOffset) &&
      !(currentRange.endContainer === endNode.firstChild && currentRange.endOffset === endNodeOffset)
    ) {
      // NOTE: Safari doesn't support reusing range
      s.removeAllRanges()
      let range = new Range()
      range.setStart(startNode.firstChild, startNodeOffset)
      range.setEnd(endNode.firstChild, endNodeOffset)
      s.addRange(range)
    }

    return {
      start, startNode, end, endNode,
      startNodeOffset, endNodeOffset,
      collapsed: s.isCollapsed,
      range: s.getRangeAt(0)
    }
  }

  if (!s.anchorNode || !editarea.contains(s.anchorNode)) return

  // collect start/end offsets
  start = absOffset(s.anchorNode, s.anchorOffset), end = absOffset(s.focusNode, s.focusOffset)

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
    collapsed: s.isCollapsed,
    range: s.getRangeAt(0)
  }
}


// start playback
function play(e) {
  state.playing = true;
  state.scrolling = false;
  editarea.focus();

  // from the end to the beginning
  if (state.caretOffset === state.total) selection(state.caretOffset = state.clipStart = 0)

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
    if (!state.selecting) {
      let playedTime = (performance.now() * 0.001 - state._startTime);
      let currentBlock = Math.min(state._startTimeOffset + Math.round(state.total * playedTime / state.duration), state.total)
      if (loop) currentBlock = Math.min(currentBlock, clipEnd)

      let sel = selection(state.caretOffset = currentBlock)

      state.updateCaretLine(sel)
      state.scrollIntoCaret();
    }
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
    if (state.loop) selection(clipStart, clipEnd)

    // adjust end caret position
    else if (audio.currentTime >= audio.duration) selection(state.total)

    editarea.focus()
  }
}





export default function Wavearea({
  time = 'mm:ss', // TODO
  wrap = true, // TODO
  theme = ['black'], // TODO
  channels = 1, // TODO number of input channels (planar)
  bands = 1, // TODO number of f bands
  blocksize = 1024, // TODO
  weighting = false, // TODO
  operations = [], // TODO
  settings = false, // TODO
  playback = false, // TODO: inline, etc., maybe do via child element
  readonly = false, // TODO
  history = false, // TODO
  labels = false, // TODO
  loader = false // TODO
}) {
  const waveareaRef = useRef()
  const editareaRef = useRef()
  const caretLineRef = useRef()
  const waveformRef = useRef()

  // state
  const
    loading = useSignal(false),
    recording = useSignal(false),
    playing = useSignal(false),
    selecting = useSignal(false),
    isMouseDown = useSignal(false),
    scrolling = useSignal(false),

    // current playback start/end time
    clipStart = useSignal(0),
    loop = useSignal(false),
    clipEnd = useSignal(null),
    _startTime = useSignal(0),
    _startTimeOffset = useSignal(0),

    volume = useSignal(1),

    latency = useSignal(0), // time between playback and the first sample

    // waveform segments
    segments = useSignal([]),
    total = useSignal(0), // # segments
    duration = useSignal(0), // duration (received from backend)

    caretOffscreen = useSignal(0), // +1 if caret is below, -1 above viewport
    caretOffset = useSignal(0), // current caret offset, characters

    // chars per line (~5s with block==1024)
    // FIXME: make responsive
    cols = useSignal(216);


  const sel = useSignal()
  const caret = useComputed(() => {
    // update caret x/y coordinate
    let rects = sel.range.getClientRects()
    let rect = rects[rects.length - 1]
    return [rect.right, rect.top]
  })

  // create timecodes nodes
  const timecodes = useComputed(() => {
    const segNodes = editareaRef.current?.children || []

    // output timecodes based on counting lines
    // FIXME: can likely be done simpler from mapping segments divided by cols
    let offset = 0, timecodes = [], len = cols.value || 0
    for (let segNode of segNodes) {
      let range = new Range
      range.selectNodeContents(segNode)
      let lines = Math.round(range.getBoundingClientRect().height / range.getClientRects()[1].height)
      // let lines = Math.ceil(cleanText(segNode.textContent).length / state.cols) || 1;
      for (let i = 0; i < lines; i++) {
        let tc = timecode(i * len + offset)
        timecodes.push(<a href={`#${tc}`}>{tc}</a>)
      }
      offset += segNode.textContent.length
    }
    return timecodes
  })

  // caret repositioned my mouse
  async function handleCaret() {
    // we need to do that in order to capture only manual selection change, not as result of programmatic caret move
    // let sel = selection()
    // // skip unchanged
    // if (!sel || (sel.start === caretOffset.peek() && sel.collapsed)) return

    const s = window.getSelection()
    caretOffset.value = absOffset(s.anchorNode, s.anchorOffset)
    console.log(caretOffset.value)

    // update caret x/y coordinate
    // let rects = sel.range.getClientRects()
    // let rect = rects[rects.length - 1]
    // state.caretX = rect.right
    // state.caretY = rect.top

    // FIXME: make via computed
    // state.clipStart = caretOffset.value;
    // if (!state.playing) {
    //   state.clipEnd = !sel.collapsed ? sel.end : state.total;
    //   state.loop = audio.loop = !sel.collapsed;
    // }
    // else {
    //   // FIXME: latency compensation in Safari: not perfect, but better than nothing
    //   state._startTime = (performance.now() + state.latency) * 0.001
    //   state._startTimeOffset = state.caretOffset
    // }

    // // audio.currentTime converts to float32 which may cause artifacts with caret jitter
    // audio.currentTime = state.duration * state.caretOffset / state.total;
  }

  async function handleBeforeInput(e) {
    let handler = inputHandlers[e.inputType];
    if (!handler) {
      e.preventDefault();
      e.stopPropagation();
      // avoid double space insertion (osx)
      if (e.data === '. ') selection(state.caretOffset)
    } else {
      handler.call(this, e);
    }
  }

  async function handleDrop(e) {
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
  }

  async function handleFile(e) {
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
  }

  function scrollIntoCaret() {
    if (state.caretOffscreen && !state.scrolling) {
      caretLinePointer.scrollIntoView({ behavior: 'smooth', block: 'center' })
      state.scrolling = true
      setTimeout(() => (state.scrolling = false), 108)
    }
  }

  // produce display time from frames
  function timecode(block, ms = 0) {
    let time = ((block / total.value)) * duration.value || 0
    return `${Math.floor(time / 60).toFixed(0)}:${(Math.floor(time) % 60).toFixed(0).padStart(2, 0)}${ms ? `.${(time % 1).toFixed(ms).slice(2).padStart(ms)}` : ''}`
  }

  // current caret line position observer (for play button and line display)
  useEffect(() => {
    if (!caretLineRef.current) return
    const caretObserver = new IntersectionObserver(([item]) => {
      caretOffscreen.value = item.isIntersecting ? 0 :
        (item.intersectionRect.top <= item.rootBounds.top ? 1 :
          item.intersectionRect.bottom >= item.rootBounds.bottom ? -1 :
            0);
    }, {
      // root: document,
      threshold: 0.999,
      rootMargin: '0px'
    });
    caretObserver.observe(caretLineRef.current);
    return () => caretObserver.disconnect()
  }, [editareaRef.current])

  useEffect(() => {
    if (!editareaRef.current) return
    // create line width observer
    const resizeObserver = new ResizeObserver((entries) => {
      // let width = entries[0].contentRect.width
      cols.value = measureCharsPerLine(editareaRef.current)
    })
    resizeObserver.observe(editareaRef.current);
  }, [editareaRef.current])

  // init component
  useEffect(async () => {
    if (!editareaRef.current) return

    const src = [
      'https://upload.wikimedia.org/wikipedia/commons/9/9c/Vivaldi_-_Magnificat_01_Magnificat.oga',
      // 'https://upload.wikimedia.org/wikipedia/commons/c/cf/Caja_de_m%C3%BAsica_%28PianoConcerto5_Beethoven%29.ogg',
      // 'https://upload.wikimedia.org/wikipedia/commons/9/96/Carcassi_Op_60_No_1.ogg',
    ]

    const audioBuffer = await fetchAudio(src[0])

    duration.value = audioBuffer.duration

    // render segments
    segments.value = [await drawAudio(audioBuffer)]

    // FIXME: assert waveform same as current content (must be!)
    total.value = segments.value.reduce((total, seg) => total += cleanText(seg).length, 0);

    let wavBuffer = await encodeAudio(audioBuffer);
    let blob = new Blob([wavBuffer], { type: 'audio/wav' });
    let url = URL.createObjectURL(blob);
    // URL.revokeObjectURL(audio.src) // can be persisted from history, so we keep it
    audio.src = url
    audio.preload = "metadata" // preload avoids redundant fetch requests and needed by Safari

    // audio.addEventListener('error', nok)
    // audio.addEventListener('loadedmetadata', () => {
    //   audio.currentTime = duration * state.caretOffset / state.total || 0
    // }, { once: true });
  }, [])

  // update timecodes
  useEffect(() => {
    cols.value = measureCharsPerLine(editareaRef.current)
  }, [segments.value])

  return <div className="wavearea" ref={waveareaRef} onpopstate_window={e => goto(e.state)}
    onmousedown_document__onmouseup_document={e => (isMouseDown.value = true, e => isMouseDown.value = false)}>
    {loader && <Loader />}
    <div class="w-container" onkeydown_arrow={e => raf(handleCaret)}
      onSelectStart={e => handleCaret()}
    // onselectionchange_document={e => (!playing && (e.stopImmediatePropagation(), selecting.value = false, handleCaret(e)))}
    // onselectstart__onselectionchange_document_once={e => (selecting.value = true, () => (selecting.value = false, handleCaret()))}
    >
      <div class="w-waveform" ref={waveformRef} style={{
        '--cols': cols.value,
        '--carety': (waveformRef.current ? caret[1] - waveformRef.current.getBoundingClientRect().top : 0) + 'px',
        '--caretx': (waveformRef.current ? caret[0] - waveformRef.current.getBoundingClientRect().left : 0) + 'px'
      }}>
        <span class="w-caret-line" ref={caretLineRef}></span>
        <div ref={editareaRef} contenteditable inputmode="none"
          class={"w-editable wavefont " + (playing ? 'w-playing' : '')}
          onInput={e => (handleCaret(e))}
          onbeforeinput={handleBeforeInput}
          ondblclick={e => e.preventDefault()}
          ondragenter__ondragleaveondragenter__ondrop={e => (this.classList.add('w-dragover'), e => this.classList.remove('w-dragover'))}
          ondrop={e => console.log(e.dataTransfer.types) || e.preventDefault()}>{
            segments.value.map((segment, id) =>
              <p class="w-segment" data-id={id}>{segment}</p>
            )
          }</div>
        <div class="w-timecodes">{timecodes.value}</div>
      </div>
    </div>
  </div >
}

// calculate absolute offset from relative pair
function absOffset(node, relOffset) {
  let prevNode = node.parentNode.closest('.w-segment')
  let offset = cleanText(prevNode.textContent.slice(0, relOffset)).length
  while (prevNode = prevNode.previousSibling) offset += cleanText(prevNode.textContent).length
  return offset
}

// calculate node and relative offset from absolute offset
function relOffset(offset) {
  let node = editarea.firstChild, len
  // discount previous nodes
  while (offset > (len = cleanText(node.textContent).length)) {
    offset -= len, node = node.nextSibling
  }
  // convert current node to relative offset
  let skip = 0
  for (let content = node.textContent, i = 0; i < offset; i++) {
    while (content[i + skip] >= '\u0300') skip++
  }
  return [node, offset + skip]
}


// inspired by https://www.bennadel.com/blog/4310-detecting-rendered-line-breaks-in-a-text-node-in-javascript.htm
// measure number of characters per line
function measureCharsPerLine(editarea) {
  if (!editarea.firstChild) return
  let textNode = editarea.firstChild.firstChild
  let range = new Range();
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

// return clean from modifiers text
function cleanText(str) {
  return str.replace(/\u0300|\u0301/g, '')
}
