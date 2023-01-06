// import '@github/file-attachment-element';
import sprae from 'sprae';
import * as au from './source/audio-util.js';

window.BlobBuilder ||= window.WebKitBlobBuilder || window.MozBlobBuilder;

// track if mouse is pressed - needed to workaround caret pos reset
let isMouseDown
document.addEventListener('mousedown', ()=> isMouseDown = true)
document.addEventListener('mouseup', ()=> isMouseDown = false)

// refs
const waveplay = document.querySelector('.waveplay')
const wavearea = waveplay.querySelector('.w-wavearea')
const audio = waveplay.querySelector('.w-playback')

// init markup
let state = sprae(waveplay, {
  // params
  loading: true,
  recording: false,
  playing: false,
  selecting: false,

  // current playback start/end time
  startFrame: 0,
  endFrame: null,

  volume: 1,

  // TODO: display error and state in audio element
  error: null,

  // current audio buffer
  buffer: null,

  // current displayed waveform text
  waveform: '',

  // current playable audio data
  wavURL: '',

  // caret repositioned my mouse
  handleCaret(e) {
    state.startFrame = au.frame(audio.currentTime = au.time(sel().start))
    state.endFrame = sel().collapsed ? state.waveform.length : sel().end
  },

  // key pressed
  handleKey(e) {
    // insert line break manually
    if (e.key === 'Enter') {
      e.preventDefault()
      // let res = wavearea.firstChild.splitText(sel.start)
      // wavearea.firstChild.after(document.createElement('br'))
    }
  },

  // enter or delete characters
  handleInput(e) {
    let { waveform } = state
    let start = sel().start
    let newWaveform = wavearea.textContent

    // ignore unchanged
    if (waveform.length === newWaveform.length && waveform === newWaveform) return

    // debounce
    clearTimeout(wavearea._id)

    wavearea._id = setTimeout(() => {
      // was it deleted?
      if (newWaveform.length < waveform.length) {
        // segment that was deleted
        let from = start * au.BLOCK_SIZE,
            to = (start + waveform.length - newWaveform.length) * au.BLOCK_SIZE;
            state.buffer = au.remove(state.buffer, from, to)
      }
      // it was added - detect added parts
      else {
        // detect spaces & insert silence
        let spaces = newWaveform.match(/\s+/)
        if (spaces) {
          let from = spaces.index, len = spaces[0].length
          state.buffer = au.insert(state.buffer, from * au.BLOCK_SIZE, au.silence(len * au.BLOCK_SIZE))
        }
      }

      state.render()
    }, 700)
  },

  // audio time changes
  timeChange(e) {
    // ignore if event comes from wavearea
    if (document.activeElement === wavearea) return
    sel(state.startFrame = au.frame(audio.currentTime))
    wavearea.focus()
  },

  // update audio URL based on current audio buffer
  async render () {
    const {buffer} = state;

    // encode into wav-able blob
    // NOTE: can't do directly source since it can be unsupported
    // console.trace('render', buffer.duration)
    let wavBuffer = await au.encode(buffer);
    let blob = new Blob([wavBuffer], {type:'audio/wav'});
    state.wavURL = URL.createObjectURL( blob );

    // keep proper start time
    let selection = sel()
    if (selection) audio.currentTime = au.time(selection.start);
    audio.onload = () => { URL.revokeObjectURL(state.wavURL); }

    // render waveform
    // FIXME: can rerender only diffing part
    let newWaveform = await au.draw(buffer);
    if (newWaveform !== state.waveform) state.waveform = newWaveform;
    if (selection) sel(selection.start);
  },

  play (e) {
    state.playing = true;
    let selection = sel()
    if (!selection) selection = sel(0)

    state.startFrame = selection.start
    state.endFrame = selection.start !== selection.end ? selection.end : state.waveform.length;

    let animId

    const syncCaret = () => {
      const framesPlayed = au.frame(audio.currentTime) - state.startFrame
      const currentFrame = state.startFrame + framesPlayed;
      // Prevent updating during the click
      if (!isMouseDown) sel(currentFrame)
      if (state.endFrame && currentFrame >= state.endFrame) audio.pause();
      else animId = requestAnimationFrame(syncCaret)
    }
    syncCaret()

    wavearea.focus();

    return () => {
      state.playing = false
      cancelAnimationFrame(animId), animId = null

      // return selection if there was any
      if (selection.start !== selection.end) {
        sel(startFrame, endFrame)
      }

      // adjust end caret position
      if (audio.currentTime >= audio.duration) {
        sel(state.waveform.length)
      }

      wavearea.focus()
    }
  }
});


// get/set selection with absolute (transparent) offsets
const sel = (start, end=start) => {
  let s = window.getSelection()

  // set, if passed
  if (start != null) {
    let startNode, endNode
    s.removeAllRanges()
    let range = new Range()

    // find start/end nodes
    startNode = wavearea.firstChild
    while (start > startNode.firstChild.data.length) start -= startNode.firstChild.data.length, startNode = startNode.nextSibling
    range.setStart(startNode.firstChild, start)

    endNode = wavearea.firstChild
    while (end > endNode.firstChild.data.length) end -= endNode.firstChild.data.length, endNode = endNode.nextSibling
    range.setEnd(endNode.firstChild, end)

    s.addRange(range)

    return {
      start, startNode, end, endNode,
      collapsed: s.isCollapsed
    }
  }

  if (!s.anchorNode || s.anchorNode.parentNode.parentNode !== wavearea) return

  // collect start/end offsets
  start = s.anchorOffset, end = s.focusOffset
  let prevNode = s.anchorNode
  while (prevNode = prevNode.previousSibling) start += prevNode.textContent.length
  prevNode = s.focusNode
  while (prevNode = prevNode.previousSibling) end += prevNode.textContent.length

  return {
    start,
    startNode: s.anchorNode,
    end,
    endNode: s.focusNode,
    collapsed: s.isCollapsed
  }
}


const sampleSources = [
  // './asset/Krsna book 33_ rasa dance description (enhanced).wav'
  // './2022.12.13 - Законы счастливой общины-6Dn9qvAfBH0.mp4'
  // './2019.02.12 - SB 1.6.21 - Conversation between Narada and Vyasadeva (Adilabad)-EKGiwd8Y2gI.m4a'
  // 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Vivaldi_-_Magnificat_01_Magnificat.oga',
  'https://upload.wikimedia.org/wikipedia/commons/c/cf/Caja_de_m%C3%BAsica_%28PianoConcerto5_Beethoven%29.ogg',
  // 'https://upload.wikimedia.org/wikipedia/commons/9/96/Carcassi_Op_60_No_1.ogg',
]

const url = new URL(location);

// init app
async function init(src) {
  state.loading = true;

  if (!src) {
    src = sampleSources[Math.floor(Math.random() * sampleSources.length)]
    url.searchParams.set('src', src);
    history.pushState(null, '', url);
  }

  try {
    // try loading persisted audio, if any
    let arrayBuffer// = await au.load();

    // fetch default audio, if not found in storage
    arrayBuffer = await au.fetch(src);

    // decode data from src
    state.buffer = await au.decode(arrayBuffer);
    state.render();
  }
  catch (e) {
    console.error(e)
    state.error = e.message;
  }

  state.loading = false
}

// load from url
init(url.searchParams.get('src'));

