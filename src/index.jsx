import Wavearea from './components/wavearea';
import { render } from 'preact';

// attach DOM
// FIXME: make a webcomponent one day
render(<Wavearea />, document.querySelector('#wavearea'));
