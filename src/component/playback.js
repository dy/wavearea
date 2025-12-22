class PlayButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._playing = false;
    this.tabIndex = -1;
  }

  connectedCallback() {
    this._playing = this.hasAttribute('playing');
    this.render();
    this.setupEventListeners();
  }

  static get observedAttributes() {
    return ['playing', 'tabindex'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'playing') {
      this._playing = newValue !== null;
      this.updateDisplay();
    }
  }

  get playing() {
    return this._playing;
  }

  set playing(value) {
    if (value) {
      this.setAttribute('playing', '');
    } else {
      this.removeAttribute('playing');
    }
  }

  render() {
    const tabindex = this.getAttribute('tabindex') || '0';

    this.shadowRoot.innerHTML = `
      <span class="w-play-clickarea"></span>
      <svg id="play-icon" xmlns="http://www.w3.org/2000/svg"
            height="24px" viewBox="0 0 24 24" width="24px" fill="#000000">
        <path d="M0 0h24v24H0V0z" fill="none" />
        <path d="M8 5v14l11-7L8 5z" />
      </svg>
      <svg id="pause-icon" xmlns="http://www.w3.org/2000/svg"
            height="24px" viewBox="0 0 24 24" width="24px" fill="#000000">
        <path d="M0 0h24v24H0V0z" fill="none" />
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
      </svg>
    `;

    this.updateDisplay();
  }

  updateDisplay() {
    const playIcon = this.shadowRoot.getElementById('play-icon');
    const pauseIcon = this.shadowRoot.getElementById('pause-icon');

    if (playIcon && pauseIcon) {
      playIcon.hidden = this._playing;
      pauseIcon.hidden = !this._playing;
    }
  }

  setupEventListeners() {
    const button = this.shadowRoot.querySelector('button');
    button.addEventListener('click', () => {
      this.toggle();
    });
  }

  toggle() {
    this.playing = !this._playing;
    this.dispatchEvent(new CustomEvent('toggle', {
      detail: { playing: this._playing },
      bubbles: true,
      composed: true
    }));
  }
}

customElements.define('play-button', PlayButton);

// Usage example:
// <play-button></play-button>
// <play-button playing></play-button>
//
// Listen for toggle events:
// document.querySelector('play-button').addEventListener('toggle', (e) => {
//   console.log('Playing:', e.detail.playing);
// });
