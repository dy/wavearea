# ▸ wavearea

Waveform player with simple editing and transforms: trim, delete, mute, normalize, split.
Provides minimal ergonomic means to open, edit and save audio pieces.
Perfect for speech fragments editing.

[Demo](https://dy.github.io/wavearea).

Based on [wavefont](https://github.com/dy/wavefont) and [sprae](https://github.com/dy/sprae).

## Operations

All operations on audio are reflected in URL as:

```
?src=path/to/audio&clip=300-400&br=100...200...300&del=0-10...10-20&mute=10-20&...
```

Operations are applied to source in turn.
Supported operations are (measured in blocks, each block is 1024 samples wide):

* `src=path/to/audio` – load source file by URL. Can be wav, mp3 or ogg, or any other format supported by browser.
* `norm` – normalize audio - make sure max volume is 1. <!-- TODO: normalize to indicated db value -->
* `clip=offset-to` – slice audio to indicated range.
* `br=offset..offset..offset...` – break audio by segments at indicated points.
* `del=offset-len..offset-len..offset-len...` – delete fragments of audio at `offset`s of length `len`.
* `mute=offset-len..offset-len..offset-len...` – insert silence at indicated points.
<!-- * `fadein=start-duration`, `fadeout=start-duration` -->


<p align=center><a href="https://github.com/krishnized/license/">🕉</a></p>
