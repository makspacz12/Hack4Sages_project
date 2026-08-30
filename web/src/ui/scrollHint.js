/**
 * Marking the boundary of a scroll region.
 *
 * Both side panels hold more than fits: at a 1280x800 projector the run console
 * hides roughly 700px of parameters below the fold and the analysis dock hides
 * about 1400px. A scrolling region whose content is simply cut at the edge does
 * not read as "there is more" - it reads as a rendering fault, and in a talk
 * nobody scrolls a panel they believe is broken. That is how a group heading
 * ends up half-visible with the audience assuming the panel failed to draw.
 *
 * The fix is the smallest honest one: a short fade at the edge that appears
 * only while content is genuinely hidden, and clears the moment the reader
 * reaches the end. A fade painted permanently stops carrying information and
 * just dims the last row.
 *
 * The scrollbar is left visible and merely thinned. Hiding it would remove the
 * other affordance a reader already knows how to use.
 */

/** Two pixels of slack. Fractional scroll offsets at fractional device pixel
 *  ratios otherwise leave the hint stuck on at the very bottom. */
const EPSILON = 2;

/**
 * Attach a bottom fade to a scrolling element.
 *
 * `wrap` must be the positioned ancestor that carries the fade element; the
 * caller owns the markup so each panel keeps its own styling. Returns the
 * update function, so a caller that re-renders its content can refresh the hint
 * without waiting for a scroll or resize event.
 */
export function attachScrollHint(scroller, wrap, fadeClass = 'has-more') {
  if (!scroller || !wrap) return () => {};

  const update = () => {
    const hidden = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    wrap.classList.toggle(fadeClass, hidden > EPSILON);
  };

  scroller.addEventListener('scroll', update, { passive: true });
  // Content changing height matters as much as scrolling: the dock grows a
  // chart when a fragment is selected, which can turn a fitting panel into a
  // scrolling one without any scroll event ever firing.
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(update);
    ro.observe(scroller);
    if (scroller.firstElementChild) ro.observe(scroller.firstElementChild);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('lp:uiscale', update);
  }
  update();
  return update;
}
