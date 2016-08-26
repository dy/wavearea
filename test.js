'use strict';

require('enable-mobile');
const Wavearea = require('./');
const AppAudio = require('../app-audio');
const css = require('insert-styles');


css(`
	* {
		box-sizing: border-box;
	}
	.wavearea {
		display: block;
		width: 100%;
		height: 100vh;
		overflow-x: hidden;
		border: 0;
		margin: 0;
		padding-top: 1em;
		outline: none;
	}
	.app-audio {
		background: linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 120%);
	}
`);

//create audio source
let audio = new AppAudio({

}).on();


//get data
let data = [];
for (let i = 0; i < 1e5; i++) {
	data.push(Math.sin(Math.PI * 2 * 440 * i / 44100));
}

//create editor
let textarea = document.body.appendChild(document.createElement('textarea'));
let wavearea = Wavearea(textarea, {
	samples: data
});
