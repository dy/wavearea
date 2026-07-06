// Engine worker entry — the whole audio library (decode, PCM pages, stats,
// edits) runs here; the main thread holds only the audio/worker facade.
// Extra codecs/plugins must be imported before the host wires the message loop.
import 'audio/worker-host'
