// audio decoders
import audioType from 'audio-type'

const decoders = {}

const decode = async (arrayBuffer) => {
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

  console.time('load decoder ' + type)

  let decode
  if (type === 'mp3') {
    let { MPEGDecoder } = await importDecoder('mp3')
    let decoder = new MPEGDecoder()
    await decoder.ready
    decode = (buf) => decoder.decode(buf)
  }
  else if (type === 'oga') {
    let ogg = await importDecoder('ogg')
    decode = ogg.default
  }

  // TODO: add opus, flac etc
  console.timeEnd('load decoder ' + type)

  if (!decode) throw Error(type ? 'Unsupported codec ' + type : 'Unknown codec')

  return decoders[type] = decode
}

// we need this function to mute esbuild
const importDecoder = (type) => import('./decoder/' + type + '.js')

export default decode;