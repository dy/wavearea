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
  timeslice = null

  constructor (textarea, o={}) {
    // DOM
    this.textarea = textarea
    this.textarea.style.lineHeight = 1

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
    this.playButton.addEventListener('click', e => this.paused ? this.play() : this.pause())
    this.recordButton.addEventListener('click', e => this.paused ? this.record() : this.pause())

    // audio
    this.playback = document.createElement('audio')
  }

  async initRecorder() {
    let stream = this.stream = await navigator.mediaDevices.getUserMedia({audio: true})

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    source.connect(analyser);
    const dataArray = new Float32Array(bufferLength);

    this.timeslice = analyser.fftSize/audioContext.sampleRate

    this.recorder = new MediaRecorder(stream);
    this.recorder.ondataavailable = (e) => {
      // no need to turn data into array buffers, unless we're able to read them instead of Web-Audio-API
      this.chunks.push(e.data)

      // FIXME: capture header
      if (this.chunks.length > 2) {
        // FIXME: is that possible to read data from audio chunks?
        analyser.getFloatTimeDomainData(dataArray);
        let ssum = 0
        for (let i = 0; i < dataArray.length; i++) ssum += dataArray[i] * dataArray[i]
        const rms = Math.sqrt(ssum / dataArray.length)
        this.textarea.append( String.fromCharCode(0x0100 + Math.floor(rms * 100)))
      }
    }
  }

  pause() {
    this.paused = true
    this.recordButton.innerHTML = `${recordIcon}`
    this.playButton.innerHTML = `${playIcon}`

    this.recorder.stop()
  }

  play() {
    this.paused = false
    this.playButton.innerHTML = `${pauseIcon}`

    const from = Math.max(wavearea.selectionStart, 2), to = wavearea.selectionEnd
    const frag = from === to ? chunks.slice(from) : chunks.slice(from, to)
    // NOTE: initial 2-3 chunks are required for playback source validity
    // these chunks can be seen on waveform
    // FIXME: ideally delegate to webworker?
    frag.unshift(chunks[0], chunks[1])
    let blob = new Blob(frag, { type: recorder.mimeType })
    playback.src = window.URL.createObjectURL(blob)

    // FIXME: chrome is picky for min chunk length, it disregards short chunks, that's why we can only do playback.src
    // maybe that's possible to workaround by merging chunks, who knows
    // create playback stream - anything flushed into sourceBuffer will be played
    // var mediaSource = new MediaSource();
    // playback.src = URL.createObjectURL(mediaSource);
    // var sourceopen = new Promise(resolve => console.log('sourceopen') || mediaSource.addEventListener('sourceopen', resolve));

    // console.log('add chunks', wavearea.selectionStart, queue)
    // await sourceopen
    // const sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
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
    if (!this.stream) await this.initRecorder()

    this.paused = false
    this.recordButton.innerHTML = `${pauseIcon}`

    // recorder.start()
    this.recorder.start(1000 * this.timeslice)
  }
}


