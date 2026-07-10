# Wavefont Browser Quirks

Font: wavefont 3.6+ npm package — `src/wavearea.js` imports `wavefont/fonts/variable/Wavefont[ROND,YELA,wght].woff2` (esbuild file loader emits the hashed woff2 into dist) and registers it via the FontFace API (`display: block`). No checked-in font copy.
Axes: `wght` 4–1000 (user-space; internal advance = wght/4 per mille), `ROND` 0–100, `YELA` -100/0/100 = bottom/center/top.
Caret span -30..130 (3.6+) — `--wavefont-lh` uses ratio 1.6 (minimal non-overlapping selection).

## Character Width
- Waveform chars: U+0100–U+017F (128 levels), generated in `src/waveform.js` from per-block min/max stats
- Value 128+ maps to U+0180+ — encoder clamps to 127 (LEVELS-1); font 3.6+ renders U+0180 as max bar (guard), higher blank
- `--wavefont-wght: 100` ≙ 25/1000 em advance ≈ 1.25px at 50px font-size (extremely narrow)
- `1ch` CSS unit does NOT match actual wavefont char width — `main.css` max-width uses `1ch` with a `0.5ch` rounding fix; `countCols` measures real char width from DOM
- Configurable via `--wavefont-size`, `--wavefont-spacing` CSS custom properties on `#wavearea`

## Combining Marks (vertical shift)
- Bars are center-aligned (`'YELA' 0`, tag renamed from `YALN` in wavefont 3.4+); marks shift a bar off the midline
- `́` +1 step, `̂` +10; `̀` −1, `̌` −10
- CANONICAL ORDER REQUIRED: 10-step marks first, then 1-step. The font's GPOS rules
  recognize runs of same 1-step marks only up to 10 — `'́'.repeat(64)` renders as +10, not +64.
  Max shift ±100. `statsToWavefont` emits canonical form (max |shift| here is 64 → ≤ 15 marks/char)
- Marks have 0 width — must be skipped in all offset/measurement logic
- `isBlock()` in `src/selection.js` is the single definition: block = U+0100–U+02FF; `cleanText()` strips everything else (marks, `\n`)
- `countCols()` in `src/wavearea.js` skips them via `str[i] < '̀'` check
- Pure sine wave produces chars WITHOUT combining marks (symmetric → shift 0)

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
