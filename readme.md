# wavearea [![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

Edit waveform/audio/other data in textarea.

[![wavearea](https://raw.githubusercontent.com/dfcreative/wavearea/gh-pages/preview.png "wavearea")](http://dfcreative.github.io/wavearea/)


## Usage

[![npm install wavearea](https://nodei.co/npm/wavearea.png?mini=true)](https://npmjs.org/package/wavearea/)

```js
const Wavearea = require('wavearea');
const autosize = require('autosize');

let inputEl = document.body.appendChild(document.createElement('textarea'));

autosize(inputEl);
let wavearea = Wavearea(inputEl, data);

wavearea.push(newData);
wavearea.set(data);
```

## API

<details><summary>**`const Wavearea = require('wavearea');`**</summary>

Get wave area constructor.

</details>
<details><summary>**`let wavearea = new Wavearea(textarea, options?);`**</summary>

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

</details>


## Related

> [wavefont](https://github.com/audio-lab/wavefont) — typeface for rendering data.<br/>
> [gl-waveform](https://github.com/audio-lab/gl-waveform) — wavearea used to paint waveform color based of spectral contents.<br/>
