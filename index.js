import {reposition} from 'nanopop';

import recordIcon from './asset/record.svg'; // ⏺
import stopIcon from './asset/stop.svg'; // ⏹
import playIcon from './asset/play.svg'; // ▶
import pauseIcon from './asset/pause.svg'; // ⏸
import downloadIcon from './asset/download.svg'; // ⬇⭳⤓
import settingsIcon from './asset/settings.svg';

// Design considerations
// There are 2 strategies to handle data:
// a. as sequence of blobs from media stream
// b. as sequence of audio buffers, somehow converted to media stream
// For input we must support media stream (mic), oscillator/noise (raw buffers), files (blobs)
// For output we must be able to download (blob), playback (blob/raw)
// For editing we can use buffers or blobs
// If we support oscillators, editing must be buffers. (Also that gives precise audio manip benefits.)
// If we support immediate download of edited file, editing must be blobs. (otherwise we're limited to wav encoding)
// Seems that we need 1. raw chunks (audio buffers) 2. media recorder to encode them small-size

export default class Wavearea {
  paused = true
  chunks = []
  header = []
  timeslice = null
  mimeType = 'audio/webm;codecs=opus'

  get recording () {return this.recorder?.state === 'recording'}
  get playing () {return !this.playback?.paused}

  constructor (textarea, o={}) {
    // DOM
    this.textarea = textarea
    // this.textarea.style.setProperty('--size', 100)
    Object.assign(this.textarea.style, {
      lineHeight: 1,
      // paddingTop: 0,
      // fontSize: `calc(var(--size) * 1px)`,
      // backgroundSize: `10px calc(var(--size) * 1px)`,
      // backgroundPosition: `0 calc(var(--size) * 0.5px)`,
      // backgroundImage: `linear-gradient(to bottom, rgb(230, 245, 255) 1px, transparent 1px)`,
    })

    ;(this.primaryControls = document.createElement('div'))
    .innerHTML = `
      <span id="play">${playIcon}</span>
      <span id="record">${recordIcon}</span>
    `;
    this.primaryControls.style.position = 'fixed';

    ;(this.secondaryControls = document.createElement('div'))
    .innerHTML = `
      <span id="download">${downloadIcon}</span>
      <span id="settings">${settingsIcon}</span>
    `;
    this.secondaryControls.style.position = 'fixed';
    this.textarea.after(this.primaryControls)
    this.textarea.after(this.secondaryControls)

    // fix position
    this.textarea.addEventListener('focus', e => {
      reposition(this.textarea, this.primaryControls, {margin: -24, position: 'bottom-start'})
      reposition(this.textarea, this.secondaryControls, {margin: -24, position: 'bottom-end'})
    });
    const resizeObserver = new ResizeObserver(() => {
      reposition(this.textarea, this.primaryControls, {margin: -24, position: 'bottom-start'})
      reposition(this.textarea, this.secondaryControls, {margin: -24, position: 'bottom-end'})
    });
    resizeObserver.observe(this.textarea);

    [this.playButton, this.recordButton] = this.primaryControls.children;
    [this.downloadButton, this.settingsButton] = this.secondaryControls.children;

    // interactions
    this.playButton.addEventListener('click', e => {
      !this.playing ? this.play() : this.pause()
      this.textarea.focus()
    })
    this.recordButton.addEventListener('click', e => {
      !this.recording ? this.record() : this.stop()
      this.textarea.focus()
    })

    // audio
    this.playback = document.createElement('audio')
  }

