import * as Comlink from 'comlink';

class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    Comlink.expose({
      setParameter: (value) => {
        this.parameter = value;
      },
      getState: () => {
        return { parameter: this.parameter };
      }
    }, this.port);
  }

  process(inputs, outputs, parameters) {
    // Your audio processing logic
    return true;
  }
}

registerProcessor('playback', PlaybackProcessor);
