import '@github/file-attachment-element';
import sprae from 'sprae';
import * as au from '@audio-util';


window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;

let state = sprae(document.querySelector('.waveedit'), {
  // params
  loading: true,
  recording: false,
  playing: false,
  volume: 1,

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
      if (selection[0] !== selection[1]) wavearea.selectionStart = startFrame, wavearea.selectionEnd = endFrame
    }
  }
});


// init app
async function init() {
  state.loading = true;

  // try loading existing audio, if any
  let arrayBuffer// = await au.load();

  // fetch default audio, if not found in storage
  if (!arrayBuffer) {
    console.log('loading default audio');
    // return;
    arrayBuffer = await au.fetch('./asset/Iskcon-manifest(enhanced).wav');
  }

  // set playable piece
  const blob = new Blob([arrayBuffer], { type: "audio/wav" });
  state.wavURL = URL.createObjectURL(blob);
  state.audio.onload = (e) => { URL.revokeObjectURL(state.wavURL); }

  // decode data
  const audioBuffer = await au.decode(arrayBuffer);
  // render waveform
  state.waveform = await au.draw(audioBuffer);

  state.loading = false
}

init();