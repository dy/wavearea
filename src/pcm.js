// Extract sample window from chunked PCM arrays
export function extractWindow(chunks, totalSamples, channelCount, fromSample, toSample) {
  if (!chunks.length || !chunks[0].length) return null
  if (toSample == null || toSample > totalSamples) toSample = totalSamples
  if (fromSample >= toSample) return null

  let len = toSample - fromSample
  let result = Array.from({ length: channelCount }, () => new Float32Array(len))

  for (let ch = 0; ch < channelCount; ch++) {
    let pos = 0
    for (let chunk of chunks[ch]) {
      let chunkEnd = pos + chunk.length
      if (chunkEnd > fromSample && pos < toSample) {
        let srcStart = Math.max(0, fromSample - pos)
        let srcEnd = Math.min(chunk.length, toSample - pos)
        let dstStart = Math.max(0, pos + srcStart - fromSample)
        result[ch].set(chunk.subarray(srcStart, srcEnd), dstStart)
      }
      pos = chunkEnd
    }
  }

  return result
}
