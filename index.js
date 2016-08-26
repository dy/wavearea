/**
 * @module  wavearea
 *
 * Edit audio data in textarea
 */
'use strict';

const isPlainObj = require('is-plain-obj');
const fromAmp = require('../wavefont');
const css = require('insert-styles');
const urify = require('urify');
const extend = require('just-extend');


module.exports = Wavearea;

//TODO: if user wants to reuse font... Ideally - provide font by requiring it...
const fontUri = urify(require.resolve('wavefont/font/wavefont-bars-reflected-400.otf'));

css(`
	@font-face {
		src: url(${fontUri});
		font-family: wavearea;
	}

	.wavearea {
		font-family: wavearea;
		text-rendering: optimizeSpeed;
		-webkit-font-smoothing: none;
		-moz-osx-font-smoothing: unset;
		font-smoothing: none;
		font-smooth: never;
		min-width: 40rem;
		letter-spacing: 2px;
		font-size: 64px;
	}
`, {id: 'wavearea'});

//@constructor
function Wavearea (el, options) {
	if (!(this instanceof Wavearea)) return new Wavearea(el, options);


	if (arguments.length === 1) {
		if (isPlainObj(el)) {
			options = el;
		}
		else {
			options = {samples: el};
		}
		el = document.createElement('textarea');
	}

	extend(this, options);

	if (!this.element) this.element = el;
	this.element.classList.add('wavearea');


	this.set(this.samples);
}

Wavearea.prototype.samples;
Wavearea.prototype.group = 64;
Wavearea.prototype.reduce = (prev, curr) => Math.max(prev, curr);
Wavearea.prototype.style = 'bars';
Wavearea.prototype.reflected = true;


Wavearea.prototype.set = function (data) {
	let str = ``;
	data.forEach(v => {
		str += fromAmp(v);
	});

	this.element.value = str;
}



