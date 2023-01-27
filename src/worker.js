import decode from './decode.js'


async function init(src) {
  console.time('fetch ' + src)
  let resp = await fetch(src);
  if (!resp.ok) throw new Error(`HTTP error: status=${resp.status}`);
  let arrayBuffer = await resp.arrayBuffer();
  console.timeEnd('fetch ' + src)

  // FIXME: measure real browser decoder, mb that's faster
  let {channelData, sampleRate} = await decode(arrayBuffer);

  let wavBuffer = await encodeAudio(sampleRate, channelData);
  let blob = new Blob([wavBuffer], {type:'audio/wav'});
  let url = URL.createObjectURL( blob );

  self.postMessage(url)
}
init('https://upload.wikimedia.org/wikipedia/commons/c/cf/Caja_de_m%C3%BAsica_%28PianoConcerto5_Beethoven%29.ogg')


// ops worker
self.onmessage = msg => {
  // console.log("message from main received in worker:", msg);
  // send buf back to main and transfer the underlying ArrayBuffer
  // self.postMessage(bufTransferredFromMain, bufTransferredFromMain);
};



// convert planar channel tuples [[l,r],[l,r]] to wav array buffer
export async function encodeAudio (sampleRate, ...chunks) {
  console.time('wav encode')
  // extracted parts of node-wav for seamless integration with audio chunks float32
  let bitDepth = 32
  let channels = chunks[0].length;
  let length = 0;
  for (let channelData of chunks) length += channelData[0].length;
  let buffer = new ArrayBuffer(44 + length * channels * (bitDepth >> 3));
  let v = new DataView(buffer);
  let pos = 0;
  const u8 = (x) => v.setUint8(pos++, x);
  const u16 = (x) => (v.setUint16(pos, x, true), pos += 2)
  const u32 = (x) => (v.setUint32(pos, x, true), pos += 4)
  const string = (s) => { for (var i = 0; i < s.length; ++i) u8(s.charCodeAt(i));}
  string("RIFF");
  u32(buffer.byteLength - 8);
  string("WAVE");
  string("fmt ");
  u32(16);
  u16(3); // float
  u16(channels);
  u32(sampleRate);
  u32(sampleRate * channels * (bitDepth >> 3));
  u16(channels * (bitDepth >> 3));
  u16(bitDepth);
  string("data");
  u32(buffer.byteLength - 44);

  // FIXME: can just copy data for mono case (way faster)
  // FIXME: should we instead to just directly work with wav buffer instead of audio chunks?
  let output = new Float32Array(buffer, pos);
  for (let channelData of chunks) {
    let channels = channelData.length, length = channelData[0].length
    for (let i = 0; i < length; ++i)
      for (let ch = 0; ch < channels; ++ch) output[pos++] = channelData[ch][i];
  }

  console.timeEnd('wav encode')
  return buffer;
}