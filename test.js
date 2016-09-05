'use strict';

require('../enable-mobile');


const Wavearea = require('./');
const AppAudio = require('../app-audio');
const css = require('insert-styles');
const WAAStream = require('web-audio-stream/readable');
const Panel = require('settings-panel');
const fps = require('fps-indicator')();
const isMobile = require('is-mobile')();

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
		font-family: Roboto;
		font-size: .8rem;
		background: linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 120%);
	}

	.fps {
		font-size: .8rem;
		top: 0;
		bottom: 0;
		margin-top: 1rem;
		margin-right: 1rem;
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
	log: true,
	minDecibels: -40,
	fontRatio: isMobile ? 1.05 : 1,
	rows: isMobile ? 4 : 7
	// samples: data
});

// setTimeout(() => {
// 	wavearea.push(data);
// }, 1000)

//create audio source
let audio = new AppAudio({
	source: isMobile ? './sample.mp3' : 'https://soundcloud.com/deep-house-london/ellie-cocks-dhl-mix-104'
	// source: 'https://soundcloud.com/danyarmaros/dany-armaros-wanderer-original-mix'
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

	// cols: {
	// 	type: 'range',
	// 	label: 'Cols',
	// 	value: wavearea.cols,
	// 	step: 1,
	// 	min: 100,
	// 	max: 2000,
	// 	change: v => wavearea.update({ cols: v })
	// },

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
	title: '<a href="https://github.com/audio-lab/wavearea">Wavearea</a>',
	css: `
	:host {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		width: 100%;
		font-size: .8rem;
		background: linear-gradient(to top, rgba(255,255,255,1) 20%, rgba(255,255,255,0) 140%);
	}
	.settings-panel-title {
		display: inline-block;
		vertical-align: middle;
		margin-top: -2px;
		margin-right: 1.5em;
		font-size: .9rem;
	}
	.settings-panel-field {
		width: auto;
		vertical-align: middle;
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


