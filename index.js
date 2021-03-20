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
    // NOTE: instead of timeupdate event, we schedule twice-timeslice frame renderer
    // this.playback.addEventListener('timeupdate', e => {})

    const updateTime = this.updateTime = e => (
      this.playback.currentTime = this.playback.duration * this.textarea.selectionStart / this.chunks.length
    )
    this.textarea.addEventListener('click', updateTime)

    const updateCaret = this.updateCaret = () => {
      if (this.playing) {
        // const framesPlayed = Math.floor((Date.now() - startTime) * .001 / this.timeslice)
        const framesPlayed = Math.floor(this.chunks.length * this.playback.currentTime / this.playback.duration)
        this.textarea.selectionStart = this.textarea.selectionEnd = framesPlayed
      }
      requestAnimationFrame(updateCaret)
    }
    updateCaret()
  }

  async initRecorder() {
    const audioContext = this.audioContext = new AudioContext();

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

    this.mediaStreamSource = audioContext.createMediaStreamSource(stream);
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    this.mediaStreamSource.connect(this.analyser);
    this.recorder = new MediaRecorder(stream);
  }

  play() {
    // reset recording
    if (!this.paused) this.pause();
    if (this.playback.currentTime >= this.playback.duration || this.textarea.selectionStart >= this.textarea.textLength) {
      this.playback.currentTime = 0.001;
    }

    this.paused = false
    this.playButton.innerHTML = `${pauseIcon}`

    // const fromTime = this.playback.duration * this.textarea.selectionStart / this.textarea.textContent.length
    // const frag = from === to ? this.chunks.slice(from) : this.chunks.slice(from, to)
    // let blob = new Blob([...this.header, ...frag], { type: this.recorder.mimeType })

    // FIXME: ideally, make playback fully reflect the visible range, via SourceBuffer
    // this.playback.src = window.URL.createObjectURL(blob)
    // this.playback.srcObject = stream

    // FIXME: cache(?) playback ranges
    this.playback.play()

    this.playback.onended = () => {
      this.playback.onended = null
      this.pause()
    }
    // FIXME: make a separate method when (if) full-playback method is implemented
    // FIXME: playback duration is detected wrong, since we slice chunks

    // FIXME: chrome is picky for min chunk length, it disregards short chunks, that's why we can only do playback.src
    // maybe that's possible to workaround by merging chunks, who knows
    // create playback stream - anything flushed into sourceBuffer will be played
    // var mediaSource = new MediaSource();
    // this.playback.src = URL.createObjectURL(mediaSource);
    // await new Promise(resolve => mediaSource.addEventListener('sourceopen', resolve));

    // console.log('add chunks', wavearea.selectionStart, queue)
    // const sourceBuffer = mediaSource.addSourceBuffer(this.recorder.mimeType);
    // sourceBuffer.onerror = (...e) => console.log('sourcebuffer error', ...e)
    // sourceBuffer.mode = 'sequence'

    // // sourceBuffer.onupdate = e => console.log('update',e)
    // sourceBuffer.onupdateend = e => {
    //   // console.log('updateend', sourceBuffer)
    //   // sourceBuffer.timestampOffset += chunkDuration
    //   flush()
    // }

    // const flush = () => {
    //   if (sourceBuffer.updating) return
    //   buf = queue.shift()
    //   if (buf) sourceBuffer.appendBuffer(buf)
    // }

    // flush()
  }

  // pause playback
  pause() {
    if (this.paused) return

    this.paused = true
    this.playButton.innerHTML = `${playIcon}`

    if (this.playing) this.playback.pause()
  }

  async record() {
    if (this.playing) this.pause()
    if (!this.recorder) await this.initRecorder()

    this.paused = false
    this.recordButton.innerHTML = `${pauseIcon}`

    const dataArray = new Float32Array(this.analyser.fftSize);

    // FIXME: there's discrepancy of calculated samples and played ones
    this.timeslice = (this.analyser.fftSize)/this.audioContext.sampleRate

    this.timestamps = []
    this.recorder.ondataavailable = (e) => {
      if (!e.data.size) return
      // console.log(last - (last = Date.now()), this.timeslice)
      // no need to turn data into array buffers, unless we're able to read them instead of Web-Audio-API
      // FIXME: capture header, initial 2 chunks are required for playback source validity
      if (this.header.length < 2) this.header.push(e.data)
      else {
        this.chunks.push(e.data)
        this.timestamps.push(Date.now()*.001)

        // FIXME: is that possible to read data from audio chunks?
        this.analyser.getFloatTimeDomainData(dataArray);
        let ssum = 0
        for (let i = 0; i < dataArray.length; i++) ssum += dataArray[i] * dataArray[i]
        const rms = Math.sqrt(ssum / dataArray.length)
        this.textarea.append( String.fromCharCode(0x0100 + Math.floor(rms * 100)) )
        this.textarea.selectionStart = this.textarea.textLength
        console.log('dataavailable', this.textarea.textLength)
      }
    }

    // NOTE: this method is way more precise than the next one
    // this.recorder.start()
    // this.interval = setInterval(() => this.recorder.requestData(), 1000 * this.timeslice)
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

}


// try splitting buffer to N parts, recording in parallel, generating blob
async function download() {
  const audioContext = new AudioContext();

  const mimeType = 'audio/webm;codecs=opus'

  const bufs = [], all = []
  for (let i = 0; i < 10; i++ ) {
    // 2705 - min chunk length for opus encoder in Chrome, so we increase block size to 4096 plus silent header
    let buf = new AudioBuffer({length: 4096, sampleRate: audioContext.sampleRate})
    bufs.push(buf)
    let data = buf.getChannelData(0)
    for (let j = 0; j < 4096; j++) data[j] = Math.sin(j / ((i + 1) * 2))

    // create recorders
    const source = audioContext.createBufferSource();
    source.buffer = buf;


    const chunks = []
    all.push(new Promise(r => {
      const dest = audioContext.createMediaStreamDestination();
      const recorder = new MediaRecorder(dest.stream, {mimeType});
      source.connect(dest)

      recorder.start(10)
      // delay is needed to shift encodingblocks
      source.start(0)

      recorder.ondataavailable = (e) => {
        const blob = e.data
        if (blob.size) chunks.push(blob)
      }
      recorder.onstop = e => {
        r(chunks)
      }
      source.onended = e => {
        recorder.stop()
      }
    }))
  }

  const blobs = await Promise.all(all);

  // combine multiple recorders back
  console.log(blobs)
  var blob = new Blob([...blobs[0], ...blobs.slice(1).map(b => b.slice(1)).flat()], { type : mimeType });
  let audio = document.createElement('audio')
  audio.src = URL.createObjectURL(blob);
  audio.play()
}


const event = (target, evt) => new Promise(r => target.addEventListener(evt, function fn(){target.removeEventListener(evt, fn),r()}))
