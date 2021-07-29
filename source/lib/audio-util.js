/**
 * Return sliced buffer
 */
export function slice (buffer, start, end) {
  start = start == null ? 0 : start;
  end = end == null ? buffer.length : end;

  var data = [];
  for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
    data.push(buffer.getChannelData(channel).subarray(start, end));
  }

  return create(buffer.sampleRate, data)
}

export function remove (buffer, start, end) {
  start = start == null ? 0 : start;
  end = end == null ? buffer.length : end;

  var data = [], arr;
  for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
    data.push(arr = new Float32Array(start + buffer.length - end))
    var channelData = buffer.getChannelData(channel)
    arr.set(channelData.subarray(0, start), 0);
    arr.set(channelData.subarray(end), start);
  }

  return create(buffer.sampleRate, data)
}


export function create (sampleRate, data) {
  let newBuffer = new AudioBuffer({
    length: data[0].length,
    numberOfChannels: data.length,
    sampleRate
  });

  for (var channel = 0; channel < newBuffer.numberOfChannels; channel++) {
    newBuffer.copyToChannel(data[channel], channel, 0)
  }

  return newBuffer
}
