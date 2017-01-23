/**
 * @module  wavearea
 *
 * Edit audio data in textarea
 */
'use strict';

const isPlainObj = require('is-plain-obj');
const fromAmp = require('wavefont');
const css = require('insert-styles');
const urify = require('urify');
const extend = require('just-extend');
const sliced = require('sliced');
const caret = require('caret-position2');
const raf = require('raf');
const db = require('decibels');
// const Audio = require('audio');


module.exports = Wavearea;

//TODO: if user wants to reuse font... Ideally - provide font by requiring it...
const fontUri = urify(require.resolve('../wavefont/font/wavefont-bars-reflected-200.otf'));

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
		min-width: 0;
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


	window.addEventListener('resize', () => {
		this.recalcCols().renderBars();
	});

	// this.audio = Audio(options.source);

	this.samples = Array(44100*60).fill(0);
	this.last = 0;
	this.bars = [];
	this.string = '';

	this.update(options);
}

Wavearea.prototype.samples;
Wavearea.prototype.barSize = 64;
Wavearea.prototype.reduceMax = (prev, curr, idx, all) => {
	return Math.max(Math.abs(prev), Math.abs(curr));
};
Wavearea.prototype.reduceAverage = (prev, curr, idx, all) => {
	return prev + curr / all.length
};
Wavearea.prototype.style = 'bars';
Wavearea.prototype.reflected = true;
Wavearea.prototype.cols = 800;
Wavearea.prototype.rows = 7;
Wavearea.prototype.log = false;
Wavearea.prototype.maxDecibels = 0;
Wavearea.prototype.minDecibels = -60;

//font ratio
Wavearea.prototype.fontRatio = 1;

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

	// let group = this.barSize;

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


//recalculate bars for the range (in samples)
Wavearea.prototype.recalcBars = function (start, end) {
	if (start == null) start = 0;
	if (end == null) end = this.last;

	start = Math.max(start, 0);

	let group = this.barSize;
	start = start - (start % group);
	end = end - (end % group);

	if (start >= end) return this;

	//collect grouped data for bars
	let offset = 0, str = '';
	for (offset = start; offset < end; offset+=group) {
		let bar = offset/group;
		let max = this.samples.slice(offset, offset+group).reduce(this.reduceMax, 0);
		let avg = this.samples.slice(offset, offset+group).reduce(this.reduceAverage, 0);
		let diff = max - Math.abs(avg);

		//for small scales diff is small and result → avg
		//for large scales diff is big and result → max
		this.bars[bar] = max * diff + avg * (1 - diff);

		if (this.log) {
			let amp = this.bars[bar];
			let v = db.fromGain(Math.abs(amp));
			v = Math.max(Math.min(v, this.maxDecibels), this.minDecibels);
			v = (v - this.minDecibels) / (this.maxDecibels - this.minDecibels);
			if (amp < 0) v = -v;
			this.bars[bar] = v;
		};

		str += fromAmp(this.bars[bar]);
	}

	this.string = this.string.slice(0, start/group) + str + this.string.slice(end/group);

	this.renderBars();

	return this;
}

//put string to textarea from cached string
Wavearea.prototype.renderBars = function () {
	//ignore planned raf
	if (this.planned) return this;

	this.planned = true;

	raf(() => {
		this.planned = false;

		let lines = Math.ceil(this.string.length / this.cols);
		let skipped = Math.max(lines - this.rows, 0);
		let str = '';
		for (let lineOffset = skipped * this.cols; lineOffset < (skipped + this.rows)*this.cols; lineOffset+=this.cols) {
			str += this.string.slice(lineOffset, lineOffset + this.cols) + '\n';
		}

		this.element.textContent = str.trim();

		// caret.set(this.element, this.bars.length);
		this.element.scrollTop = this.element.scrollHeight;
	});

	return this;
}


//calculate size of cols based off fontRatio
Wavearea.prototype.recalcCols = function () {
	let s = window.getComputedStyle(this.element);
	let pl = parseInt(s.paddingLeft) || 0;
	let pr = parseInt(s.paddingRight) || 0;
	this.cols = (this.element.offsetWidth - pl - pr) / this.fontRatio;

	return this;
}

//update everything, quite slow
Wavearea.prototype.update = function (opts) {
	extend(this, opts);

	this.recalcCols();

	this.string = '';
	this.recalcBars(Math.max(0, this.last - this.cols * (this.rows + .1) * this.barSize ), this.last);

	return this;
}


