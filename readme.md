# wavearea [![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

Editable audio in textarea or .

[![wavearea](https://raw.githubusercontent.com/audio-lab/wavearea/gh-pages/preview.png "wavearea")](http://audio-lab.github.io/wavearea/)


## Usage

[![npm install wavearea](https://nodei.co/npm/wavearea.png?mini=true)](https://npmjs.org/package/wavearea/)

```js
import Wavearea from 'wavearea';

let inputEl = document.body.appendChild(document.createElement('textarea'));

let wavearea = new Wavearea(inputEl, options);

wavearea.push(newData);
wavearea.set(data);
```

## API

### const Wavearea = require('wavearea');

Get wave area constructor.


### let wavearea = new Wavearea(textarea, options?);

Create waveform editor instance based off options:

```js
//sample values
samples: data,

//number of samples per bar
group: 64,

//mode of forming bar from bar samples - might be used to show log mapping etc
reduce: (prev, curr) => Math.max(prev, curr),

//bars or dots
style: 'bars',

//show reflection of data
reflected: false
```


## Related

> [wavefont](https://github.com/audio-lab/wavefont) — typeface for rendering data.<br/>
> [gl-waveform](https://github.com/audio-lab/gl-waveform) — wavearea used to paint waveform color based of spectral contents.<br/>
