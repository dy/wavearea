// playback
t('play unfocused, from the beginning')
t('play from some caret position')
t('play from caret at the end')
t('play selection: must recover selection')
t('play should stop perfectly when end is met')

t('reposition caret during playback')
t('select range during playback')

// rerendering
t('waveform rerender is always identical to edited operations')

// operations

// delete 1 segment
t('delete: by backspace at the start (no delete happens)')
t('delete: by backspace till the start')
t('delete: by backspace in the middle, 1 block')
t('delete: by backspace in the middle, some blocks')
t('delete: middle selection')
t('delete: head selection')
t('delete: tail selection')
t('delete: processing must disable interactions')
t('delete: all')

// delete 2nd segment
t('^ all delete tests')
t('delete segment: span from 1st to second')
t('delete from the tail of prev segment (must preserve line break)')

t('silence: 1 block in the middle')
t('silence: N blocks in the middle')
t('silence: 1 block in the beginning of segment')
t('silence: N blocks in the beginning of segment')
t('silence: 1 block in the end of segment')
t('silence: N blocks in the end of segment')

t('add part of itself')
t('add another source')

t('record, stop, play')
t('record-append in the end')
t('record-insert in the middle')
t('record-replace in the middle')

