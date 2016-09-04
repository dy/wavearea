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
const sliced = require('sliced');
const caret = require('caret-position2');
const raf = require('raf');
// const Audio = require('audio');


module.exports = Wavearea;

//TODO: if user wants to reuse font... Ideally - provide font by requiring it...
const fontUri = urify(require.resolve('wavefont/font/wavefont-bars-reflected-200.otf'));

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
		letter-spacing: 1px;
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

	// this.audio = Audio(options.source);

	this.samples = Array(44100*60).fill(0);
	this.last = 0;
	this.bars = [];
	this.string = '';

	this.update(options);
}

Wavearea.prototype.samples;
Wavearea.prototype.group = 64;
Wavearea.prototype.reduce = (prev, curr) => Math.max(prev, curr);
Wavearea.prototype.style = 'bars';
Wavearea.prototype.reflected = true;
Wavearea.prototype.size = 44100/64 * 5;


Wavearea.prototype.set = function (offset, samples) {
	// this.audio = Audio(samples);

	if (arguments.length === 1) {
		samples = offset;
		offset = 0;
	}

	offset = offset || 0;

	//ensure length of storage
	if (this.samples.length < samples.length + offset) {
		this.samples = this.samples.concat(Array(44100*600).fill(0));
	}

	//correct last sample pointer
	this.last = Math.max(this.last, samples.length + offset);

	//put samples to array
	for (let i = 0; i < samples.length; i++) {
		this.samples[offset + i] = samples[i];
	}

	this.recalcBars(offset, offset + samples.length);

	return this;
}


Wavearea.prototype.push = function (samples) {
	// this.audio.push(samples);

	// samples = this.tail.concat(samples);
	// this.samples = this.samples.concat(samples);

	// let group = this.group;

	// if (samples.length < group) {
	// 	this.tail = samples;
	// 	return this;
	// }

	//ensure length of storage
	if (this.samples.length < samples.length + this.last) {
		this.samples = this.samples.concat(Array(44100*60).fill(0));
	}

	//put new samples
	for (let i = 0; i<samples.length; i++) {
		this.samples[this.last + i] = samples[i];
	}

	this.last += samples.length;

	this.recalcBars(this.last - samples.length, this.last);

	return this;
}


//recalculate bars
Wavearea.prototype.recalcBars = function (start, end) {
	if (start == null) start = 0;
	if (end == null) end = this.samples.length - 1;

	let group = this.group;
	start = start - (start % group);
	end = end - (end % group);

	if (start >= end) return this;

	//collect grouped data for bars
	let offset = 0, str = '';
	for (offset = start; offset < end; offset+=group) {
		let bar = offset/group;
		this.bars[bar] = this.samples.slice(offset, offset+group).reduce(this.reduce, this.samples[offset]);
		str += fromAmp(this.bars[bar]);
	}

	this.string = this.string.slice(0, start/group) + str + this.string.slice(end/group);
	//ignore planned raf
	if (this.planned) return this;

	this.planned = true;

	raf(() => {
		this.planned = false;
		this.element.textContent = this.string.slice(-this.size);

		caret.set(this.element, this.bars.length);
		this.element.scrollTop = this.element.scrollHeight;
	});
}


Wavearea.prototype.update = function (opts) {
	extend(this, opts);
}


