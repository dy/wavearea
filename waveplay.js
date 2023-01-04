import '@github/file-attachment-element';
import sprae from 'sprae';
import * as au from './source/audio-util.js';


window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;

let state = sprae(document.querySelector('.waveedit'), {
  // params
  loading: true,
  recording: false,
  playing: false,
  volume: 1,

  error: null,

  // current audio buffer
  buffer: null,

  // current displayed waveform text
  waveform: '',

  // current playable audio data
  wavURL: '',

  // selection -> audio current time
  trackCaret(e) {
    const {wavearea, audio} = state
    const track = (e) => {
      if (!state.playing) audio.currentTime = au.time(wavearea.selectionStart)
    }
    const evts = 'keypress keydown mousedown click touchstart input select selectstart paste cut change'.split(' ')
    evts.map(evt => wavearea.addEventListener(evt, track))
    return () => evts.map(evt => wavearea.removeEventListener(evt, track))
  },

  handleInput(e) {
    let el = this
    let newWaveform = el.value
    let { waveform, buffer } = state
    let start = el.selectionStart

    // was it deleted?
    if (newWaveform.length < waveform.length) {
      // segment that was deleted
      let from = start * au.BLOCK_SIZE,
          to = (start + waveform.length - newWaveform.length) * au.BLOCK_SIZE;
          state.buffer = au.remove(buffer, from, to)
    }

    // FIXME: support multiple delete events
    clearTimeout(el._id)
    el._id = setTimeout(() => {
      state.render()
    }, 700)
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

    state.audio.onload = () => { URL.revokeObjectURL(state.wavURL); }

    // render waveform
    // FIXME: can rerender only diffing part
    let newWaveform = await au.draw(buffer);
    if (newWaveform !== state.waveform) state.waveform = newWaveform;
  },

  play (e) {
    let {wavearea, audio} = state
    state.playing = true;
    const startTime = audio.currentTime
    const startFrame = au.frame(startTime)
    const selection = [wavearea.selectionStart, wavearea.selectionEnd]
    const endFrame = selection[0] !== selection[1] ? selection[1] : wavearea.value.length
    let animId

    const syncCaret = () => {
      const framesPlayed = au.frame((audio.currentTime - startTime))
      const currentFrame = startFrame + framesPlayed;
      wavearea.selectionStart = wavearea.selectionEnd = currentFrame
      if (currentFrame >= endFrame) audio.pause();
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
  'https://upload.wikimedia.org/wikipedia/commons/9/9c/Vivaldi_-_Magnificat_01_Magnificat.oga',
  'https://upload.wikimedia.org/wikipedia/commons/c/cf/Caja_de_m%C3%BAsica_%28PianoConcerto5_Beethoven%29.ogg',
  'https://upload.wikimedia.org/wikipedia/commons/9/96/Carcassi_Op_60_No_1.ogg',
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