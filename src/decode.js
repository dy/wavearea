// audio decoders
import audioType from 'audio-type'
import AudioBuffer from 'audio-buffer'

const decoders = {}

const decodeAudio = async (arrayBuffer) => {
  const u8buf = new Uint8Array(arrayBuffer)
  const type = audioType(u8buf)
  let decode = await loadDecoder(type)

  console.time('decode')
  let data = await decode(arrayBuffer)
  console.timeEnd('decode')

  return data
}

const loadDecoder = async (type) => {
  if (decoders[type]) return decoders[type]

  let decoder
  switch (type) {
    // TODO: wav, webm
    case 'mp3':
      let { MPEGDecoder } = await importDecoder('mp3')
      decoder = new MPEGDecoder()
      break;
    case 'ogg':
    case 'oga':
      let { OGGDecoder } = await importDecoder('ogg')
      decoder = new OGGDecoder()
      break;
    case 'flac':
      let { FLACDecoder } = await importDecoder('flac')
      decoder = new FLACDecoder()
      break;
    case 'opus':
      let { OpusDecoder } = await importDecoder('opus')
      decoder = new OpusDecoder()
      break;
    default:
      throw Error(type ? 'Unsupported codec ' + type : 'Unknown codec')
  }
  // compile decoder
  await decoder.ready;

  // cache
  return decoders[type] = async (buf) => {
    let {channelData, sampleRate,...x} = await decoder.decode(buf)

    let audioBuffer = new AudioBuffer({
      sampleRate,
      length: channelData[0].length,
      numberOfChannels: channelData.length
    })
    for (let ch = 0; ch < channelData.length; ch++) audioBuffer.getChannelData(ch).set(channelData[ch])

    return audioBuffer
  }
}

// we need this function to bypass esbuild path rewrite, since decoders are bundled separately
const importDecoder = (type) => {
  console.time('load decoder ' + type)
  let module = import('./decoder/' + type + '.js')
  console.timeEnd('load decoder ' + type)
  return module
}

export default decodeAudio;