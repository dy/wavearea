# waveplay ▸

Waveform player with simple editing and transforms.
Based on [wavefont](https://github.com/dy/wavefont).

## Features

* [x] Playback
* [x] Load file from `?src=url` param
* [x] Delete fragments
* [x] Download edited wave
* [x] Insert silence
* [ ] Timecodes
* [ ] Line breaks
* [ ] Insert fragments
* [ ] Persist edited file
* [ ] Custom player
* [ ] Undo / redo

## Operations

All operations on audio are stored in URL / browser history as:

```
?src=path/to/audio&sub=300:400&br=100,200,300&del=0:10,10:20&sil=10:20&...
```

Operations are applied to source in turn.
Supported operations are (measured in blocks, each block is 1024 samples wide):

* `src=path/to/audio` – load source file by URL. Can be wav, mp3 or ogg, or any other format supported by browser.
* `cut=offset:count` – slice audio to indicated range.
* `br=offset,offset,...` – break audio by segments at indicated points.
* `del=offset:len,offset:len,...` – delete fragments of audio at `offset`s of length `len`.
* `mut=offset:len,offset:len,...` – insert silence at indicated points.


<p align=center><a href="https://github.com/krishnized/license/">🕉</a></p>
