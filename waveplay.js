import '@github/file-attachment-element';
import sprae from 'sprae';
import * as au from './source/audio-util.js';


window.BlobBuilder ||= window.WebKitBlobBuilder || window.MozBlobBuilder;

let isMouseDown
document.addEventListener('mousedown', ()=> isMouseDown = true)
document.addEventListener('mouseup', ()=> isMouseDown = false)

let state = sprae(document.querySelector('.waveedit'), {
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

  // caret repositioned my mouse or TODO: otherwise
  handleCaret(e) {
    let w = e.target
    state.startFrame = au.frame(state.audio.currentTime = au.time(w.selectionStart))
    state.endFrame = w.selectionEnd === w.selectionStart ? w.value.length : w.selectionEnd
  },

  // enter or delete characters
  handleInput(e) {
    let el = this
    let { waveform } = state
    let start = el.selectionStart

    // ignore unchanged
    if (waveform.length === el.value.length && waveform === el.value) return

    // FIXME: support multiple delete events
    clearTimeout(el._id)

    el._id = setTimeout(() => {
      let newWaveform = el.value

      // was it deleted?
      if (newWaveform.length < waveform.length) {
        // segment that was deleted
        let from = start * au.BLOCK_SIZE,
            to = (start + waveform.length - newWaveform.length) * au.BLOCK_SIZE;
            console.log('remove')
            state.buffer = au.remove(state.buffer, from, to)
      }
      // it was added - detect added parts
      else {
        // detect spaces
        for (let i = 0; i < newWaveform.length; i++) {
          let c = newWaveform[i]
          if (c === ' ') {
            let from = i
            for (; i < newWaveform.length; i++) if (newWaveform[i] !== ' ') break;
            state.buffer = au.insert(state.buffer, from * au.BLOCK_SIZE, au.silence((i - from) * au.BLOCK_SIZE))
          }
        }
      }

      state.render()
    }, 700)
  },

  // audio time changes
  timeChange(e) {
    // ignore if event comes from wavearea
    if (document.activeElement === state.wavearea) return
    state.wavearea.selectionStart = state.wavearea.selectionEnd = state.startFrame = au.frame(state.audio.currentTime)
    state.wavearea.focus()
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
    state.audio.currentTime = au.time(state.wavearea.selectionStart);
    state.audio.onload = () => { URL.revokeObjectURL(state.wavURL); }

    // render waveform
    // FIXME: can rerender only diffing part
    let newWaveform = await au.draw(buffer);
    let from = state.wavearea.selectionStart;
    // prevent
    if (newWaveform !== state.waveform) state.waveform = newWaveform;
    state.wavearea.selectionStart = state.wavearea.selectionEnd = from;
  },

  play (e) {
    let {wavearea, audio} = state;
    state.playing = true;
    state.startFrame = wavearea.selectionStart;
    const selection = [wavearea.selectionStart, wavearea.selectionEnd];
    state.endFrame = selection[0] !== selection[1] ? selection[1] : wavearea.value.length;

    let animId

    const syncCaret = () => {
      const framesPlayed = au.frame(audio.currentTime) - state.startFrame
      const currentFrame = state.startFrame + framesPlayed;
      // Prevent updating during the click
      if (!isMouseDown) wavearea.selectionStart = wavearea.selectionEnd = currentFrame
      if (state.endFrame && currentFrame >= state.endFrame) audio.pause();
      else animId = requestAnimationFrame(syncCaret)
    }
    syncCaret()

    wavearea.focus();

    return () => {
      state.playing = false
      cancelAnimationFrame(animId), animId = null

      // return selection if there was any
      if (selection[0] !== selection[1]) {
        wavearea.selectionStart = startFrame, wavearea.selectionEnd = endFrame
      }

      // adjust end caret position
      if (audio.currentTime >= audio.duration) {
        wavearea.selectionStart = wavearea.selectionEnd = state.waveform.length
      }

      wavearea.focus()
    }
  }
});


const sampleSources = [
  // './asset/Krsna book 33_ rasa dance description (enhanced).wav'
  // './2022.12.13 - Законы счастливой общины-6Dn9qvAfBH0.mp4'
  // './2019.02.12 - SB 1.6.21 - Conversation between Narada and Vyasadeva (Adilabad)-EKGiwd8Y2gI.m4a'
  'https://upload.wikimedia.org/wikipedia/commons/9/9c/Vivaldi_-_Magnificat_01_Magnificat.oga',
  // 'https://upload.wikimedia.org/wikipedia/commons/c/cf/Caja_de_m%C3%BAsica_%28PianoConcerto5_Beethoven%29.ogg',
  // 'https://upload.wikimedia.org/wikipedia/commons/9/96/Carcassi_Op_60_No_1.ogg',
]

const setSrc = src => {
  const url = new URL(location.href);
  url.searchParams.set('src', src);
  history.pushState(null, '', url);
}

// init app
async function init(src=sampleSources[Math.floor(Math.random() * sampleSources.length)]) {
  state.loading = true;

  try {
    // try loading existing audio, if any
    let arrayBuffer// = await au.load();

    // fetch default audio, if not found in storage
    console.log('loading default audio');
    setSrc(src);
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

init();