  // init recorder
  async init() {
    const audioContext = new AudioContext();

    // FIXME: make configurable
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints#properties_of_audio_tracks
    const constraints = {audio: {
      autoGainControl: false,
      echoCancellation: false,
      latency: 0,
      noiseSuppression: false,
      sampleRate: audioContext.sampleRate,
      sampleSize: 16
    }}
    console.time('init recorder')
    let stream = this.stream = await navigator.mediaDevices.getUserMedia(constraints)
    console.timeEnd('init recorder')

    const streamSource = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    streamSource.connect(analyser);
    this.recorder = new MediaRecorder(stream, {mimeType: this.mimeType});

    const dataArray = new Float32Array(analyser.fftSize);
    this.timeslice = (analyser.fftSize)/audioContext.sampleRate;

    this.recorder.ondataavailable = (e) => {
      if (!e.data.size) return
      // console.log(last - (last = Date.now()), this.timeslice)
      // no need to turn data into array buffers, unless we're able to read them instead of Web-Audio-API
      // FIXME: capture header, initial 2 chunks are required for playback source validity
      if (this.header.length < 2) {
        this.header.push(e.data)
      }
      else {
        // reading loudness data from chunks is hard
        analyser.getFloatTimeDomainData(dataArray);
        let ssum = 0
        for (let i = 0; i < dataArray.length; i++) ssum += dataArray[i] * dataArray[i]
        const rms = Math.sqrt(ssum / dataArray.length)
        const bar = String.fromCharCode(0x0100 + Math.floor(rms * 100))

        // append
        if (this.textarea.selectionStart === this.textarea.textLength) {
          this.chunks.push(e.data)
          this.textarea.append( bar )
          this.textarea.selectionStart = this.textarea.textLength
        }
        // insert
        else {
          const text = this.textarea.textContent, caret = this.textarea.selectionStart
          const chunkStart = text.slice(0, caret).replace(/\s/ig,'').length;
          this.chunks.splice(chunkStart, 0, e.data)
          this.textarea.textContent = text.slice(0, caret) + bar + text.slice(caret)
          this.textarea.selectionStart = caret + 1
        }
        // console.log('dataavailable', this.textarea.textLength)
      }
    }
  }

  async record() {
    if (this.playing) this.pause()

    this.paused = false
    this.recordButton.innerHTML = `${pauseIcon}`

    if (!this.recorder) await this.init()

    // reset header to re-init it from the new recording part
    this.header = []

    // NOTE: real time intervals are different from timeslice
    this.recorder.start(1000 * this.timeslice)
  }

  // stop recording
  async stop() {
    if (this.paused) return

    this.paused = true
    this.recordButton.innerHTML = `${recordIcon}`
    this.playButton.innerHTML = `${playIcon}`

    if (this.recording) {
      this.recorder.stop()

      // it still can generate the last ondataavailable event, so we wait
      await event(this.recorder, 'stop')

      // create playback chunk
      console.log(this.chunks, this.textarea.textLength)
      this.blob = new Blob([...this.header, ...this.chunks], { type: this.recorder.mimeType })
      this.playback.src = window.URL.createObjectURL(this.blob)
      // this.playback.srcObject = stream

      await event(this.playback, 'loadedmetadata')

      // Chrome bug: https://bugs.chromium.org/p/chromium/issues/detail?id=642012
      console.log('loadedmetadata', this.playback.duration)
      if (this.playback.duration === Infinity || isNaN(this.playback.duration)) {
        this.playback.currentTime = Number.MAX_SAFE_INTEGER
        await event(this.playback, 'timeupdate')
        console.log('ontimeupdate',this.playback.duration,this.playback.currentTime)
        // playback.currentTime = 0
      }
      // Normal behavior
      // else console.log('immediate',playback.duration)
    }
  }

  async play() {
    // reset recording
    if (!this.paused) this.pause();

    if (this.textarea.selectionStart >= this.textarea.textLength) this.textarea.selectionStart = this.textarea.selectionEnd = 0

    const from = this.playback.currentTime = this.playback.duration * this.textarea.selectionStart / this.textarea.textLength

    // Bug? Setting currentTime to 0 doesn't reset playback
    this.playback.currentTime = Math.max(from, 0.001)

    const to = this.textarea.selectionStart === this.textarea.selectionEnd ? this.playback.duration :
      this.playback.duration * this.textarea.selectionEnd / this.textarea.textLength

    this.paused = false
    this.playButton.innerHTML = `${pauseIcon}`

    this.playback.play()

    await Promise.any([event(this.playback, 'ended'), until(() => {
      // update caret
      const framesPlayed = Math.floor(this.chunks.length * this.playback.currentTime / this.playback.duration)
      this.textarea.selectionStart = this.textarea.selectionEnd = framesPlayed

      return this.paused || this.playback.currentTime >= to
    })])
    this.pause()
  }

  // pause playback
  pause() {
    if (this.paused) return

    this.paused = true
    this.playButton.innerHTML = `${playIcon}`

    if (this.playing) this.playback.pause()
  }
}


// wait until event
const event = (target, evt) => new Promise(r => target.addEventListener(evt, function fn(){target.removeEventListener(evt, fn),r()}))

// wait until condition
const until = (cond) => new Promise(r => {
  const check = () => cond() ? r() : requestAnimationFrame(check)
  check()
})
