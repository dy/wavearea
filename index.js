import 'audioworklet-polyfill';

const wavearea = document.getElementById('wavearea')
const playback = document.getElementById('playback')

navigator.mediaDevices.getUserMedia({audio: true}).then(record)

const chunks = []
function record (stream) {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 4096;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Float32Array(bufferLength);
  source.connect(analyser);

  let stop = false
  setTimeout(() => {
    stop = true
    source.disconnect()
    mediaRecorder.stop()
  }, 1000)

  const mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = function(e) {
    chunks.push(e.data);
    draw()
    e.data.arrayBuffer().then(buf => {
      console.log('append', buf)
      sourceBuffer.push(buf);
      sourceBuffer.push(buf);
      sourceBuffer.push(buf);
    })
  }
  // mediaRecorder.start(1000*analyser.fftSize/audioCtx.sampleRate)
  mediaRecorder.start()

  function draw() {
    analyser.getFloatTimeDomainData(dataArray);
    let ssum = 0
    for (let i = 0; i < dataArray.length; i++) ssum += dataArray[i] * dataArray[i]
    const rms = Math.sqrt(ssum / dataArray.length)
    wavearea.append( String.fromCharCode(0x0100 + Math.floor(rms * 100)))
  }
}


// create playback stream - anything flushed into sourceBuffer will be played
var mimeCodec = 'audio/webm;codecs=opus';
var mediaSource = new MediaSource(), sourceBuffer;
playback.src = URL.createObjectURL(mediaSource);
const queue = []
mediaSource.addEventListener('sourceopen', () => {
  sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
  sourceBuffer.onerror = e => console.error(e)
  sourceBuffer.mode = 'sequence'
  // sourceBuffer.onupdate = e => console.log('update',e)
  sourceBuffer.onupdateend = e => {
    console.log('updateend',sourceBuffer)
    // sourceBuffer.timestampOffset += 1000
    sourceBuffer.flush()
  }
  sourceBuffer.push = (buf) => (queue.push(buf), sourceBuffer.flush())
  sourceBuffer.flush = () => {
    if (sourceBuffer.updating) return
    buf = queue.shift()
    console.log('flush', buf)
    if (buf) sourceBuffer.appendBuffer(buf)
  }
});

// play clicked chunk
// wavearea.addEventListener('input', caretchange)
// wavearea.addEventListener('touchstart', caretchange)
// wavearea.addEventListener('mousedown', caretchange)
// wavearea.addEventListener('select', caretchange)
// wavearea.addEventListener('keydown', caretchange)

// function caretchange(){
//   console.log(wavearea.selectionStart)
//   chunks[wavearea.selectionStart].arrayBuffer().then(buf => {
//     console.log('append', buf)
//     sourceBuffer.appendBuffer(buf);
//   })
// }
