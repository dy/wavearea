import 'audioworklet-polyfill';

const wavearea = document.getElementById('wavearea')

navigator.mediaDevices.getUserMedia({audio: true}).then(init)

function init (stream) {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Float32Array(bufferLength);
  source.connect(analyser);
  // analyser.connect(audioCtx.destination);

  let stop = false

  requestAnimationFrame(function draw() {
    analyser.getFloatTimeDomainData(dataArray);
    let ssum = 0
    for (let i = 0; i < dataArray.length; i++) ssum += dataArray[i] * dataArray[i]
    const rms = Math.sqrt(ssum / dataArray.length)
    wavearea.append( String.fromCharCode(0x0100 + Math.floor(rms * 100)))
    if (!stop) requestAnimationFrame(draw)
  })

  setTimeout(() => {
    stop = true
    source.disconnect()
  }, 40000)

  // const chunks = []
  // const mediaRecorder = new MediaRecorder(stream);
  // mediaRecorder.ondataavailable = function(e) {
  //   chunks.push(e.data);
  //   console.log(e)
  //   analyser.getByteTimeDomainData(dataArray);
  // }
  // mediaRecorder.start(analyser.fftSize/audioCtx.sampleRate)
}

