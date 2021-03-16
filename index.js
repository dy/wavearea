import {reposition} from 'nanopop';

import recordIcon from './asset/record.svg'; // ⏺
import stopIcon from './asset/stop.svg'; // ⏹
import playIcon from './asset/play.svg'; // ▶
import pauseIcon from './asset/pause.svg'; // ⏸
import downloadIcon from './asset/download.svg'; // ⬇⭳⤓
import settingsIcon from './asset/settings.svg';

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
      this.paused ? this.play() : this.pause()
      this.textarea.focus()
    })
    this.recordButton.addEventListener('click', e => {
      this.paused ? this.record() : this.pause()
      this.textarea.focus()
    })

    // audio
    this.playback = document.createElement('audio')
    // NOTE: instead of timeupdate event, we schedule twice-timeslice frame renderer
    // this.playback.addEventListener('timeupdate', e => {})

    const updateTime = e => (
      this.playback.currentTime = this.playback.duration * this.textarea.selectionStart / this.chunks.length
    )
    this.textarea.addEventListener('click', updateTime)

    const updateCaret = () => {
      if (this.playing) {
        // const framesPlayed = Math.floor((Date.now() - startTime) * .001 / this.timeslice)
        const framesPlayed = Math.floor(this.chunks.length * this.playback.currentTime / this.playback.duration)
        this.textarea.selectionStart = framesPlayed
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
    let stream = this.stream = await navigator.mediaDevices.getUserMedia(constraints)

    this.mediaStreamSource = audioContext.createMediaStreamSource(stream);
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    this.mediaStreamSource.connect(this.analyser);
    this.recorder = new MediaRecorder(stream);
  }

  pause() {
    if (this.paused) return

    this.paused = true
    this.recordButton.innerHTML = `${recordIcon}`
    this.playButton.innerHTML = `${playIcon}`

    if (this.recording) {
      this.recorder.stop()

      // create playback chunk
      this.blob = new Blob([...this.header, ...this.chunks], { type: this.recorder.mimeType })
      this.playback.src = window.URL.createObjectURL(this.blob)
      // this.playback.srcObject = stream

      const playback = this.playback
      playback.addEventListener('loadedmetadata', function f() {
        playback.removeEventListener('loadedmetadata', f)
        // Chrome bug: https://bugs.chromium.org/p/chromium/issues/detail?id=642012
        if (playback.duration === Infinity) {
          playback.currentTime = Number.MAX_SAFE_INTEGER
          playback.ontimeupdate = () => {
            playback.ontimeupdate = null
            // console.log('ontimeupdate',playback.duration)
            // playback.currentTime = 0
          }
        }
        // Normal behavior
        // else console.log('immediate',playback.duration)
      })
    }

    if (this.playing) this.playback.pause()

    clearInterval(this.interval)
  }

  play() {
    // reset recording
    if (!this.paused) this.pause();

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

  async record() {
    if (!this.recorder) await this.initRecorder()

    this.paused = false
    this.recordButton.innerHTML = `${pauseIcon}`


    const dataArray = new Float32Array(this.analyser.fftSize);

    // FIXME: there's discrepancy of calculated samples and played ones
    this.timeslice = (this.analyser.fftSize)/this.audioContext.sampleRate

    this.timestamps = []
    let last = Date.now()
    this.recorder.ondataavailable = (e) => {
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
        this.textarea.append( String.fromCharCode(0x0100 + Math.floor(rms * 100)))
        this.textarea.selectionStart = this.textarea.textContent.length
      }
    }

    // NOTE: this method is way more precise than the next one
    this.recorder.start()
    this.interval = setInterval(() => this.recorder.requestData(), 1000 * this.timeslice)
    // this.recorder.start(1000 * this.timeslice)
  }
}


