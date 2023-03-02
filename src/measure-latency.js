let mediaElement = new Audio('data:audio/wav;base64,UklGRmgAAABXQVZFZm10IBAAAAABAAEAgLsAAAB3AQACABAAZGF0YQIAAABpNUxJU1Q6AAAASU5GT0lTRlQUAAAAcHJvYmUuYXVkaW90b29sLmNvbQBJQ1JEEQAAADIwMjMtMDMtMDIgMDctNDQAAA==')
mediaElement.preload = "metadata"
mediaElement.load()
mediaElement.volume = 0

// Measure latency of audio file between first 'playing' event and actual first sample
export async function measureLatency() {
  return new Promise(ok => {
    mediaElement.play()
    let start
    mediaElement.onplaying = () => start = performance.now()
    mediaElement.onended = () => {
      ok(performance.now() - start)
    }
  })
}