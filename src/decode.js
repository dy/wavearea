// audio decoders
import audioType from 'audio-type'
import AudioBuffer from 'audio-buffer'

const decoders = {}

const decodeAudio = async (arrayBuffer) => {
  const type = audioType(arrayBuffer)
  let decode = await loadDecoder(type)

  let data = await decode(arrayBuffer)

  return data
}

const loadDecoder = async (type) => {
  if (decoders[type]) return decoders[type]

  let decoder
  switch (type) {
    // TODO: wav, webm, aiff, aac, vob, voc, m4a
    case 'mp3':
      let { MPEGDecoder } = await importDecoder('mp3')
      decoder = new MPEGDecoder()
      break;
    case 'ogg':
    case 'oga':
      let { OggVorbisDecoder } = await importDecoder('ogg')
      decoder = new OggVorbisDecoder()
      break;
    case 'flac':
      let { FLACDecoder } = await importDecoder('flac')
      decoder = new FLACDecoder().decodeFile
      break;
    case 'opus':
      let { OpusDecoder } = await importDecoder('opus')
      decoder = new OpusDecoder().decode
      break;
    case 'wav':
      let { wav } = await importDecoder('wav')
      decoder = wav;
      break;
    default:
      throw Error(type ? 'Unsupported codec ' + type : 'Unknown codec')
  }
  // compile decoder
  await decoder.ready;

  // cache
  return decoders[type] = async (buf) => {
    console.time('decode')
    let {channelData, sampleRate, ...rest} = decoder.decodeFile ? await decoder.decodeFile(new Uint8Array(buf)) : (await decoder.decode(new Uint8Array(buf)))
    console.timeEnd('decode')

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