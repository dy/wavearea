'use strict';

require('enable-mobile');
const Wavearea = require('./');
const AppAudio = require('../app-audio');
const css = require('insert-styles');
const WAAStream = require('web-audio-stream/readable');
const Panel = require('settings-panel');
const fps = require('fps-indicator')();

css(`
	* {
		box-sizing: border-box;
	}
	.wavearea {
		display: block;
		width: 100%;
		height: 100vh;
		border: 0;
		margin: 0;
		padding-top: 1em;
		outline: none;
		padding-left: 1rem;
		padding-right: 1rem;
		overflow-x: hidden;
		overflow: hidden;
	}
	.app-audio {
		background: linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 120%);
	}

	.fps {
		top: auto!important;
		bottom: 0;
		margin-bottom: 1.75em;
		margin-right: 1em;
	}
`);




//get data
let data = new Float32Array(1e4);
for (let i = 0; i < 1e4; i++) {
	data[i] = (Math.sin(Math.PI * 2 * 440 * i / 44100));
}

//create editor
let textarea = document.body.appendChild(document.createElement('textarea'));
let wavearea = Wavearea(textarea, {
	// samples: data
});

// setTimeout(() => {
// 	wavearea.push(data);
// }, 1000)

//create audio source
let audio = new AppAudio({
	source: 'https://soundcloud.com/grrreat-recordings/sets/grrreat-night'
	// source: 'https://soundcloud.com/rafa-pineda/sets/rafa-pineda-mixes',
	// soundcloud: false
}).on('ready', (node) => {
	WAAStream(node).on('data', (chunk) => {
		let data = chunk.getChannelData(0);
		if (!data[0]) return;
		wavearea.push(data);
	});
});



//create settings
let panel = Panel({
	group: {
		type: 'range',
		label: 'Bar size',
		value: 256,
		log: true,
		precision: 0,
		// step: 1,
		min: 1, max: Math.pow(2, 16),
		change: v => {
			wavearea.update({
				barSize: Math.round(v)
			});
		}
	},
	// size: {
	// 	type: 'range',
	// 	label: 'Max bars',
	// 	value: wavearea.maxBars,
	// 	step: 1,
	// 	min: Math.pow(2, 4),
	// 	max: Math.pow(2, 13),
	// 	change: v => wavearea.update({ maxBars: v })
	// }

	cols: {
		type: 'range',
		label: 'Cols',
		value: wavearea.cols,
		step: 1,
		min: 100,
		max: 2000,
		change: v => wavearea.update({ cols: v })
	},

	rows: {
		type: 'range',
		label: 'Rows',
		value: wavearea.rows,
		step: 1,
		min: 1,
		max: 10,
		change: v => wavearea.update({ rows: v })
	}
}, {
	theme: require('settings-panel/theme/flat'),
	palette: ['black', 'white'],
	css: `
	:host {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		width: 100%;
		background: linear-gradient(to top, rgba(255,255,255,1) 20%, rgba(255,255,255,0) 140%);
	}
	.settings-panel-field {
		width: auto;
		display: inline-block;
	}
	.settings-panel-label {
		width: auto!important;
	}
	.settings-panel-value {
		width: 4em!important;
	}
	.settings-panel-range {
		max-width: 8em;
	}
	`
});

