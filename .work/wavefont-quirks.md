# Wavefont Browser Quirks

## Character Width
- Waveform chars: U+0100–U+0180 (128 levels), generated in `src/worker.js`
- Extremely narrow at default settings (~1.3px at 50px font-size)
- `1ch` CSS unit does NOT match actual wavefont char width — `main.css` max-width uses `1ch` with a `0.5ch` rounding fix
- Configurable via `--wavefont-size`, `--wavefont-spacing` CSS custom properties on `#wavearea`

## Combining Marks
- `\u0300` (grave) and `\u0301` (acute) encode vertical offset (shift up/down)
- Have 0 width — must be skipped in all offset/measurement logic
- `cleanText()` in `src/selection.js` strips them: `str.replace(/[\u0300\u0301]/g, '')`
- `cleanOffset()` / `cleanToRaw()` in `src/selection.js` convert between raw DOM offsets and clean offsets
- `countCols()` in `src/wavearea.js` skips them via `str[i] < '\u0300'` check
- Pure sine wave produces chars WITHOUT combining marks

## Caret Placement
- Browser handles caret placement natively — no manual correction
- Code uses `getClientRects()` on selection range for caret coordinates (NOT `caretRangeFromPoint()`)
- `caretX = rect.right`, `caretY = rect.top` from last client rect

## Text Selection
- Native drag-to-select fails in headless Playwright on narrow wavefont chars (selection stays collapsed)
- Works in real browsers — Playwright/headless limitation
- Test workaround: set `--wavefont-spacing: 4px` before drag-select test

## Text Node Preservation
- Sprae `:text` preserves text nodes when value unchanged (signal equality check)
- `:text.throttle-raf` avoids re-firing on unrelated state changes
- throttle-raf infinite loop bug fixed in sprae 12.4.16 (installed)

## CSS
- `word-break: break-all` required on `#editarea` for wavefont text wrapping
- `max-width: calc(4 * 216 * 1ch + 0.5ch)` on `#waveform` — the 0.5ch fixes inconsistent line breaking
