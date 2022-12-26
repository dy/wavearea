import sprae from 'sprae';
import wav from 'node-wav';

const SAMPLE_RATE = 48000;
// approx. block size - close to chars length. Must be in sync with wavefont.
const BLOCK_SIZE = 1024
const audioCtx = new OfflineAudioContext(2,SAMPLE_RATE*40,SAMPLE_RATE);

let state = sprae(document.querySelector('.waveedit'), {
  // params
  loading: false,
  recording: false,
  playing: false,
  volume: 1,

  // currend audio buffer
  audioBuffer: null,

  // current displayed waveform text
  waveform: '',

  // current playable audio data
  wavURL: '',

  // selection -> audio current time
  trackCaret(e) {
    const {wavearea, audio} = state
    const track = (e) => {
      if (!state.playing) audio.currentTime = wavearea.selectionStart * BLOCK_SIZE / SAMPLE_RATE
    }
    const evts = 'keypress keydown mousedown click touchstart input select selectstart paste cut change'.split(' ')
    evts.map(evt => wavearea.addEventListener(evt, track))
    return () => evts.map(evt => wavearea.removeEventListener(evt, track))
  },

  play (e) {
    let {wavearea, audio} = state
    state.playing = true;
    const startTime = audio.currentTime
    const startFrame = Math.floor(startTime * SAMPLE_RATE / BLOCK_SIZE)
    const selection = [wavearea.selectionStart, wavearea.selectionEnd]
    const endFrame = selection[0] !== selection[1] ? selection[1] : wavearea.value.length
    let animId

    const syncCaret = () => {
      const framesPlayed = Math.floor((audio.currentTime - startTime) * SAMPLE_RATE / BLOCK_SIZE)
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
      console.log('end')
      if (selection[0] !== selection[1]) wavearea.selectionStart = startFrame, wavearea.selectionEnd = endFrame
    }
  }
});


loadAudio('./asset/Iskcon-manifest(enhanced).wav');

// load audio source
async function loadAudio(src) {
  state.loading = true;

  let resp = await fetch(src);
  if (!resp.ok) throw new Error(`HTTP error: status=${resp.status}`);

  console.time('to array buffer')
  let arrayBuffer = await resp.arrayBuffer();
  console.timeEnd('to array buffer')

  console.time('decode')
  let audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  console.timeEnd('decode')

  state.audioBuffer = audioBuffer;

  console.time('to waveform string')
  state.waveform = toWaveform(audioBuffer);
  console.timeEnd('to waveform string')

  console.time('wav encode')
  const wav = toWav(audioBuffer);
  console.timeEnd('wav encode')

  console.time('wav url')
  const blob = new Blob([wav], { type: "audio/wav" });
  state.wavURL = URL.createObjectURL(blob);
  // audio.onload = function (e) { windowURL.revokeObjectURL(this.src); }
  console.timeEnd('wav url')

  // NOTE: this guy takes 16s
  // console.time('base64')
  // state.wavURL = `data:audio/mpeg;base64,` + b64.encode(wav);
  // console.timeEnd('base64')

  state.loading = false
}

function toWav(audioBuffer) {
  let channelData = audioBuffer.getChannelData(0)
  return wav.encode([channelData], { sampleRate: audioBuffer.sampleRate, float: false, bitDepth: 16 })
}

function toWaveform(audioBuffer) {
  if (!audioBuffer) return '';

  // map waveform to wavefont
  let channelData = audioBuffer.getChannelData(0), str = ''

  // normalize waveform before rendering
  // for every channel bring it to max-min amplitude range
  let max = 0
  for (let i = 0; i < channelData.length; i++) max = Math.max(Math.abs(channelData[i]), max)
  let amp = Math.max(1 / max, 1)
  for (let i = 0; i < channelData.length; i++) channelData[i] = Math.max(Math.min(amp * channelData[i], 1),-1);

  // TODO: weight waveform by audible spectrum

  // create wavefont string
  // amp coef brings up value a bit
  const VISUAL_AMP = 2
  for (let i = 0, nextBlock = BLOCK_SIZE; i < channelData.length;) {
    let ssum = 0, sum = 0

    // avg amp method - waveform is too small
    // for (; i < nextBlock; i++) sum += Math.abs(i > channelData.length ? 0 : channelData[i])
    // const avg = sum / BLOCK_SIZE
    // str += String.fromCharCode(0x0100 + Math.ceil(avg * 100))

    // rms method:
    // drawback: waveform is smaller than needed
    for (;i < nextBlock; i++) ssum += i > channelData.length ? 0 : channelData[i] ** 2
    const rms = Math.sqrt(ssum / BLOCK_SIZE)
    str += String.fromCharCode(0x0100 + Math.min(100, Math.ceil(rms * 100 * VISUAL_AMP)))

    nextBlock += BLOCK_SIZE
  }

  return str
}