/**
 *
 * @param {HTMLMediaElement} media - An audio/video/etc element
 * @param {object} clip - Object with `{start, end?}` signature, indicating clip to play
 * @returns
 */
export default function playClip (media, clip) {
  if (!clip) {
    media.play()
    return () => media.pause()
  }

  clip.start ||= 0;
  media.currentTime = clip.start;

  let timeInterval

  const toSeekableRange = () => {
    if (media.readyState === 0) return;

    // Setting preload to `none` from `auto` was required on iOS to fix a bug
    // that caused no `timeupdate` events to fire after seeking ¯\_(ツ)_/¯
    const wasAuto = media.preload === 'auto';
    if (wasAuto) media.preload = 'none';

    if (media.currentTime < 0) media.currentTime = 0;
    if (media.currentTime > clip.end) media.currentTime = clip.end;

    if (wasAuto) media.preload = 'auto';
  }

  const onTimeupdate = () => {
    clearInterval(timeInterval);

    if (media.currentTime >= clip.end) { // ended
      if (media.loop) { media.currentTime = clip.start; return; }
      media.pause();
      media.dispatchEvent(new Event('ended'));
      return;
    }

    // When the playhead is 200ms or less from the end check every 4ms (~512 samples)
    // for increased accuracy. timeupdate is only fired every ~150ms or so.
    if (media.currentTime + .2 > clip.end) timeInterval = setInterval(onTimeupdate, 10);
  }

  const onPlaying = () => {
    if (media.currentTime >= clip.end) media.currentTime = clip.start;
  }

  media.addEventListener('durationchange', toSeekableRange);
  media.addEventListener('seeking', toSeekableRange);
  if (clip.end) media.addEventListener('timeupdate', onTimeupdate);
  media.addEventListener('playing', onPlaying);

  media.play()

  return () => {
    media.removeEventListener('durationchange', toSeekableRange);
    media.removeEventListener('seeking', toSeekableRange);
    media.removeEventListener('timeupdate', onTimeupdate);
    media.removeEventListener('playing', onPlaying);

    media.pause()
  }
}